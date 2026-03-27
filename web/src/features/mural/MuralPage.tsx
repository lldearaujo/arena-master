import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type ModalidadeListaItem = {
  id: number | null;
  name: string;
  em_catalogo: boolean;
  has_graduation_system: boolean;
  skills_labels: string[] | null;
};

type MuralPost = {
  id: number;
  dojo_id: number;
  content: string;
  pinned: boolean;
  modalidades?: string[] | null;
  author_name: string;
  likes_count: number;
  liked_by_me: boolean;
  created_at: string;
  updated_at: string;
};

type MuralLiker = {
  id: number;
  name: string | null;
  email: string;
  avatar_url: string | null;
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

  const { data: modalidades } = useQuery({
    queryKey: ["modalidades"],
    queryFn: async () => {
      const res = await api.get<ModalidadeListaItem[]>("/api/modalidades");
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [likersPostId, setLikersPostId] = useState<number | null>(null);
  const [selectedModalidades, setSelectedModalidades] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const autoTitle =
        content.trim().split("\n")[0]?.slice(0, 80) || "Recado";
      await api.post("/api/mural", {
        title: autoTitle,
        content,
        pinned,
        modalidades: selectedModalidades,
      });
    },
    onSuccess: () => {
      setContent("");
      setPinned(false);
      setSelectedModalidades([]);
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

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/api/mural");
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

  const likeMutation = useMutation({
    mutationFn: async (post: MuralPost) => {
      if (post.liked_by_me) {
        const res = await api.delete<{ likes_count: number; liked_by_me: boolean }>(
          `/api/mural/${post.id}/like`
        );
        return { postId: post.id, ...res.data };
      }
      const res = await api.post<{ likes_count: number; liked_by_me: boolean }>(
        `/api/mural/${post.id}/like`
      );
      return { postId: post.id, ...res.data };
    },
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: ["mural"] });
      const prev = queryClient.getQueryData<MuralPost[]>(["mural"]);

      queryClient.setQueryData<MuralPost[]>(["mural"], (cur) => {
        if (!cur) return cur;
        return cur.map((p) => {
          if (p.id !== post.id) return p;
          const nextLiked = !p.liked_by_me;
          const nextCount = Math.max(0, (p.likes_count ?? 0) + (nextLiked ? 1 : -1));
          return { ...p, liked_by_me: nextLiked, likes_count: nextCount };
        });
      });

      return { prev };
    },
    onError: (_err, _post, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["mural"], ctx.prev);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MuralPost[]>(["mural"], (cur) => {
        if (!cur) return cur;
        return cur.map((p) =>
          p.id === data.postId
            ? { ...p, likes_count: data.likes_count, liked_by_me: data.liked_by_me }
            : p
        );
      });
    },
  });

  const likersQuery = useQuery({
    queryKey: ["mural-likers", likersPostId],
    queryFn: async () => {
      const res = await api.get<MuralLiker[]>(`/api/mural/${likersPostId}/likes/users`);
      return res.data;
    },
    enabled: likersPostId != null,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if ((selectedModalidades?.length ?? 0) === 0) return;
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
          <label style={{ display: "block", fontSize: tokens.text.sm, marginBottom: 6 }}>
            Publicar para modalidades
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              padding: 10,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              backgroundColor: "white",
            }}
          >
            {(modalidades ?? []).map((m) => {
              const checked = selectedModalidades.includes(m.name);
              return (
                <label
                  key={m.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: tokens.text.sm,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${checked ? tokens.color.primary : tokens.color.borderSubtle}`,
                    backgroundColor: checked ? "rgba(184,158,93,0.10)" : "white",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setSelectedModalidades((cur) => {
                        const set = new Set(cur);
                        if (next) set.add(m.name);
                        else set.delete(m.name);
                        return Array.from(set);
                      });
                    }}
                  />
                  {m.name}
                </label>
              );
            })}
            {(modalidades ?? []).length === 0 && (
              <span style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
                Nenhuma modalidade cadastrada. Cadastre modalidades para direcionar recados.
              </span>
            )}
          </div>
          {(selectedModalidades?.length ?? 0) === 0 && (
            <div style={{ marginTop: 6, color: tokens.color.error, fontSize: tokens.text.xs }}>
              Selecione ao menos uma modalidade.
            </div>
          )}
        </div>
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
            opacity:
              createMutation.isPending ||
              !content.trim() ||
              (selectedModalidades?.length ?? 0) === 0
                ? 0.7
                : 1,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: tokens.space.md,
            marginBottom: tokens.space.md,
          }}
        >
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, margin: 0 }}>
            Recados publicados
          </h2>
          <button
            type="button"
            disabled={
              deleteAllMutation.isPending ||
              isLoading ||
              !!error ||
              (data?.length ?? 0) === 0
            }
            onClick={() => {
              const ok = window.confirm(
                "Tem certeza que deseja excluir TODOS os recados do mural? Essa ação não pode ser desfeita."
              );
              if (!ok) return;
              deleteAllMutation.mutate();
            }}
            style={{
              padding: "6px 10px",
              fontSize: tokens.text.xs,
              borderRadius: tokens.radius.sm,
              border: `1px solid ${tokens.color.error}`,
              backgroundColor: "white",
              color: tokens.color.error,
              cursor: "pointer",
              opacity:
                deleteAllMutation.isPending ||
                isLoading ||
                !!error ||
                (data?.length ?? 0) === 0
                  ? 0.6
                  : 1,
            }}
          >
            {deleteAllMutation.isPending ? "Excluindo..." : "Excluir todos"}
          </button>
        </div>
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
                  <span
                    style={{
                      display: "inline-flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginLeft: 6,
                      alignItems: "center",
                    }}
                  >
                    {((post.modalidades ?? []).length > 0 ? post.modalidades! : ["Todas"]).map((m) => (
                      <span
                        key={`${post.id}-${m}`}
                        style={{
                          fontSize: tokens.text.xs,
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          color: tokens.color.textMuted,
                          backgroundColor: "white",
                          lineHeight: 1.2,
                        }}
                        title="Modalidade(s) que verão este recado"
                      >
                        {m}
                      </span>
                    ))}
                  </span>
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => likeMutation.mutate(post)}
                    style={{
                      padding: "6px 10px",
                      fontSize: tokens.text.xs,
                      borderRadius: 999,
                      border: `1px solid ${post.liked_by_me ? tokens.color.primary : tokens.color.borderSubtle}`,
                      backgroundColor: post.liked_by_me ? tokens.color.primary : "white",
                      color: post.liked_by_me ? tokens.color.textOnPrimary : tokens.color.textMuted,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                      ♥
                    </span>
                    {post.liked_by_me ? "Curtiu" : "Curtir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLikersPostId(post.id)}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: tokens.text.xs,
                      color: tokens.color.textMuted,
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                    title="Ver quem curtiu (admin)"
                  >
                    {post.likes_count ?? 0} curtida{(post.likes_count ?? 0) === 1 ? "" : "s"}
                  </button>
                </div>
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

      {likersPostId != null && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: tokens.space.lg,
            zIndex: 50,
          }}
          onClick={() => setLikersPostId(null)}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              maxHeight: "80vh",
              overflow: "auto",
              backgroundColor: "white",
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.color.borderSubtle}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: tokens.space.lg,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: tokens.space.md,
                borderBottom: `1px solid ${tokens.color.borderSubtle}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: tokens.text.md }}>Curtidas</div>
                <div style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
                  Usuários que curtiram este recado
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLikersPostId(null)}
                style={{
                  padding: "6px 10px",
                  fontSize: tokens.text.xs,
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>

            <div style={{ padding: tokens.space.lg }}>
              {likersQuery.isLoading && <p style={{ margin: 0 }}>Carregando...</p>}
              {likersQuery.isError && (
                <p style={{ margin: 0, color: tokens.color.error }}>
                  Erro ao carregar curtidas. Verifique se você está logado como admin.
                </p>
              )}
              {!likersQuery.isLoading && !likersQuery.isError && (likersQuery.data?.length ?? 0) === 0 && (
                <p style={{ margin: 0, color: tokens.color.textMuted }}>
                  Ainda não há curtidas.
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(likersQuery.data ?? []).map((u) => {
                  const label = (u.name?.trim() || u.email).trim();
                  return (
                    <div
                      key={u.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: tokens.radius.md,
                        border: `1px solid ${tokens.color.borderSubtle}`,
                        backgroundColor: "white",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          overflow: "hidden",
                          backgroundColor: tokens.color.borderSubtle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: 700 }}>
                            {label.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: tokens.text.sm, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {label}
                        </div>
                        <div style={{ fontSize: tokens.text.xs, color: tokens.color.textMuted, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {u.email}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

