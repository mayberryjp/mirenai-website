import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type { Page, QueryList, QueryLog } from "@/types/domain";

export async function listQueries(limit?: number, offset?: number): Promise<Page<QueryLog>> {
  const res = await api.get<QueryList>("/queries", { params: { limit, offset } });
  return { items: res.data.queries, total: res.data.total };
}

// Clears the entire query log; returns the number of rows removed. Guard with confirm.
export async function clearQueries(): Promise<number> {
  const res = await api.delete<DeleteResult>("/queries");
  return res.data.deleted;
}
