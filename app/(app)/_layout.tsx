import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function AppLayout() {
  const { session, isLoading, userProfile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const isAdmin = userProfile?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid-outline" size={22} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={22} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => (
            <Ionicons name="briefcase-outline" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={22} color={color} />
          ),
        }}
        redirect={!isAdmin}
      />
      
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={22} color={color} />
          ),
        }}
      />

      {/* Hidden Screens — NOT in tab bar */}
      <Tabs.Screen name="workers" options={{ href: null }} />

      {/* 
        IMPORTANT: Hide the documents folder from the tab bar.
        Documents are now accessed from the Dashboard action grid.
        
        NOTE: Your folder is currently named "douments" (typo — missing 'c').
        You MUST rename it to "documents" in your project:
          app/(app)/douments/  →  app/(app)/documents/
        
        Once renamed, change the name below from "douments" to "documents".
        Until you rename it, keep this as "douments" so it matches the actual folder.
      */}
      <Tabs.Screen name="documents" options={{ href: null }} />
    </Tabs>
  );
}