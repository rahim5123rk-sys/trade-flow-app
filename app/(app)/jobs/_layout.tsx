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

      {/* 3. Job Details */}
      <Stack.Screen 
        name="[id]/index" 
        options={{ 
            headerShown: true, 
            title: 'Job Details',
            headerTintColor: Colors.primary,
            headerBackTitle: "", // ✅ Fixed: Use empty string instead of headerBackTitleVisible
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

      {/* 5. Invoice */}
      <Stack.Screen 
        name="[id]/invoice" 
        options={{ 
            headerShown: true,
            title: 'Invoice',
            headerTintColor: Colors.primary
        }} 
      />
    </Stack>
  );
}