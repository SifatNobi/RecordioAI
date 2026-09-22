import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/appStore';

const Tab = createBottomTabNavigator();

type TabIconProps = { focused: boolean; color: string; size: number };

export default function TabLayout() {
  const { onboarding } = useAppStore();

  if (!onboarding.completed) {
    return null;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#0066FF',
        tabBarInactiveTintColor: '#6B7A99',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: { backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#171717', paddingBottom: 8, paddingTop: 4, height: 80 },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarIcon: ({ focused, color, size }: TabIconProps) => {
          const icons: Record<string, { focused: string; unfocused: string }> = {
            index: { focused: 'home', unfocused: 'home-outline' },
            agents: { focused: 'construct', unfocused: 'construct-outline' },
            conversations: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
            resolve: { focused: 'shield-checkmark', unfocused: 'shield-checkmark-outline' },
            receipts: { focused: 'document-text', unfocused: 'document-text-outline' },
          };
          const icon = icons[route.name] || { focused: 'help', unfocused: 'help-outline' };
          return <Ionicons name={focused ? icon.focused : icon.unfocused} size={size} color={color} />;
        },
      })}
      tabBarOptions={{ showLabel: true, keyboardHidesTabBar: true }}
    >
      <Tab.Screen name="index" options={{ title: 'Home' }} />
      <Tab.Screen name="agents" options={{ title: 'Agents' }} />
      <Tab.Screen name="conversations" options={{ title: 'Conversations' }} />
      <Tab.Screen name="resolve" options={{ title: 'Resolve' }} />
      <Tab.Screen name="receipts" options={{ title: 'Receipts' }} />
    </Tab.Navigator>
  );
}