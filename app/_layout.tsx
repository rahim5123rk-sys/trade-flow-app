import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { OfflineProvider } from '../src/context/OfflineContext';
import { ThemeProvider } from '../src/context/ThemeContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <OfflineProvider>
              <Stack screenOptions={{ headerShown: false }}>
                {/* Entry point (redirect logic) */}
                <Stack.Screen name="index" />

                {/* Login/Register screens */}
                <Stack.Screen name="(auth)" />

                {/* ✅ THE NEW UNIFIED APP (This was missing) */}
                <Stack.Screen name="(app)" />
              </Stack>
            </OfflineProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}