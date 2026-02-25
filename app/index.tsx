import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { session, isLoading, role } = useAuth();

  // Show a loading spinner while checking the Supabase session
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // If no session exists, send user to the Auth flow
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // If logged in, redirect based on their assigned role in the profiles table
  if (role === 'admin') {
    return <Redirect href="/(admin)/dashboard" />;
  } 
  
  if (role === 'worker') {
    return <Redirect href="/(worker)/jobs" />;
  }

  // Fallback if role is not yet assigned or recognized
  return <Redirect href="/(auth)/login" />;
}