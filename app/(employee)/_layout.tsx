import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

export default function EmployeeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
        headerRight: () => <NotificationBell route="/(employee)/notifications" />,
        headerStyle: { backgroundColor: '#fff' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Schedule',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: 'Clock In/Out',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen
        name="visit/[id]"
        options={{ href: null, title: 'Visit Detail', headerShown: true }}
      />
      <Tabs.Screen
        name="case-note/[scheduleId]"
        options={{ href: null, title: 'Case Note', headerShown: true }}
      />
      <Tabs.Screen
        name="signature/[documentId]"
        options={{ href: null, title: 'Sign Document', headerShown: true }}
      />
    </Tabs>
  );
}
