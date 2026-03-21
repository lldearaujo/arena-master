import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type PublicMatStatus = {
  mat: { id: number; name: string; display_order: number };
  on_mat: {
    id: number;
    red_name: string | null;
    blue_name: string | null;
    match_status: string;
  } | null;
  on_deck: {
    id: number;
    red_name: string | null;
    blue_name: string | null;
  } | null;
  warm_up: Array<{ id: number; red_name: string | null; blue_name: string | null }>;
};

export function PublicMatsPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["public-mats", token],
    queryFn: async () => {
      const res = await api.get<PublicMatStatus[]>(`/api/competitions/public/${token}/mats`);
      return res.data;
    },
    enabled: Boolean(token),
    refetchInterval: 5000,
  });

  if (!token) return <p>Token inválido</p>;
  if (isLoading) return <p style={{ color: "#fff" }}>Carregando…</p>;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
        color: "#f8fafc",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Arena Master — Tatames</h1>
      <p style={{ opacity: 0.75, marginBottom: 32 }}>Atualização automática a cada 5s</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {(data ?? []).map((row) => (
          <div
            key={row.mat.id}
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: 20,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{row.mat.name}</h2>
            <Section label="No tatame" big>
              {row.on_mat
                ? `${row.on_mat.red_name ?? "—"} × ${row.on_mat.blue_name ?? "—"}`
                : "—"}
            </Section>
            <Section label="Próximo (borda)">
              {row.on_deck
                ? `${row.on_deck.red_name ?? "—"} × ${row.on_deck.blue_name ?? "—"}`
                : "—"}
            </Section>
            <Section label="Aquecimento">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {row.warm_up.length === 0 && <li>—</li>}
                {row.warm_up.map((w) => (
                  <li key={w.id} style={{ marginBottom: 6 }}>
                    {w.red_name ?? "—"} × {w.blue_name ?? "—"}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
  big,
}: {
  label: string;
  children: React.ReactNode;
  big?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.55, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 18 : 14, fontWeight: big ? 700 : 500 }}>{children}</div>
    </div>
  );
}
