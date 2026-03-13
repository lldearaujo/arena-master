import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type Dojo = {
  id: number;
  name: string;
  slug: string;
  localidade: string | null;
  contato: string | null;
  active: boolean;
};

type DojoPayload = {
  name: string;
  slug: string;
  localidade: string;
  contato: string;
  active: boolean;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function DojosPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dojos"],
    queryFn: async () => {
      const res = await api.get<Dojo[]>("/api/dojos");
      return res.data;
    },
  });

  const [form, setForm] = useState<DojoPayload>({
    name: "",
    slug: "",
    localidade: "",
    contato: "",
    active: true,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Nome é obrigatório");
      }
      const slug = form.slug.trim() || slugify(form.name);
      const payload = {
        name: form.name.trim(),
        slug,
        localidade: form.localidade.trim() || null,
        contato: form.contato.trim() || null,
        active: form.active,
      };
      if (editingId) {
        await api.put(`/api/dojos/${editingId}`, payload);
      } else {
        await api.post("/api/dojos", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dojos"] });
      setForm({ name: "", slug: "", localidade: "", contato: "", active: true });
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar dojo");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/dojos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dojos"] });
      setDeletingId(null);
      setEditingId(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao remover dojo");
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  };

  const handleNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      name: value,
      slug: f.slug ? f.slug : slugify(value),
    }));
  };

  const startEdit = (dojo: Dojo) => {
    setEditingId(dojo.id);
    setForm({
      name: dojo.name,
      slug: dojo.slug,
      localidade: dojo.localidade ?? "",
      contato: dojo.contato ?? "",
      active: dojo.active,
    });
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", slug: "", localidade: "", contato: "", active: true });
    setFormError(null);
  };

  const confirmDelete = (dojo: Dojo) => {
    if (deletingId === dojo.id) {
      deleteMutation.mutate(dojo.id);
    } else {
      setDeletingId(dojo.id);
    }
  };

  const cancelDelete = () => {
    setDeletingId(null);
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

  const btnPrimary = {
    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
    backgroundColor: tokens.color.primary,
    color: tokens.color.textOnPrimary,
    borderRadius: tokens.radius.md,
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
  };

  const btnSecondary = {
    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
    backgroundColor: "white",
    color: tokens.color.textPrimary,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.borderSubtle}`,
    cursor: "pointer",
  };

  const btnDanger = {
    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
    fontSize: tokens.text.sm,
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.error}`,
    backgroundColor: "#fee2e2",
    color: tokens.color.primaryDark,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Dojos
      </h1>

      <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
        <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
          {editingId ? "Editar dojo" : "Novo dojo"}
        </h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: tokens.space.md, maxWidth: 400 }}
        >
          <label style={labelStyle}>
            <span>Nome</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="Ex: Dojo Centro"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Slug</span>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="ex: dojo-centro (gerado automaticamente se vazio)"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Localidade</span>
            <input
              type="text"
              value={form.localidade}
              onChange={(e) => setForm((f) => ({ ...f, localidade: e.target.value }))}
              placeholder="Ex: São Paulo - SP"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Contato</span>
            <input
              type="text"
              value={form.contato}
              onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
              placeholder="Ex: (11) 99999-9999 ou email@dojo.com"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: tokens.space.sm }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              style={{ width: "auto" }}
            />
            <span style={{ fontSize: tokens.text.sm }}>Ativo</span>
          </label>
          {formError && (
            <div style={{ color: tokens.color.error, fontSize: tokens.text.sm }}>{formError}</div>
          )}
          <div style={{ display: "flex", gap: tokens.space.sm }}>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{ ...btnPrimary, opacity: saveMutation.isPending ? 0.7 : 1 }}
            >
              {saveMutation.isPending
                ? "Salvando..."
                : editingId
                  ? "Atualizar"
                  : "Criar"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={btnSecondary}>
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
        {error && <p style={{ color: tokens.color.error }}>Erro ao carregar dojos.</p>}
        {data && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Nome
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Slug
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Localidade
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Contato
                </th>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: "right",
                    borderBottom: `2px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((dojo) => (
                <tr
                  key={dojo.id}
                  style={{
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    backgroundColor: editingId === dojo.id ? "#fef2f2" : undefined,
                  }}
                >
                  <td style={{ padding: tokens.space.sm }}>{dojo.name}</td>
                  <td style={{ padding: tokens.space.sm, fontFamily: "monospace", fontSize: tokens.text.sm }}>
                    {dojo.slug}
                  </td>
                  <td style={{ padding: tokens.space.sm, fontSize: tokens.text.sm }}>
                    {dojo.localidade ?? "—"}
                  </td>
                  <td style={{ padding: tokens.space.sm, fontSize: tokens.text.sm }}>
                    {dojo.contato ?? "—"}
                  </td>
                  <td style={{ padding: tokens.space.sm }}>
                    {dojo.active ? (
                      <span style={{ color: tokens.color.success, fontWeight: 500 }}>Ativo</span>
                    ) : (
                      <span style={{ color: tokens.color.textMuted }}>Inativo</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: tokens.space.sm,
                      textAlign: "right",
                    }}
                  >
                    <div style={{ display: "flex", gap: tokens.space.xs, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => startEdit(dojo)}
                        disabled={editingId !== null && editingId !== dojo.id}
                        style={{
                          ...btnSecondary,
                          opacity: editingId !== null && editingId !== dojo.id ? 0.5 : 1,
                        }}
                      >
                        Editar
                      </button>
                      {deletingId === dojo.id ? (
                        <>
                          <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>
                            Confirmar?
                          </span>
                          <button type="button" onClick={() => confirmDelete(dojo)} style={btnDanger}>
                            Sim, remover
                          </button>
                          <button type="button" onClick={cancelDelete} style={btnSecondary}>
                            Não
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => confirmDelete(dojo)}
                          disabled={deleteMutation.isPending}
                          style={btnDanger}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.length === 0 && !isLoading && (
          <p style={{ color: tokens.color.textMuted, padding: tokens.space.lg }}>
            Nenhum dojo cadastrado. Crie o primeiro acima.
          </p>
        )}
      </section>
    </div>
  );
}
