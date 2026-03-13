import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";

type Faixa = {
  id: number;
  dojo_id: number;
  name: string;
  ordem: number;
  max_graus: number;
  exibir_como_dan: boolean;
};

type FaixaPayload = {
  name: string;
  ordem: number;
  max_graus: number;
  exibir_como_dan: boolean;
};

export function FaixasPage() {
  const queryClient = useQueryClient();
  const { data: faixas, isLoading, error } = useQuery({
    queryKey: ["faixas"],
    queryFn: async () => {
      const res = await api.get<Faixa[]>("/api/faixas");
      return res.data;
    },
  });

  const [form, setForm] = useState<FaixaPayload>({
    name: "",
    ordem: 0,
    max_graus: 4,
    exibir_como_dan: false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (editingId) {
        await api.put(`/api/faixas/${editingId}`, form);
      } else {
        await api.post("/api/faixas", form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faixas"] });
      setForm({ name: "", ordem: 0, max_graus: 4, exibir_como_dan: false });
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/faixas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faixas"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const startEdit = (f: Faixa) => {
    setEditingId(f.id);
    setForm({
      name: f.name,
      ordem: f.ordem,
      max_graus: f.max_graus,
      exibir_como_dan: f.exibir_como_dan,
    });
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Faixas</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Defina as faixas do dojo. Use &quot;Graus&quot; para faixas coloridas e
        &quot;Dan&quot; para faixa preta.
      </p>

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          backgroundColor: "white",
          borderRadius: 8,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          maxWidth: 480,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          {editingId ? "Editar faixa" : "Nova faixa"}
        </h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <label>
            <span>Nome</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Branca, Azul, Preta"
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Ordem (exibição)</span>
            <input
              type="number"
              min={0}
              value={form.ordem}
              onChange={(e) =>
                setForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Máx. graus/dans</span>
            <input
              type="number"
              min={0}
              max={9}
              value={form.max_graus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_graus: Number(e.target.value) || 0,
                }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.exibir_como_dan}
              onChange={(e) =>
                setForm((f) => ({ ...f, exibir_como_dan: e.target.checked }))
              }
            />
            <span>Exibir como dan (ex.: 1º dan, 2º dan)</span>
          </label>
          {formError && (
            <div style={{ color: "red", fontSize: 14 }}>{formError}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{
                padding: "8px 14px",
                backgroundColor: "#111827",
                color: "white",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: "", ordem: 0, max_graus: 4, exibir_como_dan: false });
                  setFormError(null);
                }}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "white",
                  color: "#111827",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {isLoading && <p>Carregando...</p>}
      {error && <p style={{ color: "red" }}>Erro ao carregar faixas.</p>}
      {faixas && faixas.length === 0 && (
        <p style={{ color: "#6b7280" }}>Nenhuma faixa cadastrada. Crie a primeira acima.</p>
      )}
      {faixas && faixas.length > 0 && (
        <table style={{ width: "100%", maxWidth: 560, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                Ordem
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                Nome
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                Graus/Dans
              </th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {faixas.map((f) => (
              <tr key={f.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{f.ordem}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{f.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {f.exibir_como_dan ? "dan" : "grau"} (máx. {f.max_graus})
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => startEdit(f)}
                    style={{
                      marginRight: 8,
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(f.id)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #dc2626",
                      color: "#dc2626",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
