import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type SkillsOverview = {
  default_skills: string[];
  students: Array<{
    student_id: number;
    student_name: string;
    skills: string[];
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

  const initialSkills = useMemo(
    () => data?.default_skills ?? ["", "", "", "", ""],
    [data?.default_skills],
  );
  const [skillsDraft, setSkillsDraft] = useState<string[]>(initialSkills);

  // Mantém draft sincronizado quando carregar
  if (
    data &&
    skillsDraft.join("|") !== data.default_skills.join("|") &&
    skillsDraft.every((s) => s === "")
  ) {
    setSkillsDraft(data.default_skills);
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

  const saveManyStudentsMutation = useMutation({
    mutationFn: async (payloads: Array<{ studentId: number; ratings: number[] }>) => {
      for (const payload of payloads) {
        await api.put(`/api/skills/students/${payload.studentId}`, { ratings: payload.ratings });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills", "overview"] });
      setRatingsDraft({});
    },
  });

  const [ratingsDraft, setRatingsDraft] = useState<Record<number, number[]>>({});
  const [isSmallScreen, setIsSmallScreen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const onChange = () => setIsSmallScreen(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const students = data?.students ?? [];
  const defaultSkills = data?.default_skills ?? [
    "Habilidade 1",
    "Habilidade 2",
    "Habilidade 3",
    "Habilidade 4",
    "Habilidade 5",
  ];

  const allStudentsSameSkills = useMemo(() => {
    if (!students.length) return true;
    const ref = students[0].skills?.join("|") ?? "";
    return students.every((s) => (s.skills?.join("|") ?? "") === ref);
  }, [students]);

  const tableColumnSkills = students[0]?.skills?.length === 5 ? students[0].skills : defaultSkills;
  const draftCount = Object.keys(ratingsDraft).length;

  const skillsGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: isSmallScreen ? "1fr" : "repeat(5, minmax(0, 1fr))",
    gap: 12,
    marginTop: tokens.space.md,
  };

  const setStudentSkill = (studentId: number, current: number[], idx: number, value: number) => {
    const safe = Math.min(10, Math.max(0, value));
    const next = [...current];
    next[idx] = safe;
    setRatingsDraft((prev) => ({ ...prev, [studentId]: next }));
  };

  const fillStudentSkills = (studentId: number, value: number) => {
    const safe = Math.min(10, Math.max(0, value));
    setRatingsDraft((prev) => ({ ...prev, [studentId]: [safe, safe, safe, safe, safe] }));
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ margin: 0, marginBottom: tokens.space.sm }}>Habilidades</h1>
      <p style={{ marginTop: 0, color: tokens.color.textMuted }}>
        Defina o <strong>padrão do dojo</strong> (usado quando a modalidade não tem lista própria). Por modalidade,
        configure as 5 habilidades em <strong>Turmas → Modalidades</strong>. Avalie cada aluno de 0 a 10.
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
          <h2 style={{ margin: 0, fontSize: tokens.text.lg }}>Habilidades padrão do dojo</h2>
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
        <p style={{ marginTop: 8, marginBottom: 0, color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
          Use nomes simples e curtos para facilitar o lançamento rápido das notas pelo professor.
        </p>

        <div style={skillsGridStyle}>
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
                placeholder={defaultSkills[idx] ?? `Habilidade ${idx + 1}`}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  outline: "none",
                  boxSizing: "border-box",
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
              {isLoading ? "Carregando..." : `${students.length} aluno(s)`}
            </div>
            <button
              type="button"
              disabled={draftCount === 0 || saveManyStudentsMutation.isPending}
              onClick={() => {
                const payloads = Object.entries(ratingsDraft).map(([studentId, ratings]) => ({
                  studentId: Number(studentId),
                  ratings,
                }));
                if (!payloads.length) return;
                saveManyStudentsMutation.mutate(payloads);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
                backgroundColor: draftCount > 0 ? tokens.color.primary : "white",
                color: draftCount > 0 ? tokens.color.textOnPrimary : tokens.color.textMuted,
                fontWeight: 700,
                cursor: draftCount > 0 ? "pointer" : "default",
                opacity: saveManyStudentsMutation.isPending ? 0.85 : 1,
              }}
            >
              {saveManyStudentsMutation.isPending
                ? "Salvando..."
                : draftCount > 0
                ? `Salvar lançamentos (${draftCount})`
                : "Sem alterações"}
            </button>
          </div>
        </div>

        {error && <div style={{ marginTop: tokens.space.sm, color: tokens.color.error }}>Erro ao carregar.</div>}

        <div style={{ marginTop: tokens.space.md }}>
          {(isSmallScreen || !allStudentsSameSkills) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.sm }}>
              {students.map((st) => {
                const current = ratingsDraft[st.student_id] ?? st.ratings ?? [0, 0, 0, 0, 0];
                const rowSkills =
                  st.skills?.length === 5 ? st.skills : defaultSkills;
                return (
                  <article
                    key={st.student_id}
                    style={{
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      borderRadius: tokens.radius.md,
                      padding: tokens.space.md,
                      display: "flex",
                      flexDirection: "column",
                      gap: tokens.space.sm,
                    }}
                  >
                    <div>
                      <strong>{st.student_name}</strong>
                      {!allStudentsSameSkills && (
                        <div style={{ fontSize: 11, color: tokens.color.textMuted, marginTop: 4 }}>
                          Modalidade com habilidades próprias — colunas abaixo seguem o catálogo.
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => fillStudentSkills(st.student_id, 0)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: tokens.radius.sm,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          backgroundColor: "white",
                          cursor: "pointer",
                        }}
                      >
                        Zerar tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => fillStudentSkills(st.student_id, 5)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: tokens.radius.sm,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          backgroundColor: "white",
                          cursor: "pointer",
                        }}
                      >
                        Base 5
                      </button>
                      <button
                        type="button"
                        onClick={() => fillStudentSkills(st.student_id, 10)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: tokens.radius.sm,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          backgroundColor: "white",
                          cursor: "pointer",
                        }}
                      >
                        Máximo 10
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                      {current.map((value, idx) => (
                        <label key={idx} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: tokens.text.xs }}>
                          {rowSkills[idx] ?? `Skill ${idx + 1}`}
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={value}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              setStudentSkill(
                                st.student_id,
                                current,
                                idx,
                                Number.isFinite(parsed) ? parsed : 0,
                              );
                            }}
                            style={{
                              width: "100%",
                              minHeight: 40,
                              padding: "10px 12px",
                              borderRadius: tokens.radius.md,
                              border: `1px solid ${tokens.color.borderSubtle}`,
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <div>
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
                    </div>
                  </article>
                );
              })}
              {!students.length && !isLoading && (
                <div style={{ padding: "14px 8px", color: tokens.color.textMuted }}>Nenhum aluno cadastrado.</div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                      Aluno
                    </th>
                    {tableColumnSkills.map((s, i) => (
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
                              setStudentSkill(
                                st.student_id,
                                current,
                                idx,
                                Number.isFinite(parsed) ? parsed : 0,
                              );
                              }}
                              style={{
                                width: 88,
                                minHeight: 36,
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
          )}
        </div>

        {saveStudentMutation.isError && (
          <div style={{ marginTop: tokens.space.sm, color: tokens.color.error }}>
            {(saveStudentMutation.error as any)?.response?.data?.detail ?? "Erro ao salvar notas."}
          </div>
        )}
        {saveManyStudentsMutation.isError && (
          <div style={{ marginTop: tokens.space.sm, color: tokens.color.error }}>
            {(saveManyStudentsMutation.error as any)?.response?.data?.detail ??
              "Erro ao salvar lançamentos em lote."}
          </div>
        )}
      </section>
    </div>
  );
}

