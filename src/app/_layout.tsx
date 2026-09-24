import React from 'react';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Providers } from '@/components/Providers';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';
import { useAppStore } from '@/store/appStore';
import { useEntitlementStore } from '@/store/entitlementStore';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Keep the app usable if the splash API is unavailable.
});

export default function RootLayout() {
  const initializeStores = useAppStore((s) => s.initializeStores);
  const initializeEntitlements = useEntitlementStore((s) => s.initializeEntitlements);

  React.useEffect(() => {
    let active = true;

    // Optional store initialization is deferred off the critical path and
    // isolated so a failure can never block first paint.
    Promise.resolve()
      .then(() => {
        if (!active) return;
        initializeStores();
        initializeEntitlements();
      })
      .catch(() => {});

    // Dismiss the splash as soon as the first frame is ready. The timer is a
    // safety net so a slow optional task can never leave the splash up.
    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignore hide failures.
      }
    };
    const frame = requestAnimationFrame(() => {
      hide();
    });
    const timeout = setTimeout(hide, 800);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [initializeStores, initializeEntitlements]);

  return (
    <QueryClientProvider client={queryClient}>
      <Providers>
        <Slot />
      </Providers>
    </QueryClientProvider>
  );
}