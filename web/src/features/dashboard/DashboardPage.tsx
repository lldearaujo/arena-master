import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { tokens } from "../../ui/tokens";

type Dojo = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
};

type Student = {
  id: number;
  name: string;
  email: string | null;
};

type Turma = {
  id: number;
  name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  tipo: string;
};

type CheckIn = {
  id: number;
  student_id: number;
  turma_id: number;
  occurred_at: string;
};

type KidsTurma = {
  student: { id: number; name: string };
  turma: Turma;
};

const cardStyle = {
  padding: tokens.space.xl,
  backgroundColor: "white",
  borderRadius: tokens.radius.lg,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  border: `1px solid ${tokens.color.borderSubtle}`,
};

function SuperAdminDashboard() {
  const { data: dojos, isLoading, error } = useQuery({
    queryKey: ["dojos"],
    queryFn: async () => {
      const res = await api.get<Dojo[]>("/api/dojos");
      return res.data;
    },
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Painel SuperAdmin
      </h1>
      <p style={{ color: tokens.color.textMuted, marginBottom: tokens.space.xl }}>
        Gerencie todos os dojos da plataforma.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: tokens.space.lg,
          marginBottom: tokens.space.xl,
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              fontSize: tokens.text.xs,
              color: tokens.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: tokens.space.xs,
            }}
          >
            Total de Dojos
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: tokens.color.primary }}>
            {isLoading ? "—" : dojos?.length ?? 0}
          </div>
        </div>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: tokens.text.xs,
              color: tokens.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: tokens.space.xs,
            }}
          >
            Ativos
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: tokens.color.success }}>
            {isLoading ? "—" : dojos?.filter((d) => d.active).length ?? 0}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.space.md }}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600 }}>Dojos</h2>
          <Link
            to="/dojos"
            style={{
              padding: `${tokens.space.sm}px ${tokens.space.md}px`,
              backgroundColor: tokens.color.primary,
              color: tokens.color.textOnPrimary,
              borderRadius: tokens.radius.md,
              textDecoration: "none",
              fontSize: tokens.text.sm,
              fontWeight: 500,
            }}
          >
            Gerenciar Dojos
          </Link>
        </div>
        {isLoading && <p>Carregando...</p>}
        {error && <p style={{ color: tokens.color.error }}>Erro ao carregar.</p>}
        {dojos && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
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
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
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
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    padding: tokens.space.sm,
                    fontSize: tokens.text.sm,
                    color: tokens.color.textMuted,
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {(dojos ?? []).slice(0, 5).map((d) => (
                <tr key={d.id}>
                  <td style={{ padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                    {d.name}
                  </td>
                  <td style={{ padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                    {d.slug}
                  </td>
                  <td style={{ padding: tokens.space.sm, borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
                    {d.active ? (
                      <span style={{ color: tokens.color.success }}>Ativo</span>
                    ) : (
                      <span style={{ color: tokens.color.textMuted }}>Inativo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: dojo } = useQuery({
    queryKey: ["dojo", "me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    enabled: !!user,
  });

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await api.get<Student[]>("/api/students");
      return res.data;
    },
  });
  const { data: turmas } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const res = await api.get<Turma[]>("/api/turmas");
      return res.data;
    },
  });
  const { data: checkins } = useQuery({
    queryKey: ["check-ins", "recent"],
    queryFn: async () => {
      const res = await api.get<CheckIn[]>("/api/check-in");
      return res.data;
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = (checkins ?? []).filter(
    (c) => new Date(c.occurred_at).toISOString().slice(0, 10) === todayStr
  ).length;
  const recentCheckins = (checkins ?? []).slice(0, 8);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Painel do Professor
      </h1>
      <p style={{ color: tokens.color.textMuted, marginBottom: tokens.space.xl }}>
        Visão geral do dojo {dojo ? `"${dojo.name}"` : "..." }.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: tokens.space.lg,
          marginBottom: tokens.space.xl,
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              fontSize: tokens.text.xs,
              color: tokens.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: tokens.space.xs,
            }}
          >
            Alunos
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: tokens.color.primary }}>
            {students?.length ?? 0}
          </div>
          <Link to="/students" style={{ fontSize: tokens.text.sm, color: tokens.color.primary, marginTop: 4 }}>
            Ver todos
          </Link>
        </div>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: tokens.text.xs,
              color: tokens.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: tokens.space.xs,
            }}
          >
            Turmas
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: tokens.color.primary }}>
            {turmas?.length ?? 0}
          </div>
          <Link to="/turmas" style={{ fontSize: tokens.text.sm, color: tokens.color.primary, marginTop: 4 }}>
            Ver todas
          </Link>
        </div>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: tokens.text.xs,
              color: tokens.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: tokens.space.xs,
            }}
          >
            Check-ins (hoje)
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: tokens.color.success }}>
            {todayCount}
          </div>
          <Link to="/check-ins" style={{ fontSize: tokens.text.sm, color: tokens.color.primary, marginTop: 4 }}>
            Registrar
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: tokens.space.lg,
          marginBottom: tokens.space.lg,
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, marginBottom: tokens.space.md }}>
            Check-ins recentes
          </h2>
          {recentCheckins.length === 0 ? (
            <p style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
              Nenhum check-in recente.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {recentCheckins.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: tokens.space.sm,
                    borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                    fontSize: tokens.text.sm,
                  }}
                >
                  Aluno #{c.student_id} · Turma #{c.turma_id} ·{" "}
                  {new Date(c.occurred_at).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/check-ins"
            style={{
              display: "inline-block",
              marginTop: tokens.space.sm,
              fontSize: tokens.text.sm,
              color: tokens.color.primary,
            }}
          >
            Ver todos os check-ins →
          </Link>
        </div>
        <div style={cardStyle}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, marginBottom: tokens.space.md }}>
            Ações rápidas
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.sm }}>
            <Link
              to="/students"
              style={{
                padding: tokens.space.sm,
                backgroundColor: tokens.color.bgBody,
                color: tokens.color.textOnPrimary,
                borderRadius: tokens.radius.md,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Cadastrar aluno
            </Link>
            <Link
              to="/turmas"
              style={{
                padding: tokens.space.sm,
                backgroundColor: tokens.color.bgBody,
                color: tokens.color.textOnPrimary,
                borderRadius: tokens.radius.md,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Nova turma
            </Link>
            <Link
              to="/check-ins"
              style={{
                padding: tokens.space.sm,
                backgroundColor: tokens.color.primary,
                color: tokens.color.textOnPrimary,
                borderRadius: tokens.radius.md,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Registrar check-in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlunoDashboard() {
  const { data: myTurmas } = useQuery({
    queryKey: ["turmas", "my"],
    queryFn: async () => {
      const res = await api.get<Turma[]>("/api/turmas/my");
      return res.data;
    },
  });
  const { data: kidsTurmas } = useQuery({
    queryKey: ["turmas", "my-kids"],
    queryFn: async () => {
      const res = await api.get<KidsTurma[]>("/api/turmas/my-kids");
      return res.data;
    },
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
        Meu Painel
      </h1>
      <p style={{ color: tokens.color.textMuted, marginBottom: tokens.space.xl }}>
        Suas turmas e atividades.
      </p>

      {(myTurmas && myTurmas.length > 0) && (
        <div style={{ ...cardStyle, marginBottom: tokens.space.lg }}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, marginBottom: tokens.space.md }}>
            Minhas turmas
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {myTurmas.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: tokens.space.md,
                  borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div
                    style={{
                      fontSize: tokens.text.sm,
                      color: tokens.color.textMuted,
                    }}
                  >
                    {t.day_of_week} · {t.start_time?.slice?.(0, 5) ?? t.start_time} -{" "}
                    {t.end_time?.slice?.(0, 5) ?? t.end_time} ·{" "}
                    {t.tipo === "kids" ? "KIDS" : "Regular"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(kidsTurmas && kidsTurmas.length > 0) && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: tokens.text.lg, fontWeight: 600, marginBottom: tokens.space.md }}>
            Turma kids
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {kidsTurmas.map((item, idx) => (
              <li
                key={`${item.student.id}-${item.turma.id}-${idx}`}
                style={{
                  padding: tokens.space.md,
                  borderBottom: `1px solid ${tokens.color.borderSubtle}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {item.student.name} → {item.turma.name}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.text.sm,
                      color: tokens.color.textMuted,
                    }}
                  >
                    {item.turma.day_of_week} ·{" "}
                    {item.turma.start_time?.slice?.(0, 5) ?? item.turma.start_time} -{" "}
                    {item.turma.end_time?.slice?.(0, 5) ?? item.turma.end_time} ·{" "}
                    {item.turma.tipo === "kids" ? "KIDS" : "Regular"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!myTurmas || myTurmas.length === 0) && (!kidsTurmas || kidsTurmas.length === 0) && (
        <div style={cardStyle}>
          <p style={{ color: tokens.color.textMuted }}>
            Você ainda não está matriculado em nenhuma turma. Entre em contato com o administrador
            do seu dojo.
          </p>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return null;
  }

  if (user.role === "superadmin") {
    return <SuperAdminDashboard />;
  }
  if (user.role === "admin") {
    return <AdminDashboard />;
  }
  return <AlunoDashboard />;
}
