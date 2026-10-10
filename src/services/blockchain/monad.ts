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

function proofData(artifactHash: Hex): Hex {
  return `${stringToHex(`${PROOF_PREFIX}${artifactHash}`)}` as Hex;
}

function parseProofData(input: Hex): Hex | null {
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
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  address: Address,
  artifactHash: Hex
): Promise<MonadProof> {
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (Number.parseInt(String(chainId), 16) !== MONAD_TESTNET_CHAIN_ID) {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}` }],
    });
  }

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
