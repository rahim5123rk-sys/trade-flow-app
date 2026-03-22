import {Stack} from 'expo-router';
import React from 'react';
import {useAppTheme} from '../../../src/context/ThemeContext';

export default function NotesLayout() {
  const {theme} = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: {backgroundColor: theme.surface.base},
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
