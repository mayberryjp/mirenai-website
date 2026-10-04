import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type {
  LocalRecord,
  LocalRecordList,
  LocalZone,
  LocalZoneCreate,
  LocalZoneList,
  LocalZoneResponse,
  Page
} from "@/types/domain";

// GET /local-zones — configured remote zone files, newest-highest id first.
export async function listLocalZones(limit?: number, offset?: number): Promise<Page<LocalZone>> {
  const res = await api.get<LocalZoneList>("/local-zones", { params: { limit, offset } });
  return { items: res.data.local_zones, total: res.data.total };
}

export async function createLocalZone(body: LocalZoneCreate): Promise<LocalZone> {
  const res = await api.post<LocalZoneResponse>("/local-zones", body);
  return res.data.local_zone;
}

export async function deleteLocalZone(id: number): Promise<number> {
  const res = await api.delete<DeleteResult>(`/local-zones/${id}`);
  return res.data.deleted;
}

// POST /local-zones/{id}/refresh — forced synchronous download + reparse; may take
// seconds. Returns the updated zone; 502 download_failed carries a detail string.
export async function refreshLocalZone(id: number): Promise<LocalZone> {
  const res = await api.post<LocalZoneResponse>(`/local-zones/${id}/refresh`);
  return res.data.local_zone;
}

// GET /local-records — merged records across every zone, each tagged with zone_name.
// Optional ?search= (matches name or value) and ?type= (case-insensitive) filters.
export async function listLocalRecords(search?: string, type?: string): Promise<Page<LocalRecord>> {
  const res = await api.get<LocalRecordList>("/local-records", { params: { search, type } });
  return { items: res.data.records, total: res.data.total };
}
