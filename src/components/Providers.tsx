import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Theme } from '@/constants/theme';
import { WalletConnectModal } from '@walletconnect/modal-react-native';
import {
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC_URL,
  WALLETCONNECT_PROJECT_ID,
} from '@/constants/env';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [walletConnectReady, setWalletConnectReady] = React.useState(false);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => setWalletConnectReady(true), 500);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {children}
        {walletConnectReady && WALLETCONNECT_PROJECT_ID ? (
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