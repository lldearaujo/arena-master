import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { useAuthStore } from "../store/auth";

function resolveBaseUrl(): string {
  const trim = (u: string | undefined) => u?.replace(/\/+$/, "");
  const fromEnv = trim(process.env.EXPO_PUBLIC_API_URL);
  const fromEnvWeb = trim(process.env.EXPO_PUBLIC_API_URL_WEB);

  // Web no navegador compartilha a mesma variável EXPO_PUBLIC_API_URL que o Expo Go usa para a LAN.
  // Isso fazia o browser chamar 192.168.x.x:8000 onde frequentemente há *outro* processo (mesma porta),
  // gerando 404 em /api/... do Arena Master. Em dev, web usa localhost por padrão.
  if (Platform.OS === "web") {
    if (fromEnvWeb) {
      return fromEnvWeb;
    }
    if (__DEV__) {
      const local = "http://localhost:8000";
      if (fromEnv && fromEnv !== local && fromEnv !== "http://127.0.0.1:8000") {
        console.info(
          "[api] Web (dev): baseURL = %s — EXPO_PUBLIC_API_URL (%s) é ignorado no browser. " +
            "Use EXPO_PUBLIC_API_URL_WEB se precisar da API na LAN.",
          local,
          fromEnv,
        );
      }
      return local;
    }
    return fromEnv ?? "https://arenamasterbk.ideiasobria.online";
  }

  if (fromEnv) {
    return fromEnv;
  }

  // Em builds instalados (produção), `hostUri` normalmente não existe.
  // Usamos o backend público para evitar "Network Error" por fallback em localhost.
  if (!__DEV__) {
    return "https://arenamasterbk.ideiasobria.online";
  }

  // Em dispositivos/Expo Go, usamos o host do próprio servidor Metro/Expo.
  // SDKs mais recentes podem não preencher expoConfig.hostUri; então tentamos várias fontes.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).expoGoConfig?.debuggerHost ??
    // manifests antigos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).manifest?.debuggerHost ??
    // EAS updates / manifest2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    undefined;
  if (hostUri) {
    const host = String(hostUri).split(":")[0]; // "192.168.0.10:19000" -> "192.168.0.10"
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:8000`;
    }
  }

  // Fallback final
  return "http://localhost:8000";
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
});

/** Evita redirect 307 FastAPI que quebra CORS em chamadas `/api/foo` without slash. */
function withTrailingSlashAvoidRedirect(url: string | undefined): string | undefined {
  if (!url) return url;
  const qIdx = url.indexOf("?");
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const query = qIdx >= 0 ? url.slice(qIdx) : "";
  if (/^\/api\/[a-z0-9-]+$/i.test(path)) {
    return `${path}/${query}`;
  }
  return url;
}

api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = withTrailingSlashAvoidRedirect(config.url) ?? config.url;
  }
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    // Axios v1 tipa headers como AxiosHeaders; fazemos merge e forçamos o tipo.
    config.headers = ({
      ...(config.headers as any),
      Authorization: `Bearer ${tokens.accessToken}`,
    } as any);
  }
  return config;
});

const SESSION_KEY = "arena-master-session";
const SESSION_KEY_ASYNC = "arena-master-session-async";

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // SecureStore pode falhar (ex.: limite ~2KB no iOS); grava no AsyncStorage
  }
  await AsyncStorage.setItem(SESSION_KEY_ASYNC, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(key);
  }
  let raw = await SecureStore.getItemAsync(key);
  if (raw) return raw;
  raw = await AsyncStorage.getItem(SESSION_KEY_ASYNC);
  return raw;
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignora
  }
  await AsyncStorage.removeItem(SESSION_KEY_ASYNC);
}

export async function persistSession() {
  const state = useAuthStore.getState();
  if (!state.tokens || !state.user) return;
  // Evita armazenar avatares enormes (data URL) no SecureStore, que tem limite ~2KB.
  // O avatar completo continua vindo do backend em /api/users/me.
  const user = state.user;
  const safeUser =
    user.avatarUrl &&
    typeof user.avatarUrl === "string" &&
    user.avatarUrl.startsWith("data:") &&
    user.avatarUrl.length > 2000
      ? { ...user, avatarUrl: null }
      : user;
  await setItem(
    SESSION_KEY,
    JSON.stringify({
      tokens: state.tokens,
      user: safeUser,
    }),
  );
}

export async function clearPersistedSession() {
  await deleteItem(SESSION_KEY);
}

export async function clearSessionSafely() {
  try {
    await clearPersistedSession();
  } catch {
    // Não bloqueia o logoff se storage local falhar.
  }
  useAuthStore.getState().clearSession();
}

export async function restoreSession() {
  const raw = await getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      tokens: { accessToken: string; refreshToken: string };
      user: { id: number; email: string; role: string; dojoId: number | null; avatarUrl?: string | null };
    };
    useAuthStore.setState({
      tokens: parsed.tokens,
      user: parsed.user as any,
    });
  } catch {
    await clearPersistedSession();
  }
}

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    role: string;
    dojo_id: number | null;
    avatar_url?: string | null;
  };
};

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
  config: AxiosRequestConfig;
}[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
      return;
    }
    if (token) {
      prom.config.headers = {
        ...prom.config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    api.request(prom.config).then(prom.resolve).catch(prom.reject);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      !originalRequest.url
    ) {
      return Promise.reject(error);
    }

    const { tokens, user } = useAuthStore.getState();
    if (!tokens?.refreshToken || !user) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    isRefreshing = true;

    try {
      const res = await api.post<RefreshResponse>("/api/auth/refresh", {
        refresh_token: tokens.refreshToken,
      });

      const newTokens = {
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
      };

      useAuthStore.getState().setSession(newTokens, {
        id: res.data.user.id,
        email: res.data.user.email,
        role: res.data.user.role as any,
        dojoId: res.data.user.dojo_id,
        avatarUrl: res.data.user.avatar_url ?? null,
      });
      await persistSession();

      const newAccessToken = newTokens.accessToken;
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newAccessToken}`,
      };

      processQueue(null, newAccessToken);

      return api.request(originalRequest);
    } catch (refreshError) {
      await clearSessionSafely();
      processQueue(refreshError, null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

