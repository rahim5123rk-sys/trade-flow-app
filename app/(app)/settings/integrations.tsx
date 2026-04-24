// Integrations — Pro only. Today: Xero. More to come (QuickBooks, FreeAgent).
//
// OAuth flow:
//   1. Call edge fn xero-oauth-start → returns auth URL
//   2. Open in in-app browser (WebBrowser.openAuthSessionAsync)
//   3. Xero redirects to our edge fn callback, which stores tokens + redirects
//      to gaspilotapp.com/xero-connected (the URL WebBrowser is watching for)
//   4. Browser closes, we refetch status

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, UI} from '../../../constants/theme';
import {supabase} from '../../../src/config/supabase';
import {useAuth} from '../../../src/context/AuthContext';
import {useSubscription} from '../../../src/context/SubscriptionContext';
import {useAppTheme} from '../../../src/context/ThemeContext';

type XeroStatus = {
  connected: boolean;
  tenant_name?: string | null;
  connected_at?: string | null;
};

export default function IntegrationsScreen() {
  const {theme, isDark} = useAppTheme();
  const {userProfile} = useAuth();
  const {isPro} = useSubscription();
  const insets = useSafeAreaInsets();
  const isAdmin = userProfile?.role === 'admin';

  const [status, setStatus] = useState<XeroStatus>({connected: false});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!userProfile?.company_id) {
      setLoading(false);
      return;
    }
    const {data} = await supabase
      .from('xero_connection_status')
      .select('tenant_name, connected_at')
      .eq('company_id', userProfile.company_id)
      .maybeSingle();
    setStatus({
      connected: !!data,
      tenant_name: data?.tenant_name ?? null,
      connected_at: data?.connected_at ?? null,
    });
    setLoading(false);
  }, [userProfile?.company_id]);

  useFocusEffect(useCallback(() => { void loadStatus(); }, [loadStatus]));

  const handleConnect = async () => {
    if (!isAdmin) {
      Alert.alert('Admin only', 'Only an admin can connect Xero for the company.');
      return;
    }
    setConnecting(true);
    try {
      const {data, error} = await supabase.functions.invoke('xero-oauth-start');
      if (error) throw error;
      const authUrl = data?.url;
      if (!authUrl) throw new Error('Failed to start Xero connection.');
      // Open in in-app browser; wait for redirect back to our success URL.
      await WebBrowser.openAuthSessionAsync(authUrl, 'https://gaspilotapp.com/xero-connected');
      await loadStatus();
    } catch (e: any) {
      Alert.alert('Connection failed', e?.message || 'Could not start Xero OAuth.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Xero?',
      'Future invoices won\'t push to Xero. Existing invoices already in Xero stay there.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              const {error} = await supabase.functions.invoke('xero-disconnect');
              if (error) throw error;
              await loadStatus();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not disconnect.');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{flex: 1}}>
      <LinearGradient
        colors={isDark ? theme.gradients.appBackground : UI.gradients.appBackground}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{paddingTop: insets.top + 20, paddingBottom: 80, paddingHorizontal: 16}}
        showsVerticalScrollIndicator={false}
      >
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 24}}>
          <TouchableOpacity onPress={() => router.back()} style={{padding: 6, marginRight: 8}}>
            <Ionicons name="chevron-back" size={24} color={theme.text.title} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, {color: theme.text.title}]}>Integrations</Text>
            <Text style={[styles.subtitle, {color: theme.text.muted}]}>Connect GasPilot to tools you already use</Text>
          </View>
        </View>

        {!isPro ? (
          <View style={[styles.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={20} color={theme.text.muted} />
              <Text style={[styles.lockText, {color: theme.text.title}]}>Integrations are a Pro feature</Text>
            </View>
            <Text style={[styles.lockSub, {color: theme.text.muted}]}>
              Upgrade to Pro to connect your accounting tools and push invoices automatically.
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push('/(app)/settings/subscription')}
            >
              <LinearGradient colors={UI.gradients.primary} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.upgradeBtnInner}>
                <Text style={styles.upgradeBtnText}>See Pro plans</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border}]}>
            <View style={styles.providerRow}>
              <View style={styles.providerIcon}>
                <Text style={{fontSize: 20, fontWeight: '800', color: '#13B5EA'}}>X</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={[styles.providerName, {color: theme.text.title}]}>Xero</Text>
                <Text style={[styles.providerDesc, {color: theme.text.muted}]}>
                  Push sent invoices to Xero as drafts automatically.
                </Text>
              </View>
            </View>

            <View style={[styles.divider, isDark && {backgroundColor: theme.surface.divider}]} />

            {loading ? (
              <ActivityIndicator color={theme.brand.primary} style={{marginVertical: 20}} />
            ) : status.connected ? (
              <View>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotOn} />
                  <Text style={[styles.statusText, {color: theme.text.title}]}>Connected</Text>
                </View>
                {status.tenant_name && (
                  <Text style={[styles.tenantText, {color: theme.text.muted}]}>{status.tenant_name}</Text>
                )}
                <TouchableOpacity
                  style={[styles.dangerBtn, disconnecting && {opacity: 0.6}]}
                  onPress={handleDisconnect}
                  disabled={disconnecting || !isAdmin}
                >
                  {disconnecting ? (
                    <ActivityIndicator size="small" color={Colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="unlink-outline" size={16} color={Colors.danger} />
                      <Text style={styles.dangerBtnText}>Disconnect Xero</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.statusRow}>
                  <View style={styles.statusDotOff} />
                  <Text style={[styles.statusText, {color: theme.text.muted}]}>Not connected</Text>
                </View>
                <Text style={[styles.tenantText, {color: theme.text.muted, marginBottom: 14}]}>
                  When connected, every invoice you send is automatically created in Xero as a draft — ready for you to approve.
                </Text>
                <TouchableOpacity
                  style={[styles.connectBtn, (connecting || !isAdmin) && {opacity: 0.6}]}
                  onPress={handleConnect}
                  disabled={connecting || !isAdmin}
                >
                  <LinearGradient colors={UI.gradients.primary} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.connectBtnInner}>
                    {connecting ? (
                      <ActivityIndicator size="small" color={UI.text.white} />
                    ) : (
                      <>
                        <Ionicons name="link" size={16} color={UI.text.white} />
                        <Text style={styles.connectBtnText}>Connect Xero</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                {!isAdmin && (
                  <Text style={[styles.tenantText, {color: theme.text.muted, marginTop: 10}]}>
                    Only an admin can connect Xero.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {fontSize: 28, fontWeight: '800', letterSpacing: -0.5},
  subtitle: {fontSize: 13, marginTop: 2},
  card: {
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...Colors.shadow,
  },
  providerRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(19,181,234,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {fontSize: 17, fontWeight: '700'},
  providerDesc: {fontSize: 13, marginTop: 2},
  divider: {height: 1, backgroundColor: 'rgba(148,163,184,0.18)', marginVertical: 14},
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  statusDotOn: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981'},
  statusDotOff: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8'},
  statusText: {fontSize: 14, fontWeight: '600'},
  tenantText: {fontSize: 13, marginBottom: 12},
  connectBtn: {borderRadius: 12, overflow: 'hidden'},
  connectBtnInner: {paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6},
  connectBtnText: {color: UI.text.white, fontSize: 15, fontWeight: '700'},
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    marginTop: 10,
  },
  dangerBtnText: {color: Colors.danger, fontSize: 14, fontWeight: '700'},
  lockRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6},
  lockText: {fontSize: 15, fontWeight: '700'},
  lockSub: {fontSize: 13, marginBottom: 14},
  upgradeBtn: {borderRadius: 12, overflow: 'hidden'},
  upgradeBtnInner: {paddingVertical: 12, alignItems: 'center'},
  upgradeBtnText: {color: UI.text.white, fontSize: 15, fontWeight: '700'},
});
