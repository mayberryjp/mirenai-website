import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type {
  Page,
  Upstream,
  UpstreamCreate,
  UpstreamList,
  UpstreamResponse,
  UpstreamUpdate
} from "@/types/domain";

export async function listUpstreams(limit?: number, offset?: number): Promise<Page<Upstream>> {
  const res = await api.get<UpstreamList>("/upstreams", { params: { limit, offset } });
  return { items: res.data.upstreams, total: res.data.total };
}

export async function getUpstream(id: number): Promise<Upstream> {
  const res = await api.get<UpstreamResponse>(`/upstreams/${id}`);
  return res.data.upstream;
}

export async function createUpstream(body: UpstreamCreate): Promise<Upstream> {
  const res = await api.post<UpstreamResponse>("/upstreams", body);
  return res.data.upstream;
}

export async function updateUpstream(id: number, body: UpstreamUpdate): Promise<Upstream> {
  const res = await api.put<UpstreamResponse>(`/upstreams/${id}`, body);
  return res.data.upstream;
}

export async function deleteUpstream(id: number): Promise<number> {
  const res = await api.delete<DeleteResult>(`/upstreams/${id}`);
  return res.data.deleted;
}
