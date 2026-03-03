// ============================================
// FILE: app/(app)/forms/_layout.tsx
// Stack layout for Forms hub + sub-forms
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function FormsLayout() {
  const { theme } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.surface.base },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="warning-notice" />
      <Stack.Screen name="service-record" />
      <Stack.Screen name="commissioning" />
      <Stack.Screen name="decommissioning" />
      <Stack.Screen name="breakdown" />
      <Stack.Screen name="installation" />
    </Stack>
  );
}
