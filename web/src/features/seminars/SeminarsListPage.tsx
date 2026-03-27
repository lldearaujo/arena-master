import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { tokens } from "../../ui/tokens";
import type { Seminar } from "./types";

const card: React.CSSProperties = {
  padding: tokens.space.xl,
  backgroundColor: "white",
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.color.borderSubtle}`,
};

export function SeminarsListPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: list, isLoading } = useQuery({
    queryKey: ["seminars"],
    queryFn: async () => {
      const res = await api.get<Seminar[]>("/api/seminars/");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      if (!title.trim()) throw new Error("Informe um título");
      const organizer_dojo_id = user.dojoId ?? null;
      if (user.role !== "superadmin" && organizer_dojo_id == null) {
        throw new Error("Seu usuário não está vinculado a um dojo");
      }
      const res = await api.post<Seminar>("/api/seminars/", {
        organizer_dojo_id: organizer_dojo_id ?? 1,
        title: title.trim(),
        is_published: false,
      });
      return res.data;
    },
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["seminars"] });
    },
  });

  return (
    <div style={{ padding: tokens.space.xl, display: "grid", gap: tokens.space.xl }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Seminários/Aulões</h1>
        <p style={{ marginTop: 8, color: tokens.color.textMuted }}>
          Crie e gerencie masterclasses com lotes, cronograma, inscrições e check-in.
        </p>
      </div>

      {(user?.role === "admin" || user?.role === "superadmin") && (
        <div style={card}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Criar seminário</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do seminário"
              style={{
                flex: 1,
                minWidth: 240,
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${tokens.color.borderSubtle}`,
              }}
            />
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
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
              {createMutation.isPending ? "Criando..." : "Criar"}
            </button>
          </div>
          {createMutation.isError && (
            <div style={{ marginTop: 10, color: tokens.color.danger }}>
              {(createMutation.error as any)?.response?.data?.detail ?? (createMutation.error as Error).message}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Lista</h2>
        {isLoading ? (
          <div style={{ color: tokens.color.textMuted }}>Carregando...</div>
        ) : !list?.length ? (
          <div style={{ color: tokens.color.textMuted }}>Nenhum seminário cadastrado ainda.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {list.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>{s.title}</div>
                  <div style={{ color: tokens.color.textMuted, fontSize: 13 }}>
                    {s.starts_at ? new Date(s.starts_at).toLocaleString("pt-BR") : "Data a definir"} •{" "}
                    {s.is_published ? "Publicado" : "Rascunho"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Link
                    to={`/seminarios/gerir/${s.id}`}
                    style={{
                      textDecoration: "none",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      color: tokens.color.textPrimary,
                      fontWeight: 800,
                    }}
                  >
                    Gerir
                  </Link>
                  <Link
                    to={`/seminarios/checkin/${s.id}`}
                    style={{
                      textDecoration: "none",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      color: tokens.color.textPrimary,
                      fontWeight: 800,
                    }}
                  >
                    Check-in
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

