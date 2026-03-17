import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

function IconShare(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* share-nodes (3 pontos ligados) */}
      <path
        d="M8.4 11.4 15.6 7.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 12.6 15.6 16.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="6" r="2.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="2.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18" r="2.3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEdit(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUsers(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCredit(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 15h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6l1 16h10l1-16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ui = {
  page: {
    maxWidth: 1280,
    margin: 0,
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: tokens.space.lg,
    marginBottom: tokens.space.lg,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    margin: "6px 0 0 0",
    color: tokens.color.textMuted,
    fontSize: tokens.text.sm,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: tokens.space.lg,
    alignItems: "start",
  } as const,
  card: {
    backgroundColor: "white",
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.color.borderSubtle}`,
    boxShadow: "0 10px 25px rgba(17,24,39,0.06)",
  },
  cardHeader: {
    padding: tokens.space.lg,
    borderBottom: `1px solid rgba(224,214,196,0.8)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.md,
  },
  cardBody: {
    padding: tokens.space.lg,
  },
  h2: {
    margin: 0,
    fontSize: tokens.text.lg,
    fontWeight: 800,
    color: tokens.color.textPrimary,
  },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    color: tokens.color.textPrimary,
    fontSize: tokens.text.xs,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: tokens.radius.md,
    border: `1px solid rgba(224,214,196,0.95)`,
    outline: "none",
    fontSize: tokens.text.sm,
    backgroundColor: "white",
  },
  inputHint: {
    color: tokens.color.textMuted,
    fontSize: 12,
    fontWeight: 500,
  },
  row: {
    display: "flex",
    gap: tokens.space.md,
    flexWrap: "wrap" as const,
    alignItems: "end",
  },
  button: {
    padding: "10px 14px",
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.borderSubtle}`,
    backgroundColor: "white",
    color: tokens.color.textPrimary,
    cursor: "pointer",
    fontSize: tokens.text.sm,
    fontWeight: 700,
  },
  buttonPrimary: {
    backgroundColor: tokens.color.bgCard,
    border: `1px solid ${tokens.color.borderStrong}`,
    color: tokens.color.textOnPrimary,
  },
  buttonGold: {
    backgroundColor: tokens.color.primary,
    border: `1px solid ${tokens.color.primaryDark}`,
    color: tokens.color.textOnPrimary,
  },
  buttonDanger: {
    backgroundColor: "rgba(217,83,79,0.10)",
    border: `1px solid rgba(217,83,79,0.35)`,
    color: tokens.color.error,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: tokens.radius.full,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${tokens.color.borderSubtle}`,
  },
  tableWrap: {
    overflowX: "auto" as const,
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.color.borderSubtle}`,
  },
  table: {
    width: "100%",
    borderCollapse: "separate" as const,
    borderSpacing: 0,
    backgroundColor: "white",
  },
  th: {
    textAlign: "left" as const,
    padding: "12px 12px",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    color: tokens.color.textMuted,
    backgroundColor: "#fafafa",
    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
    position: "sticky" as const,
    top: 0,
    zIndex: 1,
  },
  td: {
    padding: "10px 12px",
    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
    fontSize: tokens.text.sm,
    color: tokens.color.textPrimary,
    verticalAlign: "middle" as const,
  },
  actions: {
    display: "flex",
    gap: 6,
    justifyContent: "flex-end",
    flexWrap: "nowrap" as const,
    alignItems: "center",
  },
  iconBtn: {
    width: 34,
    height: 32,
    padding: 0,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.borderSubtle}`,
    backgroundColor: "white",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    color: tokens.color.textPrimary,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
} as const;

type Faixa = {
  id: number;
  dojo_id: number;
  name: string;
  ordem: number;
  max_graus: number;
  exibir_como_dan: boolean;
};

type Student = {
  id: number;
  dojo_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  modalidade?: string | null;
  user_id?: number | null;
  login_email?: string | null;
  is_active?: boolean;
  faixa_id?: number | null;
  grau?: number;
  graduacao?: string | null;
};

