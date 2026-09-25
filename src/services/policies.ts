import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type {
  Page,
  Policy,
  PolicyCreate,
  PolicyList,
  PolicyResponse,
  PolicyUpdate
} from "@/types/domain";

// Omitting limit/offset returns all rows (axios drops undefined params). See spec §5.
export async function listPolicies(limit?: number, offset?: number): Promise<Page<Policy>> {
  const res = await api.get<PolicyList>("/policies", { params: { limit, offset } });
  return { items: res.data.policies, total: res.data.total };
}

export async function getPolicy(id: number): Promise<Policy> {
  const res = await api.get<PolicyResponse>(`/policies/${id}`);
  return res.data.policy;
}

export async function createPolicy(body: PolicyCreate): Promise<Policy> {
  const res = await api.post<PolicyResponse>("/policies", body);
  return res.data.policy;
}

export async function updatePolicy(id: number, body: PolicyUpdate): Promise<Policy> {
  const res = await api.put<PolicyResponse>(`/policies/${id}`, body);
  return res.data.policy;
}

export async function deletePolicy(id: number): Promise<number> {
  const res = await api.delete<DeleteResult>(`/policies/${id}`);
  return res.data.deleted;
}
