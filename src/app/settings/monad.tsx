import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useWalletConnectModal } from '@walletconnect/modal-react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Caption, H1, H2 } from '@/components/Typography';
import { Theme } from '@/constants/theme';
import { MONAD_TESTNET_CHAIN_ID } from '@/constants/env';
import {
  ensureMonadNetwork,
  hashArtifact,
  submitMonadProof,
  verifyMonadProof,
  type MonadProof,
} from '@/services/blockchain/monad';
import { isAddress, type Hex } from 'viem';

export default function MonadProvenanceScreen() {
  const { open, provider, address, isConnected } = useWalletConnectModal();
  const [reference, setReference] = useState('');
  const [artifactText, setArtifactText] = useState('');
  const [proof, setProof] = useState<MonadProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<boolean | null>(null);
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'wrong_network'
  >(isConnected && address ? 'connected' : 'disconnected');
  const [workflowState, setWorkflowState] = useState<
    'idle' | 'awaiting_approval' | 'pending' | 'confirmed' | 'failed'
  >('idle');

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

  const artifactHash = useMemo(() => {
    if (!reference.trim() || !artifactText.trim()) return null;
    return hashArtifact({
      reference: reference.trim(),
      artifact: artifactText,
    });
  }, [reference, artifactText]);

  const proofMatchesArtifact =
    proof !== null && artifactHash !== null && proof.artifactHash === artifactHash;

  const connectWallet = async () => {
    setConnectionState('connecting');
    try {
      await open();
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <H1 weight="bold" color="textPrimary">Monad Provenance</H1>
      <Body color="textSecondary" style={styles.subtitle}>
        Record only a cryptographic fingerprint on Monad Testnet. The artifact text never leaves this device.
      </Body>

      <Card variant="outlined" padding="md" style={styles.card}>
        <Caption color="warning" weight="semiBold">MONAD TESTNET • CHAIN {MONAD_TESTNET_CHAIN_ID}</Caption>
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
        {artifactHash ? (
          <Caption color="textSecondary" selectable>
            Hash: {artifactHash}
          </Caption>
        ) : null}
      </Card>

      <Card variant="outlined" padding="md" style={styles.card}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Theme.spacing[5], paddingTop: Theme.spacing[8], paddingBottom: Theme.spacing[12] },
  subtitle: { marginTop: Theme.spacing[2], marginBottom: Theme.spacing[5] },
  card: { marginBottom: Theme.spacing[4], gap: Theme.spacing[3] },
  cardTitle: { marginTop: Theme.spacing[2] },
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
