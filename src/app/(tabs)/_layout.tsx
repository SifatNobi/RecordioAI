import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/appStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabLayout() {
  const onboarding = useAppStore((s) => s.onboarding);

  if (!onboarding.completed) {
    return null;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#0066FF',
        tabBarInactiveTintColor: '#6B7A99',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: { backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#171717', paddingBottom: 8, paddingTop: 4, height: 80 },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
            index: { focused: 'home', unfocused: 'home-outline' },
            agents: { focused: 'construct', unfocused: 'construct-outline' },
            conversations: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
            resolve: { focused: 'shield-checkmark', unfocused: 'shield-checkmark-outline' },
            receipts: { focused: 'document-text', unfocused: 'document-text-outline' },
            'create-record': { focused: 'mic', unfocused: 'mic-outline' },
          };
          const icon = icons[route.name] || { focused: 'help', unfocused: 'help-outline' } as { focused: IoniconName; unfocused: IoniconName };
          return <Ionicons name={focused ? icon.focused : icon.unfocused} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="agents" options={{ title: 'Agents' }} />
      <Tabs.Screen name="create-record" options={{ title: 'Record' }} />
      <Tabs.Screen name="conversations" options={{ title: 'Conversations' }} />
      <Tabs.Screen name="resolve" options={{ title: 'Resolve' }} />
      <Tabs.Screen name="receipts" options={{ title: 'Receipts' }} />
    </Tabs>
  );
}