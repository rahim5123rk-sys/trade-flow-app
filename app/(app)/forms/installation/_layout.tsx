import {Stack} from 'expo-router';
import React from 'react';
import {useAppTheme} from '../../../../src/context/ThemeContext';

export default function InstallationLayout() {
  const {theme} = useAppTheme();
  return (
    <Stack screenOptions={{headerShown: false, contentStyle: {backgroundColor: theme.surface.base}}}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
