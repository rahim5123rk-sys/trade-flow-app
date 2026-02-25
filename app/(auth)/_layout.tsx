import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // We will build our own headers or use safe areas
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register-company" options={{ headerShown: true, title: 'Create Company' }} />
    </Stack>
  );
}