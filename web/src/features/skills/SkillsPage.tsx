import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type SkillsOverview = {
  skills: string[];
  students: Array<{
    student_id: number;
    student_name: string;
    ratings: number[] | null;
  }>;
};

export function SkillsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["skills", "overview"],
    queryFn: async () => {
      const res = await api.get<SkillsOverview>("/api/skills/overview");
      return res.data;
    },
  });

  const initialSkills = useMemo(() => data?.skills ?? ["", "", "", "", ""], [data?.skills]);
  const [skillsDraft, setSkillsDraft] = useState<string[]>(initialSkills);

  // Mantém draft sincronizado quando carregar
  if (data && skillsDraft.join("|") !== data.skills.join("|") && skillsDraft.every((s) => s === "")) {
    setSkillsDraft(data.skills);
  }

  const saveConfigMutation = useMutation({
    mutationFn: async (skills: string[]) => {
      await api.put("/api/skills/config", { skills });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills", "overview"] });
    },
  });

  const saveStudentMutation = useMutation({
    mutationFn: async (payload: { studentId: number; ratings: number[] }) => {
      await api.put(`/api/skills/students/${payload.studentId}`, { ratings: payload.ratings });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills", "overview"] });
    },
  });

  const [ratingsDraft, setRatingsDraft] = useState<Record<number, number[]>>({});

  const students = data?.students ?? [];
  const skills = data?.skills ?? ["Habilidade 1", "Habilidade 2", "Habilidade 3", "Habilidade 4", "Habilidade 5"];

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ margin: 0, marginBottom: tokens.space.sm }}>Habilidades</h1>
      <p style={{ marginTop: 0, color: tokens.color.textMuted }}>
        Configure 5 habilidades do seu dojo e avalie cada aluno de 0 a 10.
      </p>

      <section
        style={{
          backgroundColor: "white",
          border: `1px solid ${tokens.color.borderSubtle}`,
          borderRadius: tokens.radius.lg,
          padding: tokens.space.lg,
          marginBottom: tokens.space.lg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: tokens.text.lg }}>Configurar habilidades</h2>
          <button
            type="button"
            onClick={() => saveConfigMutation.mutate(skillsDraft)}
            disabled={saveConfigMutation.isPending}
            style={{
              padding: "10px 14px",
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              backgroundColor: tokens.color.primary,
              color: tokens.color.textOnPrimary,
              fontWeight: 700,
              cursor: saveConfigMutation.isPending ? "default" : "pointer",
              opacity: saveConfigMutation.isPending ? 0.85 : 1,
            }}
          >
            {saveConfigMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 12,
            marginTop: tokens.space.md,
          }}
        >
          {skillsDraft.map((value, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                Skill {idx + 1}
              </label>
              <input
                value={value}
                onChange={(e) => {
                  const next = [...skillsDraft];
                  next[idx] = e.target.value;
                  setSkillsDraft(next);
                }}
                placeholder={skills[idx] ?? `Habilidade ${idx + 1}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>

        {saveConfigMutation.isError && (
          <div style={{ marginTop: tokens.space.sm, color: tokens.color.error }}>
            {(saveConfigMutation.error as any)?.response?.data?.detail ?? "Erro ao salvar habilidades."}
          </div>
        )}
      </section>

      <section
        style={{
          backgroundColor: "white",
          border: `1px solid ${tokens.color.borderSubtle}`,
          borderRadius: tokens.radius.lg,
          padding: tokens.space.lg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: tokens.text.lg }}>Avaliar alunos</h2>
          <div style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
            {isLoading ? "Carregando..." : `${students.length} aluno(s)`}
          </div>
        </div>

        {error && <div style={{ marginTop: tokens.space.sm, color: tokens.color.error }}>Erro ao carregar.</div>}

        <div style={{ overflowX: "auto", marginTop: tokens.space.md }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                  Aluno
                </th>
                {skills.map((s, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "left",
                      padding: "10px 8px",
                      borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                      minWidth: 120,
                    }}
                  >
                    {s}
                  </th>
                ))}
                <th style={{ padding: "10px 8px", borderBottom: `1px solid ${tokens.color.borderSubtle}` }} />
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const current = ratingsDraft[st.student_id] ?? st.ratings ?? [0, 0, 0, 0, 0];
                return (
                  <tr key={st.student_id}>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                      <strong>{st.student_name}</strong>
                    </td>
                    {current.map((value, idx) => (
                      <td key={idx} style={{ padding: "10px 8px", borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={value}
                          onChange={(e) => {
                            const parsed = Number(e.target.value);
                            const safe = Number.isFinite(parsed) ? Math.min(10, Math.max(0, parsed)) : 0;
                            const next = [...current];
                            next[idx] = safe;
                            setRatingsDraft((prev) => ({ ...prev, [st.student_id]: next }));
                          }}
                          style={{
                            width: 80,
                            padding: "8px 10px",
                            borderRadius: tokens.radius.md,
                            border: `1px solid ${tokens.color.borderSubtle}`,
                            outline: "none",
                          }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${tokens.color.borderSubtle}`, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => saveStudentMutation.mutate({ studentId: st.student_id, ratings: current })}
                        disabled={saveStudentMutation.isPending}
                        style={{
                          padding: "8px 12px",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          backgroundColor: "white",
                          cursor: saveStudentMutation.isPending ? "default" : "pointer",
                        }}
                      >
                        Salvar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!students.length && !isLoading && (
                <tr>
                  <td colSpan={7} style={{ padding: "14px 8px", color: tokens.color.textMuted }}>
                    Nenhum aluno cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {saveStudentMutation.isError && (
          <div style={{ marginTop: tokens.space.sm, color: tokens.color.error }}>
            {(saveStudentMutation.error as any)?.response?.data?.detail ?? "Erro ao salvar notas."}
          </div>
        )}
      </section>
    </div>
  );
}

