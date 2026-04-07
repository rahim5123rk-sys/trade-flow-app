// ============================================
// FILE: components/SwipeableJobCard.tsx
// Swipe-to-update-status job card with gradient
// reveal and haptic feedback.
// ============================================

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { UI } from '../constants/theme';

// ─── Status flow ────────────────────────────────
const STATUS_FLOW = ['pending', 'in_progress', 'complete', 'paid'] as const;
type JobStatus = (typeof STATUS_FLOW)[number] | 'cancelled';

const SWIPE_THRESHOLD = 100;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

interface StatusMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
}

const NEXT_STATUS_META: Record<string, StatusMeta> = {
  pending:     { label: 'Start',    icon: 'play',             colors: [UI.status.inProgress, '#60A5FA'] },
  in_progress: { label: 'Complete', icon: 'checkmark-circle', colors: ['#059669', '#34D399'] },
  complete:    { label: 'Paid',     icon: 'cash',             colors: ['#7C3AED', '#A78BFA'] },
};

const PREV_STATUS_META: Record<string, StatusMeta> = {
  in_progress: { label: 'Reopen',   icon: 'refresh',   colors: ['#D97706', '#FBBF24'] },
  complete:    { label: 'Reopen',   icon: 'refresh',   colors: ['#D97706', '#FBBF24'] },
  paid:        { label: 'Unpay',    icon: 'refresh',   colors: ['#D97706', '#FBBF24'] },
  pending:     { label: 'Delete',   icon: 'trash',     colors: ['#DC2626', '#F87171'] },
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
  const hasTriggeredHaptic = useRef(false);
  const isActive = useSharedValue(false);

  const nextMeta = NEXT_STATUS_META[status];
  const prevMeta = PREV_STATUS_META[status];

  // Can advance? (paid is the last status)
  const canAdvance = status !== 'paid' && status !== 'cancelled';
  // Left swipe: revert (or delete if pending)
  const canRevert = isAdmin; // only admins can revert/delete

  const triggerHaptic = useCallback(() => {
    if (!hasTriggeredHaptic.current) {
      hasTriggeredHaptic.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      runOnJS(resetHaptic)();
    })
    .onUpdate((event) => {
      // Clamp based on what's allowed
      let x = event.translationX;
      if (!canAdvance && x > 0) x = 0;
      if (!canRevert && x < 0) x = 0;

      // Rubber-band feel at edges
      if (x > SWIPE_THRESHOLD * 1.5) {
        x = SWIPE_THRESHOLD * 1.5 + (x - SWIPE_THRESHOLD * 1.5) * 0.3;
      }
      if (x < -SWIPE_THRESHOLD * 1.5) {
        x = -SWIPE_THRESHOLD * 1.5 + (x + SWIPE_THRESHOLD * 1.5) * 0.3;
      }

      translateX.value = x;

      // Haptic at threshold
      if (Math.abs(x) >= SWIPE_THRESHOLD) {
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      isActive.value = false;
      const x = translateX.value;

      if (x >= SWIPE_THRESHOLD && canAdvance) {
        // Snap out then snap back
        translateX.value = withSpring(SWIPE_THRESHOLD * 1.2, SPRING_CONFIG, () => {
          translateX.value = withSpring(0, SPRING_CONFIG);
        });
        runOnJS(handleAdvance)();
      } else if (x <= -SWIPE_THRESHOLD && canRevert) {
        translateX.value = withSpring(-SWIPE_THRESHOLD * 1.2, SPRING_CONFIG, () => {
          translateX.value = withSpring(0, SPRING_CONFIG);
        });
        runOnJS(handleRevert)();
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Card translation
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Right gradient (advance) — revealed when swiping right
  const rightRevealStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0.6, 1],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  // Left gradient (revert/delete) — revealed when swiping left
  const leftRevealStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD * 0.5, -SWIPE_THRESHOLD],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD],
      [0.6, 1],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  // Threshold indicator — icon pulses when threshold is reached
  const rightIconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [SWIPE_THRESHOLD * 0.8, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.2],
      [1, 1.3, 1.15],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  const leftIconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD * 0.8, -SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 1.2],
      [1, 1.3, 1.15],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  // Subtle card shadow/elevation change when dragging
  const containerStyle = useAnimatedStyle(() => {
    const elevation = isActive.value
      ? withTiming(8, { duration: 150 })
      : withTiming(2, { duration: 300 });
    return {
      shadowOpacity: interpolate(elevation, [2, 8], [0.04, 0.15]),
      shadowRadius: interpolate(elevation, [2, 8], [6, 16]),
      elevation,
    };
  });

  return (
    <Animated.View style={[styles.wrapper, containerStyle]}>
      {/* Advance gradient (behind — right side) */}
      {canAdvance && nextMeta && (
        <Animated.View style={[styles.revealContainer, styles.revealLeft, rightRevealStyle]}>
          <LinearGradient
            colors={[...nextMeta.colors]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradient}
          >
            <Animated.View style={[styles.revealContent, rightIconStyle]}>
              <Ionicons name={nextMeta.icon} size={24} color="#FFFFFF" />
              <Text style={styles.revealLabel}>{nextMeta.label}</Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Revert/Delete gradient (behind — left side) */}
      {canRevert && prevMeta && (
        <Animated.View style={[styles.revealContainer, styles.revealRight, leftRevealStyle]}>
          <LinearGradient
            colors={[...prevMeta.colors]}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={styles.gradient}
          >
            <Animated.View style={[styles.revealContent, styles.revealContentRight, leftIconStyle]}>
              <Ionicons name={prevMeta.icon} size={24} color="#FFFFFF" />
              <Text style={styles.revealLabel}>{prevMeta.label}</Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* The actual card content — slides over the gradients */}
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
  },
  revealContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: 'hidden',
  },
  revealLeft: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  revealRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  revealContent: {
    alignItems: 'center',
    gap: 4,
    paddingLeft: 24,
  },
  revealContentRight: {
    paddingLeft: 0,
    paddingRight: 24,
    alignSelf: 'flex-end',
  },
  revealLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
