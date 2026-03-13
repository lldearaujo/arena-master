import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View, Text, FlatList, Pressable } from "react-native";

import { api } from "../../src/api/client";

type CheckInRead = {
  id: number;
  turma_id: number;
  student_id: number;
  occurred_at: string;
};

type KidTurma = {
  student: {
    id: number;
    name: string;
    dojo_id: number;
  };
  turma: {
    id: number;
    name: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    capacity: number;
    vagas_restantes?: number;
  };
};

export default function FilhosScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["kids-turmas"],
    queryFn: async () => {
      const res = await api.get<KidTurma[]>("/api/turmas/my-kids");
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

  const checkedInKeys = new Set(
    checkins?.map((c) => `${c.turma_id}-${c.student_id}`) ?? []
  );
  const checkinIdByKey = new Map(
    checkins?.map((c) => [`${c.turma_id}-${c.student_id}`, c.id]) ?? []
  );

  const mutation = useMutation({
    mutationFn: async (payload: { turmaId: number; studentId: number }) => {
      await api.post("/api/check-in/", {
        turma_id: payload.turmaId,
        student_id: payload.studentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      await api.delete(`/api/check-in/${checkinId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#020617", padding: 16 }}>
      <Text
        style={{
          color: "white",
          fontSize: 22,
          fontWeight: "600",
          marginBottom: 12,
        }}
      >
        Turmas dos filhos
      </Text>
      {isLoading && <Text style={{ color: "white" }}>Carregando...</Text>}
      {error && (
        <Text style={{ color: "#fecaca" }}>
          Erro ao carregar turmas KIDS. Verifique sua conexão.
        </Text>
      )}
      {data && (
        <FlatList
          data={data}
          keyExtractor={(item) => `${item.student.id}-${item.turma.id}`}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/turma-checkins/[id]",
                  params: { id: String(item.turma.id), name: item.turma.name },
                })
              }
              style={{
                backgroundColor: "#0f172a",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#1e293b",
              }}
            >
              <Text style={{ color: "#facc15", fontWeight: "700", marginBottom: 4 }}>
                {item.student.name}
              </Text>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
                {item.turma.name}
              </Text>
              <Text style={{ color: "#9ca3af", marginTop: 4 }}>
                {item.turma.day_of_week} — {item.turma.start_time.slice(0, 5)} às{" "}
                {item.turma.end_time.slice(0, 5)}
              </Text>
              {item.turma.capacity != null && (
                <Text style={{ color: "#9ca3af", marginTop: 2 }}>
                  Vagas: {item.turma.vagas_restantes ?? item.turma.capacity} de{" "}
                  {item.turma.capacity}
                </Text>
              )}
              {checkedInKeys.has(`${item.turma.id}-${item.student.id}`) ? (
                <>
                  <Pressable
                    style={{
                      marginTop: 12,
                      backgroundColor: "#1e293b",
                      borderRadius: 999,
                      paddingVertical: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#ffffff",
                        fontWeight: "700",
                      }}
                    >
                      Check-in feito ✓
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const id = checkinIdByKey.get(
                        `${item.turma.id}-${item.student.id}`
                      );
                      if (id) cancelMutation.mutate(id);
                    }}
                    disabled={cancelMutation.isPending}
                    style={{
                      marginTop: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#ef4444",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Cancelar check-in
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() =>
                    mutation.mutate({
                      turmaId: item.turma.id,
                      studentId: item.student.id,
                    })
                  }
                  disabled={mutation.isPending}
                  style={{
                    marginTop: 12,
                    backgroundColor: "#22c55e",
                    borderRadius: 999,
                    paddingVertical: 8,
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

