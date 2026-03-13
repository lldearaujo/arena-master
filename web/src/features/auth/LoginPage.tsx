import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { api } from "../../api/client";
import { useAuthStore, Role } from "../../store/auth";
import { tokens } from "../../ui/tokens";

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

      const tokens = {
        accessToken: loginRes.data.access_token,
        refreshToken: loginRes.data.refresh_token,
      };

      setSession(tokens, {
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
        maxWidth: 360,
        margin: "80px auto",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.sm }}>
        Arena Master
      </h1>
      <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.lg }}>
        Entrar no painel
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: tokens.space.sm,
              marginTop: tokens.space.xs,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
            }}
          />
        </label>
        <label>
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: tokens.space.sm,
              marginTop: tokens.space.xs,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
            }}
          />
        </label>
        {error && (
          <div style={{ color: tokens.color.error, fontSize: tokens.text.sm }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          style={{
            padding: `${tokens.space.sm + 2}px ${tokens.space.lg}px`,
            marginTop: tokens.space.sm,
            backgroundColor: tokens.color.primary,
            color: tokens.color.textOnPrimary,
            borderRadius: tokens.radius.md,
            border: "none",
            cursor: "pointer",
          }}
        >
          {mutation.isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

