import axios from "axios";
import type { ApiErrorCode } from "@/types/api";

export type ApiErrorKind = ApiErrorCode | "network" | "timeout" | "unknown";

export interface NormalizedApiError {
  code: ApiErrorKind;
  message: string;
  detail?: string;
}

// Normalize any thrown error into the mirenai envelope shape. Callers should
// branch on `code` (stable), not the human-readable `message` (spec §4, §10).
export function getApiError(err: unknown): NormalizedApiError {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") {
      return { code: "timeout", message: "Request timed out" };
    }
    if (!err.response) {
      return { code: "network", message: "Network unavailable" };
    }
    const data = err.response.data as
      | { code?: ApiErrorCode; error?: string; detail?: string }
      | undefined;
    if (data?.code) {
      return { code: data.code, message: data.error ?? "Request failed", detail: data.detail };
    }
    return { code: "unknown", message: `HTTP ${err.response.status}` };
  }
  return { code: "unknown", message: err instanceof Error ? err.message : "Unknown error" };
}

// Friendly one-line message including validation/download detail when present.
export function apiErrorMessage(err: unknown): string {
  const e = getApiError(err);
  return e.detail ? `${e.message}: ${e.detail}` : e.message;
}
