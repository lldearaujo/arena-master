import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore, Role } from "../../store/auth";
import { tokens } from "../../ui/tokens";
import arenaMasterLogo from "../../assets/arena-master-logo.png";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    role: Role;
    dojo_id: number | null;
  };
};

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
  fontSize: tokens.text.md,
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.borderSubtle}`,
  backgroundColor: "#fff",
  color: tokens.color.textPrimary,
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  boxSizing: "border-box",
};

export function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const loginRes = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password,
      });

      const authTokens = {
        accessToken: loginRes.data.access_token,
        refreshToken: loginRes.data.refresh_token,
      };

      setSession(authTokens, {
        id: loginRes.data.user.id,
        email: loginRes.data.user.email,
        role: loginRes.data.user.role,
        dojoId: loginRes.data.user.dojo_id,
      });
    },
    onSuccess: () => {
      navigate("/dashboard", { replace: true });
    },
    onError: () => {
      setError("Falha ao entrar. Verifique suas credenciais.");
    },
  });

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  };

  if (user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: tokens.color.bgBody,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.space.xl,
        boxSizing: "border-box",
      }}
    >
      <Link
        to="/"
        style={{
          position: "absolute",
          top: tokens.space.xl,
          left: tokens.space.xl,
          color: tokens.color.textMuted,
          fontSize: tokens.text.sm,
          textDecoration: "none",
        }}
      >
        ← Voltar ao site
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#fff",
          borderRadius: tokens.radius.lg,
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
          border: `1px solid ${tokens.color.borderSubtle}`,
          padding: tokens.space.xl * 1.5,
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: tokens.space.xl }}>
          <img
            src={arenaMasterLogo}
            alt="Arena Master"
            style={{ height: 160, width: "auto", display: "block", margin: "0 auto" }}
          />
          <p
            style={{
              fontSize: tokens.text.sm,
              color: tokens.color.textMuted,
              margin: 0,
              marginTop: tokens.space.lg,
            }}
          >
            Entrar no painel administrador
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.lg,
          }}
        >
          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: tokens.text.sm,
                fontWeight: 600,
                color: tokens.color.textPrimary,
                marginBottom: tokens.space.xs,
              }}
            >
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              style={inputBaseStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tokens.color.primary;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.color.primary}40`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = tokens.color.borderSubtle;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </label>

          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: tokens.text.sm,
                fontWeight: 600,
                color: tokens.color.textPrimary,
                marginBottom: tokens.space.xs,
              }}
            >
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputBaseStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tokens.color.primary;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.color.primary}40`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = tokens.color.borderSubtle;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </label>

          {error && (
            <div
              style={{
                padding: tokens.space.md,
                fontSize: tokens.text.sm,
                color: tokens.color.error,
                backgroundColor: `${tokens.color.error}12`,
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.error}30`,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              marginTop: tokens.space.sm,
              padding: `${tokens.space.md}px ${tokens.space.xl}px`,
              fontSize: tokens.text.md,
              fontWeight: 600,
              color: tokens.color.textOnPrimary,
              backgroundColor: tokens.color.primary,
              border: "none",
              borderRadius: tokens.radius.md,
              cursor: mutation.isPending ? "not-allowed" : "pointer",
              opacity: mutation.isPending ? 0.8 : 1,
              transition: "background-color 0.2s ease, transform 0.1s ease",
            }}
            onMouseOver={(e) => {
              if (!mutation.isPending) {
                e.currentTarget.style.backgroundColor = tokens.color.primaryDark;
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = tokens.color.primary;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {mutation.isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div
          style={{
            marginTop: tokens.space.xl,
            borderTop: `1px solid ${tokens.color.borderSubtle}`,
            paddingTop: tokens.space.lg,
            textAlign: "center",
          }}
        >
          <a
            href="https://wa.me/558399468978"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: `${tokens.space.sm}px ${tokens.space.xl}px`,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.primary}`,
              backgroundColor: "#fff",
              color: tokens.color.primaryDark,
              fontSize: tokens.text.sm,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = tokens.color.primary;
              e.currentTarget.style.color = tokens.color.textOnPrimary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
              e.currentTarget.style.color = tokens.color.primaryDark;
            }}
          >
            Suporte
          </a>
        </div>
      </div>
    </div>
  );
}
