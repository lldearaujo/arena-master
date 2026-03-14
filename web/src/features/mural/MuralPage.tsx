import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type MuralPost = {
  id: number;
  dojo_id: number;
  content: string;
  pinned: boolean;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export function MuralPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["mural"],
    queryFn: async () => {
      const res = await api.get<MuralPost[]>("/api/mural");
      return res.data;
    },
  });

  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const autoTitle =
        content.trim().split("\n")[0]?.slice(0, 80) || "Recado";
      await api.post("/api/mural", { title: autoTitle, content, pinned });
    },
    onSuccess: () => {
      setContent("");
      setPinned(false);
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/mural/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async (post: MuralPost) => {
      await api.put(`/api/mural/${post.id}`, {
        pinned: !post.pinned,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createMutation.mutate();
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Mural do dojo
      </h1>
      <p style={{ color: tokens.color.textMuted, marginBottom: tokens.space.xl }}>
        Publique recados e avisos que aparecerão para seus alunos no aplicativo.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: tokens.space.xl,
          padding: tokens.space.lg,
          borderRadius: tokens.radius.lg,
          backgroundColor: "white",
          border: `1px solid ${tokens.color.borderSubtle}`,
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.sm,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: tokens.text.sm, marginBottom: 4 }}>
            Mensagem
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: tokens.space.sm,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              resize: "vertical",
            }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: tokens.text.sm }}>
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Fixar no topo
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          style={{
            marginTop: tokens.space.sm,
            alignSelf: "flex-start",
            padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
            borderRadius: tokens.radius.md,
            border: "none",
            backgroundColor: tokens.color.primary,
            color: tokens.color.textOnPrimary,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {createMutation.isPending ? "Publicando..." : "Publicar recado"}
        </button>
      </form>

      <div
        style={{
          padding: tokens.space.lg,
          borderRadius: tokens.radius.lg,
          backgroundColor: "white",
          border: `1px solid ${tokens.color.borderSubtle}`,
        }}
      >
        <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, marginBottom: tokens.space.md }}>
          Recados publicados
        </h2>
        {isLoading && <p>Carregando...</p>}
        {error && (
          <p style={{ color: tokens.color.error }}>Erro ao carregar mural. Tente novamente.</p>
        )}
        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <p style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
            Ainda não há recados publicados.
          </p>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {(data ?? []).map((post) => (
            <li
              key={post.id}
              style={{
                padding: tokens.space.md,
                borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                display: "flex",
                gap: tokens.space.md,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: tokens.text.sm,
                    }}
                  >
                    {post.author_name}
                  </span>
                  {post.pinned && (
                    <span
                      style={{
                        fontSize: tokens.text.xs,
                        padding: "2px 6px",
                        borderRadius: 999,
                        backgroundColor: tokens.color.primary,
                        color: tokens.color.textOnPrimary,
                      }}
                    >
                      Fixado
                    </span>
                  )}
                </div>
                <p
                  style={{
                    marginTop: 4,
                    marginBottom: 4,
                    whiteSpace: "pre-wrap",
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  {post.content}
                </p>
                <span
                  style={{
                    fontSize: tokens.text.xs,
                    color: tokens.color.textMuted,
                  }}
                >
                  {new Date(post.created_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePinMutation.mutate(post)}
                  style={{
                    padding: "4px 8px",
                    fontSize: tokens.text.xs,
                    borderRadius: tokens.radius.sm,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  {post.pinned ? "Desfixar" : "Fixar"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(post.id)}
                  style={{
                    padding: "4px 8px",
                    fontSize: tokens.text.xs,
                    borderRadius: tokens.radius.sm,
                    border: `1px solid ${tokens.color.error}`,
                    backgroundColor: "white",
                    color: tokens.color.error,
                    cursor: "pointer",
                  }}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

