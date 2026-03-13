import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";

type CheckIn = {
  id: number;
  dojo_id: number;
  turma_id: number;
  student_id: number;
  occurred_at: string;
  checked_in_by_user_id: number | null;
};

export function CheckInsPage() {
  const [turmaId, setTurmaId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");

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

  const handleFilter = (e: FormEvent) => {
    e.preventDefault();
    refetch();
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

      {isLoading && <p>Carregando...</p>}
      {error && <p style={{ color: "red" }}>Erro ao carregar check-ins.</p>}
      {data && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Aluno (ID)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Turma (ID)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Data/Hora</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{c.student_id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{c.turma_id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {new Date(c.occurred_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

