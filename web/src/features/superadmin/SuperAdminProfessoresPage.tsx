import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type Dojo = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
};

type Professor = {
  id: number;
  email: string;
  dojo_id: number | null;
  is_active: boolean;
};

type ProfessorPayload = {
  email: string;
  password: string;
};

const cardStyle = {
  padding: tokens.space.lg,
  backgroundColor: "white",
  borderRadius: tokens.radius.lg,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: `1px solid ${tokens.color.borderSubtle}`,
};

const inputStyle = {
  width: "100%",
  padding: tokens.space.sm,
  marginTop: tokens.space.xs,
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.borderSubtle}`,
  boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block",
  fontSize: tokens.text.sm,
  fontWeight: 500,
  marginBottom: tokens.space.xs,
};

export function SuperAdminProfessoresPage() {
  const queryClient = useQueryClient();
  const [dojoId, setDojoId] = useState<number | null>(null);

  const { data: dojos } = useQuery({
    queryKey: ["dojos"],
    queryFn: async () => {
      const res = await api.get<Dojo[]>("/api/dojos");
      return res.data;
    },
  });

  const { data: professors, isLoading, error } = useQuery({
    queryKey: ["superadmin", "professores", dojoId],
    queryFn: async () => {
      if (!dojoId) return [];
      const res = await api.get<Professor[]>(
        `/api/superadmin/dojos/${dojoId}/professores`
      );
      return res.data;
    },
    enabled: !!dojoId,
  });

  const [form, setForm] = useState<ProfessorPayload>({ email: "", password: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dojoId) throw new Error("Selecione um dojo");
      if (!form.email.trim()) throw new Error("E-mail é obrigatório");
      if (!editingId && !form.password) throw new Error("Senha é obrigatória");
      if (editingId) {
        await api.put(
          `/api/superadmin/dojos/${dojoId}/professores/${editingId}`,
          {
            email: form.email.trim(),
            ...(editPassword ? { password: editPassword } : {}),
          }
        );
      } else {
        await api.post(`/api/superadmin/dojos/${dojoId}/professores`, {
          email: form.email.trim(),
          password: form.password,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "professores", dojoId],
      });
      setForm({ email: "", password: "" });
      setEditPassword("");
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!dojoId) return;
      await api.delete(`/api/superadmin/dojos/${dojoId}/professores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "professores", dojoId],
      });
      setDeletingId(null);
      setEditingId(null);
    },
  });

  const startEdit = (p: Professor) => {
    setEditingId(p.id);
    setForm({ email: p.email, password: "" });
    setEditPassword("");
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ email: "", password: "" });
    setEditPassword("");
    setFormError(null);
  };

  const confirmDelete = (p: Professor) => {
    if (deletingId === p.id) deleteMutation.mutate(p.id);
    else setDeletingId(p.id);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Professores
      </h1>

      <section style={{ ...cardStyle, marginBottom: tokens.space.lg }}>
        <label style={labelStyle}>Dojo</label>
        <select
          value={dojoId ?? ""}
          onChange={(e) => setDojoId(e.target.value ? Number(e.target.value) : null)}
          style={{ ...inputStyle, maxWidth: 320 }}
        >
          <option value="">Selecione um dojo</option>
          {dojos?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </section>

      {!dojoId && (
        <p style={{ color: tokens.color.textMuted }}>
          Selecione um dojo para gerenciar os professores.
        </p>
      )}

      {dojoId && (
        <>
          <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
            <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
              {editingId ? "Editar professor" : "Novo professor"}
            </h2>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                setFormError(null);
                saveMutation.mutate();
              }}
              style={{ display: "flex", flexDirection: "column", gap: tokens.space.md, maxWidth: 400 }}
            >
              <label style={labelStyle}>
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  style={inputStyle}
                />
              </label>
              {!editingId ? (
                <label style={labelStyle}>
                  <span>Senha</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={6}
                    style={inputStyle}
                  />
                </label>
              ) : (
                <label style={labelStyle}>
                  <span>Nova senha (deixe em branco para não alterar)</span>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    style={inputStyle}
                  />
                </label>
              )}
              {formError && (
                <div style={{ color: tokens.color.error, fontSize: tokens.text.sm }}>
                  {formError}
                </div>
              )}
              <div style={{ display: "flex", gap: tokens.space.sm }}>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  style={{
                    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                    backgroundColor: tokens.color.primary,
                    color: tokens.color.textOnPrimary,
                    borderRadius: tokens.radius.md,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                      backgroundColor: "white",
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      borderRadius: tokens.radius.md,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
              Registros
            </h2>
            {isLoading && <p>Carregando...</p>}
            {error && <p style={{ color: tokens.color.error }}>Erro ao carregar.</p>}
            {professors && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>E-mail</th>
                    <th style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Status</th>
                    <th style={{ textAlign: "right", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {professors.map((p) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}`, backgroundColor: editingId === p.id ? "#fef2f2" : undefined }}>
                      <td style={{ padding: tokens.space.sm }}>{p.email}</td>
                      <td style={{ padding: tokens.space.sm }}>
                        {p.is_active ? <span style={{ color: tokens.color.success }}>Ativo</span> : <span style={{ color: tokens.color.textMuted }}>Inativo</span>}
                      </td>
                      <td style={{ padding: tokens.space.sm, textAlign: "right" }}>
                        <button type="button" onClick={() => startEdit(p)} style={{ marginRight: 8, padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.borderSubtle}`, background: "white", cursor: "pointer" }}>Editar</button>
                        {deletingId === p.id ? (
                          <>
                            <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Confirmar? </span>
                            <button type="button" onClick={() => confirmDelete(p)} style={{ marginLeft: 4, padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.error}`, background: "#fee2e2", color: tokens.color.primaryDark, cursor: "pointer" }}>Sim</button>
                            <button type="button" onClick={() => setDeletingId(null)} style={{ marginLeft: 4, padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.borderSubtle}`, background: "white", cursor: "pointer" }}>Não</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => confirmDelete(p)} disabled={deleteMutation.isPending} style={{ padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.error}`, background: "#fee2e2", color: tokens.color.primaryDark, cursor: "pointer" }}>Remover</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {professors?.length === 0 && !isLoading && (
              <p style={{ color: tokens.color.textMuted, padding: tokens.space.lg }}>Nenhum professor neste dojo.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
