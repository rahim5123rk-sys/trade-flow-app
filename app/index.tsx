import { Redirect } from 'expo-router';
import React from 'react';
import { Image, Text, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';
import { useSubscription } from '../src/context/SubscriptionContext';

export default function Index() {
  const { session, isLoading } = useAuth();
  const { theme, isDark } = useAppTheme();
  const { isPro } = useSubscription();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface.base }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../assets/images/iconlogo.png')}
            style={{ width: 34, height: 34, marginTop: -4 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 32, fontFamily: 'ClashDisplay-Semibold', color: isDark ? '#FFFFFF' : '#000000', letterSpacing: -0.5 }}>
            GasPilot
          </Text>
          {isPro && (
            <View style={{ backgroundColor: theme.brand.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>PRO</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ✅ FIX: Redirect everyone to the new unified dashboard
  if (session) {
    return <Redirect href={"/(app)/dashboard" as any} />;
  }

  return <Redirect href="/(auth)/login" />;
}