import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Theme } from '@/constants/theme';
import { recordStartupStage } from '@/services/startupDiagnostics';
import {
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC_URL,
  WALLETCONNECT_PROJECT_ID,
} from '@/constants/env';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [WalletConnectModal, setWalletConnectModal] =
    React.useState<React.ComponentType<any> | null>(null);

  React.useEffect(() => {
    recordStartupStage('providers-mounted');
    let active = true;
    const timeoutId = setTimeout(() => {
      void Promise.resolve()
        .then(() => {
          require('@walletconnect/react-native-compat');
          return require('@walletconnect/modal-react-native');
        })
        .then((module) => {
          if (active) setWalletConnectModal(() => module.WalletConnectModal);
        })
        .catch((error) => {
          console.error(
            `[startup] optional WalletConnect unavailable: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
    }, 2000);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {children}
        {WalletConnectModal && WALLETCONNECT_PROJECT_ID ? (
          <WalletConnectModal
            projectId={WALLETCONNECT_PROJECT_ID}
            sessionParams={{
              namespaces: {
                eip155: {
                  chains: [`eip155:${MONAD_TESTNET_CHAIN_ID}`],
                  methods: ['eth_sendTransaction', 'personal_sign'],
                  events: ['chainChanged', 'accountsChanged'],
                  rpcMap: {
                    [`eip155:${MONAD_TESTNET_CHAIN_ID}`]: MONAD_TESTNET_RPC_URL,
                  },
                },
              },
            }}
            providerMetadata={{
              name: 'RecordioAI',
              description: 'Verifiable AI artifact provenance on Monad Testnet',
              url: 'https://recordioai.com',
              icons: ['https://recordioai.com/icon.png'],
              redirect: {
                native: 'recordioai://',
              },
            }}
          />
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
});