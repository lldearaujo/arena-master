import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type CheckIn = {
  id: number;
  dojo_id: number;
  turma_id: number;
  turma_name: string | null;
  student_id: number;
  student_name: string | null;
  score: number | null;
  occurred_at: string;
  checked_in_by_user_id: number | null;
  presence_confirmed_at: string | null;
  presence_confirmed_by_user_id: number | null;
  marked_absent_at: string | null;
  marked_absent_by_user_id: number | null;
};

type Turma = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
};

export function CheckInsPage() {
  const [turmaId, setTurmaId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: turmas } = useQuery({
    queryKey: ["turmas-for-checkins"],
    queryFn: async () => {
      const res = await api.get<Turma[]>("/api/turmas");
      return res.data;
    },
  });

  const turmasById = (turmas ?? []).reduce<Record<number, Turma>>((acc, turma) => {
    acc[turma.id] = turma;
    return acc;
  }, {});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["check-ins", turmaId, studentName, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (turmaId) params.turma_id = Number(turmaId);
      if (studentName) params.student_name = studentName;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await api.get<CheckIn[]>("/api/check-in", { params });
      return res.data;
    },
  });

  const filteredData: CheckIn[] =
    data?.filter((c) =>
      studentName
        ? (c.student_name ?? "").toLowerCase().includes(studentName.toLowerCase())
        : true
    ) ?? [];

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
    <div
      style={{
        padding: tokens.space.xl,
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          marginBottom: tokens.space.xl,
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.xs,
        }}
      >
        <h1
          style={{
            fontSize: tokens.text["2xl"],
            fontWeight: 600,
            color: tokens.color.textPrimary,
            margin: 0,
          }}
        >
          Check-ins
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: tokens.text.sm,
            color: tokens.color.textMuted,
          }}
        >
          Acompanhe e gerencie os check-ins dos alunos em cada turma.
        </p>
      </header>

      <section
        style={{
          backgroundColor: tokens.color.surface,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.color.borderSubtle}`,
          boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
          padding: tokens.space.xl,
        }}
      >
        <form
          onSubmit={handleFilter}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: tokens.space.lg,
            alignItems: "flex-end",
            marginBottom: tokens.space.lg,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: tokens.space.xs }}>
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Turma
            </span>
            <select
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              style={{
                width: 200,
                padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
                fontSize: tokens.text.sm,
                boxSizing: "border-box",
                backgroundColor: "#fff",
              }}
            >
              <option value="">Todas as turmas</option>
              {(turmas ?? []).map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: tokens.space.xs }}>
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Aluno (nome)
            </span>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Ex: Diego"
              style={{
                width: 160,
                padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
                fontSize: tokens.text.sm,
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: tokens.space.xs }}>
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Data inicial
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: 180,
                padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
                fontSize: tokens.text.sm,
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: tokens.space.xs }}>
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Data final
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: 180,
                padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
                fontSize: tokens.text.sm,
                boxSizing: "border-box",
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
              backgroundColor: tokens.color.primary,
              color: "white",
              borderRadius: tokens.radius.md,
              border: "none",
              cursor: "pointer",
              fontSize: tokens.text.sm,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.space.xs,
            }}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setTurmaId("");
              setStudentName("");
              setStartDate("");
              setEndDate("");
              refetch();
            }}
            style={{
              padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
              backgroundColor: tokens.color.bgSubtle,
              color: tokens.color.textPrimary,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              cursor: "pointer",
              fontSize: tokens.text.sm,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.space.xs,
            }}
          >
            Limpar filtros
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

      {isLoading && (
        <p
          style={{
            marginTop: tokens.space.md,
            fontSize: tokens.text.sm,
            color: tokens.color.textMuted,
          }}
        >
          Carregando check-ins...
        </p>
      )}
      {error && (
        <p
          style={{
            marginTop: tokens.space.md,
            fontSize: tokens.text.sm,
            color: tokens.color.error,
          }}
        >
          Erro ao carregar check-ins.
        </p>
      )}
      {filteredData.length === 0 && !isLoading && !error && (
        <p
          style={{
            marginTop: tokens.space.md,
            fontSize: tokens.text.sm,
            color: tokens.color.textMuted,
          }}
        >
          Nenhum check-in encontrado para os filtros selecionados.
        </p>
      )}
      {filteredData.length > 0 && (
        <div
          style={{
            marginTop: tokens.space.md,
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: tokens.text.sm,
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: tokens.color.bgSubtle,
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  Aluno
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  Score
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                  }}
                >
                  Turma
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  Horário da turma
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  Data / Hora
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                    whiteSpace: "nowrap",
                  }}
                >
                  Confirmação
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((c) => (
                <tr key={c.id}>
                  <td
                    style={{
                      padding: tokens.space.md,
                      borderBottom: `1px solid ${tokens.color.borderMuted}`,
                    }}
                  >
                    {c.student_name ?? `ID ${c.student_id}`}
                  </td>
                  <td
                    style={{
                      padding: tokens.space.md,
                      borderBottom: `1px solid ${tokens.color.borderMuted}`,
                    }}
                  >
                    {c.score ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: tokens.space.md,
                      borderBottom: `1px solid ${tokens.color.borderMuted}`,
                    }}
                  >
                    {c.turma_id}{" "}
                    {turmasById[c.turma_id]?.name
                      ? `- ${turmasById[c.turma_id].name}`
                      : c.turma_name
                        ? `- ${c.turma_name}`
                        : ""}
                  </td>
                  <td
                    style={{
                      padding: tokens.space.md,
                      borderBottom: `1px solid ${tokens.color.borderMuted}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {turmasById[c.turma_id]
                      ? `${turmasById[c.turma_id].start_time.slice(0, 5)} - ${turmasById[
                          c.turma_id
                        ].end_time.slice(0, 5)}`
                      : "—"}
                  </td>
                  <td
                    style={{
                      padding: tokens.space.md,
                      borderBottom: `1px solid ${tokens.color.borderMuted}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(c.occurred_at).toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: tokens.space.md,
                      borderBottom: `1px solid ${tokens.color.borderMuted}`,
                    }}
                  >
                    {c.presence_confirmed_at ? (
                      <span
                        style={{
                          color: "#16a34a",
                          fontWeight: 500,
                        }}
                      >
                        Confirmado em {new Date(c.presence_confirmed_at).toLocaleString()}
                      </span>
                    ) : c.marked_absent_at ? (
                      <span
                        style={{
                          color: "#b45309",
                          fontWeight: 500,
                        }}
                      >
                        Ausente (crédito devolvido)
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "flex",
                          gap: tokens.space.sm,
                          flexWrap: "wrap",
                        }}
                      >
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
                            borderRadius: tokens.radius.md,
                            border: "none",
                            cursor: "pointer",
                            fontSize: tokens.text.xs,
                            fontWeight: 500,
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
                            borderRadius: tokens.radius.md,
                            border: "none",
                            cursor: "pointer",
                            fontSize: tokens.text.xs,
                            fontWeight: 500,
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
        </div>
      )}
      </section>
    </div>
  );
}

