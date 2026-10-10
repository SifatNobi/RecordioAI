import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useWalletConnectModal } from '@walletconnect/modal-react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Caption, H1, H2 } from '@/components/Typography';
import { Theme } from '@/constants/theme';
import { MONAD_TESTNET_CHAIN_ID } from '@/constants/env';
import {
  hashArtifact,
  submitMonadProof,
  verifyMonadProof,
  type MonadProof,
} from '@/services/blockchain/monad';
import type { Hex } from 'viem';

export default function MonadProvenanceScreen() {
  const { open, provider, address, isConnected } = useWalletConnectModal();
  const [reference, setReference] = useState('');
  const [artifactText, setArtifactText] = useState('');
  const [proof, setProof] = useState<MonadProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<boolean | null>(null);

  const artifactHash = useMemo(() => {
    if (!reference.trim() || !artifactText.trim()) return null;
    return hashArtifact({
      reference: reference.trim(),
      artifact: artifactText,
    });
  }, [reference, artifactText]);

  const connectWallet = async () => {
    try {
      await open();
    } catch (error) {
      Alert.alert('Wallet unavailable', error instanceof Error ? error.message : 'The wallet connection was not completed.');
    }
  };

  const anchorProof = async () => {
    if (!artifactHash || !provider || !address) {
      Alert.alert('Missing information', 'Connect a wallet and provide the final artifact before anchoring.');
      return;
    }

    setBusy(true);
    setVerification(null);
    try {
      const nextProof = await submitMonadProof(provider, address as `0x${string}`, artifactHash);
      setProof(nextProof);
      setVerification(true);
    } catch (error) {
      Alert.alert(
        'Proof not submitted',
        error instanceof Error ? error.message : 'The wallet or Monad Testnet could not complete the request.'
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
        <Button variant="outline" fullWidth onPress={connectWallet} style={styles.button}>
          {isConnected && address ? `Connected: ${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect Wallet'}
        </Button>
        <Button variant="primary" fullWidth onPress={anchorProof} loading={busy} disabled={!artifactHash || !isConnected || !provider} style={styles.button}>
          Submit Proof on Monad Testnet
        </Button>
      </Card>

      {proof ? (
        <Card variant="elevated" padding="md" style={styles.card}>
          <Caption color="success" weight="semiBold">
            {verification ? 'MINED AND VERIFIED' : 'MINED'}
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
