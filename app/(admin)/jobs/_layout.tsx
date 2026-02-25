// ============================================
// FILE: app/(admin)/jobs/_layout.tsx
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primary,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'All Jobs', headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'New Job', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Job Details' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit Job' }} />
      <Stack.Screen name="[id]/invoice" options={{ title: 'Create Invoice' }} />
    </Stack>
  );
}