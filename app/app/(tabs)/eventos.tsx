import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BookOpen, CalendarDays, ChevronRight, Search, Trophy } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { tokens } from "../../src/ui/tokens";

const arenaMasterLogo = require("../../assets/arena-master-logo.png");

type CompetitionRead = {
  id: number;
  name: string;
  reference_year: number;
  event_starts_at: string | null;
  banner_url: string | null;
  organizer_dojo_name: string | null;
  is_published?: boolean;
  event_modality: string | null;
};

type SeminarRead = {
  id: number;
  title: string;
  banner_url: string | null;
  starts_at: string | null;
  speaker_name: string | null;
  organizer_dojo_name?: string | null;
  is_published?: boolean;
};

type EventItem =
  | {
      kind: "competition";
      id: number;
      title: string;
      subtitle: string | null;
      startsAt: string | null;
      bannerUrl: string | null;
      organizer: string | null;
    }
  | {
      kind: "seminar";
      id: number;
      title: string;
      subtitle: string | null;
      startsAt: string | null;
      bannerUrl: string | null;
      organizer: null;
    };

function resolvePublicImage(url: string | null | undefined): { uri: string } | null {
  if (!url) return null;
  if (url.startsWith("http")) return { uri: url };
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  return { uri: `${base}${url.startsWith("/") ? "" : "/"}${url}` };
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default function EventosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const { data: comps, isLoading: compsLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const res = await api.get<CompetitionRead[]>("/api/competitions/");
      return res.data;
    },
  });

  const { data: seminars, isLoading: semLoading } = useQuery({
    queryKey: ["seminars"],
    queryFn: async () => {
      const res = await api.get<SeminarRead[]>("/api/seminars/");
      return res.data;
    },
  });

  const items = useMemo<EventItem[]>(() => {
    const list: EventItem[] = [];

    for (const c of comps ?? []) {
      list.push({
        kind: "competition",
        id: c.id,
        title: c.name,
        subtitle: c.event_modality ? `Competição · ${String(c.event_modality).toUpperCase()}` : "Competição",
        startsAt: c.event_starts_at ?? null,
        bannerUrl: c.banner_url ?? null,
        organizer: c.organizer_dojo_name ?? null,
      });
    }

    for (const s of seminars ?? []) {
      list.push({
        kind: "seminar",
        id: s.id,
        title: s.title,
        subtitle: s.speaker_name ? `Seminário · ${s.speaker_name}` : "Seminário",
        startsAt: s.starts_at ?? null,
        bannerUrl: s.banner_url ?? null,
        organizer: s.organizer_dojo_name ?? null,
      });
    }

    // Ordena por data (mais próximo primeiro); sem data vai pro final.
    return list.sort((a, b) => {
      const ta = a.startsAt ? new Date(a.startsAt).getTime() : Infinity;
      const tb = b.startsAt ? new Date(b.startsAt).getTime() : Infinity;
      return ta - tb;
    });
  }, [comps, seminars]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.title} ${(it.subtitle ?? "")} ${(it.organizer ?? "")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const isLoading = compsLoading || semLoading;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.lg,
          paddingBottom: tokens.space.lg,
          paddingHorizontal: tokens.space.lg,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 4,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
          alignItems: "center",
        }}
      >
        <Image
          source={arenaMasterLogo}
          style={{
            width: 260,
            height: 140,
            resizeMode: "contain",
          }}
        />
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.color.textPrimary, letterSpacing: 0.2 }}>
          Eventos
        </Text>
        <Text style={{ color: "rgba(17,24,39,0.72)", marginTop: 6, fontSize: 13, lineHeight: 18 }}>
          Competições e seminários em um só lugar.
        </Text>

        <View
          style={{
            marginTop: 14,
            backgroundColor: tokens.color.bgCard,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Search size={18} color={"rgba(255,255,255,0.72)"} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nome, palestrante ou organizador"
            placeholderTextColor={"rgba(255,255,255,0.55)"}
            style={{
              flex: 1,
              color: tokens.color.textOnPrimary,
              fontSize: 14,
              paddingVertical: 0,
            }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator color={tokens.color.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => `${it.kind}:${it.id}`}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24 + insets.bottom,
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <Text style={{ color: tokens.color.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                Nenhum evento encontrado.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const img = resolvePublicImage(item.bannerUrl);
            const dateLabel = fmtDate(item.startsAt);
            return (
              <Pressable
                onPress={() => {
                  if (item.kind === "competition") {
                    router.push({
                      pathname: "/(tabs)/competicoes",
                      params: { id: String(item.id), from: "eventos" },
                    });
                  } else {
                    router.push({
                      pathname: "/(tabs)/seminarios",
                      params: { id: String(item.id), from: "eventos" },
                    });
                  }
                }}
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: tokens.color.bgCard,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  marginBottom: 12,
                }}
              >
                {img ? (
                  <Image
                    source={img}
                    resizeMode="cover"
                    style={{ height: 110, width: "100%", backgroundColor: tokens.color.borderSubtle }}
                  />
                ) : (
                  <View style={{ height: 12, backgroundColor: tokens.color.borderSubtle }} />
                )}
                <View style={{ padding: 14, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "900", fontSize: 16, color: tokens.color.textOnPrimary }} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" as any }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <CalendarDays size={14} color={"rgba(255,255,255,0.72)"} />
                          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
                            {dateLabel ?? "Data a definir"}
                          </Text>
                        </View>
                        {item.organizer ? (
                          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
                            · {item.organizer}
                          </Text>
                        ) : null}
                      </View>
                      {item.subtitle ? (
                        <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      {item.kind === "competition" ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            backgroundColor: "rgba(184,158,93,0.12)",
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: "rgba(184,158,93,0.22)",
                          }}
                        >
                          <Trophy size={14} color={tokens.color.primary} />
                          <Text style={{ color: tokens.color.primary, fontSize: 12, fontWeight: "800" }}>
                            Competição
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            backgroundColor: "rgba(34,197,94,0.14)",
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: "rgba(34,197,94,0.28)",
                          }}
                        >
                          <BookOpen size={14} color={tokens.color.success} />
                          <Text style={{ color: tokens.color.success, fontSize: 12, fontWeight: "800" }}>
                            Seminário
                          </Text>
                        </View>
                      )}

                      <ChevronRight size={20} color={"rgba(255,255,255,0.72)"} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

