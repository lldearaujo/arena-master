import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";

type CheckIn = {
  id: number;
  dojo_id: number;
  turma_id: number;
  student_id: number;
  student_name: string | null;
  occurred_at: string;
  checked_in_by_user_id: number | null;
  presence_confirmed_at: string | null;
  presence_confirmed_by_user_id: number | null;
  marked_absent_at: string | null;
  marked_absent_by_user_id: number | null;
};

export function CheckInsPage() {
  const [turmaId, setTurmaId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["check-ins", turmaId, studentId],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (turmaId) params.turma_id = Number(turmaId);
      if (studentId) params.student_id = Number(studentId);
      const res = await api.get<CheckIn[]>("/api/check-in", { params });
      return res.data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      await api.post(`/api/check-in/${checkinId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-ins"] });
    },
  });

  const markAbsentMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      await api.post(`/api/check-in/${checkinId}/mark-absent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-ins"] });
    },
  });

  const handleFilter = (e: FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const handleConfirmPresence = (checkinId: number) => {
    if (confirmMutation.isPending) return;
    confirmMutation.mutate(checkinId);
  };

  const handleMarkAbsent = (checkinId: number) => {
    if (markAbsentMutation.isPending) return;
    markAbsentMutation.mutate(checkinId);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Check-ins</h1>

      <form
        onSubmit={handleFilter}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <label>
          <span>Turma (ID)</span>
          <input
            type="number"
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            style={{ padding: 6, marginTop: 4, width: 120 }}
          />
        </label>
        <label>
          <span>Aluno (ID)</span>
          <input
            type="number"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            style={{ padding: 6, marginTop: 4, width: 120 }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: "8px 14px",
            backgroundColor: "#111827",
            color: "white",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          Aplicar filtros
        </button>
      </form>

      {(confirmMutation.isError || markAbsentMutation.isError) && (
        <p style={{ color: "red", marginBottom: 8 }}>
          {(confirmMutation.error as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail ??
            (markAbsentMutation.error as { response?: { data?: { detail?: string } } })
              ?.response?.data?.detail ??
            "Erro na operação."}
        </p>
      )}

      {isLoading && <p>Carregando...</p>}
      {error && <p style={{ color: "red" }}>Erro ao carregar check-ins.</p>}
      {data && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Aluno</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Turma (ID)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Data/Hora</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Confirmação</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {c.student_name ?? `ID ${c.student_id}`}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{c.turma_id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {new Date(c.occurred_at).toLocaleString()}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {c.presence_confirmed_at ? (
                    <span style={{ color: "#16a34a" }}>
                      Confirmado em {new Date(c.presence_confirmed_at).toLocaleString()}
                    </span>
                  ) : c.marked_absent_at ? (
                    <span style={{ color: "#b45309" }}>
                      Ausente (crédito devolvido)
                    </span>
                  ) : (
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleConfirmPresence(c.id)}
                        disabled={
                          (confirmMutation.isPending && confirmMutation.variables === c.id) ||
                          (markAbsentMutation.isPending && markAbsentMutation.variables === c.id)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#16a34a",
                          color: "white",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        {confirmMutation.isPending && confirmMutation.variables === c.id
                          ? "Confirmando..."
                          : "Confirmar presença"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAbsent(c.id)}
                        disabled={
                          (confirmMutation.isPending && confirmMutation.variables === c.id) ||
                          (markAbsentMutation.isPending && markAbsentMutation.variables === c.id)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#b45309",
                          color: "white",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        {markAbsentMutation.isPending && markAbsentMutation.variables === c.id
                          ? "Marcando..."
                          : "Ausente"}
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

