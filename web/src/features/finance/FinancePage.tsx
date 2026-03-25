import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type Plan = {
  id: number;
  dojo_id: number;
  name: string;
  description?: string | null;
  /** Vazio/null = qualquer modalidade */
  modalidades?: string[] | null;
  price: number;
  credits_total: number;
  validity_days: number;
  active: boolean;
};

function planChecksModality(plan: Plan | null, modality: string): boolean {
  if (!plan?.modalidades?.length) return false;
  return plan.modalidades.some(
    (x) =>
      String(x).trim().localeCompare(modality, "pt-BR", { sensitivity: "base" }) === 0,
  );
}

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

type Payment = {
  id: number;
  dojo_id: number;
  student_id: number;
  subscription_id: number | null;
  student_name?: string | null;
  amount: number;
  method: string;
  status: "pending_confirmation" | "confirmed" | "rejected";
  payment_date: string | null;
  confirmed_at: string | null;
  receipt_path?: string | null;
  notes?: string | null;
};

type PixConfig = {
  dojo_id: number;
  key_type: string;
  key_value: string;
  recipient_name?: string | null;
  bank_name?: string | null;
  instructions?: string | null;
  static_qr_image_path?: string | null;
};

type StudentFinanceStatus = {
  student_id: number;
  student_name: string;
  plan_name: string | null;
  subscription_status: "pending_payment" | "active" | "expired" | "canceled" | null;
  credits_remaining: number | null;
  end_date: string | null;
  last_payment_status: "pending_confirmation" | "confirmed" | "rejected" | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
};

