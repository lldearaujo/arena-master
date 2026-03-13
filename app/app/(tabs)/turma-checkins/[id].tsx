import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, FlatList, Pressable, Image } from "react-native";

import { api } from "../../../src/api/client";
import { tokens } from "../../../src/ui/tokens";

type Attendee = {
  student_id: number;
  student_name: string;
  graduacao?: string | null;
  avatar_url?: string | null;
};

export default function TurmaCheckinsScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const turmaId = id ? parseInt(id, 10) : 0;

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

  function renderContent() {
    if (isLoading) {
      return <Text style={{ color: tokens.color.textOnPrimary }}>Carregando...</Text>;
    }
    if (error) {
      return (
        <Text style={{ color: "#fecaca" }}>
          Erro ao carregar presenças. Tente novamente.
        </Text>
      );
    }
    if (!data || data.length === 0) {
      return (
        <Text style={{ color: tokens.color.textMuted }}>
          Nenhum aluno fez check-in ainda.
        </Text>
      );
    }
    return (
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.student_id)}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => {
          const avatarSource =
            item.avatar_url && item.avatar_url.startsWith("data:")
              ? { uri: item.avatar_url }
              : item.avatar_url
              ? { uri: item.avatar_url }
              : null;

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
                borderRadius: tokens.radius.md,
                padding: tokens.space.md,
                marginBottom: tokens.space.sm,
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: tokens.color.bgBody,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarSource ? (
                  <Image
                    source={avatarSource}
                    style={{ width: 40, height: 40 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={{
                      color: tokens.color.textOnPrimary,
                      fontSize: tokens.text.sm,
                      fontWeight: "600",
                    }}
                  >
                    {initials || "?"}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: tokens.color.textOnPrimary,
                    fontSize: tokens.text.md,
                  }}
                >
                  {item.student_name}
                </Text>
                {item.graduacao ? (
                  <Text
                    style={{
                      color: tokens.color.textMuted,
                      fontSize: tokens.text.sm,
                      marginTop: tokens.space.xs,
                    }}
                  >
                    {item.graduacao}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgBody,
        padding: tokens.space.md * 2,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        style={{ marginBottom: tokens.space.md, alignSelf: "flex-start" }}
      >
        <Text style={{ color: tokens.color.success, fontWeight: "600" }}>
          ← Voltar
        </Text>
      </Pressable>
      {name && (
        <Text
          style={{
            color: tokens.color.textMuted,
            fontSize: tokens.text.sm,
            marginBottom: tokens.space.xs,
          }}
        >
          {name}
        </Text>
      )}
      <Text
        style={{
          color: tokens.color.textOnPrimary,
          fontSize: tokens.text.lg,
          fontWeight: "600",
          marginBottom: tokens.space.lg,
        }}
      >
        Alunos presentes
      </Text>
      {renderContent()}
    </View>
  );
}
