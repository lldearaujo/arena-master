import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { tokens } from "../../ui/tokens";
import type { Competition, CompetitionBracket, CompetitionMatch, Registration } from "./types";
import { bracketStageLabel, totalRoundsByBracketIdFromMatches } from "./bracketLabels";

type FinishMethodKey = "finalization" | "points_victory" | "disqualification" | "tie_referee" | "tie_draw" | "wo";

const DEFAULT_FINISH_METHODS: Array<{ v: FinishMethodKey; l: string }> = [{ v: "finalization", l: "Finalização" }];

const ALL_FINISH_METHODS: Array<{ v: FinishMethodKey; l: string }> = [
  { v: "finalization", l: "Finalização" },
  { v: "points_victory", l: "Vitória por pontos" },
  { v: "disqualification", l: "Desclassificação" },
  { v: "tie_referee", l: "Empate (com vencedor do juiz)" },
  { v: "tie_draw", l: "Empate (sem vencedor)" },
  { v: "wo", l: "W.O." },
];

export function ScorekeeperPage() {
  const { cid, mid } = useParams<{ cid: string; mid: string }>();
  const competitionId = Number(cid);
  const matchId = Number(mid);
  const qc = useQueryClient();
  const [finishMethod, setFinishMethod] = useState<FinishMethodKey>("finalization");
  const [winnerSide, setWinnerSide] = useState<"red" | "blue" | "none">("red");
  const [liveMatch, setLiveMatch] = useState<CompetitionMatch | null>(null);
  const [timerDisplaySeconds, setTimerDisplaySeconds] = useState<number>(0);
  const [scoreAck, setScoreAck] = useState<{ id: number; status: "idle" | "pending" | "ok" | "error"; text: string }>({
    id: 0,
    status: "idle",
    text: "",
  });
  const [finishAck, setFinishAck] = useState<{ id: number; status: "idle" | "pending" | "ok" | "error"; text: string }>({
    id: 0,
    status: "idle",
    text: "",
  });

  const { data: comp } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: async () => {
      const res = await api.get<Competition>(`/api/competitions/${competitionId}`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  // Exibe/permite todos os métodos de finalização na UI.
  // (A validação final das regras continua no backend.)
  const allowedFinishMethods = ALL_FINISH_METHODS;

  useEffect(() => {
    // `tie_draw` não tem vencedor: força o payload para `winner_side=none`.
    if (finishMethod === "tie_draw") {
      if (winnerSide !== "none") setWinnerSide("none");
      return;
    }
    if (winnerSide === "none") setWinnerSide("red");
  }, [finishMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: matches } = useQuery({
    queryKey: ["comp-matches", competitionId],
    queryFn: async () => {
      const res = await api.get<CompetitionMatch[]>(`/api/competitions/${competitionId}/matches`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const totalRoundsByBracketId = useMemo(
    () => totalRoundsByBracketIdFromMatches(matches ?? []),
    [matches],
  );

  const m = useMemo(() => matches?.find((x) => x.id === matchId), [matches, matchId]);

  const { data: regs } = useQuery({
    queryKey: ["comp-regs", competitionId],
    queryFn: async () => {
      const res = await api.get<Registration[]>(`/api/competitions/${competitionId}/registrations`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: brackets } = useQuery({
    queryKey: ["comp-brackets", competitionId],
    queryFn: async () => {
      const res = await api.get<CompetitionBracket[]>(`/api/competitions/${competitionId}/brackets`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const liveStageLabel = useMemo(() => {
    const mm = liveMatch ?? m;
    if (!mm) return "";
    const tr = totalRoundsByBracketId.get(mm.bracket_id) ?? 1;
    const br = brackets?.find((b) => b.id === mm.bracket_id);
    const ath =
      br != null && regs != null
        ? regs.filter(
            (r) =>
              r.age_division_id === br.age_division_id &&
              r.weight_class_id === br.weight_class_id &&
              r.gender === br.gender &&
              r.status === "weighed_in",
          ).length
        : undefined;
    const athForLabel = ath != null && ath >= 2 ? ath : undefined;
    return bracketStageLabel(mm.round_index, tr, athForLabel);
  }, [liveMatch, m, totalRoundsByBracketId, brackets, regs]);

  const regById = useMemo(() => {
    const map = new Map<number, Registration>();
    for (const r of regs ?? []) map.set(r.id, r);
    return map;
  }, [regs]);

  const redReg = useMemo(() => {
    if (!m?.red_registration_id) return null;
    return regById.get(m.red_registration_id) ?? null;
  }, [m?.red_registration_id, regById]);

  const blueReg = useMemo(() => {
    if (!m?.blue_registration_id) return null;
    return regById.get(m.blue_registration_id) ?? null;
  }, [m?.blue_registration_id, regById]);

  const totalMatchSeconds = useMemo(() => {
    const fallback = comp?.default_match_duration_seconds ?? 360;

    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const canonicalBelt = (beltLabel: string | null | undefined): string | null => {
      if (!beltLabel) return null;
      const x = normalize(beltLabel).replace(/^faixa\s+/i, "");
      if (["branca", "white", "branco"].some((k) => x.includes(k))) return "branca";
      if (["cinza", "grey", "gray"].some((k) => x.includes(k))) return "cinza";
      if (["amarela", "yellow"].some((k) => x.includes(k))) return "amarela";
      if (["laranja", "orange"].some((k) => x.includes(k))) return "laranja";
      if (["verde", "green"].some((k) => x.includes(k))) return "verde";
      if (["azul", "blue"].some((k) => x.includes(k))) return "azul";
      if (["roxa", "purple", "roxo"].some((k) => x.includes(k))) return "roxa";
      if (["marrom", "brown"].some((k) => x.includes(k))) return "marrom";
      if (["preta", "black"].some((k) => x.includes(k))) return "preta";
      return null;
    };

    const kidDurationSeconds = (ageLabel: string): number | null => {
      const a = normalize(ageLabel);
      if (a.includes("pre-mirim")) return 120; // 2 min
      if (a.includes("mirim 1") || a.includes("mirim 2")) return 180; // 3 min
      if (a.includes("mirim 3")) return 240; // 4 min
      if (a.includes("infantil 1") || a.includes("infantil 2")) return 240; // 4 min
      if (a.includes("juvenil")) return 300; // 5 min
      return null;
    };

    const adultDurationSeconds = (ageLabel: string, beltLabel: string | null | undefined): number | null => {
      const a = normalize(ageLabel);
      const belt = canonicalBelt(beltLabel) ?? null;
      if (!belt) return null;

      // Adultos
      if (a.includes("adulto")) {
        if (belt === "branca") return 300; // 5
        if (belt === "azul") return 360; // 6
        if (belt === "roxa") return 420; // 7
        if (belt === "marrom") return 480; // 8
        if (belt === "preta") return 600; // 10
        return null;
      }

      // Master 1: roxa/marrom/preta = 6 min; branca/azul = 5 min
      if (a.includes("master 1")) {
        if (belt === "branca" || belt === "azul") return 300;
        if (belt === "roxa" || belt === "marrom" || belt === "preta") return 360;
        return null;
      }

      // Master 2+ : 5 min para todas as faixas
      if (a.includes("master")) return 300;

      return null;
    };

    const calcForReg = (r: Registration | null) => {
      if (!r?.age_division_label) return fallback;

      const kid = kidDurationSeconds(r.age_division_label);
      if (kid != null) return kid;

      const adt = adultDurationSeconds(r.age_division_label, r.student_faixa_label);
      if (adt != null) return adt;

      return fallback;
    };

    // Se houver discrepância entre as duas pontas, usamos o tempo mais longo.
    return Math.max(calcForReg(redReg), calcForReg(blueReg));
  }, [comp?.default_match_duration_seconds, redReg, blueReg]);

  const timerRemainingSeconds = useMemo(() => {
    return Math.max(0, Math.floor(totalMatchSeconds - timerDisplaySeconds));
  }, [totalMatchSeconds, timerDisplaySeconds]);

  const pendingLabel = scoreAck.status === "pending" ? scoreAck.text : "";
  const pendingFinishLabel = finishAck.status === "pending" ? finishAck.text : "";

  const Spinner = ({ color }: { color: string }) => (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        borderRadius: 999,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        animation: "skSpin 0.9s linear infinite",
      }}
    />
  );

  const patchScore = useMutation({
    mutationFn: async (body: Partial<CompetitionMatch>) => {
      await api.patch(`/api/competitions/${competitionId}/matches/${matchId}/score`, body);
    },
    // Atualização via WebSocket ("match_score").
  });

  const finish = useMutation({
    mutationFn: async (payload: { winner_side: string; finish_method: string; referee_decision: boolean }) => {
      await api.post(`/api/competitions/${competitionId}/matches/${matchId}/finish`, payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] }),
  });

  const sendScoreUpdate = (body: Partial<CompetitionMatch>, label: string) => {
    const id = Date.now();
    setScoreAck({ id, status: "pending", text: label });
    patchScore.mutate(body, {
      onSuccess: () => setScoreAck((prev) => (prev.id === id ? { ...prev, status: "ok" } : prev)),
      onError: () => setScoreAck((prev) => (prev.id === id ? { ...prev, status: "error" } : prev)),
    });
  };

  const sendFinish = (
    payload: { winner_side: string; finish_method: string; referee_decision: boolean },
    label: string,
  ) => {
    const id = Date.now();
    setFinishAck({ id, status: "pending", text: label });
    finish.mutate(payload, {
      onSuccess: () => setFinishAck((prev) => (prev.id === id ? { ...prev, status: "ok" } : prev)),
      onError: () => setFinishAck((prev) => (prev.id === id ? { ...prev, status: "error" } : prev)),
    });
  };

  useEffect(() => {
    if (scoreAck.status === "idle") return;
    if (scoreAck.status === "pending") return;
    const t = window.setTimeout(() => setScoreAck((p) => ({ ...p, status: "idle", text: "" })), 1200);
    return () => window.clearTimeout(t);
  }, [scoreAck.status]);

  useEffect(() => {
    if (finishAck.status === "idle") return;
    if (finishAck.status === "pending") return;
    const t = window.setTimeout(() => setFinishAck((p) => ({ ...p, status: "idle", text: "" })), 1400);
    return () => window.clearTimeout(t);
  }, [finishAck.status]);

  useEffect(() => {
    if (!Number.isFinite(competitionId)) return;
    const token = useAuthStore.getState().tokens?.accessToken;
    if (!token) return;
    const raw = api.defaults.baseURL ?? "";
    const wsBase = raw.replace(/^https/i, "wss").replace(/^http/i, "ws");
    const ws = new WebSocket(`${wsBase}/api/competitions/ws/${competitionId}?token=${encodeURIComponent(token)}`);
    ws.onmessage = (ev) => {
      let data: any = null;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!data || data.match_id !== matchId) return;
      if (data.type === "match_score" && data.payload && typeof data.payload === "object") {
        const payload = data.payload as Record<string, unknown>;
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(payload)) {
          // O backend só aplica campos enviados; o WS pode mandar `null` para campos não enviados.
          if (v !== null) cleaned[k] = v;
        }
        setLiveMatch((prev) => (prev ? ({ ...prev, ...cleaned } as CompetitionMatch) : prev));
      } else if (data.type === "match_display" && typeof data.status === "string") {
        setLiveMatch((prev) => (prev ? ({ ...prev, match_status: data.status } as CompetitionMatch) : prev));
      } else if (data.type === "match_finished") {
        // O payload completo vem na lista; para evitar inconsistência (winner/feeder), recarregamos.
        // Mas já travamos o timer na UI para ficar "constante".
        setLiveMatch((prev) =>
          prev
            ? ({
                ...prev,
                match_status: "completed",
                timer_running: false,
              } as CompetitionMatch)
            : prev,
        );
        qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] });
      }
    };
    return () => ws.close();
  }, [competitionId, qc, matchId]);

  useEffect(() => {
    if (!m) return;
    setLiveMatch(m);
  }, [m]);

  // Timer "constante" no UI: quando `timer_running` estiver ativo, incrementa localmente
  // (o backend só sabe o valor quando você clica em pausar/ajustar).
  useEffect(() => {
    if (!liveMatch) return;
    if (!liveMatch.timer_running) {
      setTimerDisplaySeconds(liveMatch.timer_elapsed_seconds);
      return;
    }

    const baseElapsed = liveMatch.timer_elapsed_seconds;
    const startedAt = Date.now();

    const t = window.setInterval(() => {
      const deltaSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const nextElapsed = Math.min(totalMatchSeconds, baseElapsed + deltaSeconds);
      setTimerDisplaySeconds(nextElapsed);
      if (nextElapsed >= totalMatchSeconds) {
        window.clearInterval(t);
      }
    }, 250);

    return () => window.clearInterval(t);
  }, [liveMatch?.timer_running, liveMatch?.timer_elapsed_seconds, totalMatchSeconds]);

  if (!liveMatch) {
    return (
      <div style={{ padding: 24 }}>
        <p>Luta não encontrada ou a carregar…</p>
        <Link to={`/competicoes/gerir/${competitionId}`}>Voltar</Link>
      </div>
    );
  }

  const bigBtn = {
    padding: "20px 28px",
    fontSize: 22,
    fontWeight: 800,
    borderRadius: 12,
    border: "none",
    cursor: "pointer" as const,
    minWidth: 72,
  };

  const isTie = liveMatch.red_score === liveMatch.blue_score;

  const finishCanUse =
    finishMethod === "tie_draw" || finishMethod === "tie_referee"
      ? isTie
      : finishMethod === "finalization" || finishMethod === "points_victory"
        ? !isTie
        : true;

  const finishPayloadWinnerSide: "red" | "blue" | "none" = finishMethod === "tie_draw" ? "none" : winnerSide;
  const finishPayloadRefereeDecision = finishMethod === "tie_referee";

  const finishWinnerLabel =
    finishPayloadWinnerSide === "red" ? "vermelho" : finishPayloadWinnerSide === "blue" ? "azul" : "";

  const finishButtonLabel =
    finishMethod === "tie_draw"
      ? "Empate sem vencedor"
      : finishMethod === "tie_referee"
        ? `Empate com vencedor (${finishWinnerLabel})`
        : finishMethod === "disqualification"
          ? `Desclassificação (${finishWinnerLabel})`
          : finishMethod === "wo"
            ? `W.O. (${finishWinnerLabel})`
            : `Vitória ${finishWinnerLabel}`;

  const finishButtonColor =
    finishMethod === "tie_draw"
      ? "#64748b"
      : finishPayloadWinnerSide === "blue"
        ? "#1d4ed8"
        : "#b91c1c";

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 16,
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily: "system-ui",
        background: "linear-gradient(160deg, #0b1224 0%, #020617 100%)",
        color: "#e5e7eb",
      }}
    >
      <style>{`@keyframes skSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Link to={`/competicoes/gerir/${competitionId}`} style={{ color: tokens.color.primary }}>
        ← Gestão da competição
      </Link>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: "16px 0 6px 0", color: "#f8fafc" }}>Placar</h1>
      <p style={{ color: "rgba(229,231,235,0.75)", marginTop: 0 }}>
        {liveStageLabel || `Rodada ${liveMatch.round_index + 1}`} • Luta #{liveMatch.id}
      </p>

      {scoreAck.status !== "idle" && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            border:
              scoreAck.status === "pending"
                ? "1px solid rgba(255,255,255,0.14)"
                : scoreAck.status === "ok"
                  ? "1px solid rgba(34,197,94,0.45)"
                  : "1px solid rgba(239,68,68,0.45)",
            background:
              scoreAck.status === "pending"
                ? "rgba(255,255,255,0.06)"
                : scoreAck.status === "ok"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(239,68,68,0.12)",
            color: scoreAck.status === "ok" ? "#bbf7d0" : scoreAck.status === "error" ? "#fecaca" : "#e5e7eb",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          {scoreAck.status === "pending" ? "Enviando..." : scoreAck.status === "ok" ? "Atualizado" : "Erro"}
          <span style={{ opacity: 0.9 }}>{scoreAck.text}</span>
        </div>
      )}

      {finishAck.status !== "idle" && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            border:
              finishAck.status === "pending"
                ? "1px solid rgba(255,255,255,0.14)"
                : finishAck.status === "ok"
                  ? "1px solid rgba(34,197,94,0.45)"
                  : "1px solid rgba(239,68,68,0.45)",
            background:
              finishAck.status === "pending"
                ? "rgba(255,255,255,0.06)"
                : finishAck.status === "ok"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(239,68,68,0.12)",
            color: finishAck.status === "ok" ? "#bbf7d0" : finishAck.status === "error" ? "#fecaca" : "#e5e7eb",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          {finishAck.status === "pending" ? "Finalizando..." : finishAck.status === "ok" ? "Finalizado" : "Erro"}
          <span style={{ opacity: 0.9 }}>{finishAck.text}</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 20, alignItems: "stretch" }}>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            borderRadius: 18,
            background: "rgba(239,68,68,0.16)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 45px rgba(239,68,68,0.08)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 220,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 4 }}>
              {redReg?.student_name ?? (liveMatch.red_registration_id ? `Atleta #${liveMatch.red_registration_id}` : "—")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.8)", marginBottom: 10 }}>
              {redReg?.registration_public_code ? `Cod. ${redReg.registration_public_code}` : "—"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>VERMELHO</div>
          </div>

          <div style={{ fontSize: 76, fontWeight: 950, color: "#fecaca", lineHeight: 1 }}>{liveMatch.red_score}</div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
            <button
              type="button"
              style={{ ...bigBtn, backgroundColor: "#fecaca" }}
              disabled={patchScore.isPending}
              onClick={() => sendScoreUpdate({ red_score: Math.max(0, liveMatch.red_score - 1) }, "Red -1")}
            >
              {patchScore.isPending && pendingLabel === "Red -1" ? (
                <>
                  <Spinner color="#ef4444" /> −1
                </>
              ) : (
                "−1"
              )}
            </button>
            <button
              type="button"
              style={{ ...bigBtn, backgroundColor: "#ef4444", color: "#fff" }}
              disabled={patchScore.isPending}
              onClick={() => sendScoreUpdate({ red_score: liveMatch.red_score + 1 }, "Red +1")}
            >
              {patchScore.isPending && pendingLabel === "Red +1" ? (
                <>
                  <Spinner color="#fff" /> +1
                </>
              ) : (
                "+1"
              )}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            textAlign: "center",
            borderRadius: 18,
            background: "rgba(59,130,246,0.16)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 45px rgba(59,130,246,0.08)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 220,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 4 }}>
              {blueReg?.student_name ?? (liveMatch.blue_registration_id ? `Atleta #${liveMatch.blue_registration_id}` : "—")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.8)", marginBottom: 10 }}>
              {blueReg?.registration_public_code ? `Cod. ${blueReg.registration_public_code}` : "—"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>AZUL</div>
          </div>

          <div style={{ fontSize: 76, fontWeight: 950, color: "#bfdbfe", lineHeight: 1 }}>{liveMatch.blue_score}</div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
            <button
              type="button"
              style={{ ...bigBtn, backgroundColor: "#bfdbfe" }}
              disabled={patchScore.isPending}
              onClick={() => sendScoreUpdate({ blue_score: Math.max(0, liveMatch.blue_score - 1) }, "Blue -1")}
            >
              {patchScore.isPending && pendingLabel === "Blue -1" ? (
                <>
                  <Spinner color="#2563eb" /> −1
                </>
              ) : (
                "−1"
              )}
            </button>
            <button
              type="button"
              style={{ ...bigBtn, backgroundColor: "#3b82f6", color: "#fff" }}
              disabled={patchScore.isPending}
              onClick={() => sendScoreUpdate({ blue_score: liveMatch.blue_score + 1 }, "Blue +1")}
            >
              {patchScore.isPending && pendingLabel === "Blue +1" ? (
                <>
                  <Spinner color="#fff" /> +1
                </>
              ) : (
                "+1"
              )}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <button
          type="button"
          style={{ padding: "14px 20px", borderRadius: 10, fontWeight: 700, border: `1px solid ${tokens.color.borderSubtle}` }}
          disabled={patchScore.isPending}
          onClick={() =>
            sendScoreUpdate(
              {
                paused_for: "punishment",
                timer_running: false,
                timer_elapsed_seconds: Math.floor(timerDisplaySeconds),
              },
              "Punição",
            )
          }
        >
          {patchScore.isPending && pendingLabel === "Punição" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Spinner color="#ef4444" />
              Punição (pausa)
            </span>
          ) : (
            "Punição (pausa)"
          )}
        </button>
        <button
          type="button"
          style={{ padding: "14px 20px", borderRadius: 10, fontWeight: 700, border: `1px solid ${tokens.color.borderSubtle}` }}
          disabled={patchScore.isPending}
          onClick={() =>
            sendScoreUpdate(
              {
                paused_for: "medical",
                timer_running: false,
                timer_elapsed_seconds: Math.floor(timerDisplaySeconds),
              },
              "Tempo médico",
            )
          }
        >
          {patchScore.isPending && pendingLabel === "Tempo médico" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Spinner color="#ef4444" />
              Tempo médico (pausa)
            </span>
          ) : (
            "Tempo médico (pausa)"
          )}
        </button>
        <button
          type="button"
          style={{ padding: "14px 20px", borderRadius: 10, fontWeight: 700, backgroundColor: "#22c55e", color: "#fff", border: "none" }}
          disabled={patchScore.isPending}
          onClick={() =>
            sendScoreUpdate(
              {
                timer_running: true,
                paused_for: null,
                timer_elapsed_seconds: Math.floor(timerDisplaySeconds),
              },
              "Retomar",
            )
          }
        >
          {patchScore.isPending && pendingLabel === "Retomar" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Spinner color="#22c55e" />
              Retomar cronômetro
            </span>
          ) : (
            "Retomar cronômetro"
          )}
        </button>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 950,
            color: liveMatch.match_status === "completed" ? "#ef4444" : "rgba(229,231,235,0.85)",
          }}
        >
          {liveMatch.match_status === "completed" ? "Final" : "Em andamento"}
        </div>

        <div style={{ marginTop: 8, fontSize: 86, fontWeight: 950, letterSpacing: 2, color: "#ffffff" }}>
          {(() => {
            const s = timerRemainingSeconds;
            const mm = Math.floor(s / 60);
            const ss = s % 60;
            return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
          })()}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={patchScore.isPending}
            onClick={() => {
              const elapsed = Math.floor(timerDisplaySeconds);
              if (liveMatch.timer_running) {
                // Pausar: manda o elapsed atual para o backend (senão o timer “volta” ao retomar).
                sendScoreUpdate(
                  {
                    timer_running: false,
                    paused_for: liveMatch.paused_for,
                    timer_elapsed_seconds: elapsed,
                  },
                  "Pausar timer",
                );
              } else {
                sendScoreUpdate(
                  {
                    timer_running: true,
                    paused_for: null,
                    timer_elapsed_seconds: elapsed,
                  },
                  "Iniciar timer",
                );
              }
            }}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              fontWeight: 900,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {patchScore.isPending && pendingLabel === "Pausar timer" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Spinner color="#ffffff" />
                Pause timer
              </span>
            ) : patchScore.isPending && pendingLabel === "Iniciar timer" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Spinner color="#ffffff" />
                Start timer
              </span>
            ) : (
              `${liveMatch.timer_running ? "Pause" : "Start"} timer`
            )}
          </button>
          <button
            type="button"
            disabled={patchScore.isPending}
            onClick={() => {
              // +30s no cronômetro significa "adicionar tempo restante":
              // como o backend guarda `timer_elapsed_seconds`, reduzimos o elapsed.
              const elapsed = Math.floor(timerDisplaySeconds);
              sendScoreUpdate({ timer_elapsed_seconds: Math.max(0, elapsed - 30) }, "+30s");
            }}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              fontWeight: 950,
              border: "none",
              background: "#22c55e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {patchScore.isPending && pendingLabel === "+30s" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Spinner color="#ffffff" />
                +30s
              </span>
            ) : (
              "+30s"
            )}
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          padding: 20,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 950, marginBottom: 12, color: "#f8fafc" }}>Finalização</h2>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            width: "100%",
            maxWidth: 820,
            marginBottom: 12,
            background: "rgba(0,0,0,0.25)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            fontWeight: 900,
          }}
        >
          Selecione o método de finalização.
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={finishMethod}
            onChange={(e) => setFinishMethod(e.target.value as FinishMethodKey)}
            disabled={finish.isPending}
            style={{
              padding: 12,
              borderRadius: 10,
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              fontWeight: 900,
              minWidth: 320,
            }}
          >
            {allowedFinishMethods.map((m) => (
              <option key={m.v} value={m.v}>
                {m.l}
              </option>
            ))}
          </select>

          {finishMethod !== "tie_draw" && (
            <select
              value={winnerSide}
              onChange={(e) => setWinnerSide(e.target.value as "red" | "blue")}
              disabled={finish.isPending}
              style={{
                padding: 12,
                borderRadius: 10,
                background: "rgba(0,0,0,0.25)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                fontWeight: 900,
                minWidth: 320,
              }}
            >
              {finishMethod === "tie_referee" ? (
                <>
                  <option value="red">Vencedor do juiz (vermelho)</option>
                  <option value="blue">Vencedor do juiz (azul)</option>
                </>
              ) : (
                <>
                  <option value="red">Vencedor (vermelho)</option>
                  <option value="blue">Vencedor (azul)</option>
                </>
              )}
            </select>
          )}

          <button
            type="button"
            style={{
              padding: "14px 24px",
              borderRadius: 10,
              backgroundColor: finishButtonColor,
              color: "#fff",
              fontWeight: 900,
              border: "none",
              cursor: "pointer",
            }}
            disabled={finish.isPending || !finishCanUse}
            onClick={() => {
              sendFinish(
                {
                  winner_side: finishPayloadWinnerSide,
                  finish_method: finishMethod,
                  referee_decision: finishPayloadRefereeDecision,
                },
                finishButtonLabel,
              );
            }}
          >
            {finish.isPending && pendingFinishLabel === finishButtonLabel ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Spinner color="#fff" />
                {finishButtonLabel}
              </span>
            ) : (
              finishButtonLabel
            )}
          </button>
        </div>
        {finish.isError && (
          <p style={{ color: tokens.color.error, marginTop: 12 }}>
            {(finish.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail}
          </p>
        )}
      </div>
    </div>
  );
}
