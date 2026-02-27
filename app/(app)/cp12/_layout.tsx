// ============================================
// FILE: app/(app)/cp12/_layout.tsx
// Stack layout for CP12 multi-step flow
// ============================================

import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';
import { CP12Provider } from '../../../src/context/CP12Context';

export default function CP12Layout() {
  return (
    <CP12Provider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="appliances" />
        <Stack.Screen name="final-checks" />
        <Stack.Screen name="review-sign" />
      </Stack>
    </CP12Provider>
  );
}