type Guardian = {
  id: number;
  dojo_id: number;
  user_id: number;
  student_id: number;
};

type Plan = {
  id: number;
  dojo_id: number;
  name: string;
  description?: string | null;
  price: number;
  credits_total: number;
  validity_days: number;
  active: boolean;
};

type StudentSubscription = {
  id: number;
  dojo_id: number;
  student_id: number;
  plan_id: number;
  status: "pending_payment" | "active" | "expired" | "canceled";
  start_date: string | null;
  end_date: string | null;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  recurrence_type: string;
};

type StudentPayload = {
  name: string;
  email?: string | null;
  phone?: string | null;
  modalidade?: string | null;
  faixa_id?: number | null;
  grau?: number;
  is_active?: boolean;
};

type StudentCreatedResponse = {
  student: Student;
  initial_password: string;
  login_email: string;
};

export function StudentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await api.get<Student[]>("/api/students");
      return res.data;
    },
  });

  const { data: faixas } = useQuery({
    queryKey: ["faixas"],
    queryFn: async () => {
      const res = await api.get<Faixa[]>("/api/faixas");
      return res.data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["finance", "plans"],
    queryFn: async () => {
      const res = await api.get<Plan[]>("/api/finance/plans");
      return res.data;
    },
  });

  const [form, setForm] = useState<StudentPayload>({
    name: "",
    email: "",
    phone: "",
    modalidade: "",
    faixa_id: null,
    grau: 0,
    is_active: true,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedForGuardians, setSelectedForGuardians] = useState<Student | null>(null);
  const [guardianUserId, setGuardianUserId] = useState<string>("");
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [guardiansError, setGuardiansError] = useState<string | null>(null);

  const [selectedForPlan, setSelectedForPlan] = useState<Student | null>(null);
  const [studentSubscriptions, setStudentSubscriptions] = useState<StudentSubscription[]>([]);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [planIdToAssign, setPlanIdToAssign] = useState<string>("");
  const [planEndDate, setPlanEndDate] = useState<string>("");

  const [filterQuery, setFilterQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterModalidade, setFilterModalidade] = useState<string>("all");
  const [filterFaixaId, setFilterFaixaId] = useState<string>("all");

  const activePlans = useMemo(
    () => (plans ?? []).filter((p) => p.active),
    [plans],
  );

  const plansById = useMemo(() => {
    const map: Record<number, Plan> = {};
    (plans ?? []).forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [plans]);

  const modalidades = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((s) => {
      const m = (s.modalidade ?? "").trim();
      if (m) set.add(m);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [data]);

  const filteredStudents = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const faixaId =
      filterFaixaId === "all"
        ? null
        : filterFaixaId === "none"
          ? -1
          : Number.isFinite(Number(filterFaixaId))
            ? Number(filterFaixaId)
            : null;

    return (data ?? []).filter((s) => {
      const isActive = s.is_active ?? true;
      if (filterStatus === "active" && !isActive) return false;
      if (filterStatus === "inactive" && isActive) return false;

      const m = (s.modalidade ?? "").trim();
      if (filterModalidade !== "all" && m !== filterModalidade) return false;

      if (faixaId === -1 && s.faixa_id != null) return false;
      if (faixaId !== null && faixaId !== -1 && (s.faixa_id ?? null) !== faixaId) return false;

      if (!q) return true;
      const hay = [
        s.name,
        s.email ?? "",
        s.phone ?? "",
        s.modalidade ?? "",
        s.graduacao ?? "",
        s.login_email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, filterFaixaId, filterModalidade, filterQuery, filterStatus]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Nome é obrigatório");
      }
      if (editingId) {
        await api.put(`/api/students/${editingId}`, {
          ...form,
          modalidade: form.modalidade || null,
          faixa_id: form.faixa_id ?? null,
          grau: form.grau ?? 0,
          is_active: form.is_active ?? true,
        });
      } else {
        const res = await api.post<StudentCreatedResponse>(
          "/api/students",
          {
            ...form,
            modalidade: form.modalidade || null,
            faixa_id: form.faixa_id ?? null,
            grau: form.grau ?? 0,
            is_active: form.is_active ?? true,
          },
        );
        const { student, initial_password, login_email } = res.data;
        const loginEmail = login_email;
        // Exibe os dados de acesso gerados para o professor
        alert(
          `Aluno criado com sucesso!\n\nLogin: ${loginEmail}\nSenha inicial: ${initial_password}`,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setForm({ name: "", email: "", phone: "", modalidade: "", faixa_id: null, grau: 0, is_active: true });
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar aluno");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  const startEdit = (student: Student) => {
    setEditingId(student.id);
    setForm({
      name: student.name,
      email: student.email ?? "",
      phone: student.phone ?? "",
      modalidade: student.modalidade ?? "",
      faixa_id: student.faixa_id ?? null,
      grau: student.grau ?? 0,
      is_active: student.is_active ?? true,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", email: "", phone: "", modalidade: "", faixa_id: null, grau: 0, is_active: true });
    setFormError(null);
  };

  const loadGuardians = async (student: Student) => {
    try {
      const res = await api.get<Guardian[]>(`/api/students/${student.id}/guardians`);
      setGuardians(res.data);
      setGuardiansError(null);
    } catch (e) {
      setGuardians([]);
      setGuardiansError("Erro ao carregar responsáveis.");
    }
  };

  const openGuardians = (student: Student) => {
    setSelectedForGuardians(student);
    void loadGuardians(student);
  };

  const addGuardian = async () => {
    if (!selectedForGuardians || !guardianUserId) return;
    try {
      await api.post(`/api/students/${selectedForGuardians.id}/guardians`, {
        user_id: Number(guardianUserId),
      });
      setGuardianUserId("");
      await loadGuardians(selectedForGuardians);
    } catch (e) {
      setGuardiansError("Erro ao adicionar responsável.");
    }
  };

  const removeGuardian = async (userId: number) => {
    if (!selectedForGuardians) return;
    try {
      await api.delete(
        `/api/students/${selectedForGuardians.id}/guardians/${userId}`,
      );
      await loadGuardians(selectedForGuardians);
    } catch (e) {
      setGuardiansError("Erro ao remover responsável.");
    }
  };

  const loadSubscriptions = async (student: Student) => {
    try {
      const res = await api.get<StudentSubscription[]>(
        `/api/finance/students/${student.id}/subscriptions`,
      );
      // Para o professor, consideramos "remover plano" como ocultar
      // assinaturas já canceladas da lista.
      setStudentSubscriptions(res.data.filter((s) => s.status !== "canceled"));
      setSubscriptionsError(null);
    } catch (e) {
      setStudentSubscriptions([]);
      setSubscriptionsError("Erro ao carregar plano/créditos do aluno.");
    }
  };

  const openPlanManager = (student: Student) => {
    setSelectedForPlan(student);
    setPlanIdToAssign("");
    setPlanEndDate("");
    void loadSubscriptions(student);
  };

  const assignPlanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedForPlan) return;
      const planId = Number(planIdToAssign);
      if (!planId) throw new Error("Selecione um plano");
      if (!planEndDate) throw new Error("Defina a data de vencimento");
      await api.post(`/api/finance/students/${selectedForPlan.id}/subscriptions`, {
        plan_id: planId,
        recurrence_type: "none",
        end_date: planEndDate,
      });
    },
    onSuccess: async () => {
      if (!selectedForPlan) return;
      await loadSubscriptions(selectedForPlan);
      queryClient.invalidateQueries({ queryKey: ["finance", "payments-pending"] });
    },
    onError: (err: unknown) => {
      setSubscriptionsError(err instanceof Error ? err.message : "Erro ao atribuir plano.");
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      if (!selectedForPlan) return;
      await api.delete(
        `/api/finance/students/${selectedForPlan.id}/subscriptions/${subscriptionId}`,
      );
    },
    onSuccess: async () => {
      if (!selectedForPlan) return;
      await loadSubscriptions(selectedForPlan);
    },
    onError: (err: unknown) => {
      setSubscriptionsError(
        err instanceof Error
          ? err.message
          : "Erro ao cancelar/remover plano do aluno.",
      );
    },
  });

  return (
    <div style={ui.page}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        .am-grid { display: grid; grid-template-columns: 360px 1fr; gap: ${tokens.space.lg}px; align-items: start; }
        @media (max-width: 1100px) { .am-grid { grid-template-columns: 1fr; } }

        .am-input, .am-select {
          width: 100%;
          max-width: 100%;
          padding: 10px 12px;
          border-radius: ${tokens.radius.md}px;
          border: 1px solid rgba(224,214,196,0.95);
          outline: none;
          font-size: ${tokens.text.sm}px;
          background: #fff;
          box-sizing: border-box;
          transition: box-shadow .15s, border-color .15s, transform .02s;
        }
        .am-input:focus, .am-select:focus {
          border-color: rgba(184,158,93,0.95);
          box-shadow: 0 0 0 4px rgba(184,158,93,0.18);
        }
        .am-btn { transition: transform .02s, filter .15s, box-shadow .15s; }
        .am-btn:hover { filter: brightness(0.98); }
        .am-btn:active { transform: translateY(1px); }

        .am-row-hover:hover { background: #f9fafb !important; }
      `}</style>

      <div style={ui.headerRow}>
        <div>
          <h1 style={ui.title}>Alunos</h1>
          <p style={ui.subtitle}>Cadastre, edite e gerencie acesso, responsáveis e planos.</p>
        </div>
      </div>

      <div className="am-grid">
        {/* Form */}
        <section style={ui.card}>
          <div style={ui.cardHeader}>
            <h2 style={ui.h2}>{editingId ? "Editar aluno" : "Novo aluno"}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="am-btn" style={{ ...ui.button }}>
                Cancelar
              </button>
            )}
          </div>
          <div style={ui.cardBody}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={ui.label}>
                Nome
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="am-input"
                  style={ui.input}
                />
              </label>
              <label style={ui.label}>
                E-mail
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="am-input"
                  style={ui.input}
                />
              </label>
              <label style={ui.label}>
                Telefone
                <input
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="am-input"
                  style={ui.input}
                />
              </label>
              <label style={ui.label}>
                Modalidade
                <input
                  type="text"
                  placeholder="Ex: Jiu-Jitsu, Muay Thai"
                  value={form.modalidade ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}
                  className="am-input"
                  style={ui.input}
                />
                <span style={ui.inputHint}>Ajuda a organizar filtros e relatórios.</span>
              </label>
              <label style={ui.label}>
                Faixa
                <select
                  value={form.faixa_id ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      faixa_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="am-select"
                  style={ui.input}
                >
                  <option value="">— Nenhuma —</option>
                  {faixas?.map((faixa) => (
                    <option key={faixa.id} value={faixa.id}>
                      {faixa.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={ui.label}>
                Grau / Dan
                <input
                  type="number"
                  min={0}
                  value={form.grau ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, grau: Number(e.target.value) || 0 }))}
                  className="am-input"
                  style={ui.input}
                />
              </label>

              <label style={ui.label}>
                Status
                <select
                  value={(form.is_active ?? true) ? "active" : "inactive"}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "active" }))}
                  className="am-select"
                  style={ui.input}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>

              {formError && (
                <div style={{ color: tokens.color.error, fontSize: tokens.text.sm, fontWeight: 700 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="am-btn"
                  style={{
                    ...ui.button,
                    ...ui.buttonGold,
                    opacity: saveMutation.isPending ? 0.85 : 1,
                    flex: 1,
                    boxShadow: "0 10px 18px rgba(184,158,93,0.22)",
                  }}
                >
                  {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
                </button>
                <button type="button" onClick={resetForm} className="am-btn" style={{ ...ui.button, flex: 1 }}>
                  Limpar
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Lista + filtros */}
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.lg }}>
          <section style={ui.card}>
            <div style={ui.cardHeader}>
              <h2 style={ui.h2}>Lista</h2>
              <div style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                {data ? `Exibindo ${filteredStudents.length} de ${data.length}` : "—"}
              </div>
            </div>
            <div style={ui.cardBody}>
              <div style={ui.row}>
                <label style={{ ...ui.label, minWidth: 280, flex: "1 1 320px" }}>
                  Buscar
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Nome, e-mail, telefone, modalidade, graduação..."
                    className="am-input"
                    style={ui.input}
                  />
                </label>
                <label style={{ ...ui.label, minWidth: 180 }}>
                  Status
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
                    className="am-select"
                    style={ui.input}
                  >
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </label>
                <label style={{ ...ui.label, minWidth: 220 }}>
                  Modalidade
                  <select
                    value={filterModalidade}
                    onChange={(e) => setFilterModalidade(e.target.value)}
                    className="am-select"
                    style={ui.input}
                  >
                    <option value="all">Todas</option>
                    {modalidades.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ ...ui.label, minWidth: 220 }}>
                  Faixa
                  <select
                    value={filterFaixaId}
                    onChange={(e) => setFilterFaixaId(e.target.value)}
                    className="am-select"
                    style={ui.input}
                  >
                    <option value="all">Todas</option>
                    <option value="none">— Nenhuma —</option>
                    {faixas?.map((faixa) => (
                      <option key={faixa.id} value={String(faixa.id)}>
                        {faixa.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setFilterQuery("");
                    setFilterStatus("all");
                    setFilterModalidade("all");
                    setFilterFaixaId("all");
                  }}
                  className="am-btn"
                  style={{ ...ui.button, height: 42 }}
                >
                  Limpar
                </button>
              </div>

              {isLoading && <p style={{ marginTop: 12, color: tokens.color.textMuted }}>Carregando...</p>}
              {error && <p style={{ marginTop: 12, color: tokens.color.error, fontWeight: 700 }}>Erro ao carregar alunos.</p>}

              {data && (
                <div style={{ marginTop: tokens.space.md }}>
                  <div style={ui.tableWrap}>
                    <table style={ui.table}>
                      <thead>
                        <tr>
                          <th style={ui.th}>Nome</th>
                          <th style={ui.th}>Status</th>
                          <th style={ui.th}>Modalidade</th>
                          <th style={ui.th}>Graduação</th>
                          <th style={ui.th}>E-mail</th>
                          <th style={ui.th}>Telefone</th>
                          <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, idx) => {
                          const isActive = student.is_active ?? true;
                          const zebra = idx % 2 === 0 ? "white" : "#fcfcfc";
                          return (
                            <tr
                              key={student.id}
                              className="am-row-hover"
                              style={{ backgroundColor: zebra, opacity: isActive ? 1 : 0.72 }}
                            >
                              <td style={ui.td}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <strong style={{ fontWeight: 800 }}>{student.name}</strong>
                                  <span style={{ color: tokens.color.textMuted, fontSize: 11, lineHeight: 1.2 }}>
                                    ID #{student.id}
                                    {student.login_email ? ` • ${student.login_email}` : ""}
                                  </span>
                                </div>
                              </td>
                              <td style={ui.td}>
                                <span
                                  style={{
                                    ...ui.pill,
                                    borderColor: isActive ? "rgba(34,197,94,0.35)" : tokens.color.borderSubtle,
                                    backgroundColor: isActive ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.10)",
                                    color: isActive ? "#166534" : "#374151",
                                  }}
                                >
                                  {isActive ? "Ativo" : "Inativo"}
                                </span>
                              </td>
                              <td style={ui.td}>{student.modalidade ?? "-"}</td>
                              <td style={ui.td}>{student.graduacao ?? "-"}</td>
                              <td style={ui.td}>{student.email ?? "-"}</td>
                              <td style={ui.td}>{student.phone ?? "-"}</td>
                              <td style={{ ...ui.td, textAlign: "right" }}>
                                <div style={ui.actions}>
                                  <button
                                    type="button"
                                    title="Compartilhar acesso"
                                    aria-label="Compartilhar acesso"
                                    onClick={async () => {
                                      const loginEmail = student.login_email ?? "";
                                      const message = `Dados de acesso ao Arena Master:\n\nAluno: ${student.name}\nLogin: ${loginEmail}\nSenha inicial: aluno${student.id
                                        .toString()
                                        .padStart(4, "0")}`;
                                      try {
                                        await navigator.clipboard.writeText(message);
                                        alert("Dados de acesso copiados para a área de transferência.");
                                      } catch {
                                        alert(message);
                                      }
                                    }}
                                    className="am-btn"
                                    style={{ ...ui.iconBtn }}
                                  >
                                    <IconShare />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(student)}
                                    className="am-btn"
                                    style={{ ...ui.iconBtn }}
                                    title="Editar aluno"
                                    aria-label="Editar aluno"
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openGuardians(student)}
                                    className="am-btn"
                                    style={{ ...ui.iconBtn }}
                                    title="Responsáveis"
                                    aria-label="Responsáveis"
                                  >
                                    <IconUsers />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openPlanManager(student)}
                                    className="am-btn"
                                    style={{ ...ui.iconBtn }}
                                    title="Plano / créditos"
                                    aria-label="Plano / créditos"
                                  >
                                    <IconCredit />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteMutation.mutate(student.id)}
                                    className="am-btn"
                                    style={{ ...ui.iconBtn, ...ui.buttonDanger }}
                                    title="Remover aluno"
                                    aria-label="Remover aluno"
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!filteredStudents.length && (
                          <tr>
                            <td colSpan={7} style={{ ...ui.td, color: tokens.color.textMuted }}>
                              Nenhum aluno encontrado com os filtros atuais.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Painéis laterais (mantidos como cards) */}
          {selectedForGuardians && (
            <section style={ui.card}>
              <div style={ui.cardHeader}>
                <h2 style={ui.h2}>Responsáveis</h2>
                <button type="button" onClick={() => setSelectedForGuardians(null)} className="am-btn" style={ui.button}>
                  Fechar
                </button>
              </div>
              <div style={ui.cardBody}>
                <div style={{ marginBottom: 10, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  Aluno: <strong style={{ color: tokens.color.textPrimary }}>{selectedForGuardians.name}</strong>
                </div>
                {guardiansError && <p style={{ color: tokens.color.error, fontWeight: 700 }}>{guardiansError}</p>}
                <div style={{ display: "flex", gap: tokens.space.sm, alignItems: "end", flexWrap: "wrap", marginBottom: tokens.space.md }}>
                  <label style={{ ...ui.label, minWidth: 280, flex: "1 1 320px" }}>
                    ID do usuário responsável
                    <input
                      type="number"
                      value={guardianUserId}
                      onChange={(e) => setGuardianUserId(e.target.value)}
                      className="am-input"
                      style={ui.input}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addGuardian}
                    className="am-btn"
                    style={{ ...ui.button, ...ui.buttonPrimary, height: 42 }}
                  >
                    Adicionar
                  </button>
                </div>
                <div style={ui.tableWrap}>
                  <table style={ui.table}>
                    <thead>
                      <tr>
                        <th style={ui.th}>ID usuário</th>
                        <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guardians.map((g, idx) => (
                        <tr key={g.id} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#fcfcfc" }}>
                          <td style={ui.td}>{g.user_id}</td>
                          <td style={{ ...ui.td, textAlign: "right" }}>
                            <button type="button" onClick={() => removeGuardian(g.user_id)} style={{ ...ui.smallBtn, ...ui.buttonDanger }}>
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!guardians.length && (
                        <tr>
                          <td colSpan={2} style={{ ...ui.td, color: tokens.color.textMuted }}>
                            Nenhum responsável cadastrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {selectedForPlan && (
            <section style={ui.card}>
              <div style={ui.cardHeader}>
                <h2 style={ui.h2}>Plano / créditos</h2>
                <button type="button" onClick={() => setSelectedForPlan(null)} className="am-btn" style={ui.button}>
                  Fechar
                </button>
              </div>
              <div style={ui.cardBody}>
                <div style={{ marginBottom: 10, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  Aluno: <strong style={{ color: tokens.color.textPrimary }}>{selectedForPlan.name}</strong>
                </div>
                {subscriptionsError && <p style={{ color: tokens.color.error, fontWeight: 700 }}>{subscriptionsError}</p>}

                <div style={{ display: "flex", gap: tokens.space.sm, alignItems: "end", flexWrap: "wrap", marginBottom: tokens.space.md }}>
                  <label style={{ ...ui.label, minWidth: 320, flex: "1 1 360px" }}>
                    Selecionar plano
                    <select
                      value={planIdToAssign}
                      onChange={(e) => setPlanIdToAssign(e.target.value)}
                      className="am-select"
                      style={ui.input}
                    >
                      <option value="">— Selecione —</option>
                      {activePlans.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name} — {p.credits_total} créditos — R$ {p.price.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ ...ui.label, minWidth: 220 }}>
                    Data de vencimento
                    <input
                      type="date"
                      value={planEndDate}
                      onChange={(e) => setPlanEndDate(e.target.value)}
                      className="am-input"
                      style={ui.input}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => assignPlanMutation.mutate()}
                    disabled={assignPlanMutation.isPending || !planIdToAssign || !planEndDate}
                    className="am-btn"
                    style={{
                      ...ui.button,
                      ...ui.buttonGold,
                      height: 42,
                      opacity: assignPlanMutation.isPending || !planIdToAssign || !planEndDate ? 0.7 : 1,
                      boxShadow: "0 10px 18px rgba(184,158,93,0.22)",
                    }}
                  >
                    {assignPlanMutation.isPending ? "Atribuindo..." : "Atribuir plano"}
                  </button>
                </div>

                <div style={ui.tableWrap}>
                  <table style={ui.table}>
                    <thead>
                      <tr>
                        <th style={ui.th}>Assinatura</th>
                        <th style={ui.th}>Status</th>
                        <th style={ui.th}>Créditos</th>
                        <th style={ui.th}>Vigência</th>
                        <th style={{ ...ui.th, textAlign: "right" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentSubscriptions.map((s, idx) => (
                        <tr key={s.id} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#fcfcfc" }}>
                          <td style={ui.td}>{plansById[s.plan_id]?.name ?? `Plano ${s.plan_id}`}</td>
                          <td style={ui.td}>{s.status}</td>
                          <td style={ui.td}>
                            <strong>{s.credits_remaining}</strong> / {s.credits_total}
                          </td>
                          <td style={ui.td}>
                            {s.start_date ? new Date(s.start_date).toLocaleDateString("pt-BR") : "-"} até{" "}
                            {s.end_date ? new Date(s.end_date).toLocaleDateString("pt-BR") : "-"}
                          </td>
                          <td style={{ ...ui.td, textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => cancelSubscriptionMutation.mutate(s.id)}
                              disabled={cancelSubscriptionMutation.isPending}
                              style={{ ...ui.smallBtn, ...ui.buttonDanger }}
                            >
                              Remover plano
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!studentSubscriptions.length && (
                        <tr>
                          <td colSpan={5} style={{ ...ui.td, color: tokens.color.textMuted }}>
                            Nenhuma assinatura encontrada para este aluno ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p style={{ marginTop: 12, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  Ao atribuir um plano, o sistema cria uma cobrança pendente para o aluno enviar comprovante no app. Os créditos só ficam ativos após confirmação do professor.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>

    </div>
  );
}


