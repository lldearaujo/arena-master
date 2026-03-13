import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";

type Turma = {
  id: number;
  dojo_id: number;
  name: string;
  description: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  active: boolean;
  tipo: string;
};

type TurmaPayload = {
  name: string;
  description?: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  active: boolean;
  tipo: string;
};

const DAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

const defaultPayload: TurmaPayload = {
  name: "",
  description: "",
  day_of_week: "seg",
  start_time: "19:00",
  end_time: "20:00",
  capacity: 20,
  active: true,
  tipo: "regular",
};

type EnrollmentPayload = {
  studentId: string;
};

export function TurmasPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const res = await api.get<Turma[]>("/api/turmas/");
      return res.data;
    },
  });

  const [form, setForm] = useState<TurmaPayload>(defaultPayload);
  const [selectedDays, setSelectedDays] = useState<string[]>(["seg"]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollmentPayload>({ studentId: "" });
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Nome é obrigatório");
      }
      if (selectedDays.length === 0) {
        throw new Error("Selecione pelo menos um dia da semana");
      }
      const payload: TurmaPayload = {
        ...form,
        day_of_week: selectedDays.join(","),
      };
      if (editingId) {
        await api.put(`/api/turmas/${editingId}`, payload);
      } else {
        await api.post("/api/turmas/", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turmas"] });
      setForm(defaultPayload);
      setSelectedDays(["seg"]);
      setEditingId(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar turma");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/turmas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turmas"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const startEdit = (turma: Turma) => {
    setEditingId(turma.id);
    const days = turma.day_of_week
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    setSelectedDays(days.length ? days : ["seg"]);
    setForm({
      name: turma.name,
      description: turma.description ?? "",
      day_of_week: turma.day_of_week,
      start_time: turma.start_time.slice(0, 5),
      end_time: turma.end_time.slice(0, 5),
      capacity: turma.capacity,
      active: turma.active,
      tipo: turma.tipo,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultPayload);
    setFormError(null);
    setSelectedDays(["seg"]);
  };

  const enrollMutation = useMutation({
    mutationFn: async (turmaId: number) => {
      if (!enroll.studentId) {
        throw new Error("Informe o ID do aluno");
      }
      await api.post(`/api/turmas/${turmaId}/enroll`, {
        student_id: Number(enroll.studentId),
      });
    },
    onSuccess: () => {
      setEnroll({ studentId: "" });
      setEnrollError(null);
    },
    onError: (err: unknown) => {
      setEnrollError(
        err instanceof Error ? err.message : "Erro ao matricular aluno",
      );
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (payload: { turmaId: number; studentId: number }) => {
      await api.delete(`/api/turmas/${payload.turmaId}/enroll`, {
        params: { student_id: payload.studentId },
      });
    },
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Turmas</h1>

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          backgroundColor: "white",
          borderRadius: 8,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          {editingId ? "Editar turma" : "Nova turma"}
        </h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <label style={{ gridColumn: "1 / -1" }}>
            <span>Nome</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <span>Descrição</span>
            <input
              type="text"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <span>Dias da semana</span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 4,
              }}
            >
              {DAYS.map((day) => (
                <label key={day.value} style={{ fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day.value)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedDays((current) =>
                        checked
                          ? [...current, day.value]
                          : current.filter((d) => d !== day.value),
                      );
                    }}
                    style={{ marginRight: 4 }}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </label>
          <label>
            <span>Capacidade</span>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Início</span>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Término</span>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, end_time: e.target.value }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={form.tipo}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipo: e.target.value }))
              }
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="regular">Regular</option>
              <option value="kids">KIDS</option>
            </select>
          </label>
          <label>
            <span>Ativa</span>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
              style={{ marginLeft: 8 }}
            />
          </label>
          {formError && (
            <div
              style={{
                gridColumn: "1 / -1",
                color: "red",
                fontSize: 14,
              }}
            >
              {formError}
            </div>
          )}
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              gap: 8,
              marginTop: 8,
            }}
          >
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
              {saveMutation.isPending
                ? "Salvando..."
                : editingId
                  ? "Atualizar"
                  : "Criar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
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
      {error && <p style={{ color: "red" }}>Erro ao carregar turmas.</p>}
      {data && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Nome</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Dia</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Horário</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Cap.</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Tipo</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {data.map((turma) => (
              <tr key={turma.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{turma.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {turma.day_of_week
                    .split(",")
                    .map((d) => d.trim())
                    .filter(Boolean)
                    .map((code) => DAYS.find((day) => day.value === code)?.label ?? code)
                    .join(", ")}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {turma.start_time.slice(0, 5)} - {turma.end_time.slice(0, 5)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{turma.capacity}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  {turma.tipo === "kids" ? "KIDS" : "Regular"}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f3f4f6",
                    textAlign: "right",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(turma)}
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
                    onClick={() => deleteMutation.mutate(turma.id)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #fecaca",
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      cursor: "pointer",
                    }}
                  >
                    Remover
                  </button>
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="number"
                      placeholder="ID aluno"
                      value={enroll.studentId}
                      onChange={(e) =>
                        setEnroll({ studentId: e.target.value })
                      }
                      style={{ width: 100, padding: 4, marginRight: 4 }}
                    />
                    <button
                      type="button"
                      onClick={() => enrollMutation.mutate(turma.id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        backgroundColor: "white",
                        cursor: "pointer",
                        marginRight: 4,
                      }}
                    >
                      Matricular
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        unenrollMutation.mutate({
                          turmaId: turma.id,
                          studentId: Number(enroll.studentId),
                        })
                      }
                      style={{
                        padding: "4px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #fecaca",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        cursor: "pointer",
                      }}
                    >
                      Desmatricular
                    </button>
                    {enrollError && (
                      <div style={{ color: "red", fontSize: 12, marginTop: 4 }}>
                        {enrollError}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

