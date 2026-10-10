import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Theme } from '@/constants/theme';
import { WalletConnectModal } from '@walletconnect/modal-react-native';
import { WALLETCONNECT_PROJECT_ID } from '@/constants/env';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {children}
        {WALLETCONNECT_PROJECT_ID ? (
          <WalletConnectModal
            projectId={WALLETCONNECT_PROJECT_ID}
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