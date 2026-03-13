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

type Student = {
  id: number;
  dojo_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  user_id: number | null;
};

type StudentPayload = {
  name: string;
  email: string;
  phone: string;
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

export function SuperAdminStudentsPage() {
  const queryClient = useQueryClient();
  const [dojoId, setDojoId] = useState<number | null>(null);

  const { data: dojos } = useQuery({
    queryKey: ["dojos"],
    queryFn: async () => {
      const res = await api.get<Dojo[]>("/api/dojos");
      return res.data;
    },
  });

  const { data: students, isLoading, error } = useQuery({
    queryKey: ["superadmin", "students", dojoId],
    queryFn: async () => {
      if (!dojoId) return [];
      const res = await api.get<Student[]>(
        `/api/superadmin/dojos/${dojoId}/students`
      );
      return res.data;
    },
    enabled: !!dojoId,
  });

  const [form, setForm] = useState<StudentPayload>({ name: "", email: "", phone: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dojoId) throw new Error("Selecione um dojo");
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };
      if (editingId) {
        await api.put(
          `/api/superadmin/dojos/${dojoId}/students/${editingId}`,
          payload
        );
      } else {
        await api.post(`/api/superadmin/dojos/${dojoId}/students`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "students", dojoId],
      });
      setForm({ name: "", email: "", phone: "" });
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar aluno");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!dojoId) return;
      await api.delete(`/api/superadmin/dojos/${dojoId}/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "students", dojoId],
      });
      setDeletingId(null);
      setEditingId(null);
    },
  });

  const startEdit = (s: Student) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      email: s.email ?? "",
      phone: s.phone ?? "",
    });
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", email: "", phone: "" });
    setFormError(null);
  };

  const confirmDelete = (s: Student) => {
    if (deletingId === s.id) deleteMutation.mutate(s.id);
    else setDeletingId(s.id);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Alunos
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
          Selecione um dojo para gerenciar os alunos.
        </p>
      )}

      {dojoId && (
        <>
          <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
            <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
              {editingId ? "Editar aluno" : "Novo aluno"}
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
                <span>Nome</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span>Telefone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                />
              </label>
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
            {students && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Nome</th>
                    <th style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>E-mail</th>
                    <th style={{ textAlign: "left", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Telefone</th>
                    <th style={{ textAlign: "right", borderBottom: `2px solid ${tokens.color.borderSubtle}`, padding: tokens.space.sm, fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${tokens.color.borderSubtle}`, backgroundColor: editingId === s.id ? "#fef2f2" : undefined }}>
                      <td style={{ padding: tokens.space.sm }}>{s.name}</td>
                      <td style={{ padding: tokens.space.sm }}>{s.email ?? "—"}</td>
                      <td style={{ padding: tokens.space.sm }}>{s.phone ?? "—"}</td>
                      <td style={{ padding: tokens.space.sm, textAlign: "right" }}>
                        <button type="button" onClick={() => startEdit(s)} style={{ marginRight: 8, padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.borderSubtle}`, background: "white", cursor: "pointer" }}>Editar</button>
                        {deletingId === s.id ? (
                          <>
                            <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Confirmar? </span>
                            <button type="button" onClick={() => confirmDelete(s)} style={{ marginLeft: 4, padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.error}`, background: "#fee2e2", color: tokens.color.primaryDark, cursor: "pointer" }}>Sim</button>
                            <button type="button" onClick={() => setDeletingId(null)} style={{ marginLeft: 4, padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.borderSubtle}`, background: "white", cursor: "pointer" }}>Não</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => confirmDelete(s)} disabled={deleteMutation.isPending} style={{ padding: "4px 8px", fontSize: 13, borderRadius: 4, border: `1px solid ${tokens.color.error}`, background: "#fee2e2", color: tokens.color.primaryDark, cursor: "pointer" }}>Remover</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {students?.length === 0 && !isLoading && (
              <p style={{ color: tokens.color.textMuted, padding: tokens.space.lg }}>Nenhum aluno neste dojo.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
