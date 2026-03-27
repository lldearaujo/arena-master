import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { tokens } from "./tokens";
import arenaMasterLogo from "../assets/arena-master-logo.png";

type Dojo = {
  id: number;
  name: string;
  logo_url: string | null;
};

type AppShellProps = {
  children: ReactNode;
};

function resolveDojoLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null;

  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";

  // URL absoluta
  if (logoUrl.startsWith("http")) {
    // Normaliza casos antigos com localhost/127.0.0.1 para usar o mesmo host do baseURL
    if (logoUrl.includes("localhost") || logoUrl.includes("127.0.0.1")) {
      const path = logoUrl.replace(/^https?:\/\/[^/]+/, "");
      return `${base}${path}`;
    }
    return logoUrl;
  }

  // Caminho relativo salvo no banco (padrão atual)
  return `${base}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
}

function isActivePath(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(to + "/");
}

const navLinkStyle = {
  color: tokens.color.textOnPrimary,
  textDecoration: "none" as const,
  padding: "10px 16px",
  borderRadius: tokens.radius.sm,
  width: "100%" as const,
  textAlign: "center" as const,
  fontSize: tokens.text.sm,
  transition: "background-color 0.15s, color 0.15s",
};

export function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1024px)").matches : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { data: dojo } = useQuery({
    queryKey: ["dojo", "me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    enabled: user?.role === "admin",
  });

  const logoDoDojo = dojo?.logo_url ? resolveDojoLogoUrl(dojo.logo_url) : null;

  const sidebarWidth = 240;
  const contentGap = 24;
  const headerHeight = 56;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const onChange = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(false);
      }
    };
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div
      style={{
        fontFamily: "system-ui",
        backgroundColor: tokens.color.bgBody,
        minHeight: "100vh",
      }}
    >
      <style>{`
        .am-admin-main {
          overflow-x: hidden;
        }
        .am-admin-main img,
        .am-admin-main svg,
        .am-admin-main video,
        .am-admin-main canvas {
          max-width: 100%;
          height: auto;
        }
        .am-admin-main table {
          width: 100%;
        }
        .am-admin-main input,
        .am-admin-main select,
        .am-admin-main textarea,
        .am-admin-main button {
          max-width: 100%;
        }
        @media (max-width: 1024px) {
          .am-admin-main [style*="grid-template-columns: 1fr 1fr"],
          .am-admin-main [style*="grid-template-columns:2fr 1.5fr"],
          .am-admin-main [style*="grid-template-columns: 2fr 1.5fr"],
          .am-admin-main [style*="grid-template-columns:2fr 1fr 1fr 1fr auto"],
          .am-admin-main [style*="grid-template-columns: 2fr 1fr 1fr 1fr auto"] {
            grid-template-columns: 1fr !important;
          }
          .am-admin-main [style*="min-width: 220px"],
          .am-admin-main [style*="min-width: 260px"],
          .am-admin-main [style*="min-width: 280px"],
          .am-admin-main [style*="min-width: 320px"] {
            min-width: 0 !important;
          }
          .am-admin-main table {
            min-width: max-content;
          }
        }
      `}</style>
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 35,
            border: "none",
            background: "rgba(15, 23, 42, 0.4)",
            cursor: "pointer",
          }}
        />
      )}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: sidebarWidth,
          height: "100vh",
          backgroundColor: tokens.color.bgCard,
          color: tokens.color.textOnPrimary,
          padding: `${tokens.space.xl}px ${tokens.space.xl}px`,
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
          borderRight: `1px solid ${tokens.color.borderStrong}`,
          zIndex: 40,
          transform: isMobile ? (isSidebarOpen ? "translateX(0)" : "translateX(-110%)") : "translateX(0)",
          transition: "transform 0.2s ease",
        }}
      >
        {user?.role === "admin" && (
          <div
            style={{
              marginBottom: tokens.space.xl,
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {logoDoDojo ? (
              <img
                src={logoDoDojo}
                alt={dojo?.name ? `Logo do ${dojo.name}` : "Logo do dojo"}
                style={{ width: "100%", maxWidth: 160, height: "auto", objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  maxWidth: 140,
                  aspectRatio: "1",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: tokens.radius.md,
                  border: "1px dashed rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: tokens.text.xs,
                  color: "rgba(255,255,255,0.45)",
                  textAlign: "center",
                  padding: 12,
                }}
              >
                Logo do dojo
              </div>
            )}
          </div>
        )}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: 1,
            alignItems: "center",
          }}
        >
          <Link
            to="/dashboard"
            style={{
              ...navLinkStyle,
              backgroundColor: isActivePath(location.pathname, "/dashboard")
                ? "rgba(255,255,255,0.12)"
                : "transparent",
              borderLeft: isActivePath(location.pathname, "/dashboard")
                ? `3px solid ${tokens.color.primary}`
                : "3px solid transparent",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/dashboard")
                ? "rgba(255,255,255,0.12)"
                : "transparent";
            }}
          >
            Dashboard
          </Link>
          {(user?.role === "aluno" || user?.role === "admin" || user?.role === "superadmin") && (
            <Link
              to="/competicoes"
              style={{
                ...navLinkStyle,
                backgroundColor: isActivePath(location.pathname, "/competicoes")
                  ? "rgba(255,255,255,0.12)"
                  : "transparent",
                borderLeft: isActivePath(location.pathname, "/competicoes")
                  ? `3px solid ${tokens.color.primary}`
                  : "3px solid transparent",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/competicoes")
                  ? "rgba(255,255,255,0.12)"
                  : "transparent";
              }}
            >
              Competições
            </Link>
          )}
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link
              to="/seminarios"
              style={{
                ...navLinkStyle,
                backgroundColor: isActivePath(location.pathname, "/seminarios")
                  ? "rgba(255,255,255,0.12)"
                  : "transparent",
                borderLeft: isActivePath(location.pathname, "/seminarios")
                  ? `3px solid ${tokens.color.primary}`
                  : "3px solid transparent",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/seminarios")
                  ? "rgba(255,255,255,0.12)"
                  : "transparent";
              }}
            >
              Seminários
            </Link>
          )}
          {user?.role === "aluno" && (
            <Link
              to="/configuracoes"
              style={{
                ...navLinkStyle,
                backgroundColor: isActivePath(location.pathname, "/configuracoes")
                  ? "rgba(255,255,255,0.12)"
                  : "transparent",
                borderLeft: isActivePath(location.pathname, "/configuracoes")
                  ? `3px solid ${tokens.color.primary}`
                  : "3px solid transparent",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/configuracoes")
                  ? "rgba(255,255,255,0.12)"
                  : "transparent";
              }}
            >
              Configurações
            </Link>
          )}
          {user?.role === "superadmin" && (
            <>
              <Link
                to="/dojos"
                style={{
                  ...navLinkStyle,
                  backgroundColor: isActivePath(location.pathname, "/dojos")
                    ? "rgba(255,255,255,0.12)"
                    : "transparent",
                  borderLeft: isActivePath(location.pathname, "/dojos")
                    ? `3px solid ${tokens.color.primary}`
                    : "3px solid transparent",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/dojos")
                    ? "rgba(255,255,255,0.12)"
                    : "transparent";
                }}
              >
                Dojos
              </Link>
              <Link
                to="/superadmin/professores"
                style={{
                  ...navLinkStyle,
                  backgroundColor: isActivePath(location.pathname, "/superadmin/professores")
                    ? "rgba(255,255,255,0.12)"
                    : "transparent",
                  borderLeft: isActivePath(location.pathname, "/superadmin/professores")
                    ? `3px solid ${tokens.color.primary}`
                    : "3px solid transparent",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/superadmin/professores")
                    ? "rgba(255,255,255,0.12)"
                    : "transparent";
                }}
              >
                Professores
              </Link>
              <Link
                to="/superadmin/alunos"
                style={{
                  ...navLinkStyle,
                  backgroundColor: isActivePath(location.pathname, "/superadmin/alunos")
                    ? "rgba(255,255,255,0.12)"
                    : "transparent",
                  borderLeft: isActivePath(location.pathname, "/superadmin/alunos")
                    ? `3px solid ${tokens.color.primary}`
                    : "3px solid transparent",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = isActivePath(location.pathname, "/superadmin/alunos")
                    ? "rgba(255,255,255,0.12)"
                    : "transparent";
                }}
              >
                Alunos
              </Link>
            </>
          )}
          {user?.role === "admin" && (
            <>
              {[
                { to: "/faixas", label: "Faixas & modalidades" },
                { to: "/mural", label: "Mural" },
                { to: "/students", label: "Alunos" },
                { to: "/habilidades", label: "Habilidades" },
                { to: "/turmas", label: "Turmas" },
                { to: "/check-ins", label: "Check-ins" },
              { to: "/financeiro", label: "Financeiro" },
                { to: "/configuracoes", label: "Configurações" },
              ].map(({ to, label }) => {
                const active = isActivePath(location.pathname, to);
                return (
                  <Link
                    key={to}
                    to={to}
                    style={{
                      ...navLinkStyle,
                      backgroundColor: active ? "rgba(255,255,255,0.12)" : "transparent",
                      borderLeft: active ? `3px solid ${tokens.color.primary}` : "3px solid transparent",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = active ? "rgba(255,255,255,0.12)" : "transparent";
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div
          style={{
            paddingTop: tokens.space.xl,
            paddingBottom: tokens.space.xl + tokens.space.lg,
            flexShrink: 0,
            marginTop: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={arenaMasterLogo}
            alt="Arena Master"
            style={{ width: "100%", maxWidth: 140, height: "auto", objectFit: "contain" }}
          />
        </div>
      </aside>
      <div
        style={{
          marginLeft: isMobile ? 0 : sidebarWidth + contentGap,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            height: headerHeight,
            borderBottom: `1px solid ${tokens.color.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 12px" : "0 24px",
            backgroundColor: "white",
            position: isMobile ? "sticky" : "static",
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setIsSidebarOpen(true)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.borderSubtle}`,
                  backgroundColor: "white",
                  color: tokens.color.textPrimary,
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ☰
              </button>
            )}
            <div style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user ? (
              <>
                Logado como <strong>{user.email}</strong> ({user.role})
              </>
            ) : (
              "Não autenticado"
            )}
            </div>
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
          className="am-admin-main"
          style={{
            flex: 1,
            padding: isMobile ? tokens.space.md : tokens.space.lg,
            paddingLeft: isMobile ? tokens.space.md : tokens.space.xl * 2,
            backgroundColor: "#f9fafb",
            overflow: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

