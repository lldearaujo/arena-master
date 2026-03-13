import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View, Text, FlatList, Pressable } from "react-native";

import { api } from "../../src/api/client";
import { tokens } from "../../src/ui/tokens";

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
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      await api.delete(`/api/check-in/${checkinId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
    },
  });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgBody,
        padding: tokens.space.md * 2,
      }}
    >
      {isLoading && (
        <Text style={{ color: tokens.color.textOnPrimary }}>Carregando...</Text>
      )}
      {error && (
        <Text style={{ color: "#fecaca" }}>
          Erro ao carregar turmas. Verifique sua conexão.
        </Text>
      )}
      {(mutation.isError || cancelMutation.isError) && (
        <Text style={{ color: "#fecaca", marginTop: 8 }}>
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
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/turma-checkins/[id]",
                      params: { id: String(item.id), name: item.name },
                    })
                  }
                  style={{
                    backgroundColor: tokens.color.bgCard,
                    borderRadius: tokens.radius.lg,
                    padding: tokens.space.lg,
                    marginBottom: tokens.space.md,
                    borderWidth: 1,
                    borderColor: tokens.color.borderStrong,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.color.textOnPrimary,
                      fontSize: tokens.text.md,
                      fontWeight: "600",
                    }}
                  >
                {item.name}
              </Text>
              <Text
                style={{
                  color: tokens.color.textMuted,
                  marginTop: tokens.space.xs,
                }}
              >
                {item.day_of_week} — {item.start_time.slice(0, 5)} às{" "}
                {item.end_time.slice(0, 5)}
              </Text>
              <Text
                style={{
                  color: tokens.color.textMuted,
                  marginTop: 2,
                }}
              >
                Vagas: {item.vagas_restantes ?? item.capacity} de {item.capacity}
              </Text>
              {checkedInTurmaIds.has(item.id) ? (
                <>
                  <Pressable
                    disabled={cancelMutation.isPending}
                    onPress={() => {
                      const id = checkinIdByTurmaId.get(item.id);
                      if (id) cancelMutation.mutate(id);
                    }}
                    style={{
                      marginTop: tokens.space.md,
                      backgroundColor: tokens.color.success,
                      borderRadius: tokens.radius.full,
                      paddingVertical: tokens.space.sm,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#052e16",
                        fontWeight: "700",
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
                  disabled={mutation.isPending}
                  style={{
                    marginTop: tokens.space.md,
                    backgroundColor: tokens.color.success,
                    borderRadius: tokens.radius.full,
                    paddingVertical: tokens.space.sm,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#052e16",
                      fontWeight: "700",
                    }}
                  >
                    Fazer check-in
                  </Text>
                </Pressable>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

