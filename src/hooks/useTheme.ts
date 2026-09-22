import { useCallback, useEffect, useState } from 'react';
import { useColorScheme, Keyboard } from 'react-native';
import { useAppStore } from '@/store/appStore';

export function useTheme() {
  const systemTheme = useColorScheme();
  const { settings, updateSettings } = useAppStore();
  const theme = settings.theme === 'system' ? systemTheme : settings.theme;
  const setTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => { updateSettings({ theme: newTheme }); }, [updateSettings]);
  return { theme, setTheme, systemTheme };
}

export function useOnboarding() {
  const { onboarding, setOnboardingStep, completeOnboarding, resetOnboarding } = useAppStore();
  return { ...onboarding, nextStep: () => setOnboardingStep(onboarding.currentStep + 1), prevStep: () => setOnboardingStep(Math.max(0, onboarding.currentStep - 1)), goToStep: setOnboardingStep, complete: completeOnboarding, reset: resetOnboarding };
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => { const handler = setTimeout(() => setDebouncedValue(value), delay); return () => clearTimeout(handler); }, [value, delay]);
  return debouncedValue;
}

export function useKeyboard() {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => { const show = Keyboard.addListener('keyboardDidShow', () => setIsVisible(true)); const hide = Keyboard.addListener('keyboardDidHide', () => setIsVisible(false)); return () => { show.remove(); hide.remove(); }; }, []);
  return { isVisible };
}

export function useSafeArea() {
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  useEffect(() => {
    const timer = setTimeout(() => {
      setInsets({ top: 0, bottom: 0, left: 0, right: 0 });
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return insets;
}