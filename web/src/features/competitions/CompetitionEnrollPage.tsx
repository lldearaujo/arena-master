import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import arenaMasterLogo from "../../assets/arena-master-logo.png";
import type { Competition, WeightClass } from "./types";

type Eligibility = {
  age_divisions: Array<{ age_division: { id: number; label: string }; allowed_faixa_ids: number[] }>;
  weight_classes: Array<{ weight_class: WeightClass }>;
};

type StudentMe = {
  id: number;
  name: string;
  birth_date: string | null;
  faixa_id: number | null;
  graduacao?: string | null;
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

export function CompetitionEnrollPage() {
  const { id } = useParams<{ id: string }>();
  const competitionId = Number(id);
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [ageId, setAgeId] = useState<number | "">("");
  const [wcId, setWcId] = useState<number | "">("");
  const [enrollModality, setEnrollModality] = useState<"gi" | "nogi" | "">("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: comp, isLoading: compLoading, error: compError } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: async () => {
      const res = await api.get<Competition>(`/api/competitions/${competitionId}`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: me } = useQuery({
    queryKey: ["student", "me"],
    queryFn: async () => {
      const res = await api.get<StudentMe>("/api/students/me");
      return res.data;
    },
  });

  const birthYear = useMemo(() => {
    if (!me?.birth_date) return null;
    return new Date(me.birth_date).getFullYear();
  }, [me?.birth_date]);

  const { data: elig } = useQuery({
    queryKey: ["eligibility", competitionId, gender, birthYear],
    queryFn: async () => {
      const res = await api.get<Eligibility>(`/api/competitions/${competitionId}/eligibility-options`, {
        params: { gender, birth_year: birthYear ?? undefined },
      });
      return res.data;
    },
    enabled: Number.isFinite(competitionId) && birthYear != null,
  });

  const enroll = useMutation({
    mutationFn: async () => {
      if (!me || ageId === "" || wcId === "") throw new Error("incompleto");
      await api.post(`/api/competitions/${competitionId}/registrations`, {
        student_id: me.id,
        gender,
        age_division_id: ageId,
        weight_class_id: wcId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
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

  const ageOptions = elig?.age_divisions.filter(
    (a) => me?.faixa_id != null && a.allowed_faixa_ids.includes(me.faixa_id),
  );

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

  const canProceedStep1 = Boolean(me?.birth_date && me?.faixa_id);

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
        <div style={{ ...cardStyle, marginBottom: tokens.space.lg }}>
          {logoUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: tokens.space.md }}>
              <img
                src={logoUrl}
                alt={comp?.organizer_dojo_name ?? "Dojo"}
                style={{ width: "50%", maxWidth: 260, height: "auto", objectFit: "contain" }}
              />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: tokens.space.lg, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: tokens.color.textPrimary }}>
                Inscrição na competição
              </h1>
              <p style={{ margin: "6px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                {compLoading ? "Carregando…" : comp ? comp.name : "Competição não encontrada"}
              </p>
              {comp && (
                <p style={{ margin: "8px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  {comp.organizer_dojo_name ? `Organização: ${comp.organizer_dojo_name} • ` : ""}
                  Ano de referência: {comp.reference_year}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap", alignItems: "center" }}>
              <StepPill active={step === 1} done={step > 1} label="1. Início" />
              <StepPill active={step === 2} done={step > 2} label="2. Categoria" />
              <StepPill active={step === 3} done={step > 3} label="3. Peso" />
              <StepPill active={step === 4} done={step > 4} label="4. Concluído" />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <Link
            to="/competicoes"
            style={{ fontSize: tokens.text.sm, color: tokens.color.primary, fontWeight: 800, textDecoration: "none" }}
          >
            ← Voltar às competições
          </Link>

          {compError && (
            <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 800 }}>
              Não foi possível carregar esta competição.
            </p>
          )}

          {!compLoading && !compError && comp && step !== 4 && (
            <>
              {step === 1 && (
                <>
                  <h2 style={{ margin: `${tokens.space.lg}px 0 0 0`, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Olá{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
                  </h2>
                  <p style={{ margin: `${tokens.space.md}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.6 }}>
                    Confirme se seus dados estão corretos para se inscrever. A categoria de idade e de peso dependem da sua{" "}
                    <strong>data de nascimento</strong> e <strong>faixa</strong> cadastradas no dojo.
                  </p>
                  <div
                    style={{
                      marginTop: tokens.space.lg,
                      padding: tokens.space.lg,
                      borderRadius: tokens.radius.md,
                      backgroundColor: tokens.color.bgBody,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                    }}
                  >
                    <div style={{ fontSize: tokens.text.sm, fontWeight: 900, color: tokens.color.textMuted, marginBottom: 8 }}>
                      Resumo do seu cadastro
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: tokens.color.textPrimary, fontSize: tokens.text.sm, lineHeight: 1.7 }}>
                      <li>
                        <strong>Data de nascimento:</strong>{" "}
                        {me?.birth_date ? new Date(me.birth_date).toLocaleDateString("pt-BR") : "— não informada"}
                      </li>
                      <li>
                        <strong>Graduação:</strong> {me?.graduacao ?? (me?.faixa_id ? "Faixa cadastrada" : "— sem faixa")}
                      </li>
                    </ul>
                  </div>

                  {!me?.birth_date && (
                    <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 800, fontSize: tokens.text.sm }}>
                      Informe sua data de nascimento em{" "}
                      <Link to="/configuracoes" style={{ color: tokens.color.primary }}>
                        Configurações
                      </Link>{" "}
                      ou peça ao professor.
                    </p>
                  )}
                  {me && !me.faixa_id && (
                    <p style={{ marginTop: tokens.space.sm, color: tokens.color.error, fontWeight: 800, fontSize: tokens.text.sm }}>
                      É necessário ter faixa cadastrada. Fale com seu professor.
                    </p>
                  )}

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
                  <h2 style={{ margin: `${tokens.space.lg}px 0 0 0`, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Gênero e divisão
                  </h2>
                  <p style={{ margin: `${tokens.space.sm}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                    Escolha o gênero da chave e a divisão de idade em que vai competir.
                  </p>

                  <div style={{ marginTop: tokens.space.lg }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                      Gênero
                    </p>
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
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: hasBothModalities ? "1 / -1" : "1 / -1" }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                        Divisão de idade
                      </span>
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
                        {(ageOptions ?? []).map((a) => (
                          <option key={a.age_division.id} value={a.age_division.id}>
                            {a.age_division.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {hasBothModalities && (
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                          Modalidade
                        </span>
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
                      Não foi possível carregar opções de idade sem data de nascimento.
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
                  <h2 style={{ margin: `${tokens.space.lg}px 0 0 0`, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Categoria de peso
                  </h2>
                  <p style={{ margin: `${tokens.space.sm}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                    Escolha a categoria conforme a tabela do evento. Confira o intervalo de peso na pesagem oficial.
                  </p>

                  <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: tokens.space.lg }}>
                    <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>
                      Categoria
                    </span>
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
                Sua inscrição em <strong>{comp?.name}</strong> foi enviada. Acompanhe datas e pesagem com a organização do evento.
              </p>
              <div style={{ marginTop: tokens.space.lg }}>
                <Link
                  to="/competicoes"
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
                  Voltar às competições
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
