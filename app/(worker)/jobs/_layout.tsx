import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function WorkerLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, // Hide header here (The Job Stack handles it)
      tabBarActiveTintColor: '#2563eb'
    }}>
      <Tabs.Screen
        name="jobs" // This points to the 'jobs' FOLDER
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ color }) => <Ionicons name="briefcase" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}