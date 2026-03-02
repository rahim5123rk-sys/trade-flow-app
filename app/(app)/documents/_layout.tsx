// ============================================
// FILE: app/(app)/documents/_layout.tsx
// NOTE: Folder MUST be named "documents" (not "douments")
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';
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
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: 'Document Details',
          headerTintColor: theme.brand.primary,
          headerStyle: { backgroundColor: theme.surface.base },
          headerTitleStyle: { color: theme.text.title },
          headerShadowVisible: !isDark,
          headerBackTitle: '',
        }}
      />
    </Stack>
  );
}