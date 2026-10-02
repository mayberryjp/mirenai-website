import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type {
  Page,
  TrustedNetwork,
  TrustedNetworkCreate,
  TrustedNetworkList,
  TrustedNetworkResponse
} from "@/types/domain";

// Source subnets the resolver accepts queries from. CIDR is validated and
// canonicalized server-side (10.2.10.5/24 → 10.2.10.0/24); duplicates return 409.
// Envelope keys follow the rest of the service: trusted_network(s).
export async function listTrustedNetworks(
  limit?: number,
  offset?: number
): Promise<Page<TrustedNetwork>> {
  const res = await api.get<TrustedNetworkList>("/trusted-networks", { params: { limit, offset } });
  return { items: res.data.trusted_networks, total: res.data.total };
}

export async function getTrustedNetwork(id: number): Promise<TrustedNetwork> {
  const res = await api.get<TrustedNetworkResponse>(`/trusted-networks/${id}`);
  return res.data.trusted_network;
}

export async function createTrustedNetwork(body: TrustedNetworkCreate): Promise<TrustedNetwork> {
  const res = await api.post<TrustedNetworkResponse>("/trusted-networks", body);
  return res.data.trusted_network;
}

export async function deleteTrustedNetwork(id: number): Promise<number> {
  const res = await api.delete<DeleteResult>(`/trusted-networks/${id}`);
  return res.data.deleted;
}
