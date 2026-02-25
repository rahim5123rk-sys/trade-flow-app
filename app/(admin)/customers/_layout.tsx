import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';

export default function CustomersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: Colors.primary,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Customers', headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add Customer' }} />
      <Stack.Screen name="[id]" options={{ title: 'Customer Details' }} />
    </Stack>
  );
}