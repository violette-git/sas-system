import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function OwnerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#7c3aed' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Companies',
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
