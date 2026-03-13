import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "../store/auth";

export const api = axios.create({
  baseURL: "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${tokens.accessToken}`,
    };
  }
  return config;
});

const SESSION_KEY = "arena-master-session";

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function persistSession() {
  const state = useAuthStore.getState();
  if (!state.tokens || !state.user) return;
  await setItem(
    SESSION_KEY,
    JSON.stringify({
      tokens: state.tokens,
      user: state.user,
    }),
  );
}

export async function clearPersistedSession() {
  await deleteItem(SESSION_KEY);
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
      user: parsed.user,
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
      await clearPersistedSession();
      useAuthStore.getState().clearSession();
      processQueue(refreshError, null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

