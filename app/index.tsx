import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';

export default function Index() {
  const { session, isLoading } = useAuth();
  const { theme } = useAppTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface.base }}>
        <ActivityIndicator size="large" color={theme.brand.primary} />
      </View>
    );
  }

  // ✅ FIX: Redirect everyone to the new unified dashboard
  if (session) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}