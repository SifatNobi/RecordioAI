import {
  createPublicClient,
  defineChain,
  formatUnits,
  http,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import {
  MONAD_EXPLORER_NAME,
  MONAD_EXPLORER_URL,
  MONAD_NATIVE_CURRENCY,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC_URL,
} from '@/constants/env';
import type { Conversation } from '@/types';

/**
 * Official Monad Testnet definition.
 * Chain ID 10143 / RPC https://testnet-rpc.monad.xyz verified against
 * https://docs.monad.xyz/developer-essentials/testnet
 */
const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { ...MONAD_NATIVE_CURRENCY },
  rpcUrls: { default: { http: [MONAD_TESTNET_RPC_URL] } },
  blockExplorers: {
    default: { name: MONAD_EXPLORER_NAME, url: MONAD_EXPLORER_URL },
  },
  testnet: true,
});

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_TESTNET_RPC_URL, {
    // Fail fast instead of hanging when the public RPC is degraded.
    timeout: 15_000,
    retryCount: 2,
    retryDelay: 750,
  }),
});

const PROOF_PREFIX = 'RECORDIOAI-PROOF-V1:';

export interface MonadProof {
  artifactHash: Hex;
  chainId: number;
  transactionHash: Hex;
  explorerUrl: string;
  verified: boolean;
  blockNumber: bigint;
}

export interface MonadProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export function parseChainId(value: unknown): number {
  const text = String(value);
  return text.toLowerCase().startsWith('0x')
    ? Number.parseInt(text, 16)
    : Number.parseInt(text, 10);
}

export async function ensureMonadNetwork(provider: MonadProvider): Promise<void> {
  const chainId = parseChainId(await provider.request({ method: 'eth_chainId' }));
  if (chainId === MONAD_TESTNET_CHAIN_ID) return;

  const chainParams = {
    chainId: `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}`,
    chainName: 'Monad Testnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: [MONAD_TESTNET_RPC_URL],
    blockExplorerUrls: [MONAD_EXPLORER_URL],
  };

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainParams.chainId }],
    });
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [chainParams],
    });
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainParams.chainId }],
    });
  }

  const confirmedChainId = parseChainId(await provider.request({ method: 'eth_chainId' }));
  if (confirmedChainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new Error('Wallet is not connected to Monad Testnet (chain 10143).');
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

export function hashArtifact(artifact: unknown): Hex {
  return keccak256(stringToHex(canonicalize(artifact)));
}

export function hashConversationArtifact(conversation: Pick<Conversation, 'transcript' | 'analysis' | 'customer' | 'duration' | 'startedAt'>): Hex {
  return hashArtifact({
    transcript: conversation.transcript?.fullText || '',
    analysis: conversation.analysis,
    recording: {
      recordingType: conversation.customer.metadata.recordingType,
      duration: conversation.duration,
      createdAt: conversation.startedAt,
    },
  });
}

export function proofData(artifactHash: Hex): Hex {
  return `${stringToHex(`${PROOF_PREFIX}${artifactHash}`)}` as Hex;
}

/** Tolerant hex -> ASCII decoder for the UTF-8 proof payload. Never throws. */
function hexToAscii(input: string): string | null {
  const clean = input.startsWith('0x') || input.startsWith('0X') ? input.slice(2) : input;
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    return null;
  }
  let decoded = '';
  for (let index = 0; index < clean.length; index += 2) {
    decoded += String.fromCharCode(Number.parseInt(clean.slice(index, index + 2), 16));
  }
  return decoded;
}

/**
 * Extracts the anchored artifact hash from transaction calldata.
 *
 * The on-chain payload is `RECORDIOAI-PROOF-V1:` followed by the artifact hash in
 * its canonical 0x-prefixed form, so the payload must be decoded before matching.
 * Returns null for any calldata that is not a RecordioAI proof.
 */
export function parseProofData(input: Hex): Hex | null {
  if (typeof input !== 'string' || !input.startsWith('0x')) return null;

  const payload = hexToAscii(input);
  if (!payload || !payload.startsWith(PROOF_PREFIX)) return null;

  const hash = payload.slice(PROOF_PREFIX.length);
  return /^0x[0-9a-fA-F]{64}$/.test(hash) ? (hash.toLowerCase() as Hex) : null;
}

