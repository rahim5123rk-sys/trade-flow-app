import {Stack} from 'expo-router';
import React from 'react';
import {useAppTheme} from '../../../src/context/ThemeContext';

export default function WorkersLayout() {
  const {theme, isDark} = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.brand.primary,
        headerBackTitle: 'Back',
        headerStyle: {backgroundColor: theme.surface.base},
        headerTitleStyle: {color: theme.text.title},
        contentStyle: {backgroundColor: theme.surface.base},
      }}
    >
      <Stack.Screen name="index" options={{title: 'Team', headerShown: false}} />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Worker Details',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: 'Add Worker',
          presentation: 'modal',
          headerShadowVisible: !isDark,
        }}
      />
    </Stack>
  );
}