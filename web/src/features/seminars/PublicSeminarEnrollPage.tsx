import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import arenaMasterLogo from "../../assets/arena-master-logo.png";

type PublicSummary = {
  seminar: {
    id: number;
    title: string;
    description: string | null;
    banner_url: string | null;
    starts_at: string | null;
    location_text: string | null;
    speaker_name: string | null;
    is_published: boolean;
    organizer_dojo_id: number;
  };
  pricing: {
    seminar_id: number;
    lot: { id: number; name: string; price_amount: number } | null;
    current_price_amount: number;
    seats_total: number | null;
    seats_filled: number;
    percent_filled: number;
    next_lot_starts_at: string | null;
  };
  pix_config:
    | {
        key_type: string;
        key_value: string;
        recipient_name?: string | null;
        bank_name?: string | null;
        instructions?: string | null;
        static_qr_image_path?: string | null;
      }
    | null;
};

type PublicEnrollResponse = {
  registration: {
    id: number;
    seminar_id: number;
    guest_full_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    payment_status: "pending_payment" | "pending_confirmation" | "confirmed" | "rejected" | string;
    payment_receipt_path: string | null;
    payment_notes: string | null;
    public_code: string;
    created_at: string;
  };
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

export function PublicSeminarEnrollPage() {
  const { id } = useParams<{ id: string }>();
  const seminarId = Number(id);
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reg, setReg] = useState<PublicEnrollResponse["registration"] | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-seminar-summary", seminarId],
    queryFn: async () => {
      const res = await api.get<PublicSummary>(`/api/seminars/public/enroll/${seminarId}/summary`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
    retry: false,
  });

  const bannerUrl = useMemo(() => resolveAssetUrl(data?.seminar.banner_url), [data?.seminar.banner_url]);
  const price = data?.pricing.current_price_amount ?? 0;
  const priceLabel = useMemo(() => {
    try {
      return (price ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch {
      return `R$ ${Number(price ?? 0).toFixed(2)}`;
    }
  }, [price]);

  const enroll = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.includes("@")) throw new Error("incompleto");
      const res = await api.post<PublicEnrollResponse>(`/api/seminars/public/enroll/${seminarId}`, {
        guest_full_name: name.trim(),
        guest_email: email.trim(),
        guest_phone: phone.trim() || null,
      });
      return res.data.registration;
    },
    onSuccess: (r) => {
      setReg(r);
      setFormError(null);
      setStep(2);
      qc.invalidateQueries({ queryKey: ["public-seminar-summary", seminarId] });
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.response?.data?.detail ?? "Não foi possível concluir sua inscrição.";
      setFormError(String(detail));
    },
  });

  const uploadReceipt = useMutation({
    mutationFn: async () => {
      if (!reg?.public_code) throw new Error("sem-codigo");
      if (!receiptFile) throw new Error("sem-arquivo");
      const form = new FormData();
      form.append("file", receiptFile);
      const res = await api.post(
        `/api/seminars/public/registrations/${encodeURIComponent(reg.public_code)}/payment-receipt`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data as PublicEnrollResponse["registration"];
    },
    onSuccess: (r: any) => {
      setReg((cur) => (cur ? { ...cur, ...r } : cur));
      setFormError(null);
      setStep(3);
    },
    onError: (err: unknown) => {
      const detail = (err as any)?.response?.data?.detail ?? "Não foi possível enviar o comprovante.";
      setFormError(String(detail));
    },
  });

  useEffect(() => {
    if (step !== 2) return;
    if (!reg) return;
    if (reg.payment_status === "confirmed") setStep(3);
  }, [step, reg]);

  if (!Number.isFinite(seminarId)) return <p>ID inválido</p>;

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
          {bannerUrl ? (
            <>
              <img src={bannerUrl} alt={data?.seminar.title ?? "Banner"} style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
              <div style={{ padding: "16px 20px 4px 20px" }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: tokens.color.textPrimary }}>
                  {isLoading ? "Carregando…" : data?.seminar.title ?? "Seminário"}
                </h1>
                {data?.seminar.speaker_name && (
                  <p style={{ margin: "6px 0 0 0", fontSize: 13, color: tokens.color.textMuted }}>
                    Palestrante: {data.seminar.speaker_name}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: tokens.space.xl }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: tokens.color.textPrimary }}>
                Inscrição (convidado)
              </h1>
              <p style={{ margin: "6px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                {isLoading ? "Carregando…" : data?.seminar.title ?? "Seminário"}
              </p>
            </div>
          )}

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
            <StepPill active={step === 2} done={step > 2} label="2. Pagamento" />
            <StepPill active={step === 3} done={step > 3} label="3. Pronto" />
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", gap: tokens.space.md, flexWrap: "wrap", marginBottom: tokens.space.md }}>
            <Link to="/" style={{ fontSize: tokens.text.sm, color: tokens.color.primary, fontWeight: 800, textDecoration: "none" }}>
              ← Início
            </Link>
            <Link to="/login" style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, fontWeight: 700, textDecoration: "none" }}>
              Já tenho conta
            </Link>
          </div>

          {error && (
            <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 900 }}>
              {(error as any)?.response?.data?.detail ?? "Seminário indisponível."}
            </p>
          )}

          {!isLoading && !error && data && (
            <>
              {step === 1 && (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Seus dados
                  </h2>
                  <p style={{ margin: `${tokens.space.sm}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.6 }}>
                    Preencha para reservar sua inscrição. Você vai receber instruções de pagamento e poderá anexar o comprovante aqui.
                  </p>

                  <div style={{ display: "grid", gap: tokens.space.md, marginTop: tokens.space.lg }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Nome completo</span>
                      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>E-mail</span>
                      <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: tokens.text.xs, fontWeight: 900, color: tokens.color.textMuted }}>Telefone (opcional)</span>
                      <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                    </label>
                  </div>

                  {formError && (
                    <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 900 }}>
                      {formError}
                    </p>
                  )}

                  <div style={{ marginTop: tokens.space.lg }}>
                    <button
                      type="button"
                      disabled={enroll.isPending || !name.trim() || !email.includes("@")}
                      onClick={() => enroll.mutate()}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: enroll.isPending || !name.trim() || !email.includes("@") ? tokens.color.borderSubtle : tokens.color.primary,
                        border: `1px solid ${tokens.color.primaryDark}`,
                        color: tokens.color.textOnPrimary,
                        borderRadius: tokens.radius.md,
                        cursor: enroll.isPending ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        fontSize: tokens.text.sm,
                      }}
                    >
                      {enroll.isPending ? "Enviando…" : "Continuar"}
                    </button>
                  </div>
                </>
              )}

              {step === 2 && reg && (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Pagamento
                  </h2>

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
                    <strong>Valor:</strong> {priceLabel}{" "}
                    {data.pricing.lot ? <span>· <strong>Lote:</strong> {data.pricing.lot.name}</span> : null}
                    <div style={{ marginTop: 8 }}>
                      <strong>Status:</strong> {reg.payment_status === "pending_payment" ? "Pendente" : reg.payment_status === "pending_confirmation" ? "Em análise" : reg.payment_status === "confirmed" ? "Confirmado" : "—"}
                    </div>
                  </div>

                  {data.pix_config ? (
                    <div style={{ marginTop: tokens.space.md }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: tokens.color.textPrimary }}>
                        PIX
                      </h3>
                      <p style={{ margin: "6px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                        {data.pix_config.key_type}: <strong>{data.pix_config.key_value}</strong>
                      </p>
                      {data.pix_config.recipient_name ? (
                        <p style={{ margin: "4px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                          Favorecido: {data.pix_config.recipient_name}
                        </p>
                      ) : null}
                      {data.pix_config.instructions ? (
                        <p style={{ margin: "8px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm, whiteSpace: "pre-wrap" }}>
                          {data.pix_config.instructions}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {price > 0 && reg.payment_status !== "confirmed" && (
                    <div style={{ marginTop: tokens.space.lg }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: tokens.color.textPrimary }}>
                        Anexar comprovante
                      </h3>
                      <p style={{ margin: "6px 0 0 0", color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                        Selecione a imagem/PDF do comprovante e envie para análise.
                      </p>
                      <input
                        style={{ marginTop: 10 }}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                      />

                      {formError && (
                        <p style={{ marginTop: tokens.space.md, color: tokens.color.error, fontWeight: 900 }}>
                          {formError}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={uploadReceipt.isPending || !receiptFile || reg.payment_status === "pending_confirmation"}
                        onClick={() => uploadReceipt.mutate()}
                        style={{
                          marginTop: 12,
                          width: "100%",
                          padding: "12px 16px",
                          backgroundColor: uploadReceipt.isPending || !receiptFile || reg.payment_status === "pending_confirmation" ? tokens.color.borderSubtle : tokens.color.primary,
                          border: `1px solid ${tokens.color.primaryDark}`,
                          color: tokens.color.textOnPrimary,
                          borderRadius: tokens.radius.md,
                          cursor: uploadReceipt.isPending ? "not-allowed" : "pointer",
                          fontWeight: 900,
                          fontSize: tokens.text.sm,
                        }}
                      >
                        {reg.payment_status === "pending_confirmation"
                          ? "Comprovante em análise"
                          : uploadReceipt.isPending
                            ? "Enviando…"
                            : "Enviar comprovante"}
                      </button>
                    </div>
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
                      onClick={() => setStep(3)}
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
                      Concluir
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: tokens.color.textPrimary }}>
                    Inscrição enviada
                  </h2>
                  <p style={{ margin: `${tokens.space.md}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm, lineHeight: 1.6 }}>
                    Tudo certo. Se houver taxa, envie o comprovante (ou aguarde a confirmação caso já tenha enviado).
                  </p>
                  <p style={{ margin: `${tokens.space.md}px 0 0 0`, color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                    Código da inscrição: <strong>{reg?.public_code ?? "—"}</strong>
                  </p>
                </>
              )}
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

