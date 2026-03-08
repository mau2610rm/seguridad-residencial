import axios, { AxiosError } from "axios";
import { getItem, setItem, removeItem, storageKeys } from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = storageKeys.TOKEN_KEY;
const REFRESH_KEY = storageKeys.REFRESH_KEY;

export async function getAccessToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await setItem(TOKEN_KEY, access);
  await setItem(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(REFRESH_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY);
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as { _retry?: boolean };
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await getRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(API_URL + "/auth/refresh", { refreshToken: refresh });
          await setItem(TOKEN_KEY, data.accessToken);
          if (original.headers) original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          await clearTokens();
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
