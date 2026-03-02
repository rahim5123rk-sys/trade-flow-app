import { Stack } from 'expo-router';
import React from 'react';
import { useAppTheme } from '../../../src/context/ThemeContext';

export default function JobsLayout() {
  const { theme, isDark } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.surface.base },
        headerStyle: { backgroundColor: theme.surface.base },
        headerTitleStyle: { color: theme.text.title },
      }}
    >
      {/* 1. Job List */}
      <Stack.Screen name="index" />

      {/* 2. Create Job (Modal) */}
      <Stack.Screen 
        name="create" 
        options={{ 
            presentation: 'modal',
            headerShown: true, 
            title: 'New Job',
            headerTintColor: theme.brand.primary,
            headerShadowVisible: !isDark,
        }} 
      />

      {/* 3. Job Details — custom header, no native bar */}
      <Stack.Screen 
        name="[id]/index" 
        options={{ 
            headerShown: false,
        }} 
      />

      {/* 4. Edit Job (Modal) */}
      <Stack.Screen 
        name="[id]/edit" 
        options={{ 
            presentation: 'modal', 
            headerShown: true,
            title: 'Edit Job',
            headerTintColor: theme.brand.primary,
            headerShadowVisible: !isDark,
        }} 
      />

    </Stack>
  );
}