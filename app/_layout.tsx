import { Stack } from 'expo-router';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Entry point (redirect logic) */}
          <Stack.Screen name="index" />

          {/* Login/Register screens */}
          <Stack.Screen name="(auth)" />

          {/* ✅ THE NEW UNIFIED APP (This was missing) */}
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}