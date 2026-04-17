import {Ionicons} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {Redirect, Stack, router, usePathname} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Animated, {interpolate, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {UI} from '../../constants/theme';
import {useCalendarSync} from '../../hooks/useCalendarSync';
import {useAuth} from '../../src/context/AuthContext';
import {useOfflineMode} from '../../src/context/OfflineContext';
import {useAppTheme} from '../../src/context/ThemeContext';
import {TpiDeviceProvider} from '../../src/context/TpiDeviceContext';
import {registerForPushNotifications, setupNotificationListeners} from '../../src/services/notifications';

const ADMIN_FAB_ACTIONS = [
  {
    key: 'job',
    label: 'New Job',
    icon: 'briefcase-outline' as const,
    route: '/(app)/jobs/create',
  },
  {
    key: 'form',
    label: 'New Form',
    icon: 'document-text-outline' as const,
    route: '/(app)/forms',
  },
  {
    key: 'customer',
    label: 'New Customer',
    icon: 'person-add-outline' as const,
    route: '/(app)/customers/add',
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: 'hammer-outline' as const,
    route: '/(app)/toolbox',
  },
];

const WORKER_FAB_ACTIONS = [
  {
    key: 'job',
    label: 'New Job',
    icon: 'briefcase-outline' as const,
    route: '/(app)/jobs/create',
  },
  {
    key: 'form',
    label: 'New Form',
    icon: 'document-text-outline' as const,
    route: '/(app)/forms',
  },
  {
    key: 'cp12',
    label: 'Gas Cert',
    icon: 'flame-outline' as const,
    route: '/(app)/cp12',
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: 'hammer-outline' as const,
    route: '/(app)/toolbox',
  },
];

function FabMenuItem({
  action,
  index,
  onPress,
  progress,
  cardColor,
}: {
  action: {key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string};
  index: number;
  onPress: () => void;
  progress: SharedValue<number>;
  cardColor: string;
}) {
  const actionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {translateX: interpolate(progress.value, [0, 1], [18, 0])},
      {translateY: interpolate(progress.value, [0, 1], [8, -((index + 1) * 72)])},
      {scale: interpolate(progress.value, [0, 1], [0.92, 1])},
    ],
  }));

  return (
    <Animated.View style={[styles.fabMenuItemWrap, actionStyle]}>
      <TouchableOpacity activeOpacity={0.9} style={[styles.fabMenuTouch, {backgroundColor: cardColor}]} onPress={onPress}>
        <View style={[styles.fabMenuItem, {backgroundColor: cardColor}]}>
          <Ionicons name={action.icon} size={19} color="#111111" />
        </View>
        <Text style={styles.fabMenuText}>{action.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AppLayout() {
  const {session, isLoading, role, userProfile} = useAuth();
  const {offlineModeEnabled} = useOfflineMode();
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const fabBottomOffset = insets.bottom + NATIVE_TAB_BAR_HEIGHT + 14;
  const isAdmin = role === 'admin';
  const isOnTabs = pathname === '/dashboard' || pathname === '/calendar' || pathname === '/documents' || pathname === '/jobs' || pathname === '/' || pathname.startsWith('/jobs/');
  const hideGlobalFab = !isOnTabs || pathname.startsWith('/settings') || pathname.startsWith('/workers') || pathname.startsWith('/notes');
  useCalendarSync();
  const [fabOpen, setFabOpen] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (overlayVisible) {
      progress.value = withTiming(fabOpen ? 1 : 0, {duration: fabOpen ? 220 : 180});
    }
  }, [fabOpen, overlayVisible, progress]);

  useEffect(() => {
    const cleanup = setupNotificationListeners((data: Record<string, any>) => {
      if (data.type === 'job_assigned' && data.jobId) {
        router.push(`/(app)/jobs/${data.jobId}?showAcceptModal=true` as any);
      }
      if (data.type === 'quote_response' && data.documentId) {
        router.push(`/(app)/(tabs)/documents/${data.documentId}` as any);
      }
    });
    return cleanup;
  }, []);

  // Register push token so edge functions can send notifications
  useEffect(() => {
    if (userProfile?.id) {
      registerForPushNotifications(userProfile.id);
    }
  }, [userProfile?.id]);

  const toggleFab = () => {
    if (fabOpen) {
      setFabOpen(false);
      setTimeout(() => setOverlayVisible(false), 180);
      return;
    }

    setOverlayVisible(true);
    setFabOpen(true);
  };

  const closeFab = () => {
    setFabOpen(false);
    setTimeout(() => setOverlayVisible(false), 180);
  };

  const mainFabStyle = useAnimatedStyle(() => ({
    transform: [
      {rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg`},
      {scale: interpolate(progress.value, [0, 1], [1, 0.96])},
    ],
  }));

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
    <TpiDeviceProvider>
      <Stack screenOptions={{headerShown: false, gestureEnabled: false}}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="workers" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="forms" />
        <Stack.Screen name="cp12" />
        <Stack.Screen name="toolbox" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="invoice" options={{presentation: 'modal', gestureEnabled: true}} />
        <Stack.Screen name="quote" options={{presentation: 'modal', gestureEnabled: true}} />
      </Stack>

      {!hideGlobalFab ? (() => {
        const fabActions = isAdmin ? ADMIN_FAB_ACTIONS : WORKER_FAB_ACTIONS;
        const overlayHeight = fabActions.length * 72 + 20;
        return (
          <>
            {overlayVisible ? (
              <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                <Pressable style={StyleSheet.absoluteFill} onPress={closeFab}>
                  <BlurView
                    intensity={isDark ? 24 : 32}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                </Pressable>

                <View
                  pointerEvents="box-none"
                  style={[
                    styles.fabOverlay,
                    {bottom: fabBottomOffset, height: overlayHeight},
                  ]}
                >
                  {fabActions.map((action, index) => (
                    <FabMenuItem
                      key={action.key}
                      action={action}
                      index={index}
                      progress={progress}
                      cardColor="#FFFFFF"
                      onPress={() => {
                        closeFab();
                        router.push(action.route as any);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View
              pointerEvents="box-none"
              style={[
                styles.globalFabWrap,
                {bottom: fabBottomOffset},
              ]}
            >
              <Animated.View style={mainFabStyle}>
                <TouchableOpacity activeOpacity={0.9} style={styles.globalFab} onPress={toggleFab}>
                  <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        );
      })() : null}

      {offlineModeEnabled ? (
        <View pointerEvents="none" style={[styles.offlineBanner, {position: 'absolute', top: insets.top, left: 0, right: 0}, isDark && {backgroundColor: theme.text.muted}]}>
          <Ionicons name="cloud-offline-outline" size={14} color={theme.text.white} />
          <Text style={[styles.offlineBannerText, {color: theme.text.white}]}>Offline Mode Enabled</Text>
        </View>
      ) : null}
    </TpiDeviceProvider>
  );
}

const NATIVE_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

const styles = StyleSheet.create({
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
  globalFabWrap: {
    position: 'absolute',
    right: 20,
  },
  globalFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  fabOverlay: {
    position: 'absolute',
    right: 20,
    width: 240,
  },
  fabMenuItemWrap: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  fabMenuTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 208,
    height: 58,
    borderRadius: 18,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  fabMenuItem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  fabMenuText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
    marginLeft: 12,
    lineHeight: 22,
    textAlign: 'left',
    includeFontPadding: false,
  },
});
