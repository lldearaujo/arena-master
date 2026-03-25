import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type ModalidadeRow = {
  id: number | null;
  name: string;
  em_catalogo: boolean;
  has_graduation_system: boolean;
  skills_labels?: string[] | null;
};

const EMPTY_SKILLS: string[] = ["", "", "", "", ""];

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response?: { data?: { detail?: unknown } } }).response;
    const d = r?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
      return String((d[0] as { msg?: string }).msg ?? fallback);
    }
  }
  return err instanceof Error ? err.message : fallback;
}

type Props = {
  open: boolean;
  onClose?: () => void;
  /** Quando true, renderiza só o painel (sem overlay), para uso na página Faixas. */
  embedded?: boolean;
};

export function ModalidadesCrudModal({ open, onClose, embedded = false }: Props) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newHasGraduation, setNewHasGraduation] = useState(true);
  const [newSkills, setNewSkills] = useState<string[]>(() => [...EMPTY_SKILLS]);
  /** Edição de item do catálogo (id numérico). */
  const [editingCatalogId, setEditingCatalogId] = useState<number | null>(null);
  /** Nome original ao editar item só referenciado em turmas/alunos (sem id). */
  const [editingLegacyOriginalName, setEditingLegacyOriginalName] = useState<
    string | null
  >(null);
  const [editName, setEditName] = useState("");
  const [editHasGraduation, setEditHasGraduation] = useState(true);
  const [editSkills, setEditSkills] = useState<string[]>(() => [...EMPTY_SKILLS]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: rows, isLoading, isFetching } = useQuery({
    queryKey: ["modalidades-catalog"],
    queryFn: async () => {
      const res = await api.get<ModalidadeRow[]>("/api/modalidades/");
      return res.data;
    },
    enabled: embedded || open,
    staleTime: 0,
  });

  useEffect(() => {
    if (!embedded && !open) {
      setNewName("");
      setNewHasGraduation(true);
      setNewSkills([...EMPTY_SKILLS]);
      setEditingCatalogId(null);
      setEditingLegacyOriginalName(null);
      setEditName("");
      setEditHasGraduation(true);
      setEditSkills([...EMPTY_SKILLS]);
      setFeedback(null);
    }
  }, [open, embedded]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["modalidades-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["turmas-modalidades"] });
    queryClient.invalidateQueries({ queryKey: ["skills", "overview"] });
    queryClient.invalidateQueries({ queryKey: ["faixas"] });
  };

  const createMut = useMutation({
    mutationFn: async (payload: {
      name: string;
      has_graduation_system: boolean;
      skills_labels?: string[] | null;
    }) => {
      await api.post("/api/modalidades/", payload);
    },
    onSuccess: () => {
      invalidate();
      setNewName("");
      setNewHasGraduation(true);
      setNewSkills([...EMPTY_SKILLS]);
      setFeedback(null);
    },
    onError: (e) => setFeedback(apiErrorMessage(e, "Erro ao criar modalidade")),
  });

  const updateCatalogMut = useMutation({
    mutationFn: async (args: {
      id: number;
      name: string;
      has_graduation_system: boolean;
      skills_labels: string[] | null;
    }) => {
      await api.put(`/api/modalidades/${args.id}`, {
        name: args.name,
        has_graduation_system: args.has_graduation_system,
        skills_labels: args.skills_labels,
      });
    },
    onSuccess: () => {
      invalidate();
      setEditingCatalogId(null);
      setEditingLegacyOriginalName(null);
      setEditName("");
      setEditSkills([...EMPTY_SKILLS]);
      setFeedback(null);
    },
    onError: (e) =>
      setFeedback(apiErrorMessage(e, "Erro ao atualizar modalidade")),
  });

  const renamePorNomeMut = useMutation({
    mutationFn: async (args: { old_name: string; new_name: string }) => {
      await api.put("/api/modalidades/por-nome", args);
    },
    onSuccess: () => {
      invalidate();
      setEditingCatalogId(null);
      setEditingLegacyOriginalName(null);
      setEditName("");
      setFeedback(null);
    },
    onError: (e) =>
      setFeedback(apiErrorMessage(e, "Erro ao renomear modalidade")),
  });

  const deleteCatalogMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/modalidades/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setFeedback(null);
    },
    onError: (e) => setFeedback(apiErrorMessage(e, "Erro ao excluir modalidade")),
  });

  const deletePorNomeMut = useMutation({
    mutationFn: async (name: string) => {
      await api.delete("/api/modalidades/por-nome", {
        params: { name },
      });
    },
    onSuccess: () => {
      invalidate();
      setFeedback(null);
    },
    onError: (e) =>
      setFeedback(apiErrorMessage(e, "Erro ao remover referências da modalidade")),
  });

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const t = newName.trim();
    if (!t) return;
    const parsed = newSkills.map((s) => s.trim());
    const filled = parsed.filter(Boolean).length;
    let skills_labels: string[] | null | undefined;
    if (filled === 5) {
      if (new Set(parsed.map((x) => x.toLowerCase())).size !== 5) {
        setFeedback("As 5 habilidades do radar devem ser diferentes entre si.");
        return;
      }
      skills_labels = parsed;
    } else if (filled > 0) {
      setFeedback("Preencha as 5 habilidades ou deixe todas vazias (usa o padrão em Habilidades).");
      return;
    }
    createMut.mutate({
      name: t,
      has_graduation_system: newHasGraduation,
      ...(skills_labels !== undefined ? { skills_labels } : {}),
    });
  };

  const startEdit = (r: ModalidadeRow) => {
    setFeedback(null);
    setEditName(r.name);
    setEditHasGraduation(r.has_graduation_system !== false);
    if (r.skills_labels && r.skills_labels.length === 5) {
      setEditSkills([...r.skills_labels]);
    } else {
      setEditSkills([...EMPTY_SKILLS]);
    }
    if (r.id != null) {
      setEditingCatalogId(r.id);
      setEditingLegacyOriginalName(null);
    } else {
      setEditingCatalogId(null);
      setEditingLegacyOriginalName(r.name);
    }
  };

  const cancelEdit = () => {
    setEditingCatalogId(null);
    setEditingLegacyOriginalName(null);
    setEditName("");
    setEditHasGraduation(true);
    setEditSkills([...EMPTY_SKILLS]);
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    const t = editName.trim();
    if (!t) return;
    if (editingCatalogId != null) {
      const parsed = editSkills.map((s) => s.trim());
      const filled = parsed.filter(Boolean).length;
      let skills_labels: string[] | null;
      if (filled === 5) {
        if (new Set(parsed.map((x) => x.toLowerCase())).size !== 5) {
          setFeedback("As 5 habilidades do radar devem ser diferentes entre si.");
          return;
        }
        skills_labels = parsed;
      } else if (filled === 0) {
        skills_labels = null;
      } else {
        setFeedback("Preencha as 5 habilidades ou apague todas para usar o padrão do dojo.");
        return;
      }
      updateCatalogMut.mutate({
        id: editingCatalogId,
        name: t,
        has_graduation_system: editHasGraduation,
        skills_labels,
      });
    } else if (editingLegacyOriginalName != null) {
      renamePorNomeMut.mutate({
        old_name: editingLegacyOriginalName,
        new_name: t,
      });
    }
  };

  const isEditingRow = (r: ModalidadeRow) => {
    if (r.id != null) return editingCatalogId === r.id;
    return (
      editingLegacyOriginalName != null &&
      editingLegacyOriginalName === r.name
    );
  };

  const handleDelete = (r: ModalidadeRow) => {
    setFeedback(null);
    if (r.id != null) {
      deleteCatalogMut.mutate(r.id);
    } else {
      deletePorNomeMut.mutate(r.name);
    }
  };

  const anyPending =
    createMut.isPending ||
    updateCatalogMut.isPending ||
    renamePorNomeMut.isPending ||
    deleteCatalogMut.isPending ||
    deletePorNomeMut.isPending;

  if (!embedded && !open) return null;

  const overlay: CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space.lg,
    boxSizing: "border-box",
  };

  const panel: CSSProperties = embedded
    ? {
        backgroundColor: "#fff",
        borderRadius: tokens.radius.lg * 1.5,
        boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
        border: `1px solid ${tokens.color.borderSubtle}`,
        maxWidth: "100%",
        width: "100%",
        maxHeight: "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }
    : {
        backgroundColor: "#fff",
        borderRadius: tokens.radius.lg,
        boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
        border: `1px solid ${tokens.color.borderSubtle}`,
        maxWidth: 520,
        width: "100%",
        maxHeight: "min(85vh, 620px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      };

  const list = rows ?? [];
  const showEmpty = !isLoading && !isFetching && list.length === 0;

  const panelInner = (
    <>
      <div
        style={{
          padding: `${tokens.space.lg}px ${tokens.space.xl}px`,
          borderBottom: `1px solid ${tokens.color.borderSubtle}`,
          background: embedded
            ? "linear-gradient(135deg, rgba(184,158,93,0.12) 0%, rgba(255,255,255,0.9) 48%, rgba(244,241,232,0.5) 100%)"
            : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.md,
        }}
      >
        <div>
          <h2
            id="modalidades-title"
            style={{
              margin: 0,
              fontSize: embedded ? tokens.text.xl : tokens.text.lg,
              fontWeight: 700,
              color: tokens.color.textPrimary,
              letterSpacing: embedded ? "-0.02em" : undefined,
            }}
          >
            Modalidades
          </h2>
          {embedded ? (
            <p style={{ margin: "6px 0 0", fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
              Catálogo do dojo, graduação no app e habilidades do radar por modalidade
            </p>
          ) : null}
        </div>
        {!embedded ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              color: tokens.color.textMuted,
              padding: tokens.space.xs,
            }}
          >
            ×
          </button>
        ) : (
          <span style={{ width: 24 }} aria-hidden />
        )}
      </div>

        <div
          style={{
            padding: tokens.space.xl,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.lg,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
              lineHeight: 1.5,
            }}
          >
            Lista do <strong>catálogo</strong> e das modalidades já usadas em{" "}
            <strong>turmas ou alunos</strong> (mesmo sem cadastro no catálogo). Itens
            do catálogo podem ser excluídos só se não estiverem em uso. Os demais:
            <strong> remover</strong> limpa o campo nas turmas e alunos.
          </p>

          <form
            onSubmit={handleCreate}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.sm,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: tokens.space.sm,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={64}
                placeholder="Adicionar ao catálogo"
                style={{
                  flex: "1 1 200px",
                  minWidth: 0,
                  padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  fontSize: tokens.text.sm,
                }}
              />
              <button
                type="submit"
                disabled={createMut.isPending || !newName.trim()}
                style={{
                  padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                  backgroundColor: tokens.color.primary,
                  color: tokens.color.textOnPrimary,
                  border: "none",
                  borderRadius: tokens.radius.md,
                  fontWeight: 600,
                  fontSize: tokens.text.sm,
                  cursor: createMut.isPending ? "not-allowed" : "pointer",
                  opacity: createMut.isPending ? 0.7 : 1,
                }}
              >
                Adicionar
              </button>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: tokens.space.sm,
                fontSize: tokens.text.sm,
                color: tokens.color.textPrimary,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newHasGraduation}
                onChange={(e) => setNewHasGraduation(e.target.checked)}
              />
              Possui sistema de graduação (faixa e graus no perfil do aluno)
            </label>
            <p
              style={{
                margin: 0,
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
                lineHeight: 1.45,
              }}
            >
              <strong>Habilidades do radar (opcional):</strong> cinco nomes únicos para o gráfico de
              habilidades desta modalidade. Vazio = usa o padrão configurado em{" "}
              <strong>Habilidades</strong> no menu.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 8,
              }}
            >
              {newSkills.map((v, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={v}
                  maxLength={64}
                  placeholder={`Habilidade ${idx + 1}`}
                  onChange={(e) => {
                    const next = [...newSkills];
                    next[idx] = e.target.value;
                    setNewSkills(next);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    fontSize: tokens.text.sm,
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </div>
          </form>

          {feedback ? (
            <div
              style={{
                fontSize: tokens.text.sm,
                color: tokens.color.error,
                padding: tokens.space.md,
                backgroundColor: `${tokens.color.error}12`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.error}40`,
              }}
            >
              {feedback}
            </div>
          ) : null}

          {(isLoading || isFetching) && list.length === 0 ? (
            <p style={{ margin: 0, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
              Carregando modalidades…
            </p>
          ) : null}

          {showEmpty ? (
            <p style={{ margin: 0, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
              Nenhuma modalidade encontrada. Cadastre no catálogo acima ou crie turmas/alunos
              com modalidade.
            </p>
          ) : null}

          {list.length > 0 ? (
            <div>
              <div
                style={{
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  color: tokens.color.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: tokens.space.sm,
                }}
              >
                Modalidades existentes ({list.length})
              </div>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: tokens.space.sm,
                }}
              >
                {list.map((r) => (
                  <li
                    key={r.id != null ? `c-${r.id}` : `l-${r.name}`}
                    style={{
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      borderRadius: tokens.radius.md,
                      padding: tokens.space.md,
                      backgroundColor: `${tokens.color.borderSubtle}22`,
                    }}
                  >
                    {isEditingRow(r) ? (
                      <form
                        onSubmit={handleSaveEdit}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: tokens.space.sm,
                        }}
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={64}
                          style={{
                            width: "100%",
                            padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                            borderRadius: tokens.radius.md,
                            border: `1px solid ${tokens.color.borderSubtle}`,
                            fontSize: tokens.text.sm,
                            boxSizing: "border-box",
                          }}
                        />
                        {editingCatalogId != null ? (
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: tokens.space.sm,
                              fontSize: tokens.text.sm,
                              color: tokens.color.textPrimary,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={editHasGraduation}
                              onChange={(e) => setEditHasGraduation(e.target.checked)}
                            />
                            Sistema de graduação (faixa e graus no app)
                          </label>
                        ) : (
                          <p
                            style={{
                              margin: 0,
                              fontSize: tokens.text.xs,
                              color: tokens.color.textMuted,
                              lineHeight: 1.4,
                            }}
                          >
                            Itens só em turmas/alunos: ao cadastrar no catálogo você poderá marcar se há
                            graduação.
                          </p>
                        )}
                        {editingCatalogId != null ? (
                          <>
                            <p
                              style={{
                                margin: 0,
                                fontSize: tokens.text.xs,
                                color: tokens.color.textMuted,
                                lineHeight: 1.45,
                              }}
                            >
                              Habilidades do radar: cinco nomes únicos, ou vazio para o padrão do dojo.
                              Limpar todos os campos remove a personalização.
                            </p>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                gap: 8,
                              }}
                            >
                              {editSkills.map((v, idx) => (
                                <input
                                  key={idx}
                                  type="text"
                                  value={v}
                                  maxLength={64}
                                  placeholder={`Habilidade ${idx + 1}`}
                                  onChange={(e) => {
                                    const next = [...editSkills];
                                    next[idx] = e.target.value;
                                    setEditSkills(next);
                                  }}
                                  style={{
                                    padding: "8px 10px",
                                    borderRadius: tokens.radius.md,
                                    border: `1px solid ${tokens.color.borderSubtle}`,
                                    fontSize: tokens.text.sm,
                                    boxSizing: "border-box",
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        ) : null}
                        <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap" }}>
                          <button
                            type="submit"
                            disabled={
                              (updateCatalogMut.isPending || renamePorNomeMut.isPending) ||
                              !editName.trim()
                            }
                            style={{
                              padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                              backgroundColor: tokens.color.primary,
                              color: tokens.color.textOnPrimary,
                              border: "none",
                              borderRadius: tokens.radius.md,
                              fontWeight: 600,
                              fontSize: tokens.text.sm,
                              cursor: "pointer",
                            }}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            style={{
                              padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                              backgroundColor: "#fff",
                              border: `1px solid ${tokens.color.borderSubtle}`,
                              borderRadius: tokens.radius.md,
                              fontSize: tokens.text.sm,
                              cursor: "pointer",
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: tokens.space.md,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: tokens.space.xs,
                            minWidth: 0,
                            flex: "1 1 160px",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: tokens.text.sm,
                              color: tokens.color.textPrimary,
                              wordBreak: "break-word",
                            }}
                          >
                            {r.name}
                          </span>
                          {r.em_catalogo ? (
                            <>
                              <span
                                style={{
                                  fontSize: tokens.text.xs,
                                  fontWeight: 600,
                                  color: tokens.color.primaryDark,
                                  alignSelf: "flex-start",
                                  padding: `2px ${tokens.space.sm}px`,
                                  borderRadius: tokens.radius.full,
                                  backgroundColor: `${tokens.color.primary}22`,
                                }}
                              >
                                No catálogo
                              </span>
                              <span
                                style={{
                                  fontSize: tokens.text.xs,
                                  color: tokens.color.textMuted,
                                }}
                              >
                                Graduação no app: {r.has_graduation_system ? "sim" : "não"}
                              </span>
                              <span
                                style={{
                                  fontSize: tokens.text.xs,
                                  color: tokens.color.textMuted,
                                }}
                              >
                                Radar:{" "}
                                {r.skills_labels && r.skills_labels.length === 5
                                  ? "5 habilidades próprias"
                                  : "padrão do dojo"}
                              </span>
                            </>
                          ) : (
                            <span
                              style={{
                                fontSize: tokens.text.xs,
                                fontWeight: 600,
                                color: tokens.color.textMuted,
                                alignSelf: "flex-start",
                                padding: `2px ${tokens.space.sm}px`,
                                borderRadius: tokens.radius.full,
                                backgroundColor: `${tokens.color.borderSubtle}99`,
                              }}
                            >
                              Só em turmas / alunos
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: tokens.space.sm, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            disabled={anyPending}
                            style={{
                              padding: `${tokens.space.xs}px ${tokens.space.md}px`,
                              fontSize: tokens.text.sm,
                              borderRadius: tokens.radius.md,
                              border: `1px solid ${tokens.color.borderSubtle}`,
                              backgroundColor: "#fff",
                              cursor: anyPending ? "not-allowed" : "pointer",
                              opacity: anyPending ? 0.6 : 1,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            disabled={anyPending}
                            style={{
                              padding: `${tokens.space.xs}px ${tokens.space.md}px`,
                              fontSize: tokens.text.sm,
                              borderRadius: tokens.radius.md,
                              border: `1px solid ${tokens.color.error}55`,
                              backgroundColor: `${tokens.color.error}14`,
                              color: tokens.color.error,
                              cursor: anyPending ? "not-allowed" : "pointer",
                              opacity: anyPending ? 0.6 : 1,
                            }}
                          >
                            {r.id != null ? "Excluir" : "Remover uso"}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
    </>
  );

  if (embedded) {
    return (
      <div style={panel} role="region" aria-labelledby="modalidades-title">
        {panelInner}
      </div>
    );
  }

  return (
    <div
      style={overlay}
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose?.();
      }}
    >
      <div style={panel} role="dialog" aria-modal="true" aria-labelledby="modalidades-title">
        {panelInner}
      </div>
    </div>
  );
}

export function ModalidadesOpenButton({
  onClick,
  label = "Gerenciar modalidades",
}: {
  onClick: () => void;
  label?: string;
}) {
  const btnIcon: CSSProperties = {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.borderSubtle}`,
    backgroundColor: tokens.color.primary,
    color: tokens.color.textOnPrimary,
    fontSize: 24,
    fontWeight: 500,
    cursor: "pointer",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={btnIcon}
    >
      +
    </button>
  );
}
