import api from "@/services/api";
import type { Settings, SettingsResponse, SettingsUpdate } from "@/types/domain";

export async function getSettings(): Promise<Settings> {
  const res = await api.get<SettingsResponse>("/settings");
  return res.data.settings;
}

// Partial update — send only the keys to change. Returns full merged settings.
export async function updateSettings(body: SettingsUpdate): Promise<Settings> {
  const res = await api.put<SettingsResponse>("/settings", body);
  return res.data.settings;
}
