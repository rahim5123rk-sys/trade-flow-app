// ============================================
// FILE: app/(app)/forms/warning-notice/_layout.tsx
// Warning Notice multi-step layout (scaffold)
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '../../../../src/context/ThemeContext';

export default function WarningNoticeLayout() {
  const { theme } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.surface.base },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="hazard" />
      <Stack.Screen name="review-sign" />
    </Stack>
  );
}
