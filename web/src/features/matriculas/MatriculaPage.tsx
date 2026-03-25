import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import arenaMasterLogo from "../../assets/arena-master-logo.png";

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
  contato: string | null;
  slug: string | null;
};

type Plan = {
  id: number;
  dojo_id: number;
  name: string;
  description: string | null;
  modalidades?: string[] | null;
  price: number;
  credits_total: number;
  validity_days: number;
  active: boolean;
};

type FaixaOption = {
  id: number;
  name: string;
  max_graus: number;
  exibir_como_dan: boolean;
  modalidade_id: number;
  modalidade_name: string;
};

type FormResponse = {
  dojo: Dojo;
  plans: Plan[];
  modalidades: string[];
  faixas: FaixaOption[];
};

type SubmitResponse = {
  status: "created" | "existing";
  login_email: string;
  message: string;
};

type MatriculaStudent = {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  modalidade?: string | null;
  faixa_id?: number | null;
  grau?: number;
};

type SubmitPayload = {
  type: "regular" | "kids";
  plan_id: number;
  student: MatriculaStudent;
};

const APPLE_URL = "https://apps.apple.com/app/arena-master/id000000000";
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.arenamaster.app";

const cardStyle: CSSProperties = {
  padding: tokens.space.xl,
  backgroundColor: "white",
  borderRadius: tokens.radius.lg,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: `1px solid ${tokens.color.borderSubtle}`,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
  fontSize: tokens.text.md,
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.borderSubtle}`,
  backgroundColor: "#fff",
  color: tokens.color.textPrimary,
  outline: "none",
  boxSizing: "border-box",
};

function resolveAssetUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function formatBRL(value: number) {
  try {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function planMatchesStudentModalidade(
  plan: Pick<Plan, "modalidades">,
  studentModalidade: string | null | undefined,
): boolean {
  const list = (plan.modalidades ?? [])
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  const sm = (studentModalidade ?? "").trim();
  if (!sm) return false;
  return list.some((pm) => pm.localeCompare(sm, "pt-BR", { sensitivity: "base" }) === 0);
}

function StepPill(props: { active: boolean; done: boolean; label: string }) {
  const { active, done, label } = props;
  const bg = done ? tokens.color.success : active ? tokens.color.primary : tokens.color.bgBody;
  const color = done || active ? tokens.color.textOnPrimary : tokens.color.textMuted;
  const border = done ? `1px solid rgba(34,197,94,0.35)` : `1px solid ${tokens.color.borderSubtle}`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: tokens.radius.full,
        backgroundColor: bg,
        color,
        fontWeight: 800,
        fontSize: 12,
        border,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: done ? tokens.color.success : active ? tokens.color.primary : tokens.color.borderSubtle,
          opacity: done || active ? 1 : 0.8,
        }}
      />
      {label}
    </span>
  );
}

export function MatriculaPage() {
  const params = useParams();
  const token = params.token;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [type, setType] = useState<"regular" | "kids">("regular");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasGraduation, setHasGraduation] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState<string>("");

  const [student, setStudent] = useState<MatriculaStudent>({
    name: "",
    email: "",
    password: "",
    phone: null,
    modalidade: null,
    faixa_id: null,
    grau: 0,
  });

  const [submitResponse, setSubmitResponse] = useState<SubmitResponse | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["matricula-form", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get<FormResponse>(`/api/matriculas/${token}/form`);
      return res.data;
    },
  });

  const logoUrl = useMemo(() => resolveAssetUrl(data?.dojo.logo_url ?? null), [data?.dojo.logo_url]);

  const plans = data?.plans ?? [];
  const modalidades = data?.modalidades ?? [];
  const faixas = data?.faixas ?? [];

  const faixasForModalidade = useMemo(() => {
    const m = (student.modalidade ?? "").trim();
    if (!m) return [];
    return faixas.filter(
      (f) =>
        f.modalidade_name.trim().localeCompare(m, "pt-BR", { sensitivity: "base" }) === 0,
    );
  }, [faixas, student.modalidade]);

  useEffect(() => {
    if (!student.faixa_id) return;
    const ok = faixasForModalidade.some((f) => f.id === student.faixa_id);
    if (!ok) setStudent((s) => ({ ...s, faixa_id: null, grau: 0 }));
  }, [faixasForModalidade, student.faixa_id]);

  const plansForMatricula = useMemo(
    () => plans.filter((p) => p.active && planMatchesStudentModalidade(p, student.modalidade)),
    [plans, student.modalidade],
  );

  useEffect(() => {
    if (step !== 3 || selectedPlanId == null) return;
    const chosen = plans.find((p) => p.id === selectedPlanId);
    if (!chosen || !chosen.active || !planMatchesStudentModalidade(chosen, student.modalidade)) {
      setSelectedPlanId(null);
    }
  }, [step, plans, selectedPlanId, student.modalidade]);

  const modalidadeSelectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of modalidades) {
      const t = String(m).trim();
      if (t) set.add(t);
    }
    const cur = (student.modalidade ?? "").trim();
    if (cur) set.add(cur);
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }, [modalidades, student.modalidade]);

  const selectedFaixa = faixasForModalidade.find((f) => f.id === student.faixa_id) ?? null;
  const grauMax = selectedFaixa?.max_graus ?? 0;

  const submitMutation = useMutation({
    mutationFn: async (): Promise<SubmitResponse> => {
      if (!token) throw new Error("Token inválido");
      if (!selectedPlanId) throw new Error("Selecione um plano");

      const payload: SubmitPayload = {
        type,
        plan_id: selectedPlanId,
        student: {
          ...student,
          phone: student.phone ?? null,
          modalidade: student.modalidade ?? null,
          grau: student.grau ?? 0,
        },
      };
      const res = await api.post<SubmitResponse>(`/api/matriculas/${token}/submit`, payload);
      return res.data;
    },
    onSuccess: (res) => {
      setSubmitResponse(res);
      setSubmitError(null);
      setStep(4);
    },
    onError: (err: unknown) => {
      const detail =
        (err as any)?.response?.data?.detail ??
        (err instanceof Error ? err.message : "Não foi possível finalizar sua matrícula.");
      setSubmitError(String(detail));
    },
  });

  const continueFromStep2 = () => {
    // Validação simples para feedback instantâneo.
    if (!student.name.trim()) return setSubmitError("Informe o nome.");
    if (!student.email.trim()) return setSubmitError("Informe o e-mail.");
    if (!student.password || student.password.length < 6) return setSubmitError("A senha deve ter pelo menos 6 caracteres.");
    if (!passwordConfirm || passwordConfirm.length < 6) return setSubmitError("Confirme a senha.");
    if (passwordConfirm !== student.password) return setSubmitError("As senhas não conferem.");
    if (hasGraduation) {
      if (!(student.modalidade ?? "").trim()) return setSubmitError("Selecione a modalidade para informar a graduação.");
      if (!student.faixa_id) return setSubmitError("Selecione sua faixa.");
      if (student.grau === undefined || student.grau === null) return setSubmitError("Selecione seu grau.");
      if ((student.grau ?? 0) > grauMax) return setSubmitError("Grau acima do limite da faixa.");
    }
    setSubmitError(null);
    setStep(3);
  };

  const resolveContato = data?.dojo.contato ? data.dojo.contato : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: tokens.color.bgBody,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: tokens.space.xl,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ ...cardStyle, marginBottom: tokens.space.lg }}>
          {logoUrl && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: tokens.space.md,
              }}
            >
              <img
                src={logoUrl}
                alt={data.dojo.name}
                style={{
                  width: "50%",
                  maxWidth: 260,
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: tokens.space.lg, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: tokens.color.textPrimary }}>
                Matrícula
              </h1>
              <p style={{ margin: "6px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                {isLoading ? "Carregando..." : data ? `Bem-vindo(a) à academia ${data.dojo.name}` : "Link inválido"}
              </p>
              {resolveContato && (
                <p style={{ margin: "8px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  Contato: {resolveContato}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap", alignItems: "center" }}>
              <StepPill active={step === 1} done={step > 1} label="1. Tipo" />
              <StepPill active={step === 2} done={step > 2} label="2. Dados" />
              <StepPill active={step === 3} done={step > 3} label="3. Plano" />
              <StepPill active={step === 4} done={step > 4} label="4. Baixar app" />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          {isLoading && <p style={{ color: tokens.color.textMuted }}>Carregando...</p>}

          {error && (
            <p style={{ color: tokens.color.error, fontWeight: 800 }}>
              Não foi possível carregar este link. Verifique e tente novamente.
            </p>
          )}

          {!isLoading && !error && data && step !== 4 && (
            <>
              {step === 1 && (
                <>
                  <div style={{ display: "flex", gap: tokens.space.lg, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: "1 1 280px" }}>
                      <p style={{ margin: 0, color: tokens.color.textMuted, fontSize: tokens.text.sm, marginBottom: tokens.space.sm }}>
                        Escolha o tipo de matrícula
                      </p>
                      <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setType("regular")}
                          style={{
                            padding: tokens.space.md,
                            borderRadius: tokens.radius.md,
                            border: `1px solid ${
                              type === "regular" ? tokens.color.primary : tokens.color.borderSubtle
                            }`,
                            backgroundColor: type === "regular" ? `${tokens.color.primary}18` : "white",
                            cursor: "pointer",
                            fontWeight: 900,
                            color: tokens.color.textPrimary,
                            flex: "1 1 180px",
                          }}
                        >
                          Regular
                        </button>
                        <button
                          type="button"
                          onClick={() => setType("kids")}
                          style={{
                            padding: tokens.space.md,
                            borderRadius: tokens.radius.md,
                            border: `1px solid ${type === "kids" ? tokens.color.primary : tokens.color.borderSubtle}`,
                            backgroundColor: type === "kids" ? `${tokens.color.primary}18` : "white",
                            cursor: "pointer",
                            fontWeight: 900,
                            color: tokens.color.textPrimary,
                            flex: "1 1 180px",
                          }}
                        >
                          Kids
                        </button>
                      </div>

                      <div style={{ marginTop: tokens.space.lg }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitError(null);
                            setStep(2);
                          }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            backgroundColor: tokens.color.primary,
                            border: `1px solid ${tokens.color.primaryDark}`,
                            color: tokens.color.textOnPrimary,
                            borderRadius: tokens.radius.md,
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: tokens.text.sm,
                          }}
                        >
                          Continuar
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "1 1 240px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: tokens.color.textMuted,
                          fontSize: tokens.text.sm,
                          lineHeight: 1.5,
                        }}
                      >
                        {type === "regular"
                          ? "Crie sua conta e escolha seu plano."
                          : "Crie a conta do responsável (perfil mostra os dados do aluno/criança)."}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Dados {type === "kids" ? "do aluno (criança)" : "do aluno"}
                  </h2>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        Nome
                      </span>
                      <input
                        style={inputStyle}
                        value={student.name}
                        onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
                        placeholder={type === "kids" ? "Nome da criança" : "Seu nome"}
                        autoComplete="name"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        Modalidade (opcional)
                      </span>
                      <select
                        style={inputStyle}
                        value={(student.modalidade ?? "").trim() === "" ? "" : (student.modalidade ?? "").trim()}
                        onChange={(e) => {
                          const v = e.target.value ? e.target.value : null;
                          setStudent((s) => ({
                            ...s,
                            modalidade: v,
                            faixa_id: null,
                            grau: 0,
                          }));
                          setSelectedPlanId(null);
                        }}
                      >
                        <option value="">Selecione uma modalidade</option>
                        {modalidadeSelectOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      {modalidadeSelectOptions.length === 0 && (
                        <span
                          style={{
                            fontSize: tokens.text.xs,
                            color: tokens.color.textMuted,
                            marginTop: 4,
                          }}
                        >
                          Nenhuma modalidade cadastrada ainda nesta academia. O administrador pode cadastrá-las em
                          Turmas (gerenciar modalidades).
                        </span>
                      )}
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        E-mail de acesso
                      </span>
                      <input
                        style={inputStyle}
                        type="email"
                        value={student.email}
                        onChange={(e) => setStudent((s) => ({ ...s, email: e.target.value }))}
                        placeholder="seu@email.com"
                        autoComplete="email"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        Senha
                      </span>
                      <input
                        style={inputStyle}
                        type="password"
                        value={student.password}
                        onChange={(e) => setStudent((s) => ({ ...s, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        Confirmar senha
                      </span>
                      <input
                        style={inputStyle}
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        Telefone (opcional)
                      </span>
                      <input
                        style={inputStyle}
                        value={student.phone ?? ""}
                        onChange={(e) => setStudent((s) => ({ ...s, phone: e.target.value || null }))}
                        placeholder="(xx) xxxxx-xxxx"
                        autoComplete="tel"
                      />
                    </label>

                    {faixas.length > 0 && (
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          gridColumn: "1 / -1",
                          marginTop: tokens.space.md,
                        }}
                      >
                        <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                          Possuo Gradução na Modalidade
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={hasGraduation}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setHasGraduation(enabled);
                              if (!enabled) {
                                setStudent((s) => ({ ...s, faixa_id: null, grau: 0 }));
                              } else {
                                const first = faixasForModalidade[0]?.id ?? null;
                                setStudent((s) => ({ ...s, faixa_id: first, grau: 0 }));
                              }
                              setSubmitError(null);
                            }}
                          />
                        </div>

                        {hasGraduation && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space.md }}>
                            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                                Faixa
                              </span>
                              <select
                                style={inputStyle}
                                value={student.faixa_id ?? ""}
                                onChange={(e) => {
                                  const id = e.target.value ? Number(e.target.value) : null;
                                  const faixa = faixasForModalidade.find((f) => f.id === id) ?? null;
                                  const max = faixa?.max_graus ?? 0;
                                  setStudent((s) => ({
                                    ...s,
                                    faixa_id: id,
                                    grau: Math.min(s.grau ?? 0, max),
                                  }));
                                }}
                              >
                                <option value="">— Selecione —</option>
                                {faixasForModalidade.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                                Grau/Dan
                              </span>
                              <select
                                style={inputStyle}
                                value={student.grau ?? 0}
                                onChange={(e) =>
                                  setStudent((s) => ({ ...s, grau: Number(e.target.value) || 0 }))
                                }
                              >
                                {Array.from({ length: grauMax + 1 }).map((_, idx) => (
                                  <option key={idx} value={idx}>
                                    {idx === 0
                                      ? "Faixa (sem dan)"
                                      : selectedFaixa?.exibir_como_dan
                                        ? `${idx}º Dan`
                                        : `${idx}º Grau`}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                      </label>
                    )}
                  </div>

                  {submitError && (
                    <p
                      style={{
                        marginTop: tokens.space.md,
                        color: tokens.color.error,
                        fontWeight: 900,
                      }}
                    >
                      {submitError}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        backgroundColor: "white",
                        border: `1px solid ${tokens.color.borderSubtle}`,
                        color: tokens.color.textPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={continueFromStep2}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        backgroundColor: tokens.color.primary,
                        border: `1px solid ${tokens.color.primaryDark}`,
                        color: tokens.color.textOnPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Escolha o plano
                  </h2>

                  <p
                    style={{
                      margin: `${tokens.space.sm}px 0 0 0`,
                      fontSize: tokens.text.sm,
                      color: tokens.color.textMuted,
                      lineHeight: 1.5,
                    }}
                  >
                    Só aparecem planos que incluem a modalidade que você escolheu no passo anterior
                    {(student.modalidade ?? "").trim() ? ` (${(student.modalidade ?? "").trim()})` : ""}.
                    Planos sem restrição de modalidade ficam sempre disponíveis.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    {plansForMatricula.map((p) => {
                      const selected = selectedPlanId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(p.id);
                            setSubmitError(null);
                          }}
                          style={{
                            textAlign: "left",
                            padding: tokens.space.lg,
                            borderRadius: tokens.radius.lg,
                            border: `2px solid ${selected ? tokens.color.primary : tokens.color.borderSubtle}`,
                            backgroundColor: selected ? `${tokens.color.primary}10` : "white",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: tokens.space.md }}>
                            <div style={{ fontWeight: 950, color: tokens.color.textPrimary }}>{p.name}</div>
                            {selected && (
                              <span style={{ color: tokens.color.success, fontWeight: 950, fontSize: 12 }}>Selecionado</span>
                            )}
                          </div>
                          <div style={{ marginTop: tokens.space.sm, color: tokens.color.textMuted, fontWeight: 800, fontSize: 14 }}>
                            {formatBRL(p.price)} / período
                          </div>
                          <div style={{ marginTop: tokens.space.sm, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.4 }}>
                            Créditos: {p.credits_total} • Validade: {p.validity_days} dias
                          </div>
                          {p.description && (
                            <div style={{ marginTop: tokens.space.sm, color: tokens.color.textMuted, fontSize: 12, lineHeight: 1.5 }}>
                              {p.description}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {plansForMatricula.length === 0 && (
                    <p
                      style={{
                        marginTop: tokens.space.md,
                        padding: tokens.space.md,
                        borderRadius: tokens.radius.md,
                        backgroundColor: "rgba(234,179,8,0.12)",
                        color: tokens.color.textPrimary,
                        fontSize: tokens.text.sm,
                        fontWeight: 700,
                        lineHeight: 1.5,
                      }}
                    >
                      Não há planos ativos para a combinação atual.{" "}
                      {(student.modalidade ?? "").trim()
                        ? "Escolha outra modalidade, deixe a modalidade em branco (planos genéricos) ou peça à academia para cadastrar um plano para esta modalidade."
                        : "Peça à academia para cadastrar planos genéricos (sem modalidade) ou selecione uma modalidade se os planos forem específicos."}
                    </p>
                  )}

                  {submitError && (
                    <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 900 }}>
                      {submitError}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        backgroundColor: "white",
                        border: `1px solid ${tokens.color.borderSubtle}`,
                        color: tokens.color.textPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={!selectedPlanId || submitMutation.isPending}
                      onClick={() => submitMutation.mutate()}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        backgroundColor: !selectedPlanId || submitMutation.isPending ? tokens.color.borderSubtle : tokens.color.primary,
                        border: `1px solid ${tokens.color.primaryDark}`,
                        color: tokens.color.textOnPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: !selectedPlanId || submitMutation.isPending ? "not-allowed" : "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {submitMutation.isPending ? "Finalizando..." : "Confirmar matrícula"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                Tudo certo! Agora baixe o app
              </h2>
              <p style={{ margin: `${tokens.space.md}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.6 }}>
                {submitResponse?.message ?? "Matrícula confirmada."}
              </p>

              <div style={{ marginTop: tokens.space.lg, display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space.md }}>
                <a
                  href={APPLE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 46,
                    paddingLeft: 12,
                    paddingRight: 14,
                    backgroundColor: "#000",
                    borderRadius: 6,
                    textDecoration: "none",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  App Store
                </a>
                <a
                  href={PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 46,
                    paddingLeft: 12,
                    paddingRight: 14,
                    backgroundColor: "#000",
                    borderRadius: 6,
                    textDecoration: "none",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  Google Play
                </a>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: tokens.space.xl, display: "flex", justifyContent: "center" }}>
          <img
            src={arenaMasterLogo}
            alt="Arena Master"
            style={{ width: 140, height: "auto", opacity: 0.9 }}
          />
        </div>
      </div>
    </div>
  );
}