/** Reads the chain ID reported by the configured RPC (10143 on Monad Testnet). */
export async function getMonadChainId(): Promise<number> {
  return publicClient.getChainId();
}

export interface MonadNetworkStatus {
  chainId: number;
  /** Live block height read from the configured RPC. */
  blockNumber: bigint;
  rpcUrl: string;
  explorerUrl: string;
  checkedAt: string;
}

/**
 * Reads the live chain ID and block height from the configured Monad Testnet RPC.
 * Throws when the endpoint is unreachable or reports a different chain, so callers
 * can never render stale or assumed values as live network data.
 */
export async function getMonadNetworkStatus(): Promise<MonadNetworkStatus> {
  const [chainId, blockNumber] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getBlockNumber(),
  ]);

  if (chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new Error(
      `RPC reported chain ${chainId}, expected Monad Testnet (${MONAD_TESTNET_CHAIN_ID}).`
    );
  }

  return {
    chainId,
    blockNumber,
    rpcUrl: MONAD_TESTNET_RPC_URL,
    explorerUrl: MONAD_EXPLORER_URL,
    checkedAt: new Date().toISOString(),
  };
}

/** Reads the native MON balance of a public address from Monad Testnet. */
export async function getMonadBalance(address: Address | string): Promise<bigint> {
  if (!isAddress(address)) {
    throw new Error('A valid address is required to read a Monad Testnet balance.');
  }
  return publicClient.getBalance({ address });
}

/** MON is an 18-decimal native currency; never present raw wei as a balance. */
export function formatMonadBalance(value: bigint): string {
  const formatted = formatUnits(value, MONAD_NATIVE_CURRENCY.decimals);
  const numeric = Number(formatted);
  if (!Number.isFinite(numeric)) return `${formatted} MON`;
  const decimals = numeric === 0 ? 4 : numeric < 0.0001 ? 8 : 4;
  return `${numeric.toFixed(decimals)} MON`;
}

/** Maps raw transport/wallet failures to messages that are true and actionable. */
export function describeMonadRpcError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message) return 'The Monad Testnet RPC returned an unexpected response.';

  if (/timed out|timeout|aborted/i.test(message)) {
    return 'Monad Testnet RPC timed out. Check your connection and retry.';
  }
  if (/network request failed|failed to fetch|ENOTFOUND|ECONNREFUSED|ECONNRESET|socket|offline/i.test(message)) {
    return 'Monad Testnet RPC is unreachable from this device. Check your connection and retry.';
  }
  if (/is not a function|unexpected token|cannot read|JSON/i.test(message)) {
    return 'The Monad Testnet RPC returned a malformed response.';
  }
  return message;
}

export { monadTestnet, publicClient };

export async function submitMonadProof(
  provider: MonadProvider,
  address: Address,
  artifactHash: Hex
): Promise<MonadProof> {
  await ensureMonadNetwork(provider);

  const transactionHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: address,
        to: address,
        value: '0x0',
        data: proofData(artifactHash),
      },
    ],
  })) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    throw new Error('Wallet returned an invalid Monad transaction hash.');
  }

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
    confirmations: 1,
    timeout: 180_000,
  });
  if (receipt.status !== 'success') {
    throw new Error('Monad Testnet rejected the proof transaction.');
  }

  const transaction = await publicClient.getTransaction({ hash: transactionHash });
  const recordedHash = parseProofData(transaction.input);
  if (recordedHash !== artifactHash) {
    throw new Error('The mined transaction did not contain the expected artifact proof.');
  }

  return {
    artifactHash,
    chainId: MONAD_TESTNET_CHAIN_ID,
    transactionHash,
    explorerUrl: `${MONAD_EXPLORER_URL.replace(/\/$/, '')}/tx/${transactionHash}`,
    verified: true,
    blockNumber: receipt.blockNumber,
  };
}

export async function verifyMonadProof(
  transactionHash: Hex,
  expectedArtifactHash: Hex
): Promise<{ verified: boolean; blockNumber: bigint }> {
  const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== 'success') {
    return { verified: false, blockNumber: receipt.blockNumber };
  }

  const transaction = await publicClient.getTransaction({ hash: transactionHash });
  return {
    verified: parseProofData(transaction.input) === expectedArtifactHash,
    blockNumber: receipt.blockNumber,
  };
}
