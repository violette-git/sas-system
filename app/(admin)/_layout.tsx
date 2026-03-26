import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
        headerRight: () => <NotificationBell route="/(admin)/notifications" />,
        headerStyle: { backgroundColor: '#fff' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          title: 'Schedules',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Employees',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
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
      <Tabs.Screen name="notifications"                  options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="audit-log"                      options={{ href: null, title: 'Audit Log' }} />
      <Tabs.Screen name="client/[id]/index"             options={{ href: null, title: 'Client Detail' }} />
      <Tabs.Screen name="client/[id]/authorizations"    options={{ href: null, title: 'Authorizations' }} />
      <Tabs.Screen name="client/[id]/documents"         options={{ href: null, title: 'Documents' }} />
      <Tabs.Screen name="client/[id]/signature"         options={{ href: null, title: 'E-Signature' }} />
      <Tabs.Screen name="schedule/[id]"                 options={{ href: null, title: 'Schedule Detail' }} />
      <Tabs.Screen name="review"                        options={{ href: null, title: 'Review Queue' }} />
      <Tabs.Screen name="templates"                     options={{ href: null, title: 'Templates' }} />
      <Tabs.Screen name="template/[id]"                 options={{ href: null, title: 'Template Editor' }} />
    </Tabs>
  );
}
