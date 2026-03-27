import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import type { Seminar, SeminarAttendance } from "./types";

const card: React.CSSProperties = {
  padding: tokens.space.xl,
  backgroundColor: "white",
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.color.borderSubtle}`,
};

export function SeminarCheckInPage() {
  const { id } = useParams();
  const seminarId = Number(id);
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const { data: seminar } = useQuery({
    queryKey: ["seminars", seminarId],
    queryFn: async () => {
      const res = await api.get<Seminar>(`/api/seminars/${seminarId}`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
  });

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["seminars", seminarId, "attendance"],
    queryFn: async () => {
      const res = await api.get<SeminarAttendance[]>(`/api/seminars/${seminarId}/attendance`);
      return res.data;
    },
    enabled: Number.isFinite(seminarId),
    refetchInterval: 10_000,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const c = code.trim().toUpperCase();
      if (!c) throw new Error("Informe o código");
      const res = await api.post<SeminarAttendance>(`/api/seminars/${seminarId}/check-in`, { public_code: c });
      return res.data;
    },
    onSuccess: () => {
      setCode("");
      qc.invalidateQueries({ queryKey: ["seminars", seminarId, "attendance"] });
    },
  });

  const count = attendance?.length ?? 0;
  const title = seminar?.title ?? `Seminário #${seminarId}`;

  const last = useMemo(() => (attendance?.[0] ? new Date(attendance[0].checked_in_at).toLocaleString("pt-BR") : null), [
    attendance,
  ]);

  return (
    <div style={{ padding: tokens.space.xl, display: "grid", gap: tokens.space.xl }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Check-in</h1>
        <p style={{ marginTop: 8, color: tokens.color.textMuted }}>
          {title} • {count} presentes{last ? ` • último: ${last}` : ""}
        </p>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Confirmar presença</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Cole o código do ingresso"
            inputMode="text"
            autoCapitalize="characters"
            maxLength={16}
            style={{
              flex: 1,
              minWidth: 240,
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${tokens.color.borderSubtle}`,
            }}
          />
          <button
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              backgroundColor: tokens.color.primary,
              color: "white",
              fontWeight: 800,
            }}
          >
            {checkInMutation.isPending ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
        {checkInMutation.isError && (
          <div style={{ marginTop: 10, color: tokens.color.danger }}>
            {(checkInMutation.error as any)?.response?.data?.detail ?? (checkInMutation.error as Error).message}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Lista de presença</h2>
        {isLoading ? (
          <div style={{ color: tokens.color.textMuted }}>Carregando...</div>
        ) : !attendance?.length ? (
          <div style={{ color: tokens.color.textMuted }}>Ainda não há check-ins.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {attendance.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 800 }}>Inscrição #{a.registration_id}</div>
                <div style={{ color: tokens.color.textMuted, fontSize: 13 }}>
                  {new Date(a.checked_in_at).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

