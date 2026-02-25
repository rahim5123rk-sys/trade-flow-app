import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { isLoading, isAuthenticated, role } = useAuth();

  // 1. Show a loading spinner while checking Firebase Auth status
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // 2. If not logged in, send to the Login screen
  // URL path for app/(auth)/login.tsx is "/login"
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // 3. If Admin, send to Dashboard
  // URL path for app/(admin)/dashboard.tsx is "/dashboard"
  if (role === 'admin') {
    return <Redirect href="/dashboard" />;
  }

  // 4. If Worker, send to Jobs List
  // URL path for app/(worker)/jobs/index.tsx is "/jobs"
  if (role === 'worker') {
    return <Redirect href="/jobs" />;
  }

  // Fallback (e.g. if role is not yet assigned)
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});