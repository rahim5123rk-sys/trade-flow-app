// ============================================
// FILE: components/Onboarding.tsx
// Reusable first-run onboarding overlay with
// positioned tooltip cards that point at real UI
// ============================================

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI } from '../constants/theme';
import { useAppTheme } from '../src/context/ThemeContext';

// ─── Types ─────────────────────────────────
export interface OnboardingTip {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Where the card should appear on screen */
  position?: 'top' | 'center' | 'bottom';
  /** Where the arrow points relative to the card */
  arrowDirection?: 'up' | 'down' | 'none';
  /** Accent colour for the icon ring */
  accent?: string;
}

interface OnboardingProps {
  /** Unique key — used to store "has seen" flag in AsyncStorage */
  screenKey: string;
  tips: OnboardingTip[];
  /** Called when the walkthrough finishes or is skipped */
  onComplete?: () => void;
}

// ─── Storage helpers ───────────────────────
const storageKey = (k: string) => `@onboarding_seen_${k}`;

export const resetOnboarding = async (screenKey: string) => {
  await AsyncStorage.removeItem(storageKey(screenKey));
};

export const resetAllOnboarding = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const onboardingKeys = keys.filter((k) => k.startsWith('@onboarding_seen_'));
  if (onboardingKeys.length > 0) await AsyncStorage.multiRemove(onboardingKeys);
};

// ─── Arrow Component ───────────────────────
const Arrow = ({ direction, accent }: { direction: string; accent: string }) => {
  if (direction === 'none' || (direction !== 'up' && direction !== 'down')) return null;

  const isUp = direction === 'up';

  return (
    <Animated.View
      entering={isUp ? FadeInDown.delay(200).duration(300) : FadeInUp.delay(200).duration(300)}
      style={[arrowStyles.container, isUp ? { marginBottom: 8 } : { marginTop: 8 }]}
    >
      <View style={[arrowStyles.arrow, isUp ? arrowStyles.arrowUp : arrowStyles.arrowDown, { borderBottomColor: accent, borderTopColor: accent }]} />
    </Animated.View>
  );
};

const arrowStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  arrowUp: {
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: {
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

// ─── Main Onboarding Component ─────────────
export default function Onboarding({ screenKey, tips, onComplete }: OnboardingProps) {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem(storageKey(screenKey));
      if (!seen) setVisible(true);
    })();
  }, [screenKey]);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(storageKey(screenKey), '1');
    setVisible(false);
    onComplete?.();
  }, [screenKey, onComplete]);

  const next = () => {
    if (step < tips.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const skip = () => finish();

  if (!visible || tips.length === 0) return null;

  const tip = tips[step];
  const isLast = step === tips.length - 1;
  const accent = tip.accent || (isDark ? theme.brand.primary : UI.brand.primary);
  const arrow = tip.arrowDirection || 'none';
  const position = tip.position || 'center';

  // Position the card on screen
  const justifyContent =
    position === 'top' ? 'flex-start' :
    position === 'bottom' ? 'flex-end' :
    'center';

  const paddingTop = position === 'top' ? insets.top + 60 : 0;
  const paddingBottom = position === 'bottom' ? insets.bottom + 70 : 0;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={[s.backdrop, { justifyContent, paddingTop, paddingBottom }]}>
        {/* Arrow above card */}
        {arrow === 'up' && <Arrow direction="up" accent={accent} />}

        {/* Tip Card */}
        <Animated.View
          key={step}
          entering={position === 'bottom' ? FadeInUp.delay(100).springify() : FadeInDown.delay(100).springify()}
          exiting={FadeOut.duration(150)}
          style={[s.card, isDark && { backgroundColor: theme.surface.card, borderColor: theme.surface.border }]}
        >
          {/* Header row: icon + skip */}
          <View style={s.cardHeader}>
            <View style={[s.iconRing, { backgroundColor: accent + '18' }]}>
              <Ionicons name={tip.icon} size={26} color={accent} />
            </View>
            {!isLast && (
              <TouchableOpacity onPress={skip} hitSlop={16}>
                <Text style={[s.skipText, isDark && { color: theme.text.muted }]}>Skip tour</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Title */}
          <Text style={[s.title, isDark && { color: theme.text.title }]}>{tip.title}</Text>
          <Text style={[s.desc, isDark && { color: theme.text.secondary }]}>{tip.description}</Text>

          {/* Footer: dots + button */}
          <View style={s.footer}>
            {/* Dots */}
            {tips.length > 1 && (
              <View style={s.dots}>
                {tips.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      isDark && { backgroundColor: theme.surface.border },
                      i === step ? { backgroundColor: accent, width: 18 } : {},
                    ]}
                  />
                ))}
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              onPress={next}
              style={[s.cta, { backgroundColor: accent }]}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>{isLast ? 'Get Started' : 'Next'}</Text>
              <Ionicons
                name={isLast ? 'checkmark-circle' : 'arrow-forward'}
                size={18}
                color="#fff"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Arrow below card */}
        {arrow === 'down' && <Arrow direction="down" accent={accent} />}
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.text.muted,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: UI.text.title,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 14,
    color: UI.text.secondary,
    lineHeight: 21,
    marginBottom: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: UI.surface.divider,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
