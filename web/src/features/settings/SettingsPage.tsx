import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";

type UserMe = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  dojo_id: number | null;
  avatar_url: string | null;
  graduacao?: string | null;
  fcm_token?: string | null;
};

type Dojo = {
  id: number;
  name: string;
  slug: string;
  localidade: string | null;
  contato: string | null;
  logo_url: string | null;
  active: boolean;
};

const MAX_AVATAR_BYTES = 280_000; // ~280KB base64

export function SettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [nameValue, setNameValue] = useState<string>("");
  const [fcmValue, setFcmValue] = useState<string>("");

  const { data: user } = useQuery({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await api.get<UserMe>("/api/users/me");
      return res.data;
    },
  });

  const { data: dojo, isLoading, error } = useQuery({
    queryKey: ["dojo", "me"],
    queryFn: async () => {
      const res = await api.get<Dojo>("/api/dojos/me");
      return res.data;
    },
    enabled: user?.role === "admin",
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<Dojo>("/api/dojos/me/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dojo", "me"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["dojo", "me"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await api.patch("/api/dojos/me", { logo_url: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dojo", "me"] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: { name?: string; avatar_url?: string | null; fcm_token?: string | null }) => {
      const res = await api.patch<UserMe>("/api/users/me", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-me"] });
    },
  });

  const handleProfessorNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== (user?.name ?? "")) {
      updateUserMutation.mutate({ name: trimmed });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl.length > MAX_AVATAR_BYTES) {
        return; // Silently skip, or could show error
      }
      updateUserMutation.mutate({ avatar_url: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    updateUserMutation.mutate({ avatar_url: null });
  };

  useEffect(() => {
    if (user?.name !== undefined) setNameValue(user.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    if (user?.fcm_token !== undefined) setFcmValue(user.fcm_token ?? "");
  }, [user?.fcm_token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  const cardStyle = {
    padding: tokens.space.xl,
    backgroundColor: "white",
    borderRadius: tokens.radius.lg,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: `1px solid ${tokens.color.borderSubtle}`,
  };

  const inputStyle = {
    display: "none" as const,
  };

  const btnPrimary = {
    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
    backgroundColor: tokens.color.primary,
    color: tokens.color.textOnPrimary,
    borderRadius: tokens.radius.md,
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: tokens.text.sm,
  };

  const btnSecondary = {
    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
    backgroundColor: "white",
    color: tokens.color.textPrimary,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.borderSubtle}`,
    cursor: "pointer",
    fontSize: tokens.text.sm,
  };

  const btnDanger = {
    ...btnSecondary,
    borderColor: tokens.color.error,
    color: tokens.color.error,
  };

  const resolveAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith("data:") || url.startsWith("http")) return url;
    const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.xl, fontWeight: 600 }}>
        Configurações
      </h1>

      {/* Dados do utilizador */}
      <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
        <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.lg, fontWeight: 600 }}>
          {user?.role === "aluno" ? "Minha conta" : "Dados do Professor"}
        </h2>
        {user ? (
          <>
            <div style={{ display: "flex", gap: tokens.space.xl, alignItems: "flex-start", marginBottom: tokens.space.xl }}>
              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleAvatarChange}
                  style={inputStyle}
                />
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    backgroundColor: tokens.color.borderSubtle,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {user.avatar_url ? (
                    <img
                      src={resolveAvatarUrl(user.avatar_url)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>👤</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: tokens.space.sm, marginTop: tokens.space.sm }}>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={updateUserMutation.isPending}
                    style={{
                      ...btnSecondary,
                      opacity: updateUserMutation.isPending ? 0.7 : 1,
                      fontSize: tokens.text.xs,
                    }}
                  >
                    {user.avatar_url ? "Trocar" : "Enviar foto"}
                  </button>
                  {user.avatar_url && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={updateUserMutation.isPending}
                      style={{
                        ...btnDanger,
                        opacity: updateUserMutation.isPending ? 0.7 : 1,
                        fontSize: tokens.text.xs,
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <form onSubmit={handleProfessorNameSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.space.md }}>
                  <label style={{ fontSize: tokens.text.sm, fontWeight: 500, color: tokens.color.textMuted }}>
                    Nome
                  </label>
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    placeholder="Seu nome"
                    style={{
                      padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      fontSize: tokens.text.sm,
                    }}
                  />
                  <label style={{ fontSize: tokens.text.sm, fontWeight: 500, color: tokens.color.textMuted }}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    disabled
                    style={{
                      padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderSubtle}`,
                      fontSize: tokens.text.sm,
                      backgroundColor: tokens.color.bgBody,
                      color: tokens.color.textMuted,
                      cursor: "not-allowed",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={
                      updateUserMutation.isPending ||
                      nameValue.trim() === (user.name ?? "") ||
                      !nameValue.trim()
                    }
                    style={{
                      ...btnPrimary,
                      opacity:
                        updateUserMutation.isPending ||
                        nameValue.trim() === (user.name ?? "") ||
                        !nameValue.trim()
                          ? 0.6
                          : 1,
                      alignSelf: "flex-start",
                    }}
                  >
                    {updateUserMutation.isPending ? "Salvando..." : "Salvar alterações"}
                  </button>
                </form>
              </div>
            </div>
            {updateUserMutation.isError && (
              <p style={{ color: tokens.color.error, fontSize: tokens.text.sm, marginTop: tokens.space.sm }}>
                {axios.isAxiosError(updateUserMutation.error) &&
                typeof updateUserMutation.error.response?.data?.detail === "string"
                  ? updateUserMutation.error.response.data.detail
                  : "Erro ao salvar dados."}
              </p>
            )}
          </>
        ) : (
          <p style={{ color: tokens.color.textMuted }}>Carregando...</p>
        )}
      </section>

      {(user?.role === "aluno" || user?.role === "admin") && (
        <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.lg, fontWeight: 600 }}>
            Notificações push (FCM)
          </h2>
          <p style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted, marginBottom: tokens.space.md }}>
            Cole o token do dispositivo (Expo / Firebase) para receber avisos de competição no telemóvel.
          </p>
          <textarea
            value={fcmValue}
            onChange={(e) => setFcmValue(e.target.value)}
            placeholder="Token FCM…"
            rows={3}
            style={{
              width: "100%",
              padding: tokens.space.md,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              fontSize: tokens.text.sm,
              fontFamily: "monospace",
            }}
          />
          <button
            type="button"
            style={{ ...btnPrimary, marginTop: tokens.space.md }}
            onClick={() => updateUserMutation.mutate({ fcm_token: fcmValue.trim() || null })}
            disabled={updateUserMutation.isPending}
          >
            Guardar token
          </button>
        </section>
      )}

      {user?.role === "admin" && (
      <section style={{ ...cardStyle, marginBottom: tokens.space.xl }}>
        <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.lg, fontWeight: 600 }}>
          Logo do Dojo
        </h2>
        {isLoading && <p style={{ color: tokens.color.textMuted }}>Carregando...</p>}
        {error && (
          <p style={{ color: tokens.color.error }}>
            Erro ao carregar dados do dojo.
          </p>
        )}
        {dojo && (
          <>
            {dojo.logo_url && (
              <div
                style={{
                  marginBottom: tokens.space.lg,
                  padding: tokens.space.md,
                  backgroundColor: tokens.color.bgBody,
                  borderRadius: tokens.radius.md,
                  display: "inline-block",
                }}
              >
                <img
                  src={
                    dojo.logo_url.startsWith("http")
                      ? dojo.logo_url
                      : `${api.defaults.baseURL?.replace(/\/$/, "")}${dojo.logo_url.startsWith("/") ? "" : "/"}${dojo.logo_url}`
                  }
                  alt={`Logo do ${dojo.name}`}
                  style={{
                    maxWidth: 200,
                    maxHeight: 120,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.md }}>
              <div style={{ display: "flex", gap: tokens.space.sm, flexWrap: "wrap" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  style={{
                    ...btnPrimary,
                    opacity: uploadMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {uploadMutation.isPending ? "Enviando..." : dojo.logo_url ? "Trocar logo" : "Enviar logo"}
                </button>
                {dojo.logo_url && (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                    style={{
                      ...btnDanger,
                      opacity: removeMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {removeMutation.isPending ? "Removendo..." : "Remover logo"}
                  </button>
                )}
              </div>
              <p style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>
                Formatos aceitos: PNG, JPG ou WebP. Tamanho máximo: 5MB.
              </p>
              {uploadMutation.isError && (
                <p style={{ color: tokens.color.error, fontSize: tokens.text.sm }}>
                  {axios.isAxiosError(uploadMutation.error) &&
                  typeof uploadMutation.error.response?.data?.detail === "string"
                    ? uploadMutation.error.response.data.detail
                    : "Erro ao enviar logo."}
                </p>
              )}
            </div>
          </>
        )}
      </section>
      )}
    </div>
  );
}
