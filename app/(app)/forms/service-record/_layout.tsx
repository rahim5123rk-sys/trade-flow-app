// ============================================
// FILE: app/(app)/forms/service-record/_layout.tsx
// Service Record multi-step layout with context
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { ServiceRecordProvider } from '../../../../src/context/ServiceRecordContext';
import { useAppTheme } from '../../../../src/context/ThemeContext';

export default function ServiceRecordLayout() {
  const { theme } = useAppTheme();

  return (
    <ServiceRecordProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.surface.base },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="service" />
        <Stack.Screen name="review-sign" />
      </Stack>
    </ServiceRecordProvider>
  );
}
