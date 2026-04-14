import { Stack, router } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function CustomersLayout() {
  const { theme, isDark } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        gestureEnabled: false,
        headerTintColor: theme.brand.primary,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: theme.surface.base },
        headerTitleStyle: { color: theme.text.title },
        headerShadowVisible: !isDark,
        contentStyle: { backgroundColor: theme.surface.base },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Customers', headerShown: false }} />
      <Stack.Screen
        name="add"
        options={{
          title: 'Add Customer',
          gestureEnabled: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
              <Ionicons name="chevron-back" size={28} color={theme.brand.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Customer Details' }} />
    </Stack>
  );
}