import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";

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
        });
      } else {
        const res = await api.post<StudentCreatedResponse>(
          "/api/students",
          { ...form, modalidade: form.modalidade || null, faixa_id: form.faixa_id ?? null, grau: form.grau ?? 0 },
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
      setForm({ name: "", email: "", phone: "", modalidade: "", faixa_id: null, grau: 0 });
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
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", email: "", phone: "", modalidade: "", faixa_id: null, grau: 0 });
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
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Alunos</h1>

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          backgroundColor: "white",
          borderRadius: 8,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          maxWidth: 480,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          {editingId ? "Editar aluno" : "Novo aluno"}
        </h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <label>
            <span>Nome</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Telefone</span>
            <input
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Modalidade</span>
            <input
              type="text"
              placeholder="Ex: Jiu-Jitsu, Muay Thai"
              value={form.modalidade ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Faixa</span>
            <select
              value={form.faixa_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  faixa_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="">— Nenhuma —</option>
              {faixas?.map((faixa) => (
                <option key={faixa.id} value={faixa.id}>
                  {faixa.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Grau / Dan</span>
            <input
              type="number"
              min={0}
              value={form.grau ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, grau: Number(e.target.value) || 0 }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          {formError && (
            <div style={{ color: "red", fontSize: 14 }}>{formError}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{
                padding: "8px 14px",
                backgroundColor: "#111827",
                color: "white",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              {saveMutation.isPending
                ? "Salvando..."
                : editingId
                  ? "Atualizar"
                  : "Criar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "white",
                  color: "#111827",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {isLoading && <p>Carregando...</p>}
      {error && <p style={{ color: "red" }}>Erro ao carregar alunos.</p>}
      {data && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Nome</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Modalidade</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Graduação</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>E-mail</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Telefone</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {data.map((student) => (
              <tr key={student.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{student.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {student.modalidade ?? "-"}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {student.graduacao ?? "-"}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{student.email ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{student.phone ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const loginEmail = student.login_email ?? "";
                      const message = `Dados de acesso ao Arena Master:\n\nAluno: ${student.name}\nLogin: ${loginEmail}\nSenha inicial: aluno${student.id
                        .toString()
                        .padStart(4, "0")}`;
                      void navigator.clipboard.writeText(message);
                      alert("Dados de acesso copiados para a área de transferência.");
                    }}
                    style={{
                      marginRight: 8,
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    Compartilhar acesso
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(student)}
                    style={{
                      marginRight: 8,
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => openGuardians(student)}
                    style={{
                      marginRight: 8,
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    Responsáveis
                  </button>
                  <button
                    type="button"
                    onClick={() => openPlanManager(student)}
                    style={{
                      marginRight: 8,
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    Plano / créditos
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(student.id)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #fecaca",
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      cursor: "pointer",
                    }}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedForGuardians && (
        <section
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: "white",
            borderRadius: 8,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            maxWidth: 520,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            Responsáveis de {selectedForGuardians.name}
          </h2>
          {guardiansError && (
            <p style={{ color: "red", fontSize: 14 }}>{guardiansError}</p>
          )}
          <div style={{ marginBottom: 12 }}>
            <label>
              <span>ID do usuário responsável</span>
              <input
                type="number"
                value={guardianUserId}
                onChange={(e) => setGuardianUserId(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <button
              type="button"
              onClick={addGuardian}
              style={{
                padding: "6px 10px",
                marginTop: 8,
                backgroundColor: "#111827",
                color: "white",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Adicionar responsável
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  ID usuário
                </th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {guardians.map((g) => (
                <tr key={g.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {g.user_id}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f3f4f6",
                      textAlign: "right",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => removeGuardian(g.user_id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #fecaca",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        cursor: "pointer",
                      }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {selectedForPlan && (
        <section
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: "white",
            borderRadius: 8,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            maxWidth: 720,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>
            Plano / créditos de {selectedForPlan.name}
          </h2>
          {subscriptionsError && (
            <p style={{ color: "red", fontSize: 14 }}>{subscriptionsError}</p>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "end",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <label style={{ minWidth: 320 }}>
              <span>Selecionar plano</span>
              <select
                value={planIdToAssign}
                onChange={(e) => setPlanIdToAssign(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              >
                <option value="">— Selecione —</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} — {p.credits_total} créditos — R$ {p.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ minWidth: 200 }}>
              <span>Data de vencimento</span>
              <input
                type="date"
                value={planEndDate}
                onChange={(e) => setPlanEndDate(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <button
              type="button"
              onClick={() => assignPlanMutation.mutate()}
              disabled={
                assignPlanMutation.isPending || !planIdToAssign || !planEndDate
              }
              style={{
                padding: "8px 14px",
                backgroundColor: "#111827",
                color: "white",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                opacity: assignPlanMutation.isPending || !planIdToAssign ? 0.7 : 1,
              }}
            >
              {assignPlanMutation.isPending ? "Atribuindo..." : "Atribuir plano"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedForPlan(null)}
              style={{
                padding: "8px 14px",
                backgroundColor: "white",
                color: "#111827",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  Assinatura
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  Status
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  Créditos
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  Vigência
                </th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {studentSubscriptions.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {plansById[s.plan_id]?.name ?? `Plano ${s.plan_id}`}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{s.status}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {s.credits_remaining} / {s.credits_total}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {s.start_date ? new Date(s.start_date).toLocaleDateString("pt-BR") : "-"} até{" "}
                    {s.end_date ? new Date(s.end_date).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #f3f4f6",
                      textAlign: "right",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => cancelSubscriptionMutation.mutate(s.id)}
                      disabled={cancelSubscriptionMutation.isPending}
                      style={{
                        padding: "4px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #fecaca",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        cursor: "pointer",
                      }}
                    >
                      Remover plano
                    </button>
                  </td>
                </tr>
              ))}
              {!studentSubscriptions.length && (
                <tr>
                  <td colSpan={4} style={{ padding: 8, color: "#6b7280" }}>
                    Nenhuma assinatura encontrada para este aluno ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
            Ao atribuir um plano, o sistema cria uma cobrança pendente para o aluno enviar comprovante no app. Os créditos só ficam ativos após confirmação do professor.
          </p>
        </section>
      )}
    </div>
  );
}


