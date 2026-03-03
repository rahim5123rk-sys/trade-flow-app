// ============================================
// FILE: app/(app)/documents/_layout.tsx
// NOTE: Folder MUST be named "documents" (not "douments")
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function DocumentsLayout() {
  const { theme, isDark } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.surface.base },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{headerShown: false}} />
    </Stack>
  );
}