import {Ionicons} from '@expo/vector-icons';
import {Redirect, Tabs} from 'expo-router';
import React from 'react';
import {ActivityIndicator, Platform, StyleSheet, Text, View} from 'react-native';
import {HapticTab} from '../../components/haptic-tab';
import {UI} from '../../constants/theme';
import {useAuth} from '../../src/context/AuthContext';
import {useOfflineMode} from '../../src/context/OfflineContext';
import {useAppTheme} from '../../src/context/ThemeContext';

export default function AppLayout() {
  const {session, isLoading, role} = useAuth();
  const {offlineModeEnabled} = useOfflineMode();
  const {theme, colors, isDark} = useAppTheme();
  const isAdmin = role === 'admin';

  if (isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface.base}}>
        <ActivityIndicator size="large" color={theme.brand.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{flex: 1, backgroundColor: theme.surface.base}}>
      {offlineModeEnabled ? (
        <View style={[styles.offlineBanner, isDark && {backgroundColor: theme.text.muted}]}>
          <Ionicons name="cloud-offline-outline" size={14} color={theme.text.white} />
          <Text style={[styles.offlineBannerText, {color: theme.text.white}]}>Offline Mode Enabled</Text>
        </View>
      ) : null}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: theme.brand.primary,
          tabBarInactiveTintColor: theme.text.muted,
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: [styles.tabBar, isDark && {borderTopColor: 'rgba(255,255,255,0.06)'}],
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, {backgroundColor: theme.surface.base, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}]} />
          ),
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({color, focused}) => (
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({color, focused}) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: ({color, focused}) => (
              <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="documents"
          options={{
            title: 'Docs',
            href: isAdmin ? undefined : null,
            tabBarIcon: ({color, focused}) => (
              <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ─── HIDDEN SCREENS ─── */}
        <Tabs.Screen name="customers" options={{href: null}} />
        <Tabs.Screen name="workers" options={{href: null}} />
        <Tabs.Screen name="invoice" options={{href: null}} />
        <Tabs.Screen name="quote" options={{href: null}} />
        <Tabs.Screen name="settings/index" options={{href: null}} />
        <Tabs.Screen name="settings/user-details" options={{href: null}} />
        <Tabs.Screen name="settings/company-details" options={{href: null}} />
        <Tabs.Screen name="settings/privacy-policy" options={{href: null}} />
        <Tabs.Screen name="settings/terms-of-service" options={{href: null}} />
        <Tabs.Screen name="cp12" options={{href: null}} />
        <Tabs.Screen name="forms" options={{href: null}} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
  },
  tabBg: {
    backgroundColor: UI.surface.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: UI.status.pending,
  },
  offlineBannerText: {
    color: UI.text.white,
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});