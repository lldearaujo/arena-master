import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import type { Seminar, SeminarLot, SeminarRegistration, SeminarScheduleItem } from "./types";

const styles = {
  page: {
    display: "grid",
    gap: tokens.space.xl,
    padding: "clamp(16px, 3vw, 28px)",
    maxWidth: 1120,
    margin: "0 auto",
  } satisfies React.CSSProperties,
  top: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  } satisfies React.CSSProperties,
  title: {
    margin: 0,
    fontSize: "clamp(22px, 2.3vw, 30px)",
    letterSpacing: -0.2,
    color: tokens.color.textPrimary,
  } satisfies React.CSSProperties,
  meta: {
    marginTop: 8,
    color: tokens.color.textMuted,
    fontSize: 13,
    lineHeight: 1.4,
  } satisfies React.CSSProperties,
  actions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  } satisfies React.CSSProperties,
  card: {
    padding: "clamp(16px, 2.4vw, 24px)",
    backgroundColor: "white",
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.color.borderSubtle}`,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  } satisfies React.CSSProperties,
  h2: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: tokens.text.lg,
    letterSpacing: -0.1,
    color: tokens.color.textPrimary,
  } satisfies React.CSSProperties,
  helper: {
    color: tokens.color.textMuted,
    fontSize: 12,
    lineHeight: 1.45,
  } satisfies React.CSSProperties,
  grid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "start",
  } satisfies React.CSSProperties,
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  } satisfies React.CSSProperties,
  label: {
    fontWeight: 800,
    fontSize: 13,
    color: tokens.color.textPrimary,
  } satisfies React.CSSProperties,
  control: {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${tokens.color.borderSubtle}`,
    outline: "none",
    fontSize: 14,
    backgroundColor: "white",
    transition: "box-shadow 0.15s, border-color 0.15s, transform 0.02s",
  } satisfies React.CSSProperties,
  controlFocusRing: `
    box-shadow: 0 0 0 4px rgba(184, 158, 93, 0.18);
    border-color: rgba(184, 158, 93, 0.55);
  `,
  btnBase: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.1,
    transition: "transform 0.02s, filter 0.15s, background-color 0.15s, box-shadow 0.15s",
    boxShadow: "0 10px 18px rgba(15, 23, 42, 0.10)",
  } satisfies React.CSSProperties,
  btnPrimary: {
    backgroundColor: tokens.color.primary,
    color: "white",
  } satisfies React.CSSProperties,
  btnNeutral: {
    backgroundColor: "#6b7280",
    color: "white",
  } satisfies React.CSSProperties,
  btnOutline: {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${tokens.color.borderSubtle}`,
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.1,
    transition: "transform 0.02s, filter 0.15s, background-color 0.15s, box-shadow 0.15s",
  } satisfies React.CSSProperties,
  listRow: {
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${tokens.color.borderSubtle}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,251,0.98))",
  } satisfies React.CSSProperties,
} as const;

const BRAZIL_UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

function mapSeminarPaymentStatusPt(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "confirmed" || s === "not_applicable") return "Pagamento confirmado";
  if (s === "pending_confirmation") return "Pagamento em análise";
  if (s === "rejected") return "Pagamento rejeitado";
  if (s === "pending_payment") return "Pagamento pendente";
  return "Pagamento pendente";
}

function mapSeminarScheduleKindPt(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "intro") return "Abertura";
  if (s === "technique") return "Técnica";
  if (s === "drills") return "Drills";
  if (s === "qa" || s === "q&a") return "Perguntas e respostas";
  if (s === "sparring") return "Treino";
  if (s === "graduation") return "Graduação";
  if (s === "other") return "Outro";
  return "Outro";
}

function clampUf(raw: string) {
  const v = (raw || "").trim().toUpperCase();
  if (v.length <= 2) return v;
  return v.slice(0, 2);
}

export function SeminarManagePage() {
  const { id } = useParams();
  const seminarId = Number(id);
  const qc = useQueryClient();

  const { data: seminar, isLoading } = useQuery({
    queryKey: ["seminars", seminarId],
    queryFn: async () => {
      const res = await api.get<Seminar>(`/api/seminars/${seminarId}`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
  });

  const { data: lots } = useQuery({
    queryKey: ["seminars", seminarId, "lots"],
    queryFn: async () => {
      const res = await api.get<SeminarLot[]>(`/api/seminars/${seminarId}/lots`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
  });

  const { data: schedule } = useQuery({
    queryKey: ["seminars", seminarId, "schedule"],
    queryFn: async () => {
      const res = await api.get<SeminarScheduleItem[]>(`/api/seminars/${seminarId}/schedule-items`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
  });

  const { data: regs } = useQuery({
    queryKey: ["seminars", seminarId, "registrations"],
    queryFn: async () => {
      const res = await api.get<SeminarRegistration[]>(`/api/seminars/${seminarId}/registrations`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
  });

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [speakerName, setSpeakerName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "public" | "">("");

  // lot form
  const [lotName, setLotName] = useState("1º lote");
  const [lotPrice, setLotPrice] = useState("0");
  const [lotStarts, setLotStarts] = useState("");
  const [lotEnds, setLotEnds] = useState("");
  const [lotOrder, setLotOrder] = useState("0");

  // schedule form
  const [itTitle, setItTitle] = useState("");
  const [itKind, setItKind] = useState("technique");
  const [itStarts, setItStarts] = useState("");
  const [itEnds, setItEnds] = useState("");

  // payment review
  const [rejectNotes, setRejectNotes] = useState("");

  const effectiveTitle = useMemo(() => seminar?.title ?? `Seminário #${seminarId}`, [seminar, seminarId]);

  const patchMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (title.trim()) payload.title = title.trim();
      if (startsAt.trim()) payload.starts_at = new Date(startsAt).toISOString();
      if (locationCity.trim()) payload.location_city = locationCity.trim();
      if (locationState.trim()) payload.location_state = clampUf(locationState);
      if (speakerName.trim()) payload.speaker_name = speakerName.trim();
      if (capacity.trim()) payload.capacity = Number(capacity);
      if (visibility) payload.visibility = visibility;
      const res = await api.patch<Seminar>(`/api/seminars/${seminarId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      setTitle("");
      setStartsAt("");
      setLocationCity("");
      setLocationState("");
      setSpeakerName("");
      setCapacity("");
      setVisibility("");
      qc.invalidateQueries({ queryKey: ["seminars", seminarId] });
      qc.invalidateQueries({ queryKey: ["seminars"] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (published: boolean) => {
      const res = await api.post<Seminar>(`/api/seminars/${seminarId}/${published ? "publish" : "unpublish"}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seminars", seminarId] });
      qc.invalidateQueries({ queryKey: ["seminars"] });
    },
  });

  const uploadBannerMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<Seminar>(`/api/seminars/${seminarId}/banner`, fd);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seminars", seminarId] });
      qc.invalidateQueries({ queryKey: ["seminars"] });
    },
  });

  const bannerSrc = useMemo(() => {
    const url = seminar?.banner_url ?? "";
    if (!url) return null;
    const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
    return url.startsWith("http") ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  }, [seminar?.banner_url]);

  const addLotMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: lotName.trim() || "Lote",
        price_amount: Number(String(lotPrice).replace(",", ".")) || 0,
        order: Number(lotOrder) || 0,
      };
      if (lotStarts.trim()) payload.starts_at = new Date(lotStarts).toISOString();
      if (lotEnds.trim()) payload.ends_at = new Date(lotEnds).toISOString();
      const res = await api.post<SeminarLot>(`/api/seminars/${seminarId}/lots`, payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "lots"] });
    },
  });

  const deleteLotMutation = useMutation({
    mutationFn: async (lotId: number) => {
      await api.delete(`/api/seminars/${seminarId}/lots/${lotId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "lots"] });
    },
  });

  const addScheduleMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { title: itTitle.trim(), kind: itKind.trim() || "other" };
      if (itStarts.trim()) payload.starts_at = new Date(itStarts).toISOString();
      if (itEnds.trim()) payload.ends_at = new Date(itEnds).toISOString();
      const res = await api.post<SeminarScheduleItem>(`/api/seminars/${seminarId}/schedule-items`, payload);
      return res.data;
    },
    onSuccess: () => {
      setItTitle("");
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "schedule"] });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await api.delete(`/api/seminars/${seminarId}/schedule-items/${itemId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "schedule"] });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (regId: number) => {
      const res = await api.post<SeminarRegistration>(
        `/api/seminars/${seminarId}/registrations/${regId}/confirm-payment`,
      );
      return res.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData<SeminarRegistration[] | undefined>(
        ["seminars", seminarId, "registrations"],
        (cur) => {
          if (!cur) return cur;
          return cur.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
        },
      );
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "registrations"] });
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async (regId: number) => {
      const res = await api.post<SeminarRegistration>(
        `/api/seminars/${seminarId}/registrations/${regId}/reject-payment`,
        rejectNotes.trim() || null,
      );
      return res.data;
    },
    onSuccess: (updated) => {
      setRejectNotes("");
      qc.setQueryData<SeminarRegistration[] | undefined>(
        ["seminars", seminarId, "registrations"],
        (cur) => {
          if (!cur) return cur;
          return cur.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
        },
      );
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "registrations"] });
    },
  });

  if (isLoading) {
    return (
      <div style={{ padding: tokens.space.xl, color: tokens.color.textMuted }}>Carregando...</div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        .am-seminar-manage input,
        .am-seminar-manage select,
        .am-seminar-manage textarea {
          font-family: system-ui;
        }
        .am-seminar-manage input:focus,
        .am-seminar-manage select:focus,
        .am-seminar-manage textarea:focus {
          ${styles.controlFocusRing}
        }
        .am-seminar-manage button:active {
          transform: translateY(1px);
        }
        @media (max-width: 720px) {
          .am-seminar-manage-actions {
            width: 100%;
          }
          .am-seminar-manage-actions > * {
            flex: 1;
          }
          .am-seminar-manage-actions button,
          .am-seminar-manage-actions label {
            justify-content: center;
          }
        }
      `}</style>

      <div className="am-seminar-manage" style={styles.top}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.title}>{effectiveTitle}</h1>
          <p style={styles.meta}>
          Status: {seminar?.is_published ? "Publicado" : "Rascunho"} •{" "}
          {seminar?.starts_at ? new Date(seminar.starts_at).toLocaleString("pt-BR") : "Data a definir"}
          </p>
        </div>
        <div className="am-seminar-manage-actions" style={styles.actions}>
          <button
            onClick={() => publishMutation.mutate(!seminar?.is_published)}
            style={{
              ...styles.btnBase,
              ...(seminar?.is_published ? styles.btnNeutral : styles.btnPrimary),
            }}
          >
            {seminar?.is_published ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </div>

      <div className="am-seminar-manage" style={styles.card}>
        <h2 style={styles.h2}>Identidade visual do evento</h2>
        <p style={{ fontSize: 14, color: tokens.color.textMuted, marginBottom: 16, lineHeight: 1.55 }}>
          Envie a imagem de capa ou banner do seminário. Ela será exibida no app e no painel do evento.
          Formatos aceitos: JPG, PNG, WEBP (recomendado 1200×400 px).
        </p>

        {bannerSrc ? (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 14,
              overflow: "hidden",
              maxHeight: 220,
              border: `1px solid ${tokens.color.borderSubtle}`,
              background: tokens.color.bgCard,
            }}
          >
            <img
              src={bannerSrc}
              alt="Banner do seminário"
              style={{ width: "100%", display: "block", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 14,
              border: `1px dashed ${tokens.color.borderSubtle}`,
              color: tokens.color.textMuted,
              background: "rgba(17, 24, 39, 0.02)",
            }}
          >
            Nenhum banner enviado ainda.
          </div>
        )}

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: styles.btnBase.padding,
            borderRadius: 12,
            backgroundColor: styles.btnPrimary.backgroundColor,
            color: "white",
            fontWeight: 900,
            cursor: uploadBannerMut.isPending ? "not-allowed" : "pointer",
            opacity: uploadBannerMut.isPending ? 0.8 : 1,
            boxShadow: styles.btnBase.boxShadow,
          }}
        >
          {uploadBannerMut.isPending ? "Enviando..." : bannerSrc ? "Trocar imagem" : "Selecionar imagem"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploadBannerMut.isPending}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              uploadBannerMut.mutate(f);
              e.currentTarget.value = "";
            }}
          />
        </label>

        {uploadBannerMut.isError ? (
          <div style={{ marginTop: 10, color: tokens.color.error }}>
            {(uploadBannerMut.error as any)?.response?.data?.detail ??
              (uploadBannerMut.error as Error).message ??
              "Não foi possível enviar o banner."}
          </div>
        ) : null}
      </div>

      <div className="am-seminar-manage" style={styles.card}>
        <h2 style={styles.h2}>Editar</h2>
        <div style={{ ...styles.grid, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={styles.field}>
            <span style={styles.label}>Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={seminar?.title ?? ""}
              maxLength={255}
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Data/hora</span>
            <input
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              type="datetime-local"
              inputMode="numeric"
              style={styles.control}
            />
            <span style={styles.helper}>
              Dica: use o seletor ao lado para evitar erro de formato.
            </span>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Cidade</span>
            <input
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              placeholder={seminar?.location_city ?? ""}
              maxLength={128}
              autoCapitalize="words"
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Estado (UF)</span>
            <select
              value={locationState}
              onChange={(e) => setLocationState(e.target.value)}
              style={styles.control}
            >
              <option value="">{seminar?.location_state ?? "Selecione"}</option>
              {BRAZIL_UF.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Palestrante</span>
            <input
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              placeholder={seminar?.speaker_name ?? ""}
              maxLength={255}
              autoCapitalize="words"
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Capacidade</span>
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder={seminar?.capacity != null ? String(seminar.capacity) : "Sem limite"}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              style={styles.control}
            />
            <span style={styles.helper}>
              Deixe vazio para sem limite.
            </span>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Visibilidade</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} style={styles.control}>
              <option value="">{seminar?.visibility === "public" ? "Público" : "Interno"}</option>
              <option value="internal">Interno (apenas alunos do seu dojô)</option>
              <option value="public">Público (todos os usuários do sistema)</option>
            </select>
            <span style={styles.helper}>
              Público aparece para todos os alunos (independente do dojô). Interno aparece apenas para alunos do dojô organizador.
            </span>
          </label>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={() => patchMutation.mutate()}
            disabled={patchMutation.isPending}
            style={{
              ...styles.btnBase,
              ...styles.btnPrimary,
              opacity: patchMutation.isPending ? 0.78 : 1,
            }}
          >
            {patchMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
        {patchMutation.isError && (
          <div style={{ marginTop: 10, color: tokens.color.error }}>
            {(patchMutation.error as any)?.response?.data?.detail ?? (patchMutation.error as Error).message}
          </div>
        )}
      </div>

      <div className="am-seminar-manage" style={styles.card}>
        <h2 style={styles.h2}>Lotes</h2>
        <div style={{ color: tokens.color.textMuted, fontSize: 13, marginBottom: 10 }}>
          Defina o preço por período. O sistema escolhe automaticamente o lote ativo pela data/hora.
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={styles.field}>
            <span style={styles.label}>Nome do lote</span>
            <input
              value={lotName}
              onChange={(e) => setLotName(e.target.value)}
              placeholder="Ex.: 1º lote"
              maxLength={128}
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Preço (R$)</span>
            <input
              value={lotPrice}
              onChange={(e) => setLotPrice(e.target.value)}
              placeholder="Ex.: 80,00"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Prioridade do lote</span>
            <input
              value={lotOrder}
              onChange={(e) => setLotOrder(e.target.value)}
              placeholder="Ex.: 0 (1º lote), 1 (2º lote)"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              style={styles.control}
            />
            <span style={styles.helper}>
              Usado como desempate quando mais de um lote estiver válido ao mesmo tempo.
            </span>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Início do lote</span>
            <input
              value={lotStarts}
              onChange={(e) => setLotStarts(e.target.value)}
              type="datetime-local"
              inputMode="numeric"
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Fim do lote</span>
            <input
              value={lotEnds}
              onChange={(e) => setLotEnds(e.target.value)}
              type="datetime-local"
              inputMode="numeric"
              style={styles.control}
            />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => addLotMutation.mutate()}
            disabled={addLotMutation.isPending}
            style={{
              ...styles.btnBase,
              ...styles.btnPrimary,
              opacity: addLotMutation.isPending ? 0.78 : 1,
            }}
          >
            {addLotMutation.isPending ? "Adicionando..." : "Adicionar lote"}
          </button>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {(lots ?? []).map((l) => (
            <div
              key={l.id}
              style={styles.listRow}
            >
              <div>
                <div style={{ fontWeight: 900 }}>
                  {l.name} • R$ {Number(l.price_amount ?? 0).toFixed(2).replace(".", ",")}
                </div>
                <div style={{ fontSize: 13, color: tokens.color.textMuted }}>
                  {l.starts_at ? new Date(l.starts_at).toLocaleString("pt-BR") : "sem início"} →{" "}
                  {l.ends_at ? new Date(l.ends_at).toLocaleString("pt-BR") : "sem fim"} • ordem {l.order}
                </div>
              </div>
              <button
                onClick={() => deleteLotMutation.mutate(l.id)}
                style={styles.btnOutline}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="am-seminar-manage" style={styles.card}>
        <h2 style={styles.h2}>Cronograma</h2>
        <div style={{ color: tokens.color.textMuted, fontSize: 13, marginBottom: 10 }}>
          Ajuda o aluno a entender o fluxo do seminário (técnica, drills, Q&A, etc.).
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={styles.field}>
            <span style={styles.label}>Título do bloco</span>
            <input
              value={itTitle}
              onChange={(e) => setItTitle(e.target.value)}
              placeholder="Ex.: Demonstração técnica"
              maxLength={255}
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Tipo</span>
            <input
              value={itKind}
              onChange={(e) => setItKind(e.target.value)}
              placeholder="Ex.: technique, drills, qa"
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Início</span>
            <input
              value={itStarts}
              onChange={(e) => setItStarts(e.target.value)}
              type="datetime-local"
              inputMode="numeric"
              style={styles.control}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Fim</span>
            <input
              value={itEnds}
              onChange={(e) => setItEnds(e.target.value)}
              type="datetime-local"
              inputMode="numeric"
              style={styles.control}
            />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => addScheduleMutation.mutate()}
            disabled={addScheduleMutation.isPending || !itTitle.trim()}
            style={{
              ...styles.btnBase,
              ...styles.btnPrimary,
              opacity: addScheduleMutation.isPending || !itTitle.trim() ? 0.75 : 1,
            }}
          >
            {addScheduleMutation.isPending ? "Adicionando..." : "Adicionar item"}
          </button>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {(schedule ?? []).map((it) => (
            <div
              key={it.id}
              style={styles.listRow}
            >
              <div>
                <div style={{ fontWeight: 900 }}>{it.title}</div>
                <div style={{ fontSize: 13, color: tokens.color.textMuted }}>
                  {mapSeminarScheduleKindPt(it.kind) ?? "Outro"} •{" "}
                  {it.starts_at ? new Date(it.starts_at).toLocaleTimeString("pt-BR") : "--:--"} →{" "}
                  {it.ends_at ? new Date(it.ends_at).toLocaleTimeString("pt-BR") : "--:--"}
                </div>
              </div>
              <button
                onClick={() => deleteScheduleMutation.mutate(it.id)}
                style={styles.btnOutline}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="am-seminar-manage" style={styles.card}>
        <h2 style={styles.h2}>Inscrições</h2>
        <div style={{ color: tokens.color.textMuted, marginBottom: 10 }}>
          Total: {regs?.length ?? 0}
        </div>
        <label style={{ ...styles.field, marginBottom: 10 }}>
          <span style={styles.label}>Motivo de rejeição (opcional)</span>
          <input
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Ex.: comprovante ilegível"
            style={styles.control}
          />
        </label>
        <div style={{ display: "grid", gap: 8 }}>
          {(regs ?? []).map((r) => (
            <div
              key={r.id}
              style={{
                ...styles.listRow,
                alignItems: "stretch",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900 }}>
                  #{r.id} •{" "}
                  {r.student_id
                    ? (r.student_name ?? "Participante")
                    : (r.guest_full_name ?? "Convidado")}{" "}
                  • {mapSeminarPaymentStatusPt(r.payment_status)}
                </div>
                <div style={{ fontSize: 13, color: tokens.color.textMuted }}>
                  Código: {r.public_code} • criado {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
                {r.payment_receipt_path ? (
                  <a
                    href={`${api.defaults.baseURL?.replace(/\/$/, "") ?? ""}${r.payment_receipt_path}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13 }}
                  >
                    Ver comprovante
                  </a>
                ) : null}
                {r.payment_notes ? (
                  <div style={{ fontSize: 13, color: tokens.color.error }}>{r.payment_notes}</div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  onClick={() => confirmPaymentMutation.mutate(r.id)}
                  disabled={confirmPaymentMutation.isPending || r.payment_status === "confirmed"}
                  style={{
                    ...styles.btnBase,
                    ...styles.btnPrimary,
                    padding: "8px 12px",
                    boxShadow: "0 10px 16px rgba(15, 23, 42, 0.08)",
                    opacity: confirmPaymentMutation.isPending || r.payment_status === "confirmed" ? 0.75 : 1,
                  }}
                >
                  {r.payment_status === "confirmed" ? "Confirmado" : confirmPaymentMutation.isPending ? "Confirmando..." : "Confirmar"}
                </button>
                <button
                  onClick={() => rejectPaymentMutation.mutate(r.id)}
                  disabled={rejectPaymentMutation.isPending || r.payment_status === "confirmed"}
                  style={{
                    ...styles.btnOutline,
                    padding: "8px 12px",
                    opacity: rejectPaymentMutation.isPending || r.payment_status === "confirmed" ? 0.6 : 1,
                  }}
                >
                  {rejectPaymentMutation.isPending ? "Rejeitando..." : "Rejeitar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

