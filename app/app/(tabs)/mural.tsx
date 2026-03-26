import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, ScrollView, TextInput, Pressable, Image, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { tokens } from "../../src/ui/tokens";

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
};

type MuralPost = {
  id: number;
  dojo_id: number;
  content: string;
  pinned: boolean;
  author_name: string;
  author_avatar_url?: string | null;
  likes_count: number;
  liked_by_me: boolean;
  created_at: string;
  updated_at: string;
};

function resolveAvatarUri(url: string | null | undefined): { uri: string } | null {
  if (!url) return null;
  if (url.startsWith("data:")) return { uri: url };
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${base}${url.startsWith("/") ? "" : "/"}${url}` };
}

export default function MuralScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const { data: dojo } = useQuery({
    queryKey: ["dojo-me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["mural"],
    queryFn: async () => {
      const res = await api.get<MuralPost[]>("/api/mural");
      return res.data;
    },
  });

  const [content, setContent] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const autoTitle =
        content.trim().split("\n")[0]?.slice(0, 80) || "Recado";
      await api.post("/api/mural", { title: autoTitle, content, pinned: false });
    },
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (post: MuralPost) => {
      if (post.liked_by_me) {
        const res = await api.delete<{ likes_count: number; liked_by_me: boolean }>(
          `/api/mural/${post.id}/like`
        );
        return { postId: post.id, ...res.data };
      }
      const res = await api.post<{ likes_count: number; liked_by_me: boolean }>(
        `/api/mural/${post.id}/like`
      );
      return { postId: post.id, ...res.data };
    },
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: ["mural"] });
      const prev = queryClient.getQueryData<MuralPost[]>(["mural"]);

      queryClient.setQueryData<MuralPost[]>(["mural"], (cur) => {
        if (!cur) return cur;
        return cur.map((p) => {
          if (p.id !== post.id) return p;
          const nextLiked = !p.liked_by_me;
          const nextCount = Math.max(0, (p.likes_count ?? 0) + (nextLiked ? 1 : -1));
          return { ...p, liked_by_me: nextLiked, likes_count: nextCount };
        });
      });

      return { prev };
    },
    onError: (_err, _post, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["mural"], ctx.prev);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MuralPost[]>(["mural"], (cur) => {
        if (!cur) return cur;
        return cur.map((p) =>
          p.id === data.postId
            ? { ...p, likes_count: data.likes_count, liked_by_me: data.liked_by_me }
            : p
        );
      });
    },
  });

  const handleCreate = () => {
    if (!content.trim()) return;
    createMutation.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      {/* Header com logo do Dojo */}
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.md,
          paddingBottom: tokens.space.xl,
          paddingHorizontal: tokens.space.lg,
          alignItems: "center",
          shadowColor: tokens.color.textPrimary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {dojo?.logo_url ? (
          <Image
            source={{
              uri: (() => {
                const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                if (dojo.logo_url!.startsWith("http")) {
                  if (dojo.logo_url!.includes("localhost") || dojo.logo_url!.includes("127.0.0.1")) {
                    const path = dojo.logo_url!.replace(/^https?:\/\/[^/]+/, "");
                    return `${base}${path}`;
                  }
                  return dojo.logo_url!;
                }
                return `${base}${dojo.logo_url!.startsWith("/") ? "" : "/"}${dojo.logo_url}`;
              })(),
            }}
            style={{
              width: Math.min(screenWidth - tokens.space.lg * 4, 260),
              height: Math.min(screenWidth * 0.35, 140),
              resizeMode: "contain",
            }}
          />
        ) : (
          dojo?.name && (
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.xl,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              {dojo.name}
            </Text>
          )
        )}
      </View>

      <View
        style={{
          flex: 1,
          padding: tokens.space.lg,
        }}
      >
        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: "700",
            marginBottom: tokens.space.xs,
          }}
        >
          Mural do dojo
        </Text>
      <Text
        style={{
          color: tokens.color.textMuted,
          fontSize: tokens.text.sm,
          marginBottom: tokens.space.lg,
        }}
      >
        Fique por dentro dos recados, avisos de treino e anúncios do professor.
      </Text>

      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderRadius: tokens.radius.lg,
          padding: tokens.space.md,
          marginBottom: tokens.space.lg,
          borderWidth: 1,
          borderColor: tokens.color.borderStrong,
        }}
      >
        <Text
          style={{
            color: tokens.color.textOnPrimary,
            fontWeight: "600",
            marginBottom: tokens.space.sm,
          }}
        >
          Novo recado
        </Text>
        <TextInput
          placeholder="Compartilhe avisos importantes com o seu dojo..."
          placeholderTextColor={tokens.color.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: tokens.color.borderStrong,
            borderRadius: tokens.radius.md,
            paddingHorizontal: tokens.space.sm,
            paddingVertical: 6,
            color: tokens.color.textPrimary,
            minHeight: 72,
            textAlignVertical: "top",
            marginBottom: tokens.space.sm,
          }}
        />
        <Pressable
          onPress={handleCreate}
          disabled={createMutation.isPending}
          style={{
            alignSelf: "flex-end",
            backgroundColor: tokens.color.primary,
            borderRadius: tokens.radius.full,
            paddingHorizontal: tokens.space.md,
            paddingVertical: 8,
            opacity:
              createMutation.isPending || !content.trim() ? 0.7 : 1,
          }}
        >
          <Text
            style={{
              color: tokens.color.textOnPrimary,
              fontWeight: "700",
              fontSize: tokens.text.sm,
            }}
          >
            {createMutation.isPending ? "Enviando..." : "Publicar recado"}
          </Text>
        </Pressable>
      </View>

      {isLoading && (
        <Text style={{ color: tokens.color.textMuted }}>Carregando mural...</Text>
      )}
      {error && (
        <Text style={{ color: tokens.color.error }}>
          Erro ao carregar mural. Tente novamente mais tarde.
        </Text>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <Text style={{ color: tokens.color.textMuted }}>
          Ainda não há recados publicados.
        </Text>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: tokens.space.lg,
        }}
      >
        {(data ?? []).map((post) => {
          const avatarSource = resolveAvatarUri(post.author_avatar_url);
          const initials = post.author_name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("");
          return (
            <View
              key={post.id}
              style={{
                backgroundColor: tokens.color.bgCard,
                borderRadius: tokens.radius.lg,
                padding: tokens.space.md,
                marginBottom: tokens.space.md,
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: tokens.space.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: tokens.color.borderStrong,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: tokens.space.sm,
                    overflow: "hidden",
                  }}
                >
                  {avatarSource ? (
                    <Image
                      source={avatarSource}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : (
                    <Text
                      style={{
                        color: tokens.color.textMuted,
                        fontSize: tokens.text.sm,
                        fontWeight: "600",
                      }}
                    >
                      {initials || "?"}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.color.textOnPrimary,
                        fontSize: tokens.text.sm,
                        fontWeight: "600",
                      }}
                    >
                      {post.author_name}
                    </Text>
                    {post.pinned && (
                      <Text
                        style={{
                          marginLeft: tokens.space.xs,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: tokens.color.primary,
                          color: tokens.color.textOnPrimary,
                          fontSize: tokens.text.xs,
                          fontWeight: "700",
                        }}
                      >
                        Fixado
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      color: tokens.color.textMuted,
                      fontSize: tokens.text.xs,
                    }}
                  >
                    {new Date(post.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.md,
                  lineHeight: 22,
                }}
              >
                {post.content}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: tokens.space.sm, gap: tokens.space.sm }}>
                <Pressable
                  onPress={() => likeMutation.mutate(post)}
                  style={{
                    paddingHorizontal: tokens.space.md,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: post.liked_by_me ? "rgba(184,158,93,0.9)" : "rgba(255,255,255,0.18)",
                    backgroundColor: post.liked_by_me ? "rgba(184,158,93,0.18)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "800", fontSize: tokens.text.xs }}>
                    ♥ {post.liked_by_me ? "Curtiu" : "Curtir"}
                  </Text>
                </Pressable>
                <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
                  {post.likes_count ?? 0} curtida{(post.likes_count ?? 0) === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      </View>
    </View>
  );
}

