// ============================================
// FILE: components/SwipeableJobCard.tsx
// Swipe-to-update-status with glowing reveal
// and haptic feedback.
// ============================================

import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, {useCallback, useRef} from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

const IS_IOS = Platform.OS === 'ios';

// ─── Status flow ────────────────────────────────
type JobStatus = 'pending' | 'in_progress' | 'complete' | 'paid' | 'cancelled';

const SWIPE_THRESHOLD = 90;
const SPRING_CONFIG = {damping: 18, stiffness: 220, mass: 0.7};

interface StatusMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  glowBg: string;
}

const NEXT_STATUS_META: Record<string, StatusMeta> = {
  pending: {label: 'Start', icon: 'play', color: '#3B82F6', glowBg: '#DBEAFE'},
  in_progress: {label: 'Done', icon: 'checkmark-circle', color: '#10B981', glowBg: '#D1FAE5'},
  complete: {label: 'Paid', icon: 'cash', color: '#8B5CF6', glowBg: '#EDE9FE'},
};

const PREV_STATUS_META: Record<string, StatusMeta> = {
  in_progress: {label: 'Reopen', icon: 'arrow-undo', color: '#F59E0B', glowBg: '#FEF3C7'},
  complete: {label: 'Reopen', icon: 'arrow-undo', color: '#F59E0B', glowBg: '#FEF3C7'},
  paid: {label: 'Reopen', icon: 'arrow-undo', color: '#F59E0B', glowBg: '#FEF3C7'},
  pending: {label: 'Delete', icon: 'trash', color: '#EF4444', glowBg: '#FEE2E2'},
};

// ─── Props ──────────────────────────────────────
interface SwipeableJobCardProps {
  children: React.ReactNode;
  status: JobStatus;
  isAdmin: boolean;
  onAdvanceStatus: () => void;
  onRevertStatus: () => void;
  onDelete: () => void;
}

