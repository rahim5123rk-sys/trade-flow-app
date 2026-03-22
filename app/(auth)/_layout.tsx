import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function AuthLayout() {
  const { theme } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // Prevent back-swipe gesture from interfering with touch handling
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: theme.surface.base },
        headerTitleStyle: { color: theme.text.title },
        headerTintColor: theme.brand.primary,
        contentStyle: { backgroundColor: theme.surface.base },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: true, title: 'Create Company' }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
    </Stack>
  );
}