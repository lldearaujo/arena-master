import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore, type Role } from "../../store/auth";
import { tokens } from "../../ui/tokens";
import arenaMasterLogo from "../../assets/arena-master-logo.png";
import type { Competition, WeightClass } from "./types";

type Eligibility = {
  age_divisions: Array<{ age_division: { id: number; label: string }; allowed_faixa_ids: number[] }>;
  weight_classes: Array<{ weight_class: WeightClass }>;
  allowed_faixas: Array<{ id: number; label: string }>;
};

type PublicRegisterResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: { id: number; email: string; role: Role; dojo_id: number | null };
};

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

function resolveAssetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
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

export function PublicCompetitionEnrollPage() {
  const { id } = useParams<{ id: string }>();
  const competitionId = Number(id);
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [externalDojoName, setExternalDojoName] = useState("");
  const [externalFaixaLabel, setExternalFaixaLabel] = useState("");
  const [birthYearStr, setBirthYearStr] = useState("");
  const [declaredWeightStr, setDeclaredWeightStr] = useState("");

  const [gender, setGender] = useState<"male" | "female">("male");
  const [ageId, setAgeId] = useState<number | "">("");
  const [wcId, setWcId] = useState<number | "">("");
  const [enrollModality, setEnrollModality] = useState<"gi" | "nogi" | "">("");
  const [formError, setFormError] = useState<string | null>(null);

  const birthYear = useMemo(() => {
    const y = Number(birthYearStr);
    return Number.isFinite(y) && y >= 1920 ? y : null;
  }, [birthYearStr]);

  const declaredWeightKg = useMemo(() => {
    const w = Number(String(declaredWeightStr).replace(",", "."));
    return Number.isFinite(w) && w > 0 ? w : null;
  }, [declaredWeightStr]);

  const { data: comp, isLoading: compLoading, error: compError } = useQuery({
    queryKey: ["public-competition-summary", competitionId],
    queryFn: async () => {
      const res = await api.get<Competition>(`/api/competitions/public/enroll/${competitionId}/summary`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: elig } = useQuery({
    queryKey: ["public-eligibility", competitionId, gender, birthYear, enrollModality],
    queryFn: async () => {
      const res = await api.get<Eligibility>(
        `/api/competitions/public/enroll/${competitionId}/eligibility-options`,
        {
          params: {
            gender,
            birth_year: birthYear ?? undefined,
            modality: enrollModality || undefined,
          },
        },
      );
      return res.data;
    },
    enabled: Number.isFinite(competitionId) && birthYear != null,
  });

  // Faixas do evento carregadas imediatamente (não dependem de ano de nascimento)
  const { data: faixasData } = useQuery({
    queryKey: ["public-faixas", competitionId],
    queryFn: async () => {
      const res = await api.get<Eligibility>(
        `/api/competitions/public/enroll/${competitionId}/eligibility-options`,
      );
      return res.data.allowed_faixas;
    },
    enabled: Number.isFinite(competitionId),
  });

  const enroll = useMutation({
    mutationFn: async () => {
      if (
        birthYear == null ||
        declaredWeightKg == null ||
        ageId === "" ||
        wcId === "" ||
        !name.trim() ||
        !email.trim() ||
        password.length < 6
      ) {
        throw new Error("incompleto");
      }
      const res = await api.post<PublicRegisterResponse>(
        `/api/competitions/public/enroll/${competitionId}`,
        {
          name: name.trim(),
          email: email.trim(),
          password,
          external_dojo_name: externalDojoName.trim(),
          external_faixa_label: externalFaixaLabel.trim(),
          birth_year: birthYear,
          declared_weight_kg: declaredWeightKg,
          gender,
          age_division_id: ageId,
          weight_class_id: wcId,
        },
      );
      const d = res.data;
      setSession(
        {
          accessToken: d.access_token,
          refreshToken: d.refresh_token,
        },
        {
          id: d.user.id,
          email: d.user.email,
          role: d.user.role,
          dojoId: d.user.dojo_id,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      qc.invalidateQueries({ queryKey: ["student", "me"] });
      setFormError(null);
      setStep(4);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Não foi possível concluir a inscrição.";
      setFormError(String(detail));
    },
  });

  const logoUrl = useMemo(() => resolveAssetUrl(comp?.organizer_logo_url), [comp?.organizer_logo_url]);
  const bannerUrl = useMemo(() => resolveAssetUrl(comp?.banner_url), [comp?.banner_url]);

  const ageOptions = elig?.age_divisions ?? [];

  const modalitiesPresent = useMemo((): ("gi" | "nogi")[] => {
    const s = new Set<string>();
    for (const w of elig?.weight_classes ?? []) {
      s.add(w.weight_class.modality ?? "gi");
    }
    return Array.from(s).sort() as ("gi" | "nogi")[];
  }, [elig]);

  const hasBothModalities = modalitiesPresent.includes("gi") && modalitiesPresent.includes("nogi");

  useEffect(() => {
    if (modalitiesPresent.length === 1) setEnrollModality(modalitiesPresent[0]);
    else if (modalitiesPresent.length === 0) setEnrollModality("");
  }, [modalitiesPresent]);

  const weightOptions =
    elig?.weight_classes.filter((w) => {
      if (ageId !== "" && w.weight_class.age_division_id !== ageId) return false;
      const m = w.weight_class.modality ?? "gi";
      if (hasBothModalities && enrollModality !== "") return m === enrollModality;
      return true;
    }) ?? [];

  const canProceedStep1 =
    name.trim().length > 1 &&
    email.includes("@") &&
    password.length >= 6 &&
    externalDojoName.trim().length > 0 &&
    externalFaixaLabel.trim().length > 0 &&
    birthYear != null &&
    declaredWeightKg != null;

  const continueFromStep2 = () => {
    if (ageId === "") {
      setFormError("Selecione a divisão de idade.");
      return;
    }
    if (hasBothModalities && enrollModality === "") {
      setFormError("Selecione Kimono ou No-Gi.");
      return;
    }
    setFormError(null);
    setStep(3);
  };

  const continueFromStep3 = () => {
    if (wcId === "") {
      setFormError("Selecione a categoria de peso.");
      return;
    }
    setFormError(null);
    enroll.mutate();
  };

  if (!Number.isFinite(competitionId)) {
    return <p>ID inválido</p>;
  }

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
        <div style={{ ...cardStyle, marginBottom: tokens.space.lg, padding: 0, overflow: "hidden" }}>
          {/* Banner do evento */}
          {bannerUrl ? (
            <>
              <img
                src={bannerUrl}
                alt={comp?.name ?? "Banner do evento"}
                style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }}
              />
              <div style={{ padding: "16px 20px 4px 20px" }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: tokens.color.textPrimary }}>
                  {compLoading ? "Carregando…" : comp ? comp.name : "Competição não encontrada"}
                </h1>
                {comp && (
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: tokens.color.textMuted }}>
                    {comp.organizer_dojo_name ? `${comp.organizer_dojo_name} · ` : ""}
                    {comp.reference_year}
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Sem banner: layout padrão com logo + nome */
            <div style={{ padding: tokens.space.xl }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: tokens.color.textPrimary }}>
                  Inscrição (sem login)
                </h1>
                <p style={{ margin: "6px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  {compLoading ? "Carregando…" : comp ? comp.name : "Competição não encontrada"}
                </p>
                {comp && (
                  <p style={{ margin: "8px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                    {comp.organizer_dojo_name ? `Organização: ${comp.organizer_dojo_name} · ` : ""}
                    Ano de referência: {comp.reference_year}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Steps sempre visíveis abaixo (com/sem banner) */}
          <div
            style={{
              display: "flex",
              gap: tokens.space.sm,
              flexWrap: "wrap",
              alignItems: "center",
              padding: `${tokens.space.md}px ${tokens.space.xl}px`,
              borderTop: `1px solid ${tokens.color.borderSubtle}`,
              background: "white",
            }}
          >
            <StepPill active={step === 1} done={step > 1} label="1. Dados" />
            <StepPill active={step === 2} done={step > 2} label="2. Categoria" />
            <StepPill active={step === 3} done={step > 3} label="3. Peso" />
            <StepPill active={step === 4} done={step > 4} label="4. Pronto" />
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", gap: tokens.space.md, flexWrap: "wrap", marginBottom: tokens.space.md }}>
            <Link to="/" style={{ fontSize: tokens.text.sm, color: tokens.color.primary, fontWeight: 800, textDecoration: "none" }}>
              ← Início
            </Link>
            <Link
              to="/login"
              style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, fontWeight: 700, textDecoration: "none" }}
            >
              Já tenho conta
            </Link>
          </div>

          {compError && (
            <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 800 }}>
              Competição indisponível ou não publicada.
            </p>
          )}

          {!compLoading && !compError && comp && step !== 4 && (
            <>
              {step === 1 && (
                <>
                  <h2
                    style={{
                      margin: `${tokens.space.lg}px 0 0 0`,
                      fontSize: 18,
                      fontWeight: 900,
                      color: tokens.color.textPrimary,
                    }}
                  >
                    Seus dados
                  </h2>
                  <p style={{ margin: `${tokens.space.md}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.6 }}>
                    Criamos sua conta de atleta ao concluir. Informe o nome do seu dojo e sua faixa mesmo que não estejam cadastrados no sistema.
                  </p>

                  <div style={{ display: "grid", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Nome completo</span>
                      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>E-mail (será seu login)</span>
                      <input
                        style={inputStyle}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Senha (mín. 6 caracteres)</span>
                      <input
                        style={inputStyle}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Dojo / equipe</span>
                      <input
                        style={inputStyle}
                        value={externalDojoName}
                        onChange={(e) => setExternalDojoName(e.target.value)}
                        placeholder="Ex.: Gracie Barra Centro"
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Faixa</span>
                      <select
                        style={inputStyle}
                        value={externalFaixaLabel}
                        onChange={(e) => setExternalFaixaLabel(e.target.value)}
                      >
                        <option value="">Selecione sua faixa…</option>
                        {(faixasData ?? []).map((f) => (
                          <option key={f.id} value={f.label}>{f.label}</option>
                        ))}
                      </select>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space.md }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Ano de nascimento</span>
                        <input
                          style={inputStyle}
                          inputMode="numeric"
                          value={birthYearStr}
                          onChange={(e) => setBirthYearStr(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="Ex.: 2010"
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Peso declarado (kg)</span>
                        <input
                          style={inputStyle}
                          inputMode="decimal"
                          value={declaredWeightStr}
                          onChange={(e) => setDeclaredWeightStr(e.target.value)}
                          placeholder="Ex.: 64,5"
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: tokens.space.lg }}>
                    <button
                      type="button"
                      disabled={!canProceedStep1}
                      onClick={() => {
                        setFormError(null);
                        setStep(2);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: canProceedStep1 ? tokens.color.primary : tokens.color.borderSubtle,
                        border: `1px solid ${canProceedStep1 ? tokens.color.primaryDark : tokens.color.borderSubtle}`,
                        color: tokens.color.textOnPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: canProceedStep1 ? "pointer" : "not-allowed",
                        fontWeight: 900,
                        fontSize: tokens.text.sm,
                      }}
                    >
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2
                    style={{
                      margin: `${tokens.space.lg}px 0 0 0`,
                      fontSize: 18,
                      fontWeight: 900,
                      color: tokens.color.textPrimary,
                    }}
                  >
                    Gênero e divisão
                  </h2>
                  <p style={{ margin: `${tokens.space.sm}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                    Com base no ano de nascimento informado ({birthYear ?? "—"}), escolha gênero e divisão.
                  </p>

                  <div style={{ marginTop: tokens.space.lg }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Gênero</p>
                    <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setGender("male")}
                        style={{
                          padding: tokens.space.md,
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${gender === "male" ? tokens.color.primary : tokens.color.borderSubtle}`,
                          backgroundColor: gender === "male" ? `${tokens.color.primary}18` : "white",
                          cursor: "pointer",
                          fontWeight: 900,
                          color: tokens.color.textPrimary,
                          flex: "1 1 160px",
                        }}
                      >
                        Masculino
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender("female")}
                        style={{
                          padding: tokens.space.md,
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${gender === "female" ? tokens.color.primary : tokens.color.borderSubtle}`,
                          backgroundColor: gender === "female" ? `${tokens.color.primary}18` : "white",
                          cursor: "pointer",
                          fontWeight: 900,
                          color: tokens.color.textPrimary,
                          flex: "1 1 160px",
                        }}
                      >
                        Feminino
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Divisão de idade</span>
                      <select
                        style={inputStyle}
                        value={ageId === "" ? "" : String(ageId)}
                        onChange={(e) => {
                          setAgeId(e.target.value ? Number(e.target.value) : "");
                          setWcId("");
                          setFormError(null);
                        }}
                      >
                        <option value="">— Selecione —</option>
                        {ageOptions.map((a) => (
                          <option key={a.age_division.id} value={a.age_division.id}>
                            {a.age_division.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {hasBothModalities && (
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Modalidade</span>
                        <select
                          style={inputStyle}
                          value={enrollModality}
                          onChange={(e) => {
                            const v = e.target.value as "gi" | "nogi" | "";
                            setEnrollModality(v);
                            setWcId("");
                            setFormError(null);
                          }}
                        >
                          <option value="">— Selecione —</option>
                          <option value="gi">Kimono (Gi)</option>
                          <option value="nogi">No-Gi</option>
                        </select>
                      </label>
                    )}
                  </div>

                  {birthYear == null && (
                    <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontSize: tokens.text.sm }}>
                      Volte ao passo anterior e informe um ano de nascimento válido (≥ 1920).
                    </p>
                  )}

                  {formError && (
                    <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 900 }}>
                      {formError}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setStep(1);
                      }}
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
                      disabled={birthYear == null}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        backgroundColor: birthYear == null ? tokens.color.borderSubtle : tokens.color.primary,
                        border: `1px solid ${tokens.color.primaryDark}`,
                        color: tokens.color.textOnPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: birthYear == null ? "not-allowed" : "pointer",
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
                  <h2
                    style={{
                      margin: `${tokens.space.lg}px 0 0 0`,
                      fontSize: 18,
                      fontWeight: 900,
                      color: tokens.color.textPrimary,
                    }}
                  >
                    Categoria de peso
                  </h2>
                  <p style={{ margin: `${tokens.space.sm}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                    Peso declarado: <strong>{declaredWeightKg != null ? `${declaredWeightKg} kg` : "—"}</strong>. Escolha a categoria compatível; na
                    pesagem oficial o limite será verificado.
                  </p>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: tokens.space.lg }}>
                    <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Categoria</span>
                    <select
                      style={inputStyle}
                      value={wcId === "" ? "" : String(wcId)}
                      onChange={(e) => {
                        setWcId(e.target.value ? Number(e.target.value) : "");
                        setFormError(null);
                      }}
                    >
                      <option value="">— Selecione —</option>
                      {weightOptions.map((w) => {
                        const tag = (w.weight_class.modality ?? "gi") === "nogi" ? "No-Gi" : "Gi";
                        const iv = w.weight_class.weight_interval_label;
                        return (
                          <option key={w.weight_class.id} value={w.weight_class.id}>
                            [{tag}] {w.weight_class.label}
                            {iv ? ` — ${iv}` : w.weight_class.max_weight_kg != null ? ` (até ${w.weight_class.max_weight_kg} kg)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  {formError && (
                    <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 900 }}>
                      {formError}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setStep(2);
                      }}
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
                      disabled={enroll.isPending || wcId === ""}
                      onClick={continueFromStep3}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        backgroundColor: enroll.isPending || wcId === "" ? tokens.color.borderSubtle : tokens.color.primary,
                        border: `1px solid ${tokens.color.primaryDark}`,
                        color: tokens.color.textOnPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: enroll.isPending || wcId === "" ? "not-allowed" : "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {enroll.isPending ? "Enviando…" : "Confirmar inscrição"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ margin: `${tokens.space.lg}px 0 0 0`, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                Inscrição registrada
              </h2>
              <p style={{ margin: `${tokens.space.md}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.6 }}>
                Sua conta foi criada e você já está inscrito em <strong>{comp?.name}</strong>. Você pode acessar o app com o e-mail e a senha informados.
              </p>
              {(comp?.registration_fee_amount ?? 0) > 0 && (
                <div
                  style={{
                    marginTop: tokens.space.md,
                    padding: tokens.space.md,
                    borderRadius: tokens.radius.md,
                    backgroundColor: `${tokens.color.primary}12`,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    fontSize: tokens.text.sm,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Taxa de inscrição:</strong> R$ {comp?.registration_fee_amount}. Envie o comprovante em{" "}
                  <Link to="/competicoes" style={{ color: tokens.color.primary, fontWeight: 800 }}>
                    Competições
                  </Link>{" "}
                  (secção «Minhas inscrições — pagamento») após entrar. O organizador confirma como na mensalidade do dojo.
                  {comp?.registration_payment_instructions ? (
                    <p style={{ margin: "10px 0 0 0", whiteSpace: "pre-wrap" }}>{comp.registration_payment_instructions}</p>
                  ) : null}
                </div>
              )}
              <div style={{ marginTop: tokens.space.lg, display: "flex", gap: tokens.space.md, flexWrap: "wrap" }}>
                <Link
                  to="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 46,
                    padding: "0 20px",
                    backgroundColor: tokens.color.primary,
                    borderRadius: tokens.radius.md,
                    textDecoration: "none",
                    color: tokens.color.textOnPrimary,
                    fontWeight: 900,
                  }}
                >
                  Ir ao painel
                </Link>
                <Link
                  to="/competicoes"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 46,
                    padding: "0 20px",
                    backgroundColor: "white",
                    borderRadius: tokens.radius.md,
                    textDecoration: "none",
                    color: tokens.color.textPrimary,
                    fontWeight: 900,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                  }}
                >
                  Competições
                </Link>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: tokens.space.xl, display: "flex", justifyContent: "center" }}>
          <img src={arenaMasterLogo} alt="Arena Master" style={{ width: 140, height: "auto", opacity: 0.9 }} />
        </div>
      </div>
    </div>
  );
}
