import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronLeft, X } from "lucide-react-native";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../../src/api/client";
import { tokens } from "../../../src/ui/tokens";

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
};

type CheckInRead = {
  id: number;
  turma_id: number;
  student_id: number;
  occurred_at: string;
};

type Attendee = {
  student_id: number;
  student_name: string;
  graduacao?: string | null;
  avatar_url?: string | null;
};

function resolveAvatarUri(url: string | null | undefined): { uri: string } | null {
  if (!url) return null;
  if (url.startsWith("data:")) return { uri: url };
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${base}${url.startsWith("/") ? "" : "/"}${url}` };
}

function resolveDojoLogoUri(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  if (url.startsWith("http")) {
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      return `${base}${path}`;
    }
    return url;
  }
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function TurmaCheckinsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const turmaId = id ? parseInt(id, 10) : 0;
  const turmaName = name ?? "Turma";

  const { data: dojo } = useQuery({
    queryKey: ["dojo-me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    retry: false,
  });

  const { data: checkins } = useQuery({
    queryKey: ["my-checkins"],
    queryFn: async () => {
      const res = await api.get<CheckInRead[]>("/api/check-in/my");
      return res.data;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["turma-checkins", turmaId],
    queryFn: async () => {
      const res = await api.get<Attendee[]>(
        `/api/turmas/${turmaId}/check-ins`
      );
      return res.data;
    },
    enabled: turmaId > 0,
  });

  const cancelMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      await api.delete(`/api/check-in/${checkinId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["my-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["turma-checkins", turmaId] });
    },
  });

  const count = data?.length ?? 0;
  const myCheckinForTurma = checkins?.find((c) => c.turma_id === turmaId);
  const hasCheckedIn = !!myCheckinForTurma;
  const dojoLogoUri = resolveDojoLogoUri(dojo?.logo_url);

  function renderStudentCard({
    item,
    index,
  }: {
    item: Attendee;
    index: number;
  }) {
    const avatarSource = resolveAvatarUri(item.avatar_url);
    const initials = item.student_name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");

    return (
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderRadius: tokens.radius.lg,
          padding: tokens.space.lg,
          marginBottom: tokens.space.md,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: tokens.space.md,
          }}
        >
          <View style={{ position: "relative" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                overflow: "hidden",
                backgroundColor: tokens.color.borderStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {avatarSource ? (
                <Image
                  source={avatarSource}
                  style={{ width: 56, height: 56 }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    color: tokens.color.textOnPrimary,
                    fontSize: tokens.text.md,
                    fontWeight: "700",
                  }}
                >
                  {initials || "?"}
                </Text>
              )}
            </View>
            <View
              style={{
                position: "absolute",
                top: -4,
                left: -4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: tokens.color.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: tokens.color.textPrimary,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {index + 1}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, marginLeft: tokens.space.lg }}>
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.md,
                fontWeight: "700",
              }}
            >
              {item.student_name}
            </Text>
            {item.graduacao ? (
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.sm,
                  opacity: 0.9,
                  marginTop: 2,
                }}
              >
                {item.graduacao}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            backgroundColor: tokens.color.primary,
            borderRadius: tokens.radius.sm,
            paddingVertical: tokens.space.sm,
            paddingHorizontal: tokens.space.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: tokens.space.xs,
            borderWidth: 1,
            borderColor: tokens.color.textPrimary,
          }}
        >
          <Check
            size={18}
            color={tokens.color.success}
            strokeWidth={3}
          />
          <Text
            style={{
              color: tokens.color.textPrimary,
              fontSize: tokens.text.xs,
              fontWeight: "800",
              letterSpacing: 0.5,
            }}
          >
            CHECK-IN CONFIRMADO!
          </Text>
        </View>
      </View>
    );
  }

  function renderContent() {
    if (isLoading) {
      return (
        <Text
          style={{
            color: tokens.color.textMuted,
            textAlign: "center",
            marginTop: tokens.space.xl,
          }}
        >
          Carregando...
        </Text>
      );
    }
    if (error) {
      return (
        <Text
          style={{
            color: tokens.color.error,
            textAlign: "center",
            marginTop: tokens.space.xl,
          }}
        >
          Erro ao carregar presenças. Tente novamente.
        </Text>
      );
    }
    if (!data || data.length === 0) {
      return (
        <Text
          style={{
            color: tokens.color.textMuted,
            textAlign: "center",
            marginTop: tokens.space.xl,
          }}
        >
          Nenhum aluno fez check-in ainda.
        </Text>
      );
    }
    return (
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.student_id)}
        contentContainerStyle={{ paddingBottom: tokens.space.xl + 80 }}
        renderItem={({ item, index }) => renderStudentCard({ item, index })}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      {/* Header com logo do Dojo */}
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.md,
          paddingBottom: tokens.space.lg,
          paddingHorizontal: tokens.space.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            gap: tokens.space.xs,
          }}
        >
          <ChevronLeft
            size={22}
            color={tokens.color.primary}
            strokeWidth={2.5}
          />
          <Text
            style={{
              color: tokens.color.primary,
              fontSize: tokens.text.sm,
              fontWeight: "700",
              letterSpacing: 0.5,
            }}
          >
            Treinos
          </Text>
        </Pressable>

        {dojoLogoUri ? (
          <Image
            source={{ uri: dojoLogoUri }}
            style={{ width: 90, height: 90, resizeMode: "contain" }}
          />
        ) : (
          dojo?.name ? (
            <View
              style={{
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: tokens.color.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontWeight: "700",
                  fontSize: tokens.text.lg,
                }}
              >
                {dojo.name.charAt(0)}
              </Text>
            </View>
          ) : null
        )}

        <View style={{ flex: 1 }} />
      </View>

      {/* Conteúdo */}
      <View
        style={{
          flex: 1,
          padding: tokens.space.lg,
        }}
      >
        <Text
          style={{
            color: tokens.color.textMuted,
            fontSize: tokens.text.sm,
            marginBottom: tokens.space.xs,
          }}
        >
          {turmaName}
        </Text>

        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: "800",
            marginBottom: tokens.space.lg,
            letterSpacing: 0.5,
          }}
        >
          ALUNOS PRESENTES ({count.toString().padStart(2, "0")})
        </Text>

        {hasCheckedIn && (
          <Pressable
            onPress={() => myCheckinForTurma && cancelMutation.mutate(myCheckinForTurma.id)}
            disabled={cancelMutation.isPending}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: tokens.space.sm,
              backgroundColor: tokens.color.primary,
              borderWidth: 0,
              borderRadius: tokens.radius.md,
              paddingVertical: tokens.space.sm,
              paddingHorizontal: tokens.space.md,
              marginBottom: tokens.space.lg,
            }}
          >
            <X size={18} color={tokens.color.bgCard} strokeWidth={2.5} />
            <Text
              style={{
                color: tokens.color.bgCard,
                fontSize: tokens.text.sm,
                fontWeight: "700",
              }}
            >
              {cancelMutation.isPending ? "Cancelando..." : "Cancelar check-in"}
            </Text>
          </Pressable>
        )}

        {renderContent()}
      </View>
    </View>
  );
}
