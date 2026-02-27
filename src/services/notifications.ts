// ============================================
// FILE: src/services/notifications.ts
// ============================================

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });

    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job Updates',
      description: 'Notifications about job assignments and status changes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    if (!projectId) {
      console.error('No projectId found. Make sure EAS is configured.');
      return null;
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData;
    console.log('Push token registered');

    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('Failed to save push token:', error.message);
    }

    return token;
  } catch (e) {
    console.error('Error getting push token:', e);
    return null;
  }
}

export function setupNotificationListeners(
  onNotificationTapped: (data: Record<string, any>) => void
): () => void {
  const receivedSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received');
    });

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data) {
        onNotificationTapped(data);
      }
    });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export async function sendPushNotification(
  pushTokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const validTokens = pushTokens.filter(
    (t) => t && t.startsWith('ExponentPushToken')
  );

  if (validTokens.length === 0) return;

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title,
    body,
    data: data || {},
    channelId: 'jobs',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (result.errors) {
      console.warn('Push notification errors:', result.errors);
    }
  } catch (e) {
    console.warn('Failed to send push notification:', e);
  }
}

export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}