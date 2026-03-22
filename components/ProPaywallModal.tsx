import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI } from '../constants/theme';
import { useAppTheme } from '../src/context/ThemeContext';

const PRO_PERKS = [
  { icon: 'receipt-outline' as const, label: 'Invoices & quotes' },
  { icon: 'calendar-outline' as const, label: 'Smart scheduling & calendar' },
  { icon: 'people-outline' as const, label: 'Unlimited team members' },
  { icon: 'person-add-outline' as const, label: 'Unlimited customers' },
  { icon: 'notifications-outline' as const, label: 'Renewal reminders' },
  { icon: 'image-outline' as const, label: 'Custom logo on documents' },
];

type Props = {
  visible: boolean;
  onDismiss: () => void;
  featureTitle: string;
  featureDescription?: string;
};

export default function ProPaywallModal({ visible, onDismiss, featureTitle, featureDescription }: Props) {
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const cardBg = isDark ? theme.surface.card : '#FFFFFF';
  const cardBorder = isDark ? theme.surface.border : '#E2E8F0';

  const handleUpgrade = () => {
    onDismiss();
    setTimeout(() => router.push('/(app)/settings/subscription'), 100);
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(350).springify()}
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          {/* Pro badge */}
          <View style={styles.badgeRow}>
            <View style={styles.proBadge}>
              <Ionicons name="diamond" size={16} color="#fff" />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text.title }]}>
            Unlock {featureTitle}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: theme.text.muted }]}>
            {featureDescription || 'This feature is available on the GasPilot Pro plan. Upgrade to unlock the full toolkit.'}
          </Text>

          {/* Feature list */}
          <View style={styles.featureList}>
            {PRO_PERKS.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={UI.brand.primary} />
                <Text style={[styles.featureLabel, { color: theme.text.body }]}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Upgrade button */}
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Ionicons name="diamond" size={18} color="#fff" />
            <Text style={styles.upgradeBtnText}>View Plans</Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} activeOpacity={0.7}>
            <Text style={[styles.dismissText, { color: theme.text.muted }]}>Not now</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI.brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  featureList: {
    gap: 10,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureLabel: {
    fontSize: 14,
  },
  upgradeBtn: {
    backgroundColor: UI.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
