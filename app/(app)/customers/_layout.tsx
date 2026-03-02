import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function CustomersLayout() {
  const { theme, isDark } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: theme.brand.primary,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: theme.surface.base },
        headerTitleStyle: { color: theme.text.title },
        headerShadowVisible: !isDark,
        contentStyle: { backgroundColor: theme.surface.base },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Customers', headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add Customer' }} />
      <Stack.Screen name="[id]" options={{ title: 'Customer Details' }} />
    </Stack>
  );
}