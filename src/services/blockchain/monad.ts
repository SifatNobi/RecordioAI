import {
  createPublicClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import {
  MONAD_EXPLORER_URL,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC_URL,
} from '@/constants/env';

const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_TESTNET_RPC_URL] } },
});

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_TESTNET_RPC_URL),
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

export function proofData(artifactHash: Hex): Hex {
  return `${stringToHex(`${PROOF_PREFIX}${artifactHash}`)}` as Hex;
}

export function parseProofData(input: Hex): Hex | null {
  const prefixHex = stringToHex(PROOF_PREFIX).slice(2);
  const inputHex = input.slice(2);
  if (!inputHex.startsWith(prefixHex)) {
    return null;
  }

  const hash = inputHex.slice(prefixHex.length);
  return hash.length === 64 ? (`0x${hash}` as Hex) : null;
}

export async function getMonadChainId(): Promise<number> {
  return publicClient.getChainId();
}

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
