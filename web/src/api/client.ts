import axios, { AxiosError } from "axios";
import { useAuthStore } from "../store/auth";

// URL base da API:
// - Em DEV: por padrão usamos o backend local (uvicorn na :8000), sem forçar HTTPS.
// - Em PROD: por padrão usamos o domínio de produção com HTTPS (evita Mixed Content).
const rawBaseURL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://arenamasterbk.ideiasobria.online");

// Em produção, garantimos HTTPS. Em dev, preservamos (geralmente é http://localhost).
const apiBaseURL =
  !import.meta.env.DEV && rawBaseURL.startsWith("http://")
    ? rawBaseURL.replace(/^http:\/\//i, "https://")
    : rawBaseURL;

export const api = axios.create({
  baseURL: apiBaseURL,
});

type TokenPairResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    role: "superadmin" | "admin" | "aluno";
    dojo_id: number | null;
  };
};

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: AxiosError | null, newAccessToken: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(newAccessToken);
    }
  });
  failedQueue = [];
}

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

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const isRefreshRequest = originalRequest.url?.includes("/api/auth/refresh");
    if (isRefreshRequest) {
      useAuthStore.getState().clearSession();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().tokens?.refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().clearSession();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api.request(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<TokenPairResponse>(
        `${api.defaults.baseURL}/api/auth/refresh`,
        { refresh_token: refreshToken }
      );

      const { setSession } = useAuthStore.getState();
      setSession(
        {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        },
        {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          dojoId: data.user.dojo_id,
        }
      );

      processQueue(null, data.access_token);
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      }
      return api.request(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError);
      useAuthStore.getState().clearSession();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
