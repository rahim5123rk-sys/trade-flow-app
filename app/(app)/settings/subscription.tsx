import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI } from '../../../constants/theme';
import { useSubscription } from '../../../src/context/SubscriptionContext';
import { useAppTheme } from '../../../src/context/ThemeContext';

const PRO_FEATURES = [
  { icon: 'people-outline' as const, label: 'Unlimited team members' },
  { icon: 'receipt-outline' as const, label: 'Invoices & quotes' },
  { icon: 'calendar-outline' as const, label: 'Smart scheduling & calendar' },
  { icon: 'person-add-outline' as const, label: 'Unlimited customers' },
  { icon: 'notifications-outline' as const, label: 'Renewal reminders' },
  { icon: 'image-outline' as const, label: 'Custom logo on documents' },
];

const PACKAGE_ORDER = ['$rc_monthly', '$rc_annual'];

function getPlanMeta(identifier: string) {
  switch (identifier) {
    case '$rc_monthly':
      return { label: 'Monthly', badge: null, badgeColor: null, note: '30-day free trial included' };
    case '$rc_annual':
      return { label: 'Annual', badge: 'Best Value', badgeColor: '#059669', note: 'Save 25% · £14.99/mo' };
    default:
      return { label: identifier, badge: null, badgeColor: null, note: '' };
  }
}

