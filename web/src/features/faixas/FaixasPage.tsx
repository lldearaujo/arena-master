import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import { ModalidadesCrudModal } from "../turmas/ModalidadesCrudModal";

type ModalidadeCat = {
  id: number | null;
  name: string;
  em_catalogo: boolean;
  has_graduation_system: boolean;
};

type Faixa = {
  id: number;
  dojo_id: number;
  modalidade_id: number;
  modalidade_name: string;
  name: string;
  ordem: number;
  max_graus: number;
  exibir_como_dan: boolean;
};

type FaixaPayload = {
  name: string;
  ordem: number;
  max_graus: number;
  exibir_como_dan: boolean;
  modalidade_id: number;
};

const inputBase: CSSProperties = {
  width: "100%",
  padding: `${tokens.space.sm}px ${tokens.space.md}px`,
  marginTop: tokens.space.xs,
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.borderSubtle}`,
  fontSize: tokens.text.sm,
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

const cardShell: CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: tokens.radius.lg * 1.5,
  boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
  border: `1px solid ${tokens.color.borderSubtle}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export function FaixasPage() {
  const queryClient = useQueryClient();

  const { data: modalidadesCat } = useQuery({
    queryKey: ["modalidades-catalog"],
    queryFn: async () => {
      const res = await api.get<ModalidadeCat[]>("/api/modalidades/");
      return res.data;
    },
  });

  const catalogComId = (modalidadesCat ?? []).filter((m) => m.id != null) as Array<
    ModalidadeCat & { id: number }
  >;

  const [selectedModalidadeId, setSelectedModalidadeId] = useState<number | null>(null);

  const { data: faixas, isLoading, error } = useQuery({
    queryKey: ["faixas", selectedModalidadeId],
    queryFn: async () => {
      const res = await api.get<Faixa[]>("/api/faixas", {
        params:
          selectedModalidadeId != null ? { modalidade_id: selectedModalidadeId } : undefined,
      });
      return res.data;
    },
    enabled: selectedModalidadeId != null,
  });

  const [form, setForm] = useState<FaixaPayload>({
    name: "",
    ordem: 0,
    max_graus: 4,
    exibir_como_dan: false,
    modalidade_id: 0,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedModalidadeId == null) return;
    setForm((f) => ({ ...f, modalidade_id: selectedModalidadeId }));
  }, [selectedModalidadeId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (!form.modalidade_id) throw new Error("Selecione a modalidade da faixa.");
      if (editingId) {
        await api.put(`/api/faixas/${editingId}`, form);
      } else {
        await api.post("/api/faixas", form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faixas"] });
      setForm({
        name: "",
        ordem: 0,
        max_graus: 4,
        exibir_como_dan: false,
        modalidade_id: selectedModalidadeId ?? 0,
      });
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/faixas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faixas"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const startEdit = (f: Faixa) => {
    setSelectedModalidadeId(f.modalidade_id);
    setEditingId(f.id);
    setForm({
      name: f.name,
      ordem: f.ordem,
      max_graus: f.max_graus,
      exibir_como_dan: f.exibir_como_dan,
      modalidade_id: f.modalidade_id,
    });
  };

  const sorted = faixas ? [...faixas].sort((a, b) => a.ordem - b.ordem) : [];

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        paddingBottom: tokens.space.xl * 2,
      }}
    >
      <header
        style={{
          marginBottom: tokens.space.xl,
          paddingBottom: tokens.space.lg,
          borderBottom: `1px solid ${tokens.color.borderSubtle}`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: tokens.text["2xl"],
            fontWeight: 700,
            color: tokens.color.textPrimary,
            letterSpacing: "-0.03em",
          }}
        >
          Faixas & modalidades
        </h1>
        <p
          style={{
            margin: `${tokens.space.sm}px 0 0`,
            fontSize: tokens.text.sm,
            color: tokens.color.textMuted,
            lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          Configure o <strong>catálogo de modalidades</strong> (graduação no app e radar de
          habilidades) e defina as <strong>faixas por modalidade</strong> (cada modalidade tem
          sua própria sequência). Use graus para faixas coloridas e dan para faixa preta.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: tokens.space.xl,
          alignItems: "start",
        }}
      >
        <ModalidadesCrudModal embedded open />

        <div style={cardShell}>
          <div
            style={{
              padding: `${tokens.space.lg}px ${tokens.space.xl}px`,
              borderBottom: `1px solid ${tokens.color.borderSubtle}`,
              background:
                "linear-gradient(135deg, rgba(27,48,63,0.06) 0%, rgba(255,255,255,0.95) 45%, rgba(184,158,93,0.08) 100%)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: tokens.text.xl,
                fontWeight: 700,
                color: tokens.color.textPrimary,
                letterSpacing: "-0.02em",
              }}
            >
              Faixas por modalidade
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
              }}
            >
              Escolha a modalidade e cadastre a ordem das faixas, graus e dans para ela
            </p>
          </div>

          <div
            style={{
              padding: tokens.space.xl,
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.lg,
            }}
          >
            <label style={{ fontSize: tokens.text.sm, color: tokens.color.textPrimary }}>
              Modalidade
              <select
                value={selectedModalidadeId ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  setSelectedModalidadeId(v);
                  setEditingId(null);
                  setFormError(null);
                  setForm((f) => ({
                    ...f,
                    modalidade_id: v ?? 0,
                    name: "",
                    ordem: 0,
                    max_graus: 4,
                    exibir_como_dan: false,
                  }));
                }}
                style={{ ...inputBase, marginTop: tokens.space.xs }}
              >
                <option value="">Selecione uma modalidade…</option>
                {catalogComId.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {!m.has_graduation_system ? " (sem graduação no app)" : ""}
                  </option>
                ))}
              </select>
            </label>

            {catalogComId.length === 0 ? (
              <p style={{ margin: 0, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>
                Cadastre modalidades ao lado antes de definir faixas.
              </p>
            ) : null}

            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.space.md,
                opacity: selectedModalidadeId == null ? 0.5 : 1,
                pointerEvents: selectedModalidadeId == null ? "none" : "auto",
              }}
            >
              <div
                style={{
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  color: tokens.color.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {editingId ? "Editar faixa" : "Nova faixa"}
              </div>

              <label style={{ fontSize: tokens.text.sm, color: tokens.color.textPrimary }}>
                Nome
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Branca, Azul, Preta"
                  required
                  style={inputBase}
                />
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: tokens.space.md,
                }}
              >
                <label style={{ fontSize: tokens.text.sm, color: tokens.color.textPrimary }}>
                  Ordem (exibição)
                  <input
                    type="number"
                    min={0}
                    value={form.ordem}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))
                    }
                    style={inputBase}
                  />
                </label>
                <label style={{ fontSize: tokens.text.sm, color: tokens.color.textPrimary }}>
                  Máx. graus/dans
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={form.max_graus}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        max_graus: Number(e.target.value) || 0,
                      }))
                    }
                    style={inputBase}
                  />
                </label>
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
                  checked={form.exibir_como_dan}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, exibir_como_dan: e.target.checked }))
                  }
                />
                Exibir como dan (ex.: 1º dan, 2º dan)
              </label>
              {formError ? (
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
                  {formError}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  style={{
                    padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                    backgroundColor: tokens.color.primary,
                    color: tokens.color.textOnPrimary,
                    borderRadius: tokens.radius.md,
                    border: "none",
                    fontWeight: 600,
                    fontSize: tokens.text.sm,
                    cursor: saveMutation.isPending ? "not-allowed" : "pointer",
                    opacity: saveMutation.isPending ? 0.75 : 1,
                  }}
                >
                  {saveMutation.isPending
                    ? "Salvando…"
                    : editingId
                      ? "Atualizar"
                      : "Criar"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm({
                        name: "",
                        ordem: 0,
                        max_graus: 4,
                        exibir_como_dan: false,
                        modalidade_id: selectedModalidadeId ?? 0,
                      });
                      setFormError(null);
                    }}
                    style={{
                      padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                      backgroundColor: "#fff",
                      color: tokens.color.textPrimary,
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      fontSize: tokens.text.sm,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>

            {selectedModalidadeId == null ? (
              <p style={{ margin: 0, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                Selecione uma modalidade para ver e editar as faixas.
              </p>
            ) : null}
            {selectedModalidadeId != null && isLoading ? (
              <p style={{ margin: 0, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                Carregando faixas…
              </p>
            ) : null}
            {error ? (
              <p style={{ margin: 0, color: tokens.color.error, fontSize: tokens.text.sm }}>
                Erro ao carregar faixas.
              </p>
            ) : null}
            {selectedModalidadeId != null && !isLoading && sorted.length === 0 ? (
              <p style={{ margin: 0, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                Nenhuma faixa nesta modalidade. Crie a primeira acima.
              </p>
            ) : null}

            {selectedModalidadeId != null && sorted.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: tokens.text.sm,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                          borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                          color: tokens.color.textMuted,
                          fontWeight: 600,
                          fontSize: tokens.text.xs,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Modalidade
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                          borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                          color: tokens.color.textMuted,
                          fontWeight: 600,
                          fontSize: tokens.text.xs,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Ordem
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                          borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                          color: tokens.color.textMuted,
                          fontWeight: 600,
                          fontSize: tokens.text.xs,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Nome
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                          borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                          color: tokens.color.textMuted,
                          fontWeight: 600,
                          fontSize: tokens.text.xs,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Graus / dans
                      </th>
                      <th style={{ width: 1, padding: tokens.space.sm }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((f) => (
                      <tr
                        key={f.id}
                        style={{
                          borderBottom: `1px solid ${tokens.color.borderSubtle}88`,
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td
                          style={{
                            padding: `${tokens.space.md}px`,
                            color: tokens.color.textMuted,
                            fontSize: tokens.text.xs,
                          }}
                        >
                          {f.modalidade_name}
                        </td>
                        <td
                          style={{
                            padding: `${tokens.space.md}px`,
                            color: tokens.color.textMuted,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {f.ordem}
                        </td>
                        <td
                          style={{
                            padding: `${tokens.space.md}px`,
                            fontWeight: 600,
                            color: tokens.color.textPrimary,
                          }}
                        >
                          {f.name}
                        </td>
                        <td style={{ padding: `${tokens.space.md}px`, color: tokens.color.textMuted }}>
                          {f.exibir_como_dan ? "dan" : "grau"} (máx. {f.max_graus})
                        </td>
                        <td
                          style={{
                            padding: `${tokens.space.md}px`,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => startEdit(f)}
                            style={{
                              marginRight: tokens.space.sm,
                              padding: `${tokens.space.xs}px ${tokens.space.md}px`,
                              fontSize: tokens.text.sm,
                              borderRadius: tokens.radius.md,
                              border: `1px solid ${tokens.color.borderSubtle}`,
                              backgroundColor: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(f.id)}
                            style={{
                              padding: `${tokens.space.xs}px ${tokens.space.md}px`,
                              fontSize: tokens.text.sm,
                              borderRadius: tokens.radius.md,
                              border: `1px solid ${tokens.color.error}55`,
                              backgroundColor: `${tokens.color.error}14`,
                              color: tokens.color.error,
                              cursor: "pointer",
                            }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
