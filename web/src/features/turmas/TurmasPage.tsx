import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  const [isCompactList, setIsCompactList] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false,
  );
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);
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
    setIsFormCollapsed(false);
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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const onChange = () => setIsCompactList(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

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
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: tokens.space.md,
          }}
        >
          <div>
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
          <button
            type="button"
            onClick={() => setIsFormCollapsed((current) => !current)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              flexShrink: 0,
              padding: 0,
              backgroundColor: "#fff",
              color: tokens.color.textPrimary,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              cursor: "pointer",
            }}
            aria-expanded={!isFormCollapsed}
            aria-label={
              isFormCollapsed
                ? "Expandir formulário de turma"
                : "Recolher formulário de turma"
            }
          >
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {isFormCollapsed ? (
                <path d="M6 9l6 6 6-6" />
              ) : (
                <path d="M18 15l-6-6-6 6" />
              )}
            </svg>
          </button>
        </div>
        {!isFormCollapsed && (
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
        )}
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
              marginBottom: isCompactList ? tokens.space.md : tokens.space.lg,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.space.md,
            }}
          >
            <h2
              style={{
                fontSize: isCompactList ? tokens.text.md : tokens.text.lg,
                fontWeight: 700,
                color: tokens.color.textPrimary,
                margin: 0,
                letterSpacing: isCompactList ? "-0.02em" : undefined,
              }}
            >
              Turmas cadastradas
            </h2>
            <span
              style={{
                fontSize: tokens.text.xs,
                fontWeight: 600,
                ...(isCompactList
                  ? {
                      color: tokens.color.primaryDark,
                      padding: "6px 12px",
                      borderRadius: tokens.radius.full,
                      backgroundColor: "rgba(184, 158, 93, 0.14)",
                      border: "1px solid rgba(140, 116, 64, 0.22)",
                    }
                  : {
                      color: tokens.color.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }),
              }}
            >
              {totalCount} {totalCount === 1 ? "registro" : "registros"}
            </span>
          </div>
          {isCompactList ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.space.md,
                paddingTop: 2,
              }}
            >
              {data.map((turma) => {
                const modalidadeLine = turma.modalidade?.trim()
                  ? turma.modalidade
                  : null;
                const daysLine = formatDays(turma.day_of_week);
                const metaSubtitle = [modalidadeLine, daysLine]
                  .filter(Boolean)
                  .join(" · ");
                const tipoPillStyle: CSSProperties = {
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: tokens.radius.full,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  backgroundColor:
                    turma.tipo === "kids"
                      ? "rgba(250, 204, 21, 0.22)"
                      : "rgba(184, 158, 93, 0.18)",
                  color:
                    turma.tipo === "kids" ? "#854d0e" : tokens.color.primaryDark,
                  border:
                    turma.tipo === "kids"
                      ? "1px solid rgba(180, 140, 20, 0.28)"
                      : "1px solid rgba(140, 116, 64, 0.22)",
                };
                return (
                  <article
                    key={turma.id}
                    style={{
                      borderRadius: tokens.radius.lg,
                      padding: `${tokens.space.md + 2}px ${tokens.space.lg}px`,
                      backgroundColor: "#fff",
                      boxShadow: turma.active
                        ? "0 1px 0 rgba(27, 48, 63, 0.05), 0 10px 28px rgba(27, 48, 63, 0.07)"
                        : "0 1px 0 rgba(27, 48, 63, 0.04), 0 6px 20px rgba(27, 48, 63, 0.05)",
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      borderLeftWidth: turma.active ? 1 : 3,
                      borderLeftColor: turma.active
                        ? tokens.color.borderSubtle
                        : "#94a3b8",
                      boxSizing: "border-box",
                      opacity: turma.active ? 1 : 0.94,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: tokens.space.md,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: tokens.text.md,
                          fontWeight: 700,
                          color: tokens.color.textPrimary,
                          lineHeight: 1.3,
                          letterSpacing: "-0.02em",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {turma.name}
                      </h3>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 11px",
                          borderRadius: tokens.radius.full,
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          backgroundColor: turma.active
                            ? "rgba(34, 197, 94, 0.11)"
                            : "rgba(107, 114, 128, 0.1)",
                          color: turma.active ? "#166534" : "#4b5563",
                          border: `1px solid ${
                            turma.active
                              ? "rgba(34, 197, 94, 0.28)"
                              : "rgba(107, 114, 128, 0.22)"
                          }`,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: turma.active
                              ? tokens.color.success
                              : tokens.color.borderSubtle,
                          }}
                        />
                        {turma.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    {metaSubtitle ? (
                      <p
                        style={{
                          margin: `${tokens.space.sm}px 0 0`,
                          fontSize: tokens.text.sm,
                          color: tokens.color.textMuted,
                          lineHeight: 1.45,
                        }}
                      >
                        {metaSubtitle}
                      </p>
                    ) : null}
                    <div
                      style={{
                        marginTop: tokens.space.sm,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        columnGap: tokens.space.md,
                        rowGap: tokens.space.xs,
                        fontSize: tokens.text.sm,
                        color: tokens.color.textPrimary,
                      }}
                    >
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 500,
                        }}
                      >
                        {turma.start_time.slice(0, 5)} –{" "}
                        {turma.end_time.slice(0, 5)}
                      </span>
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          backgroundColor: tokens.color.borderSubtle,
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span style={{ color: tokens.color.textMuted }}>
                        até {turma.capacity}{" "}
                        {turma.capacity === 1 ? "aluno" : "alunos"}
                      </span>
                      <span style={tipoPillStyle}>
                        {turma.tipo === "kids" ? "KIDS" : "Regular"}
                      </span>
                    </div>
                    {turma.description ? (
                      <p
                        style={{
                          margin: `${tokens.space.sm}px 0 0`,
                          fontSize: tokens.text.xs,
                          color: tokens.color.textMuted,
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as const,
                          overflow: "hidden",
                        }}
                      >
                        {turma.description}
                      </p>
                    ) : null}
                    <div
                      style={{
                        marginTop: tokens.space.md,
                        paddingTop: tokens.space.md,
                        borderTop: `1px solid ${tokens.color.borderSubtle}`,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: tokens.space.sm,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => startEdit(turma)}
                        style={{
                          ...btnSecondary,
                          minHeight: 46,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          borderRadius: tokens.radius.md,
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(turma.id)}
                        style={{
                          ...btnDanger,
                          minHeight: 46,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          borderRadius: tokens.radius.md,
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
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
                    ].map((h) => (
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
                    ))}
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
                        {turma.modalidade?.trim() ? turma.modalidade : "—"}
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
          )}
        </section>
      )}
    </div>
  );
}
