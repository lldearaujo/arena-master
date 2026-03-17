import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View, Text, FlatList, Pressable, Image, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { tokens } from "../../src/ui/tokens";

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
};

type Turma = {
  id: number;
  name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  vagas_restantes: number;
  tipo: string;
};

/** True se o horário de início da turma já passou (hoje, horário local). */
function isTurmaPastStart(startTime: string): boolean {
  const now = new Date();
  const [h, m] = startTime.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = (h ?? 0) * 60 + (m ?? 0);
  return nowMins > startMins;
}

type CheckInResponse = {
  id: number;
};

type CheckInRead = {
  id: number;
  turma_id: number;
  student_id: number;
  occurred_at: string;
};

export default function MinhasTurmasScreen() {
  const router = useRouter();
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
    queryKey: ["my-turmas"],
    queryFn: async () => {
      const res = await api.get<Turma[]>("/api/turmas/my");
      return res.data;
    },
  });

  const { data: checkins } = useQuery({
    queryKey: ["my-checkins"],
    queryFn: async () => {
      const res = await api.get<CheckInRead[]>("/api/check-in/my");
      return res.data;
    },
  });

  const checkedInTurmaIds = new Set(checkins?.map((c) => c.turma_id) ?? []);
  const checkinIdByTurmaId = new Map(
    checkins?.map((c) => [c.turma_id, c.id]) ?? []
  );

  const mutation = useMutation({
    mutationFn: async (turmaId: number) => {
      await api.post<CheckInResponse>("/api/check-in/", { turma_id: turmaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["turma-checkins"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      await api.delete(`/api/check-in/${checkinId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["turma-checkins"] });
    },
  });

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
                  // URLs antigas com localhost: substituir pelo host correto para o app
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
                color: tokens.color.textPrimary,
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

      {/* Conteúdo */}
      <View
        style={{
          flex: 1,
          padding: tokens.space.md * 2,
        }}
      >
        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.xl,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: tokens.space.lg,
          }}
        >
          Treinos de Hoje
        </Text>

      {isLoading && (
        <Text style={{ color: tokens.color.textMuted }}>Carregando...</Text>
      )}
      {error && (
        <Text style={{ color: tokens.color.error }}>
          Erro ao carregar turmas. Verifique sua conexão.
        </Text>
      )}
      {(mutation.isError || cancelMutation.isError) && (
        <Text style={{ color: tokens.color.error, marginTop: 8 }}>
          {(mutation.error ?? cancelMutation.error) instanceof Error
            ? (mutation.error as any)?.response?.data?.detail ??
              (cancelMutation.error as any)?.response?.data?.detail ??
              (mutation.error ?? cancelMutation.error).message
            : "Erro ao processar check-in."}
        </Text>
      )}
      {data && (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingBottom: tokens.space.xl + 80,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            !isLoading && !error ? (
              <View
                style={{
                  paddingVertical: tokens.space.xl * 2,
                  paddingHorizontal: tokens.space.lg,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: tokens.color.textMuted,
                    fontSize: tokens.text.md,
                    textAlign: "center",
                    lineHeight: 24,
                  }}
                >
                  Nenhum treino agendado para hoje.
                </Text>
                <Text
                  style={{
                    color: tokens.color.textMuted,
                    fontSize: tokens.text.sm,
                    marginTop: tokens.space.sm,
                    textAlign: "center",
                  }}
                >
                  Verifique suas turmas ou confira os treinos da semana.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
                const pastStart = isTurmaPastStart(item.start_time);
                return (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/turma-checkins/[id]",
                      params: { id: String(item.id), name: item.name, tipo: item.tipo ?? "regular" },
                    })
                  }
                  style={{
                    backgroundColor: tokens.color.bgBody,
                    borderRadius: tokens.radius.lg,
                    padding: tokens.space.lg,
                    marginBottom: tokens.space.md,
                    borderWidth: 2,
                    borderColor: tokens.color.primary,
                    shadowColor: tokens.color.textPrimary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 3,
                    opacity: pastStart ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.color.textPrimary,
                      fontSize: tokens.text.md,
                      fontWeight: "700",
                      textDecorationLine: pastStart ? "line-through" : undefined,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      color: tokens.color.textMuted,
                      marginTop: tokens.space.xs,
                      fontSize: tokens.text.sm,
                      textDecorationLine: pastStart ? "line-through" : undefined,
                    }}
                  >
                    {item.day_of_week} — {item.start_time.slice(0, 5)} às{" "}
                    {item.end_time.slice(0, 5)}
                  </Text>
                  <Text
                    style={{
                      color: tokens.color.textMuted,
                      marginTop: 2,
                      fontSize: tokens.text.sm,
                      textDecorationLine: pastStart ? "line-through" : undefined,
                    }}
                  >
                    Vagas: {item.vagas_restantes ?? item.capacity} de{" "}
                    {item.capacity}
                  </Text>
              {item.tipo === "kids" ? (
                <Text
                  style={{
                    marginTop: tokens.space.md,
                    color: tokens.color.textMuted,
                    fontSize: tokens.text.sm,
                    fontStyle: "italic",
                  }}
                >
                  Check-in apenas pelo responsável (aba Filhos)
                </Text>
              ) : checkedInTurmaIds.has(item.id) ? (
                <>
                  <Pressable
                    disabled={cancelMutation.isPending}
                    onPress={() => {
                      const id = checkinIdByTurmaId.get(item.id);
                      if (id) cancelMutation.mutate(id);
                    }}
                    style={{
                      marginTop: tokens.space.md,
                      backgroundColor: tokens.color.primary,
                      borderRadius: tokens.radius.md,
                      paddingVertical: tokens.space.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.color.bgCard,
                        fontWeight: "700",
                        fontSize: tokens.text.sm,
                      }}
                    >
                      Check-in feito ✓
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const id = checkinIdByTurmaId.get(item.id);
                      if (id) cancelMutation.mutate(id);
                    }}
                    disabled={cancelMutation.isPending}
                    style={{
                      marginTop: tokens.space.sm,
                      paddingVertical: tokens.space.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.color.primary,
                        fontSize: tokens.text.sm,
                        fontWeight: "600",
                      }}
                    >
                      Cancelar check-in
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => mutation.mutate(item.id)}
                  disabled={mutation.isPending || pastStart}
                  style={{
                    marginTop: tokens.space.md,
                    backgroundColor: pastStart ? tokens.color.textMuted : tokens.color.primary,
                    borderRadius: tokens.radius.md,
                    paddingVertical: tokens.space.sm,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: tokens.color.bgCard,
                      fontWeight: "700",
                      fontSize: tokens.text.sm,
                    }}
                  >
                    {pastStart ? "Check-in encerrado" : "Fazer check-in"}
                  </Text>
                </Pressable>
              )}
            </Pressable>
          );
          }}
        />
      )}
      </View>
    </View>
  );
}

