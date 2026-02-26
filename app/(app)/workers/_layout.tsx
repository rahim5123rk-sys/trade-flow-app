import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';

export default function WorkersLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primary,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Team', headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add Worker', presentation: 'modal' }} />
    </Stack>
  );
}