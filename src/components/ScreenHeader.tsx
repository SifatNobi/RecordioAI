import React from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { H3 } from '@/components/Typography';

const BACK_TARGET_SIZE = 48;

/**
 * Returns a back action that never strands the user: pops the navigation
 * stack when history exists (preserving Home/list origins), otherwise
 * replaces to a safe fallback route (e.g. after recording completion opens
 * a details screen via router.replace, which leaves no history).
 */
export function useSafeBack(fallback: string): () => void {
  const router = useRouter();
  return React.useCallback(() => {
    try {
      if (router.canGoBack()) {
        router.back();
        return;
      }
    } catch {
      // canGoBack may throw when no navigation state is ready yet.
    }
    router.replace(fallback as never);
  }, [router, fallback]);
}

/**
 * Makes the Android system back button/gesture behave exactly like the
 * on-screen back button while this screen is focused.
 */
export function useSafeSystemBack(fallback: string): void {
  const router = useRouter();
  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          let canGoBack = false;
          try {
            canGoBack = router.canGoBack();
          } catch {
            canGoBack = false;
          }
          if (canGoBack) return false;
          router.replace(fallback as never);
          return true;
        }
      );
      return () => subscription.remove();
    }, [router, fallback])
  );
}

interface ScreenHeaderProps {
  title: string;
  /** Safe fallback route when there is no navigation history. */
  fallback: string;
}

/**
 * In-screen header with a guaranteed-visible back button. Used on detail
 * screens whose native header is hidden so the back affordance exists
 * whether the screen was pushed (history) or replaced (no history).
 */
export function ScreenHeader({ title, fallback }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack(fallback);
  useSafeSystemBack(fallback);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, Theme.spacing[2]) }]}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Ionicons name="arrow-back" size={24} color={Theme.colors.textPrimary} />
      </Pressable>
      <H3 weight="semiBold" color="textPrimary" style={styles.title}>
        {title}
      </H3>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.backgroundPrimary,
    paddingHorizontal: Theme.spacing[2],
    paddingBottom: Theme.spacing[2],
  },
  backButton: {
    width: BACK_TARGET_SIZE,
    height: BACK_TARGET_SIZE,
    borderRadius: BACK_TARGET_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: Theme.colors.surfaceElevated,
  },
  title: {
    flex: 1,
    marginLeft: Theme.spacing[2],
  },
  spacer: {
    width: BACK_TARGET_SIZE,
  },
});
