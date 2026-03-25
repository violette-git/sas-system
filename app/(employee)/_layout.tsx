import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function EmployeeLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#2563eb' }}>
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
        name="visit/[id]"
        options={{ href: null, title: 'Visit Detail', headerShown: true }}
      />
    </Tabs>
  );
}