export default function SubscriptionScreen() {
  const { isDark, theme } = useAppTheme();
  const { isPro, isLoading, currentOffering, purchasePackage, restorePurchases, devResetToStarter } = useSubscription();
  const insets = useSafeAreaInsets();
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleDevReset = () => {
    Alert.alert('Reset to Starter', 'This will simulate Starter mode until you purchase again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await devResetToStarter();
        },
      },
    ]);
  };

  const bg = isDark ? theme.surface.base : '#F8FAFC';
  const cardBg = isDark ? theme.glass.bg : '#FFFFFF';
  const cardBorder = isDark ? theme.glass.border : '#E2E8F0';

  const sortedPackages = currentOffering?.availablePackages
    ?.filter((p) => PACKAGE_ORDER.includes(p.identifier))
    .sort((a, b) => PACKAGE_ORDER.indexOf(a.identifier) - PACKAGE_ORDER.indexOf(b.identifier)) ?? [];

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      await purchasePackage(selectedPkg);
      Alert.alert('Welcome to Pro!', 'You now have full access to all GasPilot features.');
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      Alert.alert('Done', 'Purchases restored successfully.');
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text.title} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.title }]}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* Current Plan */}
        <Animated.View entering={FadeInDown.delay(80)} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.planRow}>
            <View style={[styles.planBadge, isPro ? styles.planBadgePro : styles.planBadgeStarter]}>
              <Ionicons name={isPro ? 'diamond' : 'layers-outline'} size={15} color="#fff" />
              <Text style={styles.planBadgeText}>{isPro ? 'Pro' : 'Starter'}</Text>
            </View>
            <Text style={[styles.planLabel, { color: theme.text.muted }]}>Current plan</Text>
          </View>
          <Text style={[styles.planDesc, { color: theme.text.muted }]}>
            {isPro
              ? 'You have full access to all GasPilot features.'
              : 'Upgrade to unlock unlimited jobs, invoices, team management and more.'}
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.delay(160)} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.text.title }]}>What's included in Pro</Text>
          <View style={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={UI.brand.primary} />
                <Text style={[styles.featureLabel, { color: theme.text.body }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Plan Selector */}
        {!isPro && (
          <Animated.View entering={FadeInDown.delay(240)}>
            <Text style={[styles.sectionTitle, { color: theme.text.title, marginBottom: 12 }]}>Choose a plan</Text>

            {isLoading ? (
              <ActivityIndicator color={UI.brand.primary} style={{ marginVertical: 24 }} />
            ) : sortedPackages.length === 0 ? (
              <Text style={[styles.planDesc, { color: theme.text.muted, textAlign: 'center', marginVertical: 16 }]}>
                Plans unavailable — please try again later.
              </Text>
            ) : (
              sortedPackages.map((pkg) => {
                const meta = getPlanMeta(pkg.identifier);
                const isSelected = selectedPkg?.identifier === pkg.identifier;
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    onPress={() => setSelectedPkg(pkg)}
                    style={[
                      styles.planCard,
                      { backgroundColor: cardBg, borderColor: isSelected ? UI.brand.primary : cardBorder },
                      isSelected && styles.planCardSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={styles.planCardLeft}>
                      <View style={styles.planCardTitleRow}>
                        <Text style={[styles.planCardTitle, { color: theme.text.title }]}>{meta.label}</Text>
                        {meta.badge && (
                          <View style={[styles.planCardBadge, { backgroundColor: meta.badgeColor! }]}>
                            <Text style={styles.planCardBadgeText}>{meta.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.planCardNote, { color: theme.text.muted }]}>{meta.note}</Text>
                    </View>
                    <View style={styles.planCardRight}>
                      <Text style={[styles.planCardPrice, { color: theme.text.title }]}>
                        {pkg.product.priceString}
                      </Text>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              style={[styles.purchaseBtn, !selectedPkg && styles.purchaseBtnDisabled]}
              onPress={handlePurchase}
              disabled={!selectedPkg || purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="diamond" size={18} color="#fff" />
                  <Text style={styles.purchaseBtnText}>
                    {selectedPkg ? `Get ${getPlanMeta(selectedPkg.identifier).label}` : 'Select a plan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Manage Subscription (Pro users) */}
        {isPro && (
          <Animated.View entering={FadeInDown.delay(240)}>
            <TouchableOpacity
              style={[styles.manageBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={handleManageSubscription}
            >
              <Ionicons name="settings-outline" size={18} color={theme.text.title} />
              <Text style={[styles.manageBtnText, { color: theme.text.title }]}>Manage Subscription</Text>
              <Ionicons name="open-outline" size={16} color={theme.text.muted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Restore */}
        <Animated.View entering={FadeInDown.delay(320)}>
          <TouchableOpacity
            style={[styles.restoreBtn, { borderColor: cardBorder }]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color={theme.text.muted} />
            ) : (
              <Text style={[styles.restoreBtnText, { color: theme.text.muted }]}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Dev Reset (remove before production) */}
        {__DEV__ && isPro && (
          <Animated.View entering={FadeInDown.delay(400)}>
            <TouchableOpacity style={styles.devResetBtn} onPress={handleDevReset}>
              <Text style={styles.devResetText}>⚙️ DEV: Reset to Starter</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  planBadgeStarter: { backgroundColor: '#64748B' },
  planBadgePro: { backgroundColor: UI.brand.primary },
  planBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  planLabel: { fontSize: 13 },
  planDesc: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  featureList: { gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureLabel: { fontSize: 14 },
  planCard: {
    borderRadius: 14, borderWidth: 2,
    padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  planCardSelected: { borderWidth: 2 },
  planCardLeft: { flex: 1 },
  planCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  planCardTitle: { fontSize: 16, fontWeight: '700' },
  planCardBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  planCardBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planCardNote: { fontSize: 13 },
  planCardRight: { alignItems: 'flex-end', gap: 8 },
  planCardPrice: { fontSize: 16, fontWeight: '700' },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: UI.brand.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: UI.brand.primary },
  purchaseBtn: {
    backgroundColor: UI.brand.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 4, marginBottom: 12,
  },
  purchaseBtnDisabled: { opacity: 0.5 },
  purchaseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  restoreBtnText: { fontSize: 14, fontWeight: '600' },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12,
  },
  manageBtnText: { fontSize: 15, fontWeight: '600' },
  devResetBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 16 },
  devResetText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
});
