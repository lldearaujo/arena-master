import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../store/auth";
import { tokens } from "./tokens";
import arenaMasterLogo from "../assets/arena-master-logo.png";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "system-ui",
        backgroundColor: tokens.color.bgBody,
      }}
    >
      <aside
        style={{
          width: 220,
          backgroundColor: tokens.color.bgCard,
          color: tokens.color.textOnPrimary,
          padding: `${tokens.space.md}px ${tokens.space.sm}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: tokens.space.lg }}>
          <img
            src={arenaMasterLogo}
            alt="Arena Master"
            style={{ width: "100%", maxWidth: 160, height: "auto" }}
          />
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            to="/dashboard"
            style={{ color: tokens.color.textOnPrimary, textDecoration: "none" }}
          >
            Dashboard
          </Link>
          {user?.role === "superadmin" && (
            <>
              <Link
                to="/dojos"
                style={{ color: tokens.color.textOnPrimary, textDecoration: "none" }}
              >
                Dojos
              </Link>
              <Link
                to="/superadmin/professores"
                style={{ color: tokens.color.textOnPrimary, textDecoration: "none" }}
              >
                Professores
              </Link>
              <Link
                to="/superadmin/alunos"
                style={{ color: tokens.color.textOnPrimary, textDecoration: "none" }}
              >
                Alunos
              </Link>
            </>
          )}
          {user?.role === "admin" && (
            <>
              <Link
                to="/faixas"
                style={{
                  color: tokens.color.textOnPrimary,
                  textDecoration: "none",
                }}
              >
                Faixas
              </Link>
              <Link
                to="/mural"
                style={{
                  color: tokens.color.textOnPrimary,
                  textDecoration: "none",
                }}
              >
                Mural
              </Link>
              <Link
                to="/students"
                style={{
                  color: tokens.color.textOnPrimary,
                  textDecoration: "none",
                }}
              >
                Alunos
              </Link>
              <Link
                to="/turmas"
                style={{
                  color: tokens.color.textOnPrimary,
                  textDecoration: "none",
                }}
              >
                Turmas
              </Link>
              <Link
                to="/check-ins"
                style={{
                  color: tokens.color.textOnPrimary,
                  textDecoration: "none",
                }}
              >
                Check-ins
              </Link>
              <Link
                to="/configuracoes"
                style={{
                  color: tokens.color.textOnPrimary,
                  textDecoration: "none",
                }}
              >
                Configurações
              </Link>
            </>
          )}
        </nav>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 56,
            borderBottom: `1px solid ${tokens.color.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
          }}
        >
          <div style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>
            {user ? (
              <>
                Logado como <strong>{user.email}</strong> ({user.role})
              </>
            ) : (
              "Não autenticado"
            )}
          </div>
          {user && (
            <button
              type="button"
              onClick={clearSession}
              style={{
                padding: "6px 10px",
                fontSize: tokens.text.sm,
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.borderSubtle}`,
                backgroundColor: "white",
                cursor: "pointer",
              }}
            >
              Sair
            </button>
          )}
        </header>
        <main
          style={{
            padding: tokens.space.lg,
            backgroundColor: "#f9fafb",
            flex: 1,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

