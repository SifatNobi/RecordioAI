import React from 'react';
import { Slot } from 'expo-router';
import { Providers } from '@/components/Providers';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';
import { useAppStore } from '@/store/appStore';
import { useEntitlementStore } from '@/store/entitlementStore';

export default function RootLayout() {
  const initializeStores = useAppStore((s) => s.initializeStores);
  const initializeEntitlements = useEntitlementStore((s) => s.initializeEntitlements);

  React.useEffect(() => {
    initializeStores();
    initializeEntitlements();
  }, [initializeStores, initializeEntitlements]);

  return (
    <QueryClientProvider client={queryClient}>
      <Providers>
        <Slot />
      </Providers>
    </QueryClientProvider>
  );
}