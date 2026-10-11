import React from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '@/components/Providers';
import { useAppStore } from '@/store/appStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { Theme } from '@/constants/theme';
import { recordStartupStage } from '@/services/startupDiagnostics';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Keep the app usable if the splash API is unavailable.
});
recordStartupStage('root-layout-evaluated');

const { backgroundPrimary, textPrimary } = Theme.colors;

const NAV_HEADERS = {
  headerStyle: { backgroundColor: backgroundPrimary },
  headerTintColor: textPrimary,
  headerTitleStyle: {
    color: textPrimary,
    fontWeight: '600' as const,
  },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};

const CONTENT_STYLE = { backgroundColor: backgroundPrimary };

const useIoniconsFont = () =>
  Font.useFonts({
    Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  });

export default function RootLayout() {
  const initializeStores = useAppStore((s) => s.initializeStores);
  const markHydrated = useAppStore((s) => s.markHydrated);
  const initializeEntitlements = useEntitlementStore((s) => s.initializeEntitlements);
  useIoniconsFont();

  React.useEffect(() => {
    recordStartupStage('providers-mounted');
    let active = true;

    initializeStores();
    initializeEntitlements();

    // Hydration is persisted-state bookkeeping, not a prerequisite for
    // rendering the router. The index route displays a safe loading state
    // until this flag is set.
    const hydrationTimeout = setTimeout(() => {
      if (active) markHydrated();
    }, 1200);

    // Recovery is best effort and must never delay navigation or splash
    // dismissal.
    const recoveryTimeout = setTimeout(() => {
      if (!active) return;
      void import('@/services/blockchain/automaticProvenance')
        .then(({ retryPendingProvenance }) => retryPendingProvenance())
        .catch((error) => {
          console.error(
            `[startup] provenance recovery unavailable: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
    }, 1500);

    return () => {
      active = false;
      clearTimeout(hydrationTimeout);
      clearTimeout(recoveryTimeout);
    };
  }, [initializeStores, initializeEntitlements, markHydrated]);

  React.useEffect(() => {
    // The router and its first route are now mounted. Icon fonts are
    // non-critical and must not be able to hold the native splash forever.
    const frame = requestAnimationFrame(() => {
      recordStartupStage('navigation-mounted');
      void SplashScreen.hideAsync().catch(() => {});
      recordStartupStage('splash-dismissed');
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <SafeAreaProvider>
      <Providers>
        <Stack screenOptions={{ headerShown: false, contentStyle: CONTENT_STYLE }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen
            name="agents/connect"
            options={{ headerShown: true, title: 'Connect Agent', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="agents/[id]"
            options={{ headerShown: true, title: 'Agent Details', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="conversations/[id]"
            options={{ headerShown: true, title: 'Conversation', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="settings/subscription"
            options={{ headerShown: true, title: 'Subscription', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="settings/monad"
            options={{ headerShown: true, title: 'Monad Provenance', ...NAV_HEADERS }}
          />
        </Stack>
      </Providers>
    </SafeAreaProvider>
  );
}