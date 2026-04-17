// ============================================
// FILE: app/(app)/forms/index.tsx
// Forms Hub – Browse & create gas forms
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router} from 'expo-router';
import React, {useState} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeIn, FadeInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GlassIconButton} from '../../../components/GlassIconButton';
import ProPaywallModal from '../../../components/ProPaywallModal';
import {UI} from '../../../constants/theme';
import {useSubscription} from '../../../src/context/SubscriptionContext';
import {useAppTheme} from '../../../src/context/ThemeContext';
import {FORM_REGISTRY, FormDefinition} from '../../../src/types/forms';

const FREE_FORM_TYPES = ['cp12'];

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;

// ─── Form Card ──────────────────────────────────────────────────

function FormCard({
  form,
  index,
  isDark,
  theme,
  isLocked,
  onLockedPress,
}: {
  form: FormDefinition;
  index: number;
  isDark: boolean;
  theme: any;
  isLocked: boolean;
  onLockedPress: () => void;
}) {
  const handlePress = () => {
    if (!form.available) return;
    if (isLocked) {onLockedPress(); return;}
    router.push(form.route as any);
  };

  const dimmed = !form.available || isLocked;

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 60).springify()}>
      <TouchableOpacity
        style={[
          styles.card,
          isDark && {backgroundColor: theme.surface.card, shadowColor: 'transparent'},
          !form.available && styles.cardDisabled,
        ]}
        onPress={handlePress}
        activeOpacity={form.available ? 0.7 : 1}
      >
        <View style={styles.cardRow}>
          <LinearGradient
            colors={form.gradient as [string, string]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={[styles.iconCircle, dimmed && {opacity: 0.4}]}
          >
            {isLocked ? (
              <Ionicons name="lock-closed" size={22} color="#fff" />
            ) : (
              <Ionicons name={form.icon as any} size={24} color="#fff" />
            )}
          </LinearGradient>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text
                style={[
                  styles.cardTitle,
                  isDark && {color: theme.text.title},
                  dimmed && {opacity: 0.5},
                ]}
                numberOfLines={1}
              >
                {form.shortLabel}
              </Text>
              {!form.available && (
                <View style={[styles.comingSoonBadge, isDark && {backgroundColor: theme.surface.elevated}]}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              )}
              {isLocked && form.available && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.cardDescription,
                isDark && {color: theme.text.muted},
                dimmed && {opacity: 0.5},
              ]}
              numberOfLines={2}
            >
              {form.description}
            </Text>
            <View style={styles.cardMeta}>
              <View style={styles.metaChip}>
                <Ionicons name="layers-outline" size={12} color={form.available && !isLocked ? form.color : UI.text.muted} />
                <Text style={[styles.metaText, form.available && !isLocked && {color: form.color}]}>
                  {form.stepsCount} steps
                </Text>
              </View>
            </View>
          </View>

          {form.available && !isLocked && (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? theme.text.muted : UI.text.muted}
            />
          )}
          {isLocked && (
            <Ionicons
              name="diamond"
              size={18}
              color={UI.brand.primary}
            />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ────────────────────────────────────────────────

export default function FormsHubScreen() {
  const {theme, isDark} = useAppTheme();
  const {isPro} = useSubscription();
  const insets = useSafeAreaInsets();
  const [showPaywall, setShowPaywall] = useState(false);

  const availableForms = FORM_REGISTRY.filter((f) => f.available);
  const comingSoonForms = FORM_REGISTRY.filter((f) => !f.available);

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ProPaywallModal
        visible={showPaywall}
        onDismiss={() => setShowPaywall(false)}
        featureTitle="All Gas Forms"
        featureDescription="Starter plan includes Gas Safety Certificates only. Upgrade to Pro for all 7 form types, unlimited."
      />
      <LinearGradient
        colors={theme.gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + 40}}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <GlassIconButton onPress={() => router.back()} />
          <View>
            <Text style={[styles.title, {color: theme.text.title}]}>Gas Forms</Text>
            <Text style={[styles.subtitle, {color: theme.text.muted}]}>
              Create certificates, notices & reports
            </Text>
          </View>
        </Animated.View>

        {/* Available forms */}
        {availableForms.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>
              Available
            </Text>
            {availableForms.map((form, i) => (
              <FormCard
                key={form.type}
                form={form}
                index={i}
                isDark={isDark}
                theme={theme}
                isLocked={!isPro && !FREE_FORM_TYPES.includes(form.type)}
                onLockedPress={() => setShowPaywall(true)}
              />
            ))}
          </View>
        )}

        {/* Coming soon forms */}
        {comingSoonForms.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isDark && {color: theme.text.muted}]}>
              Coming Soon
            </Text>
            {comingSoonForms.map((form, i) => (
              <FormCard
                key={form.type}
                form={form}
                index={availableForms.length + i}
                isDark={isDark}
                theme={theme}
                isLocked={false}
                onLockedPress={() => { }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {paddingHorizontal: 20},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: UI.text.title,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: UI.text.muted,
    fontWeight: '500',
    marginTop: 2,
  },

  // Sections
  section: {marginBottom: 20},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDisabled: {opacity: 0.85},
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {flex: 1},
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.text.title,
  },
  comingSoonBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: UI.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  proBadge: {
    backgroundColor: UI.brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 12,
    color: UI.text.muted,
    lineHeight: 17,
    marginTop: 3,
  },
  cardMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: UI.text.muted,
  },
});
