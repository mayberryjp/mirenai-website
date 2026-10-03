import api from "@/services/api";
import type { ForeignClient, ForeignClientList, Page } from "@/types/domain";

// Denied foreign (untrusted-source) clients, ordered by last_seen desc.
// GET /foreign-clients is paginated; omitting limit/offset returns the default page.
export async function listForeignClients(
  limit?: number,
  offset?: number
): Promise<Page<ForeignClient>> {
  const res = await api.get<ForeignClientList>("/foreign-clients", {
    params: { limit, offset }
  });
  return { items: res.data.foreign_clients, total: res.data.total };
}
