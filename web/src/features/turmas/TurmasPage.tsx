import { FormEvent, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import { ModalidadesCrudModal, ModalidadesOpenButton } from "./ModalidadesCrudModal";

type Turma = {
  id: number;
  dojo_id: number;
  name: string;
  description: string | null;
  modalidade?: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  active: boolean;
  tipo: string;
};

type TurmaPayload = {
  name: string;
  description?: string | null;
  modalidade: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  active: boolean;
  tipo: string;
};

const DAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

const defaultPayload: TurmaPayload = {
  name: "",
  description: "",
  modalidade: "",
  day_of_week: "seg",
  start_time: "19:00",
  end_time: "20:00",
  capacity: 20,
  active: true,
  tipo: "regular",
};

const cardStyle: CSSProperties = {
  padding: tokens.space.xl,
  backgroundColor: "#fff",
  borderRadius: tokens.radius.lg,
  boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
  border: `1px solid ${tokens.color.borderSubtle}`,
};

const inputBase: CSSProperties = {
  width: "100%",
  padding: `${tokens.space.sm}px ${tokens.space.md}px`,
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.borderSubtle}`,
  fontSize: tokens.text.sm,
  boxSizing: "border-box",
  backgroundColor: "#fff",
  color: tokens.color.textPrimary,
};

function formatDays(dayOfWeek: string) {
  return dayOfWeek
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((code) => DAYS.find((day) => day.value === code)?.label ?? code)
    .join(", ");
}

export function TurmasPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const res = await api.get<Turma[]>("/api/turmas/");
      return res.data;
    },
  });

  const { data: modalidadesApi } = useQuery({
    queryKey: ["turmas-modalidades"],
    queryFn: async () => {
      const res = await api.get<string[]>("/api/turmas/modalidades");
      return res.data;
    },
  });

  const [form, setForm] = useState<TurmaPayload>(defaultPayload);
  const [selectedDays, setSelectedDays] = useState<string[]>(["seg"]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalidadesCrudOpen, setModalidadesCrudOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Nome é obrigatório");
      }
      const modalidadeTrim = form.modalidade.trim();
      if (!modalidadeTrim) {
        throw new Error("Selecione ou informe a modalidade");
      }
      if (selectedDays.length === 0) {
        throw new Error("Selecione pelo menos um dia da semana");
      }
      const payload: TurmaPayload = {
        ...form,
        modalidade: modalidadeTrim,
        day_of_week: selectedDays.join(","),
      };
      if (editingId) {
        await api.put(`/api/turmas/${editingId}`, payload);
      } else {
        await api.post("/api/turmas/", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turmas"] });
      queryClient.invalidateQueries({ queryKey: ["turmas-modalidades"] });
      queryClient.invalidateQueries({ queryKey: ["modalidades-catalog"] });
      setForm(defaultPayload);
      setSelectedDays(["seg"]);
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar turma");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/turmas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turmas"] });
      queryClient.invalidateQueries({ queryKey: ["turmas-modalidades"] });
      queryClient.invalidateQueries({ queryKey: ["modalidades-catalog"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const startEdit = (turma: Turma) => {
    setEditingId(turma.id);
    const days = turma.day_of_week
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    setSelectedDays(days.length ? days : ["seg"]);
    setForm({
      name: turma.name,
      description: turma.description ?? "",
      modalidade: turma.modalidade ?? "",
      day_of_week: turma.day_of_week,
      start_time: turma.start_time.slice(0, 5),
      end_time: turma.end_time.slice(0, 5),
      capacity: turma.capacity,
      active: turma.active,
      tipo: turma.tipo,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultPayload);
    setFormError(null);
    setSelectedDays(["seg"]);
  };

  const activeCount = data?.filter((t) => t.active).length ?? 0;
  const totalCount = data?.length ?? 0;

  const modalidadeSelectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of modalidadesApi ?? []) {
      const t = m.trim();
      if (t) set.add(t);
    }
    const cur = form.modalidade.trim();
    if (cur) set.add(cur);
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }, [modalidadesApi, form.modalidade]);

  const modalidadeTrimmed = form.modalidade.trim();
  const modalidadeSelectValue =
    modalidadeTrimmed === "" ? "" : modalidadeTrimmed;

  const btnPrimary: CSSProperties = {
    padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
    backgroundColor: tokens.color.primary,
    color: tokens.color.textOnPrimary,
    borderRadius: tokens.radius.md,
    border: "none",
    cursor: "pointer",
    fontSize: tokens.text.sm,
    fontWeight: 600,
  };

  const btnSecondary: CSSProperties = {
    padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
    backgroundColor: "#fff",
    color: tokens.color.textPrimary,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.borderSubtle}`,
    cursor: "pointer",
    fontSize: tokens.text.sm,
    fontWeight: 500,
  };

  const btnDanger: CSSProperties = {
    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
    fontSize: tokens.text.sm,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.error}55`,
    backgroundColor: `${tokens.color.error}14`,
    color: tokens.color.error,
    cursor: "pointer",
    fontWeight: 500,
  };

  return (
    <div
      style={{
        padding: tokens.space.xl,
        maxWidth: 1120,
        margin: "0 auto",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      <ModalidadesCrudModal
        open={modalidadesCrudOpen}
        onClose={() => setModalidadesCrudOpen(false)}
      />
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
          Turmas
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: tokens.text.sm,
            color: tokens.color.textMuted,
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          Cadastre horários, capacidade e tipo de cada turma do dojo.
        </p>
      </header>

      {data && data.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: tokens.space.lg,
            marginBottom: tokens.space.xl,
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: tokens.space.xs,
                fontWeight: 600,
              }}
            >
              Total de turmas
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: tokens.color.primaryDark,
              }}
            >
              {totalCount}
            </div>
          </div>
          <div style={cardStyle}>
            <div
              style={{
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: tokens.space.xs,
                fontWeight: 600,
              }}
            >
              Turmas ativas
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: tokens.color.success,
              }}
            >
              {activeCount}
            </div>
          </div>
        </div>
      )}

      <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
        <div
          style={{
            marginBottom: tokens.space.lg,
            paddingBottom: tokens.space.md,
            borderBottom: `1px solid ${tokens.color.borderSubtle}`,
          }}
        >
          <h2
            style={{
              fontSize: tokens.text.lg,
              fontWeight: 600,
              color: tokens.color.textPrimary,
              margin: 0,
            }}
          >
            {editingId ? "Editar turma" : "Nova turma"}
          </h2>
          <p
            style={{
              margin: `${tokens.space.xs}px 0 0`,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
            }}
          >
            {editingId
              ? "Ajuste os dados e salve para atualizar a turma."
              : "Preencha os campos abaixo para criar uma nova turma no dojo."}
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: tokens.space.lg,
          }}
        >
          <label
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.xs,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Nome
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              style={inputBase}
              placeholder="Ex.: Judô – Iniciantes"
            />
          </label>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.sm,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Modalidade
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: tokens.space.sm,
                maxWidth: 480,
              }}
            >
              <select
                value={modalidadeSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, modalidade: v }));
                }}
                style={{
                  ...inputBase,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <option value="">Selecione uma modalidade</option>
                {modalidadeSelectOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ModalidadesOpenButton
                onClick={() => setModalidadesCrudOpen(true)}
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
                lineHeight: 1.45,
              }}
            >
              O select inclui o catálogo do dojo e modalidades já usadas em turmas ou
              alunos. Use o botão + para cadastrar, editar ou excluir modalidades.
            </p>
          </div>
          <label
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.xs,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Descrição
            </span>
            <textarea
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              style={{
                ...inputBase,
                resize: "vertical",
                minHeight: 64,
                lineHeight: 1.45,
              }}
              placeholder="Opcional — público-alvo, observações…"
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
                display: "block",
                marginBottom: tokens.space.sm,
              }}
            >
              Dias da semana
            </span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: tokens.space.sm,
              }}
            >
              {DAYS.map((day) => {
                const on = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      setSelectedDays((current) =>
                        on
                          ? current.filter((d) => d !== day.value)
                          : [...current, day.value],
                      );
                    }}
                    style={{
                      padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                      borderRadius: tokens.radius.full,
                      border: `1px solid ${
                        on ? tokens.color.primary : tokens.color.borderSubtle
                      }`,
                      backgroundColor: on ? `${tokens.color.primary}22` : "#fff",
                      color: on ? tokens.color.primaryDark : tokens.color.textMuted,
                      fontSize: tokens.text.sm,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.xs,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Capacidade
            </span>
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
              }
              style={inputBase}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.xs,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Início
            </span>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
              style={inputBase}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.xs,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Término
            </span>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, end_time: e.target.value }))
              }
              style={inputBase}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.xs,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Tipo
            </span>
            <select
              value={form.tipo}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipo: e.target.value }))
              }
              style={inputBase}
            >
              <option value="regular">Regular</option>
              <option value="kids">KIDS</option>
            </select>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.space.sm,
              marginTop: tokens.space.lg,
            }}
          >
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
              style={{ width: 18, height: 18, accentColor: tokens.color.primary }}
            />
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 500,
                color: tokens.color.textPrimary,
              }}
            >
              Turma ativa
            </span>
          </label>
          {formError && (
            <div
              style={{
                gridColumn: "1 / -1",
                color: tokens.color.error,
                fontSize: tokens.text.sm,
                padding: tokens.space.md,
                backgroundColor: `${tokens.color.error}12`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.error}40`,
              }}
            >
              {formError}
            </div>
          )}
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexWrap: "wrap",
              gap: tokens.space.sm,
              marginTop: tokens.space.sm,
            }}
          >
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{
                ...btnPrimary,
                opacity: saveMutation.isPending ? 0.7 : 1,
                cursor: saveMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {saveMutation.isPending
                ? "Salvando..."
                : editingId
                  ? "Atualizar turma"
                  : "Criar turma"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={btnSecondary}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      {isLoading && (
        <p
          style={{
            color: tokens.color.textMuted,
            fontSize: tokens.text.sm,
          }}
        >
          Carregando turmas…
        </p>
      )}
      {error && (
        <div
          style={{
            ...cardStyle,
            color: tokens.color.error,
            fontSize: tokens.text.sm,
          }}
        >
          Não foi possível carregar as turmas. Tente novamente em instantes.
        </div>
      )}
      {data && data.length === 0 && !isLoading && (
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            padding: tokens.space.xl * 2,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: tokens.text.md,
              fontWeight: 600,
              color: tokens.color.textPrimary,
            }}
          >
            Nenhuma turma cadastrada
          </p>
          <p
            style={{
              margin: `${tokens.space.md}px 0 0`,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
              maxWidth: 360,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.5,
            }}
          >
            Use o formulário acima para criar a primeira turma do seu dojo.
          </p>
        </div>
      )}
      {data && data.length > 0 && (
        <section style={cardStyle}>
          <div
            style={{
              marginBottom: tokens.space.lg,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: tokens.space.md,
            }}
          >
            <h2
              style={{
                fontSize: tokens.text.lg,
                fontWeight: 600,
                color: tokens.color.textPrimary,
                margin: 0,
              }}
            >
              Turmas cadastradas
            </h2>
            <span
              style={{
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              {totalCount} {totalCount === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div style={{ overflowX: "auto", margin: `0 -${tokens.space.sm}px` }}>
            <table
              style={{
                width: "100%",
                minWidth: 840,
                borderCollapse: "collapse",
                fontSize: tokens.text.sm,
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: `${tokens.color.borderSubtle}55`,
                  }}
                >
                  {[
                    "Turma",
                    "Modalidade",
                    "Dias",
                    "Horário",
                    "Cap.",
                    "Tipo",
                    "Status",
                    "",
                  ].map(
                    (h) => (
                      <th
                        key={h || "actions"}
                        style={{
                          textAlign: "left",
                          padding: `${tokens.space.md}px ${tokens.space.lg}px`,
                          fontWeight: 600,
                          color: tokens.color.textMuted,
                          fontSize: tokens.text.xs,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((turma) => (
                  <tr
                    key={turma.id}
                    style={{
                      backgroundColor: turma.active
                        ? "transparent"
                        : `${tokens.color.borderSubtle}33`,
                      borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    }}
                  >
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          fontWeight: 600,
                          color: tokens.color.textPrimary,
                          maxWidth: 200,
                          verticalAlign: "top",
                        }}
                      >
                        {turma.name}
                        {turma.description ? (
                          <div
                            style={{
                              fontWeight: 400,
                              color: tokens.color.textMuted,
                              fontSize: tokens.text.xs,
                              marginTop: tokens.space.xs,
                              lineHeight: 1.4,
                            }}
                          >
                            {turma.description}
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          color: tokens.color.textPrimary,
                          verticalAlign: "top",
                          maxWidth: 140,
                        }}
                      >
                        {turma.modalidade?.trim()
                          ? turma.modalidade
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          color: tokens.color.textPrimary,
                          whiteSpace: "nowrap",
                          verticalAlign: "top",
                        }}
                      >
                        {formatDays(turma.day_of_week)}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          color: tokens.color.textPrimary,
                          whiteSpace: "nowrap",
                          verticalAlign: "top",
                        }}
                      >
                        {turma.start_time.slice(0, 5)} –{" "}
                        {turma.end_time.slice(0, 5)}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          color: tokens.color.textPrimary,
                          verticalAlign: "top",
                        }}
                      >
                        {turma.capacity}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          verticalAlign: "top",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: `${2 + tokens.space.xs}px ${tokens.space.sm}px`,
                            borderRadius: tokens.radius.full,
                            fontSize: tokens.text.xs,
                            fontWeight: 600,
                            backgroundColor:
                              turma.tipo === "kids"
                                ? `${tokens.color.kids}33`
                                : `${tokens.color.primary}22`,
                            color:
                              turma.tipo === "kids"
                                ? "#854d0e"
                                : tokens.color.primaryDark,
                          }}
                        >
                          {turma.tipo === "kids" ? "KIDS" : "Regular"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          verticalAlign: "top",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: tokens.text.xs,
                            fontWeight: 600,
                            color: turma.active
                              ? tokens.color.success
                              : tokens.color.textMuted,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: turma.active
                                ? tokens.color.success
                                : tokens.color.borderSubtle,
                            }}
                          />
                          {turma.active ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: `${tokens.space.lg}px`,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          verticalAlign: "top",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => startEdit(turma)}
                          style={btnSecondary}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(turma.id)}
                          style={{
                            ...btnDanger,
                            marginLeft: tokens.space.sm,
                          }}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
