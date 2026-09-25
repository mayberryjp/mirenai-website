import api from "@/services/api";
import type { ErrorEnvelope, OkEnvelope } from "@/types/api";
import type { HealthResponse } from "@/types/domain";

export async function getHealth(): Promise<HealthResponse> {
  const res = await api.get<HealthResponse>("/health");
  return res.data;
}

export interface ReadyState {
  ready: boolean;
  detail?: string;
}

// /ready returns 200 when the database is reachable, 503 otherwise.
export async function getReady(): Promise<ReadyState> {
  const res = await api.get<OkEnvelope | ErrorEnvelope>("/ready", {
    validateStatus: (s) => s === 200 || s === 503
  });
  if (res.status === 200) {
    return { ready: true };
  }
  return { ready: false, detail: (res.data as ErrorEnvelope).error };
}
