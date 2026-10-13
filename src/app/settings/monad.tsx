import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Caption, H1, H2 } from '@/components/Typography';
import { Theme } from '@/constants/theme';
import { MONAD_TESTNET_CHAIN_ID, MONAD_TESTNET_RPC_URL } from '@/constants/env';
import {
  describeMonadRpcError,
  ensureMonadNetwork,
  formatMonadBalance,
  getMonadBalance,
  getMonadNetworkStatus,
  hashArtifact,
  submitMonadProof,
  verifyMonadProof,
  type MonadNetworkStatus,
  type MonadProof,
} from '@/services/blockchain/monad';
import { isAddress, type Hex } from 'viem';
import { useAppStore } from '@/store/appStore';
import type { Conversation } from '@/types';

// NOTE: The WalletConnect SDK is intentionally never statically imported in
// this file. It is resolved lazily inside OptionalWalletSection so that a
// missing or incompatible optional wallet build can never break app startup
// or the production JS bundle evaluation. Automatic provenance uses the
// backend relayer and does not need a wallet.
interface WalletHookState {
  open: () => Promise<unknown>;
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null;
  address?: string;
  isConnected: boolean;
}

type WalletHookFn = () => WalletHookState;

export default function MonadProvenanceScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const conversation = useAppStore((state) =>
    conversationId ? state.conversations.find((item) => item.id === conversationId) : undefined
  );
  const [reference, setReference] = useState(conversation?.id || '');
  const [artifactText, setArtifactText] = useState(conversation?.transcript?.fullText || '');
  const [networkStatus, setNetworkStatus] = useState<MonadNetworkStatus | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkLoading, setNetworkLoading] = useState(true);

  // Pure fetcher: never touches component state, so effects cannot cascade renders.
  const fetchNetworkStatus = React.useCallback(async () => {
    try {
      return { status: await getMonadNetworkStatus(), error: null as string | null };
    } catch (error) {
      return { status: null, error: describeMonadRpcError(error) };
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchNetworkStatus();
      if (cancelled) return;
      setNetworkStatus(result.status);
      setNetworkError(result.error);
      setNetworkLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchNetworkStatus]);

  const refreshNetworkStatus = React.useCallback(() => {
    setNetworkLoading(true);
    void (async () => {
      const result = await fetchNetworkStatus();
      setNetworkStatus(result.status);
      setNetworkError(result.error);
      setNetworkLoading(false);
    })();
  }, [fetchNetworkStatus]);

  const artifactHash = useMemo(() => {
    if (!reference.trim() || !artifactText.trim()) return null;
    return hashArtifact({
      reference: reference.trim(),
      artifact: artifactText,
    });
  }, [reference, artifactText]);

  React.useEffect(() => {
    if (!conversation) return;
    const timeoutId = setTimeout(() => {
      setReference(conversation.id);
      setArtifactText(conversation.transcript?.fullText || '');
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [conversation]);

  const pasteClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setArtifactText(text);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <H1 weight="bold" color="textPrimary">Monad Provenance</H1>
      <Body color="textSecondary" style={styles.subtitle}>
        Record only a cryptographic fingerprint on Monad Testnet. The artifact text never leaves this device.
      </Body>

      <Card variant="outlined" padding="md" style={styles.card}>
        <View style={styles.statusHeader}>
          <Caption color="warning" weight="semiBold">
            LIVE NETWORK • MONAD TESTNET • CHAIN {MONAD_TESTNET_CHAIN_ID}
          </Caption>
          <Button variant="ghost" size="sm" onPress={refreshNetworkStatus} loading={networkLoading}>
            Refresh
          </Button>
        </View>
        <Caption color="textMuted" numberOfLines={2}>
          RPC: {networkStatus?.rpcUrl || MONAD_TESTNET_RPC_URL}
        </Caption>

        {networkLoading && !networkStatus && !networkError ? (
          <Caption color="textSecondary">Contacting the Monad Testnet RPC…</Caption>
        ) : null}

        {networkError ? (
          <>
            <Caption color="error">{networkError}</Caption>
            <Button
              variant="outline"
              fullWidth
              onPress={refreshNetworkStatus}
              loading={networkLoading}
              style={styles.button}
            >
              Retry RPC Check
            </Button>
          </>
        ) : null}

        {networkStatus ? (
          <View style={styles.statusRows}>
            <StatusRow label="Reported chain ID" value={String(networkStatus.chainId)} />
            <StatusRow label="Latest block" value={networkStatus.blockNumber.toString()} />
          </View>
        ) : null}

        <Caption color="textMuted">
          Values above are read live from the public Monad Testnet RPC. MON is testnet currency with no
          market value and cannot be exchanged for real money.
        </Caption>
      </Card>

      <Card variant="outlined" padding="md" style={styles.card}>
        <Caption color="warning" weight="semiBold">ANCHOR A PROOF • CHAIN {MONAD_TESTNET_CHAIN_ID}</Caption>
        <H2 weight="semiBold" color="textPrimary" style={styles.cardTitle}>1. Prepare an artifact</H2>
        <TextInput
          value={reference}
          onChangeText={setReference}
          placeholder="Artifact reference or receipt ID"
          placeholderTextColor={Theme.colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={artifactText}
          onChangeText={setArtifactText}
          placeholder="Paste the finalized artifact text"
          placeholderTextColor={Theme.colors.textMuted}
          multiline
          style={[styles.input, styles.multiline]}
        />
        {!conversation ? (
          <Button variant="ghost" onPress={pasteClipboard}>
            Paste from Clipboard
          </Button>
        ) : null}
        {artifactHash ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={async () => {
              await Clipboard.setStringAsync(artifactHash);
              Alert.alert('Fingerprint copied');
            }}
          >
            Fingerprint: {artifactHash.slice(0, 14)}… <Caption color="textMuted">Copy</Caption>
          </Button>
        ) : null}
      </Card>

      <OptionalWalletSection artifactHash={artifactHash} conversation={conversation} />
    </ScrollView>
  );
}

function OptionalWalletSection({
  artifactHash,
  conversation,
}: {
  artifactHash: Hex | null;
  conversation: Conversation | undefined;
}) {
  const [hookFn, setHookFn] = useState<WalletHookFn | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  React.useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        // Dynamic require: evaluated only when this screen opens, never at startup.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@walletconnect/modal-react-native') as {
          useWalletConnectModal?: unknown;
        };
        if (!active) return;
        if (typeof mod.useWalletConnectModal === 'function') {
          setHookFn(() => mod.useWalletConnectModal as WalletHookFn);
        } else {
          setUnavailable(true);
        }
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (unavailable || hookFn === null) {
    if (hookFn === null && !unavailable) {
      return (
        <Card variant="outlined" padding="md" style={styles.card}>
          <Caption color="textSecondary">Checking for an optional wallet…</Caption>
        </Card>
      );
    }
    return (
      <Card variant="outlined" padding="md" style={styles.card}>
        <H2 weight="semiBold" color="textPrimary" style={styles.cardTitle}>2. Manual wallet anchoring unavailable</H2>
        <Body color="textSecondary">
          The optional WalletConnect build is not available in this installation. Automatic provenance
          through the RecordioAI relayer is unaffected and continues to run.
        </Body>
      </Card>
    );
  }

  return (
    <ManualWalletSection useWalletHook={hookFn} artifactHash={artifactHash} conversation={conversation} />
  );
}

function ManualWalletSection({
  useWalletHook,
  artifactHash,
  conversation,
}: {
  useWalletHook: WalletHookFn;
  artifactHash: Hex | null;
  conversation: Conversation | undefined;
}) {
  const { open, provider, address, isConnected } = useWalletHook();
  const [proof, setProof] = useState<MonadProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<boolean | null>(null);
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'wrong_network'
  >(isConnected && address ? 'connected' : 'disconnected');
  const [workflowState, setWorkflowState] = useState<
    'idle' | 'awaiting_approval' | 'pending' | 'confirmed' | 'failed'
  >('idle');
  // Balance is keyed by address so a stale value is never shown for a new wallet.
  const [balanceState, setBalanceState] = useState<{
    address: string;
    value: bigint | null;
    error: string | null;
  } | null>(null);

  const walletAddress = address && isAddress(address) ? address : null;

  React.useEffect(() => {
    if (!isConnected || !walletAddress || connectionState !== 'connected') return;
    let cancelled = false;
    const target = walletAddress;
    void (async () => {
      try {
        const value = await getMonadBalance(target);
        if (!cancelled) setBalanceState({ address: target, value, error: null });
      } catch (error) {
        if (!cancelled) {
          setBalanceState({ address: target, value: null, error: describeMonadRpcError(error) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, connectionState, isConnected]);

  const walletBalanceLabel = !isConnected || !address
    ? 'Connect a wallet to read a balance'
    : !walletAddress
      ? 'Connected account is not a valid EVM address'
      : !balanceState || balanceState.address !== walletAddress
        ? 'Reading from RPC…'
        : balanceState.error
          ? balanceState.error
          : balanceState.value !== null
            ? formatMonadBalance(balanceState.value)
            : 'Reading from RPC…';

  React.useEffect(() => {
    let active = true;
    if (!isConnected || !address || !provider) {
      return () => {
        active = false;
      };
    }
    provider
      .request({ method: 'eth_chainId' })
      .then((chainId) => {
        if (!active) return;
        const numericChainId = String(chainId).toLowerCase().startsWith('0x')
          ? Number.parseInt(String(chainId), 16)
          : Number.parseInt(String(chainId), 10);
        setConnectionState(numericChainId === MONAD_TESTNET_CHAIN_ID ? 'connected' : 'wrong_network');
      })
      .catch(() => {
        if (active) setConnectionState('wrong_network');
      });
    return () => {
      active = false;
    };
  }, [address, isConnected, provider]);

  const displayedConnectionState =
    !isConnected || !address || !provider ? 'disconnected' : connectionState;

  const walletErrorMessage = (error: unknown): string => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === 4001) return 'Wallet approval was rejected. No transaction was submitted.';
    if (code === 4902) return 'Your wallet does not support adding Monad Testnet automatically. Add chain 10143 manually, then try again.';
    if (code === -32000) return 'The wallet rejected the transaction. Check that you have enough MON testnet funds.';
    return error instanceof Error
      ? error.message
      : 'The wallet or Monad Testnet could not complete the request.';
  };

  React.useEffect(() => {
    if (!conversation) return;
    const timeoutId = setTimeout(() => {
      if (conversation.provenance?.transactionHash) {
        setProof({
          artifactHash: conversation.provenance.artifactHash as Hex,
          chainId: conversation.provenance.chainId,
          transactionHash: conversation.provenance.transactionHash as Hex,
          explorerUrl: conversation.provenance.explorerUrl || '',
          verified: conversation.provenance.status === 'verified',
          blockNumber: BigInt(conversation.provenance.blockNumber || '0'),
        });
        setVerification(conversation.provenance.status === 'verified');
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [conversation]);

  const proofMatchesArtifact =
    proof !== null && artifactHash !== null && proof.artifactHash === artifactHash;

  const connectWallet = async () => {
    setConnectionState('connecting');
    try {
      await Promise.race([
        open(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Wallet connection timed out. Check the wallet app and try again.')), 30000)
        ),
      ]);
    } catch (error) {
      setConnectionState('disconnected');
      Alert.alert('Wallet unavailable', error instanceof Error ? error.message : 'The wallet connection was not completed.');
    }
  };

  const anchorProof = async () => {
    if (!artifactHash || !provider || !address || !isAddress(address)) {
      Alert.alert('Missing information', 'Connect a wallet and provide the final artifact before anchoring.');
      return;
    }

    setBusy(true);
    setWorkflowState('awaiting_approval');
    setVerification(null);
    try {
      await ensureMonadNetwork(provider);
      setWorkflowState('pending');
      const nextProof = await submitMonadProof(provider, address as `0x${string}`, artifactHash);
      setProof(nextProof);
      setVerification(true);
      setWorkflowState('confirmed');
    } catch (error) {
      setWorkflowState('failed');
      Alert.alert(
        'Proof not submitted',
        walletErrorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyProof = async () => {
    if (!proof || !artifactHash) return;
    setBusy(true);
    try {
      const result = await verifyMonadProof(proof.transactionHash, artifactHash as Hex);
      setVerification(result.verified);
    } catch (error) {
      Alert.alert('Verification unavailable', error instanceof Error ? error.message : 'Monad Testnet verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card variant="outlined" padding="md" style={styles.card}>
        <View style={styles.statusRows}>
          <StatusRow label="Wallet balance" value={walletBalanceLabel} />
        </View>
        <H2 weight="semiBold" color="textPrimary" style={styles.cardTitle}>2. Connect and anchor</H2>
        <Body color="textSecondary">
          A compatible external wallet approves a zero-value self-transaction whose calldata contains only the hash.
        </Body>
        <Button variant="outline" fullWidth onPress={connectWallet} loading={connectionState === 'connecting'} style={styles.button}>
          {isConnected && address ? `Connected: ${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect Wallet'}
        </Button>
        <Caption color={displayedConnectionState === 'connected' ? 'success' : 'textMuted'}>
          {displayedConnectionState === 'connected'
            ? 'Wallet connected • Monad Testnet is checked before signing'
            : displayedConnectionState === 'wrong_network'
              ? 'Wallet connected on the wrong network • switch to Monad Testnet when prompted'
              : displayedConnectionState === 'connecting'
                ? 'Opening wallet connection…'
                : 'Connect a compatible wallet to continue'}
        </Caption>
        <Button variant="primary" fullWidth onPress={anchorProof} loading={busy} disabled={!artifactHash || !isConnected || !provider || busy} style={styles.button}>
          Submit Proof on Monad Testnet
        </Button>
        {workflowState !== 'idle' ? (
          <Caption color={workflowState === 'failed' ? 'error' : 'textSecondary'}>
            {workflowState === 'awaiting_approval'
              ? 'Approve the transaction in your wallet…'
              : workflowState === 'pending'
                ? 'Transaction submitted. Waiting for Monad confirmation…'
                : workflowState === 'confirmed'
                  ? 'Transaction confirmed and calldata verified.'
                  : workflowState === 'failed'
                    ? 'Proof submission failed. No success was recorded.'
                    : ''}
          </Caption>
        ) : null}
        {proof?.transactionHash ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={async () => {
              await Clipboard.setStringAsync(proof.transactionHash);
              Alert.alert('Transaction hash copied');
            }}
          >
            Copy transaction hash
          </Button>
        ) : null}
      </Card>

      {proof ? (
        <Card variant="elevated" padding="md" style={styles.card}>
          <Caption color="success" weight="semiBold">
            {verification && proofMatchesArtifact ? 'MINED AND VERIFIED' : 'MINED • VERIFY CURRENT ARTIFACT'}
          </Caption>
          <Body color="textSecondary" selectable>Transaction: {proof.transactionHash}</Body>
          <Body color="textSecondary" selectable>Block: {proof.blockNumber.toString()}</Body>
          <Button variant="outline" fullWidth onPress={verifyProof} loading={busy} style={styles.button}>
            Verify Proof Again
          </Button>
        </Card>
      ) : null}
    </>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Caption color="textMuted" style={styles.statusLabel}>
        {label}
      </Caption>
      <Caption color="textPrimary" weight="semiBold" style={styles.statusValue} numberOfLines={2}>
        {value}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Theme.colors.backgroundPrimary },
  content: { padding: Theme.spacing[5], paddingTop: Theme.spacing[8], paddingBottom: Theme.spacing[12] },
  subtitle: { marginTop: Theme.spacing[2], marginBottom: Theme.spacing[5] },
  card: { marginBottom: Theme.spacing[4], gap: Theme.spacing[3] },
  cardTitle: { marginTop: Theme.spacing[2] },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing[2],
    flexWrap: 'wrap',
  },
  statusRows: { gap: Theme.spacing[2] },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing[3],
  },
  statusLabel: { flexShrink: 0 },
  statusValue: { flexShrink: 1, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.base,
    color: Theme.colors.textPrimary,
    paddingHorizontal: Theme.spacing[3],
    paddingVertical: Theme.spacing[3],
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  button: { marginTop: Theme.spacing[2] },
});
