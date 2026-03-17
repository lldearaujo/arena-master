import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

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

type Payment = {
  id: number;
  dojo_id: number;
  student_id: number;
  subscription_id: number | null;
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

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["finance", "plans"],
    queryFn: async () => {
      const res = await api.get<Plan[]>("/api/finance/plans");
      return res.data;
    },
  });

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
          gridTemplateColumns: "2fr 1.5fr",
          gap: tokens.space.xl,
          alignItems: "flex-start",
        }}
      >
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.lg,
          }}
        >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            border: `1px solid ${tokens.color.borderSubtle}`,
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
          Crie planos com quantidade de aulas (créditos) e validade em dias.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
                  marginTop: tokens.space.sm,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
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
            if (!name || !price || !credits) return;

            if (editingPlan) {
              updatePlanMutation.mutate({
                ...editingPlan,
                name,
                description,
                price,
                credits_total: credits,
                validity_days: validity,
                active: activeFlag,
              });
            } else {
              createPlanMutation.mutate({
                name,
                description,
                price,
                credits_total: credits,
                validity_days: validity,
              });
              form.reset();
            }
          }}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
            gap: tokens.space.sm,
            alignItems: "end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: tokens.text.xs,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Nome do plano
            </label>
            <input
              name="name"
              type="text"
              placeholder="Ex.: Mensal 2x por semana"
              defaultValue={editingPlan?.name ?? ""}
              style={{
                width: "100%",
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.borderSubtle}`,
                padding: "6px 8px",
                fontSize: tokens.text.sm,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: tokens.text.xs,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Créditos
            </label>
            <input
              name="credits_total"
              type="number"
              min={1}
              defaultValue={editingPlan?.credits_total ?? 8}
              style={{
                width: "100%",
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.borderSubtle}`,
                padding: "6px 8px",
                fontSize: tokens.text.sm,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: tokens.text.xs,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Validade (dias)
            </label>
            <input
              name="validity_days"
              type="number"
              min={1}
              defaultValue={editingPlan?.validity_days ?? 30}
              style={{
                width: "100%",
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.borderSubtle}`,
                padding: "6px 8px",
                fontSize: tokens.text.sm,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: tokens.text.xs,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Valor (R$)
            </label>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={editingPlan?.price ?? 150}
              style={{
                width: "100%",
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.borderSubtle}`,
                padding: "6px 8px",
                fontSize: tokens.text.sm,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: tokens.text.xs,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Ativo
            </label>
            <input
              name="active"
              type="checkbox"
              defaultChecked={editingPlan?.active ?? true}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              style={{
                padding: "8px 14px",
                borderRadius: tokens.radius.sm,
                border: "none",
                backgroundColor: tokens.color.primary,
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.sm,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
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
                  marginLeft: tokens.space.sm,
                  padding: "8px 14px",
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  backgroundColor: "white",
                  fontSize: tokens.text.sm,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            )}
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
            marginTop: tokens.space.xl,
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
                    justifyContent: "space-between",
                    alignItems: "center",
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
                      <strong>Pagamento #{p.id}</strong> — R$ {p.amount.toFixed(2)}
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
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.lg,
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            border: `1px solid ${tokens.color.borderSubtle}`,
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
            }}
          >
            Essas informações serão exibidas no app do aluno na aba Financeiro para
            pagamento manual via PIX.
          </p>
          <form
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
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: tokens.space.sm,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Tipo de chave
              </label>
              <input
                name="key_type"
                type="text"
                defaultValue={pixConfig?.key_type ?? "chave_aleatoria"}
                style={{
                  width: "100%",
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  padding: "6px 8px",
                  fontSize: tokens.text.sm,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Chave PIX
              </label>
              <input
                name="key_value"
                type="text"
                defaultValue={pixConfig?.key_value ?? ""}
                style={{
                  width: "100%",
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  padding: "6px 8px",
                  fontSize: tokens.text.sm,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Nome do favorecido
              </label>
              <input
                name="recipient_name"
                type="text"
                defaultValue={pixConfig?.recipient_name ?? ""}
                style={{
                  width: "100%",
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  padding: "6px 8px",
                  fontSize: tokens.text.sm,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Banco
              </label>
              <input
                name="bank_name"
                type="text"
                defaultValue={pixConfig?.bank_name ?? ""}
                style={{
                  width: "100%",
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  padding: "6px 8px",
                  fontSize: tokens.text.sm,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: tokens.text.xs,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Instruções para o aluno
              </label>
              <textarea
                name="instructions"
                defaultValue={pixConfig?.instructions ?? ""}
                rows={3}
                style={{
                  width: "100%",
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  padding: "6px 8px",
                  fontSize: tokens.text.sm,
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ textAlign: "right", marginTop: tokens.space.sm }}>
              <button
                type="submit"
                disabled={updatePixMutation.isPending}
                style={{
                  padding: "8px 14px",
                  borderRadius: tokens.radius.sm,
                  border: "none",
                  backgroundColor: tokens.color.primary,
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.sm,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {updatePixMutation.isPending ? "Salvando..." : "Salvar PIX"}
              </button>
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
                  <th style={{ textAlign: "left", padding: "8px" }}>Plano</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Assinatura</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Créditos</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Vencimento</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Último pagamento</th>
                </tr>
              </thead>
              <tbody>
                {!studentsStatus?.length && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "10px 12px",
                        color: tokens.color.textMuted,
                      }}
                    >
                      Nenhum aluno encontrado ou sem dados financeiros.
                    </td>
                  </tr>
                )}
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

                  return (
                    <tr key={s.student_id}>
                      <td style={{ padding: "8px 10px", borderTop: `1px solid ${tokens.color.borderSubtle}` }}>
                        {s.student_name}
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: `1px solid ${tokens.color.borderSubtle}` }}>
                        {s.plan_name ?? "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: `1px solid ${tokens.color.borderSubtle}` }}>
                        {subStatusLabel}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderTop: `1px solid ${tokens.color.borderSubtle}`,
                        }}
                      >
                        {s.credits_remaining != null ? s.credits_remaining : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: `1px solid ${tokens.color.borderSubtle}` }}>
                        {s.end_date
                          ? new Date(s.end_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: `1px solid ${tokens.color.borderSubtle}` }}>
                        {s.last_payment_amount != null && (
                          <>
                            R$ {s.last_payment_amount.toFixed(2)}{" "}
                            {s.last_payment_date &&
                              `(${new Date(s.last_payment_date).toLocaleDateString("pt-BR")})`}
                            {" · "}
                          </>
                        )}
                        {paymentStatusLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