export function FinancePage() {
  const queryClient = useQueryClient();
  const [isNarrowScreen, setIsNarrowScreen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1080px)").matches : false
  );
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1080px)");
    const onChange = () => setIsNarrowScreen(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const { data: plans } = useQuery({
    queryKey: ["finance", "plans"],
    queryFn: async () => {
      const res = await api.get<Plan[]>("/api/finance/plans");
      return res.data;
    },
  });

  const { data: modalidadesCatalog } = useQuery({
    queryKey: ["turmas-modalidades"],
    queryFn: async () => {
      const res = await api.get<string[]>("/api/turmas/modalidades");
      return res.data;
    },
  });

  const modalidadePlanOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of modalidadesCatalog ?? []) {
      const t = m.trim();
      if (t) set.add(t);
    }
    for (const x of editingPlan?.modalidades ?? []) {
      const t = String(x).trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }, [modalidadesCatalog, editingPlan?.modalidades]);

  const { data: payments } = useQuery({
    queryKey: ["finance", "payments-pending"],
    queryFn: async () => {
      const res = await api.get<Payment[]>("/api/finance/payments");
      return res.data;
    },
  });

  const { data: pixConfig } = useQuery({
    queryKey: ["finance", "pix-config"],
    queryFn: async () => {
      const res = await api.get<PixConfig>("/api/finance/pix-config");
      return res.data;
    },
  });

  const { data: studentsStatus } = useQuery({
    queryKey: ["finance", "students-status"],
    queryFn: async () => {
      const res = await api.get<StudentFinanceStatus[]>("/api/finance/students/status");
      return res.data;
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (payload: Partial<Plan>) => {
      await api.post("/api/finance/plans", {
        name: payload.name,
        description: payload.description,
        modalidades: payload.modalidades ?? null,
        price: payload.price,
        credits_total: payload.credits_total,
        validity_days: payload.validity_days ?? 30,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "plans"] });
      setEditingPlan(null);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (payload: Plan) => {
      await api.put(`/api/finance/plans/${payload.id}`, {
        name: payload.name,
        description: payload.description,
        modalidades: payload.modalidades ?? null,
        price: payload.price,
        credits_total: payload.credits_total,
        validity_days: payload.validity_days,
        active: payload.active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "plans"] });
      setEditingPlan(null);
    },
  });

  const updatePixMutation = useMutation({
    mutationFn: async (payload: PixConfig) => {
      await api.put("/api/finance/pix-config", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "pix-config"] });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      await api.post(`/api/finance/payments/${paymentId}/confirm`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "payments-pending"] });
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      await api.post(`/api/finance/payments/${paymentId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "payments-pending"] });
    },
  });

  // Form state simples via DOM (não usamos useState para evitar muito boilerplate)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.space.lg,
        maxWidth: 1320,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: tokens.space.md,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
            }}
          >
            Financeiro
          </h1>
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
            }}
          >
            Gerencie planos, configurações de PIX e acompanhe os pagamentos dos alunos.
          </p>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrowScreen ? "1fr" : "2fr 1.5fr",
          gap: tokens.space.xl,
          alignItems: "flex-start",
        }}
      >
        <section
          style={{
            display: "contents",
          }}
        >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            border: `1px solid ${tokens.color.borderSubtle}`,
            gridColumn: isNarrowScreen ? "1" : "1",
            gridRow: isNarrowScreen ? "3" : "2",
          }}
        >
        <h2
          style={{
            margin: 0,
            marginBottom: tokens.space.sm,
            fontSize: 20,
          }}
        >
          Planos de mensalidade
        </h2>
        <p
          style={{
            marginTop: 0,
            marginBottom: tokens.space.lg,
            fontSize: tokens.text.sm,
            color: tokens.color.textMuted,
          }}
        >
          Crie planos com quantidade de aulas (créditos) e validade em dias. Marque uma ou mais{" "}
          <strong>modalidades</strong> para restringir o plano a essas opções no link de matrícula e no
          app; deixe todas desmarcadas para plano genérico (qualquer modalidade).
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isNarrowScreen ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
            gap: tokens.space.md,
            marginBottom: tokens.space.lg,
          }}
        >
          {plans?.map((plan) => (
            <div
              key={plan.id}
              style={{
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
                padding: tokens.space.md,
                backgroundColor: plan.active ? "#f9fafb" : "#f3f4f6",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <strong>{plan.name}</strong>
                <span
                  style={{
                    fontSize: tokens.text.xs,
                    padding: "2px 8px",
                    borderRadius: 999,
                    backgroundColor: plan.active ? "#dcfce7" : "#e5e7eb",
                    color: plan.active ? "#166534" : "#4b5563",
                  }}
                >
                  {plan.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div
                style={{
                  fontSize: tokens.text.sm,
                  color: tokens.color.textMuted,
                  marginBottom: 8,
                }}
              >
                {plan.description || "Sem descrição"}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  fontSize: tokens.text.sm,
                }}
              >
                <span>
                  <strong>{plan.credits_total}</strong> créditos
                </span>
                <span>
                  <strong>R$ {plan.price.toFixed(2)}</strong>
                </span>
                <span>{plan.validity_days} dias</span>
              </div>
              <div
                style={{
                  marginTop: tokens.space.xs,
                  fontSize: tokens.text.xs,
                  color: tokens.color.textMuted,
                }}
              >
                {(() => {
                  const mods = (plan.modalidades ?? [])
                    .map((x) => String(x).trim())
                    .filter(Boolean);
                  return mods.length ? `Modalidades: ${mods.join(", ")}` : "Modalidades: qualquer";
                })()}
              </div>
              <div
                style={{
                  marginTop: tokens.space.sm,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: tokens.space.sm,
                  fontSize: tokens.text.xs,
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: tokens.radius.sm,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  Editar
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={plan.active}
                    readOnly
                    style={{ margin: 0 }}
                  />
                  <span>Ativo</span>
                </label>
              </div>
            </div>
          ))}
          {!plans?.length && (
            <div
              style={{
                padding: tokens.space.md,
                borderRadius: tokens.radius.md,
                border: `1px dashed ${tokens.color.borderSubtle}`,
                fontSize: tokens.text.sm,
                color: tokens.color.textMuted,
              }}
            >
              Nenhum plano cadastrado ainda. Crie o primeiro plano usando o formulário
              abaixo.
            </div>
          )}
        </div>

        <form
          key={editingPlan ? `edit-plan-${editingPlan.id}` : "new-plan"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const name = String(formData.get("name") ?? "").trim();
            const description = String(formData.get("description") ?? "").trim();
            const price = Number(formData.get("price") ?? "0");
            const credits = Number(formData.get("credits_total") ?? "0");
            const validity = Number(formData.get("validity_days") ?? "30");
            const activeFlag = formData.get("active") === "on";
            const modalidadesSel = formData
              .getAll("modalidades")
              .map((v) => String(v).trim())
              .filter(Boolean);
            const modalidades = modalidadesSel.length > 0 ? modalidadesSel : null;
            if (!name || !price || !credits) return;

            if (editingPlan) {
              updatePlanMutation.mutate({
                ...editingPlan,
                name,
                description,
                modalidades,
                price,
                credits_total: credits,
                validity_days: validity,
                active: activeFlag,
              });
            } else {
              createPlanMutation.mutate({
                name,
                description,
                modalidades,
                price,
                credits_total: credits,
                validity_days: validity,
              });
              form.reset();
            }
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.lg,
            marginTop: tokens.space.sm,
            padding: tokens.space.lg,
            borderRadius: tokens.radius.lg,
            border: `1px solid ${tokens.color.borderSubtle}`,
            backgroundColor: "rgba(250, 250, 249, 0.85)",
            boxSizing: "border-box",
          }}
        >
          {/* Modalidades */}
          <fieldset
            style={{
              margin: 0,
              padding: 0,
              border: "none",
            }}
          >
            <legend
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 700,
                color: tokens.color.textPrimary,
                padding: 0,
                marginBottom: tokens.space.xs,
              }}
            >
              Modalidades do plano
            </legend>
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: tokens.text.xs,
                color: tokens.color.textMuted,
                lineHeight: 1.5,
                maxWidth: 720,
              }}
            >
              Nenhuma selecionada = plano vale para <strong>qualquer</strong> modalidade. Marque uma ou
              várias para restringir (ex.: Boxe e MMA no mesmo plano).
            </p>
            <div
              role="group"
              aria-label="Modalidades aplicáveis ao plano"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
              }}
            >
              {modalidadePlanOptions.length === 0 ? (
                <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>
                  Cadastre modalidades em Turmas para listar aqui.
                </span>
              ) : (
                modalidadePlanOptions.map((m) => (
                  <label
                    key={m}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 999,
                      backgroundColor: "white",
                      border: `1px solid rgba(0,0,0,0.06)`,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      fontSize: tokens.text.sm,
                      fontWeight: 600,
                      color: tokens.color.textPrimary,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="modalidades"
                      value={m}
                      defaultChecked={planChecksModality(editingPlan, m)}
                      style={{
                        margin: 0,
                        width: 16,
                        height: 16,
                        accentColor: tokens.color.primary,
                        cursor: "pointer",
                      }}
                    />
                    {m}
                  </label>
                ))
              )}
            </div>
          </fieldset>

          <div
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${tokens.color.borderSubtle}, transparent)`,
              margin: 0,
            }}
          />

          {/* Dados do plano */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.md,
            }}
          >
            <span
              style={{
                fontSize: tokens.text.sm,
                fontWeight: 700,
                color: tokens.color.textPrimary,
              }}
            >
              Dados do plano
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="plan-form-name"
                style={{
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  color: tokens.color.textPrimary,
                }}
              >
                Nome do plano
              </label>
              <input
                id="plan-form-name"
                name="name"
                type="text"
                placeholder="Ex.: Mensal 2x por semana"
                defaultValue={editingPlan?.name ?? ""}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  padding: "10px 12px",
                  fontSize: tokens.text.sm,
                  backgroundColor: "white",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isNarrowScreen
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
                gap: tokens.space.md,
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="plan-form-credits"
                  style={{
                    fontSize: tokens.text.xs,
                    fontWeight: 600,
                    color: tokens.color.textPrimary,
                  }}
                >
                  Créditos (aulas)
                </label>
                <input
                  id="plan-form-credits"
                  name="credits_total"
                  type="number"
                  min={1}
                  defaultValue={editingPlan?.credits_total ?? 8}
                  style={{
                    width: "100%",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    padding: "10px 12px",
                    fontSize: tokens.text.sm,
                    backgroundColor: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="plan-form-validity"
                  style={{
                    fontSize: tokens.text.xs,
                    fontWeight: 600,
                    color: tokens.color.textPrimary,
                  }}
                >
                  Validade (dias)
                </label>
                <input
                  id="plan-form-validity"
                  name="validity_days"
                  type="number"
                  min={1}
                  defaultValue={editingPlan?.validity_days ?? 30}
                  style={{
                    width: "100%",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    padding: "10px 12px",
                    fontSize: tokens.text.sm,
                    backgroundColor: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="plan-form-price"
                  style={{
                    fontSize: tokens.text.xs,
                    fontWeight: 600,
                    color: tokens.color.textPrimary,
                  }}
                >
                  Valor (R$)
                </label>
                <input
                  id="plan-form-price"
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={editingPlan?.price ?? 150}
                  style={{
                    width: "100%",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    padding: "10px 12px",
                    fontSize: tokens.text.sm,
                    backgroundColor: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: tokens.space.md,
                paddingTop: tokens.space.sm,
                borderTop: `1px solid ${tokens.color.borderSubtle}`,
              }}
            >
              <label
                htmlFor="plan-form-active"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: tokens.text.sm,
                  fontWeight: 600,
                  color: tokens.color.textPrimary,
                  cursor: "pointer",
                }}
              >
                <input
                  id="plan-form-active"
                  name="active"
                  type="checkbox"
                  defaultChecked={editingPlan?.active ?? true}
                  style={{
                    margin: 0,
                    width: 18,
                    height: 18,
                    accentColor: tokens.color.primary,
                    cursor: "pointer",
                  }}
                />
                Plano ativo (visível na matrícula e no app)
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space.sm }}>
                <button
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                  style={{
                    padding: "10px 18px",
                    borderRadius: tokens.radius.md,
                    border: "none",
                    backgroundColor: tokens.color.primary,
                    color: tokens.color.textOnPrimary,
                    fontSize: tokens.text.sm,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    opacity:
                      createPlanMutation.isPending || updatePlanMutation.isPending ? 0.75 : 1,
                  }}
                >
                  {editingPlan
                    ? updatePlanMutation.isPending
                      ? "Salvando..."
                      : "Salvar alterações"
                    : createPlanMutation.isPending
                      ? "Criando..."
                      : "Criar plano"}
                </button>
                {editingPlan && (
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      backgroundColor: "white",
                      fontSize: tokens.text.sm,
                      fontWeight: 600,
                      color: tokens.color.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            border: `1px solid ${tokens.color.borderSubtle}`,
            gridColumn: isNarrowScreen ? "1" : "1",
            gridRow: isNarrowScreen ? "1" : "1",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: tokens.space.sm,
              fontSize: 18,
            }}
          >
            Pagamentos pendentes de confirmação
          </h3>
          <p
            style={{
              marginTop: 0,
              marginBottom: tokens.space.md,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
            }}
          >
            Confirme apenas após conferir o comprovante enviado pelo aluno.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.sm,
            }}
          >
            {!payments?.length && (
              <div
                style={{
                  padding: tokens.space.md,
                  borderRadius: tokens.radius.md,
                  border: `1px dashed ${tokens.color.borderSubtle}`,
                  fontSize: tokens.text.sm,
                  color: tokens.color.textMuted,
                }}
              >
                Nenhum pagamento aguardando confirmação no momento.
              </div>
            )}
            {payments?.map((p) => {
              const receiptUrl = p.receipt_path
                ? (() => {
                    const base =
                      api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                    let path = p.receipt_path;
                    if (path.startsWith("http")) return path;
                    // Normaliza caminhos antigos que salvaram somente o nome do arquivo
                    if (!path.startsWith("/static")) {
                      path = `/static/receipts/${path.replace(/^\/+/, "")}`;
                    }
                    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
                  })()
                : null;

              return (
                <div
                  key={p.id}
                  style={{
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.md,
                    display: "flex",
                    flexDirection: isNarrowScreen ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: isNarrowScreen ? "flex-start" : "center",
                    gap: tokens.space.md,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: tokens.text.sm,
                        marginBottom: 4,
                      }}
                    >
                      <strong>{p.student_name ?? "Aluno"}</strong> — Pagamento #{p.id} — R$ {p.amount.toFixed(2)}
                    </div>
                    <div
                      style={{
                        fontSize: tokens.text.xs,
                        color: tokens.color.textMuted,
                      }}
                    >
                      Status: {p.status === "pending_confirmation" ? "Aguardando confirmação" : p.status}
                    </div>
                    {receiptUrl && (
                      <div
                        style={{
                          marginTop: 6,
                        }}
                      >
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            fontSize: tokens.text.xs,
                            borderRadius: tokens.radius.sm,
                            border: `1px solid ${tokens.color.borderSubtle}`,
                            backgroundColor: "white",
                            color: tokens.color.primary,
                            textDecoration: "none",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Ver comprovante
                        </a>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: tokens.space.sm,
                      flexWrap: "wrap",
                      width: isNarrowScreen ? "100%" : "auto",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => confirmPaymentMutation.mutate(p.id)}
                      disabled={confirmPaymentMutation.isPending}
                      style={{
                        padding: "6px 10px",
                        borderRadius: tokens.radius.sm,
                        border: "none",
                        backgroundColor: "#16a34a",
                        color: "white",
                        fontSize: tokens.text.xs,
                        fontWeight: 600,
                        cursor: "pointer",
                        width: isNarrowScreen ? "100%" : "auto",
                      }}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectPaymentMutation.mutate(p.id)}
                      disabled={rejectPaymentMutation.isPending}
                      style={{
                        padding: "6px 10px",
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${tokens.color.borderSubtle}`,
                        backgroundColor: "white",
                        color: "#b91c1c",
                        fontSize: tokens.text.xs,
                        fontWeight: 600,
                        cursor: "pointer",
                        width: isNarrowScreen ? "100%" : "auto",
                      }}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

        <section
        style={{
          display: "contents",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            border: `1px solid ${tokens.color.borderSubtle}`,
            gridColumn: isNarrowScreen ? "1" : "2",
            gridRow: isNarrowScreen ? "4" : "2",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: tokens.space.sm,
              fontSize: 18,
            }}
          >
            PIX do dojo
          </h3>
          <p
            style={{
              marginTop: 0,
              marginBottom: tokens.space.md,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
              lineHeight: 1.5,
              maxWidth: 520,
            }}
          >
            Essas informações serão exibidas no app do aluno na aba <strong>Financeiro</strong> para
            pagamento manual via PIX.
          </p>
          <form
            key={pixConfig ? `pix-form-${pixConfig.dojo_id}` : "pix-form-loading"}
            onSubmit={(e) => {
              e.preventDefault();
              if (!pixConfig) return;
              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              const payload: PixConfig = {
                dojo_id: pixConfig.dojo_id,
                key_type: String(formData.get("key_type") ?? pixConfig.key_type),
                key_value: String(formData.get("key_value") ?? pixConfig.key_value),
                recipient_name:
                  String(formData.get("recipient_name") ?? pixConfig.recipient_name ?? "") || null,
                bank_name:
                  String(formData.get("bank_name") ?? pixConfig.bank_name ?? "") || null,
                instructions:
                  String(formData.get("instructions") ?? pixConfig.instructions ?? "") || null,
                static_qr_image_path: pixConfig.static_qr_image_path ?? null,
              };
              updatePixMutation.mutate(payload);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.lg,
              padding: tokens.space.lg,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.color.borderSubtle}`,
              backgroundColor: "rgba(250, 250, 249, 0.85)",
              boxSizing: "border-box",
            }}
          >
            {!pixConfig ? (
              <p style={{ margin: 0, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>
                Carregando configuração de PIX…
              </p>
            ) : (
              <>
                <fieldset
                  style={{
                    margin: 0,
                    padding: 0,
                    border: "none",
                  }}
                >
                  <legend
                    style={{
                      fontSize: tokens.text.sm,
                      fontWeight: 700,
                      color: tokens.color.textPrimary,
                      padding: 0,
                      marginBottom: tokens.space.xs,
                    }}
                  >
                    Chave PIX
                  </legend>
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: tokens.text.xs,
                      color: tokens.color.textMuted,
                      lineHeight: 1.5,
                    }}
                  >
                    Tipo (ex.: Celular, CPF, E-mail) e o valor exatamente como o aluno deve copiar no app
                    do banco.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isNarrowScreen ? "1fr" : "minmax(140px, 0.35fr) 1fr",
                      gap: tokens.space.md,
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label
                        htmlFor="pix-key-type"
                        style={{
                          fontSize: tokens.text.xs,
                          fontWeight: 600,
                          color: tokens.color.textPrimary,
                        }}
                      >
                        Tipo de chave
                      </label>
                      <input
                        id="pix-key-type"
                        name="key_type"
                        type="text"
                        placeholder="Ex.: Celular, CPF, E-mail"
                        defaultValue={pixConfig.key_type ?? "chave_aleatoria"}
                        style={{
                          width: "100%",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          padding: "10px 12px",
                          fontSize: tokens.text.sm,
                          backgroundColor: "white",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label
                        htmlFor="pix-key-value"
                        style={{
                          fontSize: tokens.text.xs,
                          fontWeight: 600,
                          color: tokens.color.textPrimary,
                        }}
                      >
                        Chave PIX
                      </label>
                      <input
                        id="pix-key-value"
                        name="key_value"
                        type="text"
                        placeholder="Número, e-mail ou chave aleatória"
                        defaultValue={pixConfig.key_value ?? ""}
                        style={{
                          width: "100%",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          padding: "10px 12px",
                          fontSize: tokens.text.sm,
                          backgroundColor: "white",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </fieldset>

                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${tokens.color.borderSubtle}, transparent)`,
                  }}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.sm }}>
                  <span
                    style={{
                      fontSize: tokens.text.sm,
                      fontWeight: 700,
                      color: tokens.color.textPrimary,
                    }}
                  >
                    Quem recebe (opcional)
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: tokens.text.xs,
                      color: tokens.color.textMuted,
                      lineHeight: 1.5,
                    }}
                  >
                    Ajuda o aluno a conferir se está pagando para a pessoa certa.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isNarrowScreen ? "1fr" : "repeat(2, minmax(0, 1fr))",
                      gap: tokens.space.md,
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label
                        htmlFor="pix-recipient"
                        style={{
                          fontSize: tokens.text.xs,
                          fontWeight: 600,
                          color: tokens.color.textPrimary,
                        }}
                      >
                        Nome do favorecido
                      </label>
                      <input
                        id="pix-recipient"
                        name="recipient_name"
                        type="text"
                        placeholder="Nome que aparece no PIX"
                        defaultValue={pixConfig.recipient_name ?? ""}
                        style={{
                          width: "100%",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          padding: "10px 12px",
                          fontSize: tokens.text.sm,
                          backgroundColor: "white",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label
                        htmlFor="pix-bank"
                        style={{
                          fontSize: tokens.text.xs,
                          fontWeight: 600,
                          color: tokens.color.textPrimary,
                        }}
                      >
                        Banco
                      </label>
                      <input
                        id="pix-bank"
                        name="bank_name"
                        type="text"
                        placeholder="Ex.: Nubank, Itaú"
                        defaultValue={pixConfig.bank_name ?? ""}
                        style={{
                          width: "100%",
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          padding: "10px 12px",
                          fontSize: tokens.text.sm,
                          backgroundColor: "white",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${tokens.color.borderSubtle}, transparent)`,
                  }}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    htmlFor="pix-instructions"
                    style={{
                      fontSize: tokens.text.sm,
                      fontWeight: 700,
                      color: tokens.color.textPrimary,
                    }}
                  >
                    Instruções para o aluno
                  </label>
                  <p
                    style={{
                      margin: 0,
                      fontSize: tokens.text.xs,
                      color: tokens.color.textMuted,
                      lineHeight: 1.5,
                    }}
                  >
                    Texto livre (ex.: pedir comprovante, prazo, observações).
                  </p>
                  <textarea
                    id="pix-instructions"
                    name="instructions"
                    defaultValue={pixConfig.instructions ?? ""}
                    rows={4}
                    placeholder="Ex.: Ao efetuar o pagamento, anexe o comprovante na aba Financeiro."
                    style={{
                      width: "100%",
                      minHeight: 96,
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      padding: "10px 12px",
                      fontSize: tokens.text.sm,
                      resize: "vertical",
                      backgroundColor: "white",
                      boxSizing: "border-box",
                      lineHeight: 1.45,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: tokens.space.sm,
                    paddingTop: tokens.space.sm,
                    borderTop: `1px solid ${tokens.color.borderSubtle}`,
                  }}
                >
                  <button
                    type="submit"
                    disabled={updatePixMutation.isPending}
                    style={{
                      padding: "10px 18px",
                      borderRadius: tokens.radius.md,
                      border: "none",
                      backgroundColor: tokens.color.primary,
                      color: tokens.color.textOnPrimary,
                      fontSize: tokens.text.sm,
                      fontWeight: 700,
                      cursor: updatePixMutation.isPending ? "not-allowed" : "pointer",
                      opacity: updatePixMutation.isPending ? 0.75 : 1,
                    }}
                  >
                    {updatePixMutation.isPending ? "Salvando..." : "Salvar PIX"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            border: `1px solid ${tokens.color.borderSubtle}`,
            gridColumn: isNarrowScreen ? "1" : "2",
            gridRow: isNarrowScreen ? "2" : "1",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: tokens.space.sm,
              fontSize: 18,
            }}
          >
            Status de pagamento dos alunos
          </h3>
          <p
            style={{
              marginTop: 0,
              marginBottom: tokens.space.md,
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
            }}
          >
            Visão geral de plano, créditos e último pagamento de cada aluno.
          </p>
          {!studentsStatus?.length && (
            <div
              style={{
                padding: "10px 12px",
                color: tokens.color.textMuted,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
              }}
            >
              Nenhum aluno encontrado ou sem dados financeiros.
            </div>
          )}
          {isNarrowScreen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.sm }}>
              {studentsStatus?.map((s) => {
                const subStatusLabel =
                  s.subscription_status === "active"
                    ? "Ativa"
                    : s.subscription_status === "pending_payment"
                    ? "Pendente"
                    : s.subscription_status === "expired"
                    ? "Expirada"
                    : s.subscription_status === "canceled"
                    ? "Cancelada"
                    : "Sem plano";

                const paymentStatusLabel =
                  s.last_payment_status === "confirmed"
                    ? "Confirmado"
                    : s.last_payment_status === "pending_confirmation"
                    ? "Aguardando"
                    : s.last_payment_status === "rejected"
                    ? "Rejeitado"
                    : "—";
                const isExpanded = expandedStudentId === s.student_id;

                return (
                  <article
                    key={s.student_id}
                    style={{
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      padding: tokens.space.md,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStudentId((prev) => (prev === s.student_id ? null : s.student_id))
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: tokens.text.sm,
                        fontWeight: 700,
                      }}
                    >
                      <span>{s.student_name}</span>
                      <span style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                        {isExpanded ? "Ocultar" : "Ver detalhes"}
                      </span>
                    </button>
                    {isExpanded && (
                      <>
                        <div style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                          <strong>Plano:</strong> {s.plan_name ?? "—"}
                        </div>
                        <div style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                          <strong>Assinatura:</strong> {subStatusLabel}
                        </div>
                        <div style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                          <strong>Créditos:</strong>{" "}
                          {s.credits_remaining != null ? s.credits_remaining : "—"}
                        </div>
                        <div style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                          <strong>Vencimento:</strong>{" "}
                          {s.end_date ? new Date(s.end_date).toLocaleDateString("pt-BR") : "—"}
                        </div>
                        <div style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted }}>
                          <strong>Dados da transação:</strong>{" "}
                          {s.last_payment_amount != null
                            ? `R$ ${s.last_payment_amount.toFixed(2)}`
                            : "—"}{" "}
                          {s.last_payment_date
                            ? `(${new Date(s.last_payment_date).toLocaleDateString("pt-BR")})`
                            : ""}{" "}
                          · {paymentStatusLabel}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                maxHeight: 420,
                overflow: "auto",
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.borderSubtle}`,
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
                    backgroundColor: "#f9fafb",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <th style={{ textAlign: "left", padding: "8px" }}>Aluno</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Resumo</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {studentsStatus?.map((s) => {
                  const subStatusLabel =
                    s.subscription_status === "active"
                      ? "Ativa"
                      : s.subscription_status === "pending_payment"
                      ? "Pendente"
                      : s.subscription_status === "expired"
                      ? "Expirada"
                      : s.subscription_status === "canceled"
                      ? "Cancelada"
                      : "Sem plano";

                  const paymentStatusLabel =
                    s.last_payment_status === "confirmed"
                      ? "Confirmado"
                      : s.last_payment_status === "pending_confirmation"
                      ? "Aguardando"
                      : s.last_payment_status === "rejected"
                      ? "Rejeitado"
                      : "—";
                  const isExpanded = expandedStudentId === s.student_id;

                  return (
                    <Fragment key={s.student_id}>
                      <tr>
                        <td
                          style={{
                            padding: "8px 10px",
                            borderTop: `1px solid ${tokens.color.borderSubtle}`,
                          }}
                        >
                          <strong>{s.student_name}</strong>
                        </td>
                        <td style={{ padding: "8px 10px", borderTop: `1px solid ${tokens.color.borderSubtle}` }}>
                          {s.plan_name ?? "Sem plano"} · {subStatusLabel}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            borderTop: `1px solid ${tokens.color.borderSubtle}`,
                            textAlign: "right",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStudentId((prev) => (prev === s.student_id ? null : s.student_id))
                            }
                            style={{
                              border: `1px solid ${tokens.color.borderSubtle}`,
                              borderRadius: tokens.radius.sm,
                              backgroundColor: "white",
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: tokens.text.xs,
                            }}
                          >
                            {isExpanded ? "Ocultar" : "Expandir"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={3}
                            style={{
                              padding: "10px 12px",
                              borderTop: `1px dashed ${tokens.color.borderSubtle}`,
                              backgroundColor: "#fafafa",
                              fontSize: tokens.text.xs,
                              color: tokens.color.textMuted,
                            }}
                          >
                            <strong>Dados da transação:</strong>{" "}
                            {s.last_payment_amount != null
                              ? `R$ ${s.last_payment_amount.toFixed(2)}`
                              : "—"}{" "}
                            {s.last_payment_date
                              ? `(${new Date(s.last_payment_date).toLocaleDateString("pt-BR")})`
                              : ""}{" "}
                            · {paymentStatusLabel}
                            {" · "}
                            <strong>Créditos:</strong>{" "}
                            {s.credits_remaining != null ? s.credits_remaining : "—"}
                            {" · "}
                            <strong>Vencimento:</strong>{" "}
                            {s.end_date ? new Date(s.end_date).toLocaleDateString("pt-BR") : "—"}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

