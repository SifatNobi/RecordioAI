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

// Prevent splash from auto-hiding while we initialize
SplashScreen.preventAutoHideAsync().catch(() => {
  console.warn('[startup] SplashScreen.preventAutoHideAsync failed');
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
  const [fontLoaded] = useIoniconsFont();

  React.useEffect(() => {
    recordStartupStage('providers-mounted');
    let active = true;

    // Initialize stores immediately
    initializeStores();
    initializeEntitlements();

    // Mark hydration complete after a short delay to allow Zustand persist to complete
    const hydrationTimeout = setTimeout(() => {
      if (active) {
        markHydrated();
        recordStartupStage('hydration-complete');
      }
    }, 800);

    // Recover pending provenance submissions (non-blocking)
    const recoveryTimeout = setTimeout(() => {
      if (!active) return;
      void import('@/services/blockchain/automaticProvenance')
        .then(({ retryPendingProvenance }) => {
          retryPendingProvenance();
          recordStartupStage('provenance-recovery-started');
        })
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
    // Hide splash once the router is ready and fonts are loaded (or failed)
    // Font loading failure should not block the app
    const frame = requestAnimationFrame(() => {
      recordStartupStage('navigation-mounted');
      SplashScreen.hideAsync()
        .then(() => {
          recordStartupStage('splash-dismissed');
        })
        .catch((error) => {
          console.warn('[startup] SplashScreen.hideAsync failed:', error);
          recordStartupStage('splash-dismissed');
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [fontLoaded]);

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