export function SwipeableJobCard({
  children,
  status,
  isAdmin,
  onAdvanceStatus,
  onRevertStatus,
  onDelete,
}: SwipeableJobCardProps) {
  const translateX = useSharedValue(0);
  const triggered = useSharedValue(false);
  const isActive = useSharedValue(false);
  const hasTriggeredHaptic = useRef(false);

  const nextMeta = NEXT_STATUS_META[status];
  const prevMeta = PREV_STATUS_META[status];

  const canAdvance = status !== 'paid' && status !== 'cancelled';
  const canRevert = isAdmin;

  const triggerHaptic = useCallback(() => {
    if (!hasTriggeredHaptic.current) {
      hasTriggeredHaptic.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const untriggerHaptic = useCallback(() => {
    if (hasTriggeredHaptic.current) {
      hasTriggeredHaptic.current = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const resetHaptic = useCallback(() => {
    hasTriggeredHaptic.current = false;
  }, []);

  const handleAdvance = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdvanceStatus();
  }, [onAdvanceStatus]);

  const handleRevert = useCallback(() => {
    if (status === 'pending') {
      onDelete();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onRevertStatus();
    }
  }, [status, onRevertStatus, onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      isActive.value = true;
      triggered.value = false;
      runOnJS(resetHaptic)();
    })
    .onUpdate((event) => {
      let x = event.translationX;
      if (!canAdvance && x > 0) x = 0;
      if (!canRevert && x < 0) x = 0;

      // Rubber-band after threshold
      if (Math.abs(x) > SWIPE_THRESHOLD) {
        const over = Math.abs(x) - SWIPE_THRESHOLD;
        const sign = x > 0 ? 1 : -1;
        x = sign * (SWIPE_THRESHOLD + over * 0.25);
      }

      translateX.value = x;

      // Haptic at threshold crossing (both directions)
      const pastThreshold = Math.abs(x) >= SWIPE_THRESHOLD;
      if (pastThreshold && !triggered.value) {
        triggered.value = true;
        runOnJS(triggerHaptic)();
      } else if (!pastThreshold && triggered.value) {
        triggered.value = false;
        runOnJS(untriggerHaptic)();
      }
    })
    .onEnd(() => {
      isActive.value = false;
      const x = translateX.value;

      if (x >= SWIPE_THRESHOLD && canAdvance) {
        translateX.value = withSequence(
          withSpring(SWIPE_THRESHOLD * 1.15, SPRING_CONFIG),
          withSpring(0, {...SPRING_CONFIG, damping: 22}),
        );
        runOnJS(handleAdvance)();
      } else if (x <= -SWIPE_THRESHOLD && canRevert) {
        translateX.value = withSequence(
          withSpring(-SWIPE_THRESHOLD * 1.15, SPRING_CONFIG),
          withSpring(0, {...SPRING_CONFIG, damping: 22}),
        );
        runOnJS(handleRevert)();
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // ─── Animated styles ───────────────────────────

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  // Right action (advance) — slides in from left
  const rightActionStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      transform: [
        {translateX: interpolate(progress, [0, 1], [-20, 0], Extrapolation.CLAMP)},
      ],
    };
  });

  // Left action (revert/delete) — slides in from right
  const leftActionStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      transform: [
        {translateX: interpolate(progress, [0, 1], [20, 0], Extrapolation.CLAMP)},
      ],
    };
  });

  // Icon pulse when past threshold
  const rightIconPulse = useAnimatedStyle(() => {
    const past = translateX.value >= SWIPE_THRESHOLD;
    const s = past
      ? withSpring(1.3, {damping: 8, stiffness: 300})
      : withSpring(1, {damping: 12, stiffness: 200});
    return {transform: [{scale: s}]};
  });

  const leftIconPulse = useAnimatedStyle(() => {
    const past = translateX.value <= -SWIPE_THRESHOLD;
    const s = past
      ? withSpring(1.3, {damping: 8, stiffness: 300})
      : withSpring(1, {damping: 12, stiffness: 200});
    return {transform: [{scale: s}]};
  });

  // Glow border + shadow on the card as you drag
  const glowStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const isRight = translateX.value > 0;
    const glowColor = isRight
      ? (canAdvance && nextMeta ? nextMeta.color : 'transparent')
      : (canRevert && prevMeta ? prevMeta.color : 'transparent');

    const intensity = absX < 5
      ? 0
      : interpolate(absX, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);

    const bw = interpolate(intensity, [0, 1], [0, 2], Extrapolation.CLAMP);
    const sOpacity = IS_IOS
      ? interpolate(intensity, [0, 0.5, 1], [0, 0.25, 0.55], Extrapolation.CLAMP)
      : 0;
    const sRadius = IS_IOS
      ? interpolate(intensity, [0, 1], [0, 18], Extrapolation.CLAMP)
      : 0;
    const elev = IS_IOS ? 0 : interpolate(intensity, [0, 1], [2, 12], Extrapolation.CLAMP);

    return {
      borderColor: intensity > 0 ? glowColor : 'transparent',
      borderWidth: bw,
      shadowColor: glowColor,
      shadowOpacity: sOpacity,
      shadowRadius: sRadius,
      shadowOffset: {width: 0, height: 0},
      elevation: elev,
    };
  });

  return (
    <View style={styles.wrapper}>
      {/* Right action indicator (advance) */}
      {canAdvance && nextMeta && (
        <Animated.View style={[styles.actionContainer, styles.actionLeft, rightActionStyle]}>
          <View style={[styles.actionPill, {backgroundColor: nextMeta.glowBg}]}>
            <Animated.View style={rightIconPulse}>
              <View style={[styles.iconCircle, {backgroundColor: nextMeta.color}]}>
                <Ionicons name={nextMeta.icon} size={18} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={[styles.actionLabel, {color: nextMeta.color}]}>{nextMeta.label}</Text>
          </View>
        </Animated.View>
      )}

      {/* Left action indicator (revert/delete) */}
      {canRevert && prevMeta && (
        <Animated.View style={[styles.actionContainer, styles.actionRight, leftActionStyle]}>
          <View style={[styles.actionPill, {backgroundColor: prevMeta.glowBg}]}>
            <Text style={[styles.actionLabel, {color: prevMeta.color}]}>{prevMeta.label}</Text>
            <Animated.View style={leftIconPulse}>
              <View style={[styles.iconCircle, {backgroundColor: prevMeta.color}]}>
                <Ionicons name={prevMeta.icon} size={18} color="#FFFFFF" />
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* Sliding card with glow border */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[cardStyle, glowStyle, styles.cardClip]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  actionContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: -1,
  },
  actionLeft: {
    justifyContent: 'flex-start',
    paddingLeft: 16,
  },
  actionRight: {
    justifyContent: 'flex-end',
    paddingRight: 16,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardClip: {
    borderRadius: 14,
    overflow: 'hidden',
  },
});