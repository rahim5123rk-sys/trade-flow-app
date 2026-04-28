import {Ionicons} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {Redirect, Stack, router, usePathname} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Animated, {Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {UI} from '../../constants/theme';
import {useCalendarSync} from '../../hooks/useCalendarSync';
import {useAuth} from '../../src/context/AuthContext';
import {useOfflineMode} from '../../src/context/OfflineContext';
import {useAppTheme} from '../../src/context/ThemeContext';
import {TpiDeviceProvider} from '../../src/context/TpiDeviceContext';
import {registerForPushNotifications, setupNotificationListeners} from '../../src/services/notifications';

type FabAction = {
  key: string;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  accent: string;
};

const FAB_ACTIONS: FabAction[] = [
  {
    key: 'job',
    label: 'New Job',
    sub: 'Track time, materials and progress',
    icon: 'briefcase-outline',
    route: '/(app)/jobs/create',
    accent: '#3B82F6',
  },
  {
    key: 'certificate',
    label: 'New Certificate',
    sub: 'Gas safety, service & install records',
    icon: 'document-text-outline',
    route: '/(app)/forms',
    accent: '#10B981',
  },
  {
    key: 'invoice',
    label: 'New Invoice',
    sub: 'Bill a customer for work done',
    icon: 'receipt-outline',
    route: '/(app)/invoice',
    accent: '#F59E0B',
  },
];

export default function AppLayout() {
  const {session, isLoading, role, userProfile} = useAuth();
  const {offlineModeEnabled} = useOfflineMode();
  const {theme, isDark} = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const fabBottomOffset = insets.bottom + 18;
  const isOnTabs = pathname === '/dashboard' || pathname === '/calendar' || pathname === '/documents' || pathname === '/jobs' || pathname === '/' || pathname.startsWith('/jobs/');
  const hideGlobalFab = !isOnTabs || pathname.startsWith('/settings') || pathname.startsWith('/workers') || pathname.startsWith('/notes');
  useCalendarSync();
  const [fabOpen, setFabOpen] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (overlayVisible) {
      progress.value = withTiming(fabOpen ? 1 : 0, {duration: fabOpen ? 260 : 180});
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

  const menuContainerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{translateY: interpolate(progress.value, [0, 1], [-8, 0])}],
  }));

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
      {scale: interpolate(progress.value, [0, 1], [1, 0.94])},
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
        return (
          <>
            {overlayVisible ? (
              <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                <Pressable style={StyleSheet.absoluteFill} onPress={closeFab}>
                  <BlurView
                    intensity={isDark ? 60 : 70}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[StyleSheet.absoluteFill, {backgroundColor: isDark ? 'rgba(2,6,23,0.45)' : 'rgba(15,23,42,0.18)'}]} />
                </Pressable>

                <Animated.View
                  pointerEvents="box-none"
                  style={[styles.fabMenuContainer, {paddingBottom: fabBottomOffset + 96}, menuContainerStyle]}
                >
                  <Animated.View style={[styles.fabMenuHeader, headerStyle]}>
                    <View style={[styles.fabMenuGrabber, {backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.18)'}]} />
                    <Text style={[styles.fabMenuTitle, {color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)'}]}>
                      Quick actions
                    </Text>
                  </Animated.View>

                  <View style={styles.fabMenuList}>
                    {FAB_ACTIONS.map((action, i) => (
                      <FabMenuItem
                        key={action.key}
                        action={action}
                        index={i}
                        progress={progress}
                        isDark={isDark}
                        theme={theme}
                        onPress={() => {
                          closeFab();
                          router.push(action.route as any);
                        }}
                      />
                    ))}
                  </View>
                </Animated.View>
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

function FabMenuItem({
  action,
  index,
  progress,
  onPress,
  isDark,
  theme,
}: {
  action: FabAction;
  index: number;
  progress: SharedValue<number>;
  onPress: () => void;
  isDark: boolean;
  theme: any;
}) {
  const itemStyle = useAnimatedStyle(() => {
    const start = 0.08 + index * 0.14;
    const span = 0.55;
    const local = Math.max(0, Math.min(1, (progress.value - start) / span));
    return {
      opacity: local,
      transform: [
        {translateY: interpolate(local, [0, 1], [22, 0])},
        {scale: interpolate(local, [0, 1], [0.94, 1])},
      ],
    };
  });

  const rowBg = isDark ? theme.surface.elevated : '#FFFFFF';
  const borderColour = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const titleColour = isDark ? theme.text.title : '#0F172A';
  const subColour = isDark ? theme.text.muted : '#64748B';
  const chevronColour = isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF';

  return (
    <Animated.View style={itemStyle}>
      <Pressable
        onPress={onPress}
        style={({pressed}) => [
          styles.fabRow,
          {backgroundColor: rowBg, borderColor: borderColour},
          pressed && {transform: [{scale: 0.97}], opacity: 0.92},
        ]}
      >
        <View style={[styles.fabRowIconChip, {backgroundColor: action.accent + '1F'}]}>
          <Ionicons name={action.icon} size={22} color={action.accent} />
        </View>
        <View style={{flex: 1, marginLeft: 14}}>
          <Text style={[styles.fabRowTitle, {color: titleColour}]}>{action.label}</Text>
          <Text style={[styles.fabRowSub, {color: subColour}]} numberOfLines={1}>
            {action.sub}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={chevronColour} />
      </Pressable>
    </Animated.View>
  );
}

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
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  globalFab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  fabMenuContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  fabMenuHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  fabMenuGrabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  fabMenuTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  fabMenuList: {
    gap: 10,
  },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  fabRowIconChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabRowTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  fabRowSub: {
    fontSize: 12.5,
    fontWeight: '500',
  },
});
