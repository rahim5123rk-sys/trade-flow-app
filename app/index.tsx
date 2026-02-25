import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { session, isLoading, role, userProfile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userProfile && role === 'admin') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (userProfile && role === 'worker') {
    return <Redirect href="/(worker)/jobs" />;
  }

  // Session exists but no profile yet — show loading
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}