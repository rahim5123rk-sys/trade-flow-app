// ============================================
// FILE: app/(app)/documents/_layout.tsx
// NOTE: Folder MUST be named "documents" (not "douments")
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';

export default function DocumentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: 'Document Details',
          headerTintColor: Colors.primary,
          headerBackTitle: '',
        }}
      />
    </Stack>
  );
}