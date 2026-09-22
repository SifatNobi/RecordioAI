import React from 'react';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';

export default function Index() {
  const { onboarding } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (onboarding.completed) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [onboarding.completed, router]);

  return null;
}