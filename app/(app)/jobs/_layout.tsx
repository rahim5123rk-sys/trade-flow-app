import { Stack } from 'expo-router';
import React from 'react';
import { Colors } from '../../../constants/theme';

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
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
            headerTintColor: Colors.primary 
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
            headerTintColor: Colors.primary
        }} 
      />

    </Stack>
  );
}