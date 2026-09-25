import axios, { AxiosError } from "axios";

// In containers this builds as the MIRENAI_API_BASE_URL placeholder that env.sh
// rewrites at startup; locally it falls back to the dev API origin.
const envBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
// mirenai paths are used exactly (e.g. /policies) — no /api prefix.
const baseURL = envBase.replace(/\/+$/, "");

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "auth"
  | "validation"
  | "server"
  | "unknown";

export function classifyApiError(err: unknown): { kind: ApiErrorKind; message: string } {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; detail?: string }>;
    if (e.code === "ECONNABORTED") return { kind: "timeout", message: "Request timed out" };
    if (!e.response) return { kind: "network", message: "Network unavailable" };
    if (e.response.status === 401 || e.response.status === 403) return { kind: "auth", message: "Access denied" };
    if (e.response.status === 422) return { kind: "validation", message: e.response.data?.detail || "Validation error" };
    if (e.response.status >= 500) return { kind: "server", message: "Server error" };
  }
  return { kind: "unknown", message: err instanceof Error ? err.message : "Unknown error" };
}

export default api;
