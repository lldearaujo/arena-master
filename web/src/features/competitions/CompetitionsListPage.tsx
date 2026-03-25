import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { tokens } from "../../ui/tokens";
import type { Competition, CompetitionKpiItem, Registration } from "./types";

const card = {
  padding: tokens.space.xl,
  backgroundColor: "white",
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.color.borderSubtle}`,
};

function enrollmentUrl(competitionId: number) {
  return `${window.location.origin}/competicao/inscricao/${competitionId}`;
}

async function shareOrCopyEnrollmentLink(competitionId: number): Promise<"shared" | "copied" | "failed" | "cancelled"> {
  const url = enrollmentUrl(competitionId);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "Inscrição na competição",
        text: "Inscrição aberta — não precisa estar logado. Cria conta ao finalizar.",
        url,
      });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function CompetitionsListPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const showOrganizerTabs =
    user?.role === "superadmin" || (user?.role === "admin" && user.dojoId != null);

  const [tab, setTab] = useState<"lista" | "painel" | "financeiro">(() => {
    const u = useAuthStore.getState().user;
    const organizer = u?.role === "superadmin" || (u?.role === "admin" && u.dojoId != null);
    return organizer ? "painel" : "lista";
  });
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // Se o utilizador ainda não estava hidratado no 1.º render, passar a KPIs quando for organizador.
  useEffect(() => {
    if (!showOrganizerTabs) return;
    setTab((prev) => (prev === "lista" ? "painel" : prev));
  }, [showOrganizerTabs]);

  const { data: list, isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const res = await api.get<Competition[]>("/api/competitions/");
      return res.data;
    },
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["competitions", "organizer-kpis"],
    queryFn: async () => {
      const res = await api.get<CompetitionKpiItem[]>("/api/competitions/organizer-kpis");
      return res.data;
    },
    enabled: showOrganizerTabs && tab === "painel",
  });

  const { data: pendingRegPayments, isLoading: pendPayLoading } = useQuery({
    queryKey: ["competitions", "pending-reg-payments"],
    queryFn: async () => {
      const res = await api.get<Registration[]>("/api/competitions/organizer/pending-registration-payments");
      return res.data;
    },
    enabled: showOrganizerTabs && tab === "financeiro",
  });

  const { data: myRegs, isLoading: myRegsLoading } = useQuery({
    queryKey: ["competitions", "me", "my-registrations"],
    queryFn: async () => {
      const res = await api.get<Registration[]>("/api/competitions/me/my-registrations");
      return res.data;
    },
    enabled: user?.role === "aluno",
  });

  const confirmPayList = useMutation({
    mutationFn: async ({ cid, rid }: { cid: number; rid: number }) => {
      await api.post(`/api/competitions/${cid}/registrations/${rid}/confirm-payment`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions", "pending-reg-payments"] });
      qc.invalidateQueries({ queryKey: ["competitions", "organizer-kpis"] });
    },
  });

  const rejectPayList = useMutation({
    mutationFn: async ({ cid, rid, notes }: { cid: number; rid: number; notes: string }) => {
      await api.post(`/api/competitions/${cid}/registrations/${rid}/reject-payment`, { notes: notes || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions", "pending-reg-payments"] });
      qc.invalidateQueries({ queryKey: ["competitions", "organizer-kpis"] });
    },
  });

  const uploadRegReceipt = useMutation({
    mutationFn: async ({ cid, rid, file }: { cid: number; rid: number; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/api/competitions/${cid}/registrations/${rid}/payment-receipt`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions", "me", "my-registrations"] });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<Competition>("/api/competitions/", {
        name: name.trim(),
        reference_year: year,
        is_published: false,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      qc.invalidateQueries({ queryKey: ["competitions", "organizer-kpis"] });
      setName("");
    },
  });

  const totals = (kpis ?? []).reduce(
    (acc, k) => {
      acc.inscritos += k.registrations_total;
      acc.pesados += k.registrations_weighed_in;
      acc.chaves += k.brackets_count;
      acc.pendPay += k.pending_registration_payment_confirmations ?? 0;
      return acc;
    },
    { inscritos: 0, pesados: 0, chaves: 0, pendPay: 0 },
  );

  const receiptBase = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  function receiptUrl(path: string | null | undefined) {
    if (!path) return "#";
    return path.startsWith("http") ? path : `${receiptBase}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  function regPaymentLabel(st: string | undefined) {
    switch (st) {
      case "not_applicable":
        return "Isento";
      case "pending_payment":
        return "Aguardando pagamento";
      case "pending_confirmation":
        return "Comprovante enviado";
      case "confirmed":
        return "Pago ✓";
      case "rejected":
        return "Recusado — reenvie";
      default:
        return st ?? "—";
    }
  }

  if (user?.role !== "admin" && user?.role !== "aluno" && user?.role !== "superadmin") {
    return <p style={{ color: tokens.color.textMuted }}>Acesso não autorizado.</p>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], fontWeight: 600, marginBottom: tokens.space.sm }}>
        Competições
      </h1>
      <p style={{ color: tokens.color.textMuted, marginBottom: tokens.space.lg }}>
        {user.role === "admin" || user.role === "superadmin"
          ? "Crie e gerencie eventos do seu dojo."
          : "Inscreva-se em competições publicadas."}
      </p>

      {user.role === "aluno" && (
        <div style={{ ...card, marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 700, marginBottom: tokens.space.md }}>Minhas inscrições — pagamento</h2>
          <p style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, marginBottom: tokens.space.md, lineHeight: 1.5 }}>
            Se o evento tiver taxa, envie o comprovante (PIX) aqui. O professor confirma como na mensalidade do dojo. Chave PIX e QR estão em{" "}
            <Link to="/financeiro" style={{ color: tokens.color.primary, fontWeight: 700 }}>
              Financeiro
            </Link>
            .
          </p>
          {myRegsLoading && <p style={{ color: tokens.color.textMuted }}>Carregando…</p>}
          {!myRegsLoading && (myRegs ?? []).length === 0 && (
            <p style={{ color: tokens.color.textMuted }}>Você ainda não está inscrito em nenhuma competição.</p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {(myRegs ?? [])
              .filter((r) => (r.registration_fee_amount ?? 0) > 0)
              .map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: tokens.space.md,
                    borderRadius: tokens.radius.sm,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    backgroundColor: tokens.color.bgBody,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{r.competition_name ?? `Competição #${r.competition_id}`}</div>
                  <div style={{ fontSize: tokens.text.sm, marginTop: 4 }}>
                    Status pagamento: <strong>{regPaymentLabel(r.payment_status)}</strong>
                    {r.registration_fee_amount != null ? ` • Taxa R$ ${r.registration_fee_amount}` : ""}
                  </div>
                  {r.registration_payment_instructions && (
                    <p style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {r.registration_payment_instructions}
                    </p>
                  )}
                  {r.payment_status === "pending_confirmation" && (
                    <p style={{ fontSize: 12, marginTop: 8, color: tokens.color.textMuted }}>Aguardando confirmação do organizador.</p>
                  )}
                  {(r.payment_status === "pending_payment" || r.payment_status === "rejected") && (
                    <label style={{ display: "block", marginTop: 10, fontSize: tokens.text.sm, fontWeight: 700 }}>
                      Enviar comprovante (imagem ou PDF)
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: "block", marginTop: 6 }}
                        disabled={uploadRegReceipt.isPending}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadRegReceipt.mutate({ cid: r.competition_id, rid: r.id, file: f });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  {r.payment_receipt_path && (
                    <a
                      href={receiptUrl(r.payment_receipt_path)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-block", marginTop: 8, fontSize: tokens.text.sm, color: tokens.color.primary }}
                    >
                      Ver último arquivo enviado
                    </a>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {showOrganizerTabs && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: tokens.space.xl,
            padding: 4,
            backgroundColor: tokens.color.bgBody,
            borderRadius: tokens.radius.md,
            width: "fit-content",
            border: `1px solid ${tokens.color.borderSubtle}`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab("lista");
              setCopyHint(null);
            }}
            style={{
              padding: "10px 18px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: tab === "lista" ? "white" : "transparent",
              color: tokens.color.textPrimary,
              boxShadow: tab === "lista" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("painel");
              setCopyHint(null);
            }}
            style={{
              padding: "10px 18px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: tab === "painel" ? "white" : "transparent",
              color: tokens.color.textPrimary,
              boxShadow: tab === "painel" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Painel &amp; KPIs
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("financeiro");
              setCopyHint(null);
            }}
            style={{
              padding: "10px 18px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: tab === "financeiro" ? "white" : "transparent",
              color: tokens.color.textPrimary,
              boxShadow: tab === "financeiro" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Financeiro (inscrições)
          </button>
        </div>
      )}

      {copyHint && (
        <p
          style={{
            marginBottom: tokens.space.md,
            padding: "10px 14px",
            borderRadius: tokens.radius.sm,
            backgroundColor: `${tokens.color.success}18`,
            color: tokens.color.textPrimary,
            fontSize: tokens.text.sm,
            fontWeight: 700,
          }}
        >
          {copyHint}
        </p>
      )}

      {tab === "lista" && user.role === "admin" && user.dojoId != null && (
        <div style={{ ...card, marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, marginBottom: tokens.space.md }}>
            Nova competição
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: 8, minWidth: 220, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.borderSubtle}` }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Ano referência</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ padding: 8, width: 100, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.borderSubtle}` }}
              />
            </label>
            <button
              type="button"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
              style={{
                padding: "10px 16px",
                borderRadius: tokens.radius.sm,
                border: "none",
                backgroundColor: tokens.color.primary,
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Criar
            </button>
          </div>
          {createMut.isError && (
            <p style={{ color: tokens.color.error, marginTop: 8 }}>Não foi possível criar.</p>
          )}
        </div>
      )}

      {tab === "lista" && (
        <>
          {isLoading && <p style={{ color: tokens.color.textMuted }}>Carregando…</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {(list ?? []).map((c) => (
              <li key={c.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <div>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, marginTop: 4 }}>
                      Ano {c.reference_year}
                      {c.is_published ? " · Publicada" : " · Rascunho"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {(user.role === "superadmin" ||
                      (user.role === "admin" && user.dojoId === c.organizer_dojo_id)) && (
                      <Link
                        to={`/competicoes/gerir/${c.id}`}
                        style={{
                          padding: "8px 14px",
                          borderRadius: tokens.radius.sm,
                          backgroundColor: tokens.color.primary,
                          color: "white",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: tokens.text.sm,
                        }}
                      >
                        Gerir
                      </Link>
                    )}
                    {user.role === "aluno" && c.is_published && (
                      <Link
                        to={`/competicoes/inscricao/${c.id}`}
                        style={{
                          padding: "8px 14px",
                          borderRadius: tokens.radius.sm,
                          border: `1px solid ${tokens.color.primary}`,
                          color: tokens.color.primary,
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: tokens.text.sm,
                        }}
                      >
                        Inscrever-me
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {!isLoading && (list?.length ?? 0) === 0 && (
            <p style={{ color: tokens.color.textMuted }}>Nenhuma competição listada.</p>
          )}
        </>
      )}

      {tab === "painel" && showOrganizerTabs && (
        <>
          <p style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm, marginBottom: tokens.space.lg, lineHeight: 1.5 }}>
            Visão rápida das suas competições. O link público de inscrição não exige login; alunos com taxa enviam o comprovante em{" "}
            <strong>Competições → Financeiro (inscrições)</strong> ou na lista (minhas inscrições).
          </p>

          {kpisLoading && <p style={{ color: tokens.color.textMuted }}>Carregando indicadores…</p>}

          {!kpisLoading && (kpis?.length ?? 0) > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: tokens.space.md,
                marginBottom: tokens.space.xl,
              }}
            >
              <div style={{ ...card, padding: tokens.space.lg }}>
                <div style={{ fontSize: tokens.text.xs, fontWeight: 800, color: tokens.color.textMuted, textTransform: "uppercase" }}>
                  Eventos
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: tokens.color.textPrimary }}>{kpis!.length}</div>
              </div>
              <div style={{ ...card, padding: tokens.space.lg }}>
                <div style={{ fontSize: tokens.text.xs, fontWeight: 800, color: tokens.color.textMuted, textTransform: "uppercase" }}>
                  Inscrições
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: tokens.color.textPrimary }}>{totals.inscritos}</div>
              </div>
              <div style={{ ...card, padding: tokens.space.lg }}>
                <div style={{ fontSize: tokens.text.xs, fontWeight: 800, color: tokens.color.textMuted, textTransform: "uppercase" }}>
                  Pesados
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: tokens.color.textPrimary }}>{totals.pesados}</div>
              </div>
              <div style={{ ...card, padding: tokens.space.lg }}>
                <div style={{ fontSize: tokens.text.xs, fontWeight: 800, color: tokens.color.textMuted, textTransform: "uppercase" }}>
                  Chaves
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: tokens.color.textPrimary }}>{totals.chaves}</div>
              </div>
              <div style={{ ...card, padding: tokens.space.lg }}>
                <div style={{ fontSize: tokens.text.xs, fontWeight: 800, color: tokens.color.textMuted, textTransform: "uppercase" }}>
                  Comprovantes a confirmar
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    marginTop: 6,
                    color: totals.pendPay > 0 ? tokens.color.primary : tokens.color.textPrimary,
                  }}
                >
                  {totals.pendPay}
                </div>
              </div>
            </div>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {(kpis ?? []).map((k) => (
              <li key={k.competition_id} style={card}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: tokens.space.md }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <strong>{k.name}</strong>
                    <div style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, marginTop: 4 }}>
                      Ano {k.reference_year}
                      {k.is_published ? " · Publicada" : " · Rascunho"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: tokens.space.md,
                        marginTop: tokens.space.md,
                        fontSize: tokens.text.sm,
                        color: tokens.color.textPrimary,
                      }}
                    >
                      <span>
                        <strong>{k.registrations_total}</strong> inscritos
                      </span>
                      <span style={{ color: tokens.color.textMuted }}>|</span>
                      <span>{k.registrations_registered} só inscritos</span>
                      <span style={{ color: tokens.color.textMuted }}>|</span>
                      <span>{k.registrations_weighed_in} pesados</span>
                      {k.registrations_disqualified > 0 && (
                        <>
                          <span style={{ color: tokens.color.textMuted }}>|</span>
                          <span style={{ color: tokens.color.error }}>{k.registrations_disqualified} desclass.</span>
                        </>
                      )}
                      <span style={{ color: tokens.color.textMuted }}>|</span>
                      <span>{k.brackets_count} chaves</span>
                      {(k.pending_registration_payment_confirmations ?? 0) > 0 && (
                        <>
                          <span style={{ color: tokens.color.textMuted }}>|</span>
                          <span style={{ color: tokens.color.primary, fontWeight: 800 }}>
                            {k.pending_registration_payment_confirmations} comprovante(s) a confirmar
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch", minWidth: 200 }}>
                    {(user.role === "superadmin" ||
                      (user.role === "admin" && user.dojoId === k.organizer_dojo_id)) && (
                      <Link
                        to={`/competicoes/gerir/${k.competition_id}`}
                        style={{
                          padding: "8px 14px",
                          borderRadius: tokens.radius.sm,
                          backgroundColor: tokens.color.primary,
                          color: "white",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: tokens.text.sm,
                          textAlign: "center",
                        }}
                      >
                        Gerir
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={!k.is_published}
                      title={!k.is_published ? "Publique a competição para os alunos usarem o link." : undefined}
                      onClick={async () => {
                        const r = await shareOrCopyEnrollmentLink(k.competition_id);
                        if (r === "cancelled") return;
                        if (r === "copied") setCopyHint("Link copiado para a área de transferência.");
                        else if (r === "shared") setCopyHint("Partilha enviada.");
                        else setCopyHint("Não foi possível copiar. Copie manualmente: " + enrollmentUrl(k.competition_id));
                        window.setTimeout(() => setCopyHint(null), 5000);
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${tokens.color.primary}`,
                        backgroundColor: k.is_published ? "white" : tokens.color.bgBody,
                        color: k.is_published ? tokens.color.primary : tokens.color.textMuted,
                        fontWeight: 600,
                        fontSize: tokens.text.sm,
                        cursor: k.is_published ? "pointer" : "not-allowed",
                      }}
                    >
                      {k.is_published ? "Copiar / partilhar link de inscrição" : "Publique para partilhar o link"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {!kpisLoading && (kpis?.length ?? 0) === 0 && (
            <p style={{ color: tokens.color.textMuted }}>Nenhuma competição para exibir.</p>
          )}
        </>
      )}

      {tab === "financeiro" && showOrganizerTabs && (
        <>
          <p style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm, marginBottom: tokens.space.lg, lineHeight: 1.6 }}>
            Comprovantes de <strong>taxa de inscrição</strong> enviados pelos atletas. Confirme ou recuse (como nos pagamentos de mensalidade em{" "}
            <Link to="/financeiro" style={{ color: tokens.color.primary, fontWeight: 700 }}>
              Financeiro
            </Link>
            ). Para ver só um evento, use <strong>Gerir → Financeiro</strong>.
          </p>
          {pendPayLoading && <p style={{ color: tokens.color.textMuted }}>Carregando…</p>}
          {!pendPayLoading && (pendingRegPayments?.length ?? 0) === 0 && (
            <p style={{ color: tokens.color.textMuted }}>Nenhum comprovante aguardando confirmação.</p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {(pendingRegPayments ?? []).map((r) => (
              <li key={`${r.competition_id}-${r.id}`} style={card}>
                <div style={{ fontWeight: 800 }}>{r.competition_name ?? `Evento #${r.competition_id}`}</div>
                <div style={{ fontSize: tokens.text.sm, marginTop: 4 }}>
                  {r.student_name ?? `Aluno #${r.student_id}`} — código {r.registration_public_code}
                  {r.registration_fee_amount != null ? ` • R$ ${r.registration_fee_amount}` : ""}
                </div>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {r.payment_receipt_path ? (
                    <a href={receiptUrl(r.payment_receipt_path)} target="_blank" rel="noreferrer" style={{ color: tokens.color.primary, fontWeight: 700 }}>
                      Abrir comprovante
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={confirmPayList.isPending}
                    onClick={() => confirmPayList.mutate({ cid: r.competition_id, rid: r.id })}
                    style={{ padding: "8px 14px", fontWeight: 700 }}
                  >
                    Confirmar pagamento
                  </button>
                  <button
                    type="button"
                    disabled={rejectPayList.isPending}
                    onClick={() => {
                      const notes = window.prompt("Motivo (opcional):") ?? "";
                      rejectPayList.mutate({ cid: r.competition_id, rid: r.id, notes });
                    }}
                    style={{ padding: "8px 14px" }}
                  >
                    Recusar
                  </button>
                  <Link
                    to={`/competicoes/gerir/${r.competition_id}`}
                    style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, fontWeight: 600 }}
                  >
                    Abrir gestão do evento
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
