import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="briefcase-outline" size={24} color={color} />,
        }}
      />
      {/* ADD THIS NEW TAB */}
      <Tabs.Screen
        name="workers"
        options={{
          title: 'Workers',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}