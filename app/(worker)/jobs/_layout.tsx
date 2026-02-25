import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Alert, TouchableOpacity } from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';

export default function WorkerJobsLayout() {
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const logoutButton = (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
      <Ionicons name="log-out-outline" size={22} color="#ef4444" />
    </TouchableOpacity>
  );

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'My Jobs',
          headerRight: () => logoutButton,
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Job Detail' }} />
    </Stack>
  );
}
