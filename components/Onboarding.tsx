// ============================================
// FILE: components/Onboarding.tsx
// Reusable first-run onboarding overlay with
// animated tip cards, arrows and dot indicators
// ============================================

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    SlideInDown,
    SlideInUp
} from 'react-native-reanimated';
import { UI } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types ─────────────────────────────────
export interface OnboardingTip {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Where the arrow points: top / bottom / left / right / none */
  arrowDirection?: 'up' | 'down' | 'left' | 'right' | 'none';
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
const Arrow = ({ direction }: { direction: string }) => {
  const arrowMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    up: 'arrow-up',
    down: 'arrow-down',
    left: 'arrow-back',
    right: 'arrow-forward',
  };

  if (direction === 'none' || !arrowMap[direction]) return null;

  const entering =
    direction === 'up'
      ? SlideInDown.delay(300).springify()
      : direction === 'down'
        ? SlideInUp.delay(300).springify()
        : FadeIn.delay(300);

  return (
    <Animated.View entering={entering} style={[arrowStyles.container, arrowStyles[direction as keyof typeof arrowStyles]]}>
      <View style={arrowStyles.pulse}>
        <Ionicons name={arrowMap[direction]} size={28} color="#fff" />
      </View>
    </Animated.View>
  );
};

const arrowStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  pulse: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(29, 78, 216, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  up: { marginBottom: 12 },
  down: { marginTop: 12 },
  left: { marginRight: 12 },
  right: { marginLeft: 12 },
});

// ─── Main Onboarding Component ─────────────
export default function Onboarding({ screenKey, tips, onComplete }: OnboardingProps) {
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
  const accent = tip.accent || UI.brand.primary;
  const arrow = tip.arrowDirection || 'none';

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={s.backdrop}>
        {/* Arrow above card */}
        {(arrow === 'up' || arrow === 'left') && (
          <Arrow direction={arrow} />
        )}

        {/* Tip Card */}
        <Animated.View
          key={step}
          entering={FadeInDown.delay(100).springify()}
          exiting={FadeOut.duration(150)}
          style={s.card}
        >
          {/* Skip button */}
          {!isLast && (
            <TouchableOpacity onPress={skip} style={s.skipBtn} hitSlop={16}>
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
          )}

          {/* Icon */}
          <View style={[s.iconRing, { backgroundColor: accent + '18' }]}>
            <Ionicons name={tip.icon} size={32} color={accent} />
          </View>

          {/* Title */}
          <Text style={s.title}>{tip.title}</Text>
          <Text style={s.desc}>{tip.description}</Text>

          {/* Dots */}
          {tips.length > 1 && (
            <View style={s.dots}>
              {tips.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    i === step ? { backgroundColor: accent, width: 20 } : {},
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
              size={20}
              color="#fff"
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>

          {/* Step counter */}
          <Text style={s.counter}>
            {step + 1} of {tips.length}
          </Text>
        </Animated.View>

        {/* Arrow below card */}
        {(arrow === 'down' || arrow === 'right') && (
          <Arrow direction={arrow} />
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.text.muted,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: UI.text.title,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 15,
    color: UI.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI.surface.divider,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    marginBottom: 12,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  counter: {
    fontSize: 12,
    color: UI.text.muted,
    fontWeight: '500',
  },
});
