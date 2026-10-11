import { api } from '@/services/api';
import { getDeviceSessionToken, clearDeviceSessionToken } from '@/services/auth/deviceSession';
import type { Hex } from 'viem';

interface RelayerResponse {
  status: 'verified';
  artifact_hash: Hex;
  transaction_hash: Hex;
  chain_id: number;
  block_number: number;
  explorer_url: string;
}

export async function submitProvenanceViaRelayer(
  artifactHash: Hex,
  idempotencyKey: string
): Promise<RelayerResponse> {
  let token = await getDeviceSessionToken();
  try {
    return await api.post<RelayerResponse>(
      '/provenance/submit',
      { artifact_hash: artifactHash, idempotency_key: idempotencyKey },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 401) {
      await clearDeviceSessionToken();
      token = await getDeviceSessionToken();
      return api.post<RelayerResponse>(
        '/provenance/submit',
        { artifact_hash: artifactHash, idempotency_key: idempotencyKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
    throw error;
  }
}
