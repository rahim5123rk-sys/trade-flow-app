import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../src/context/ThemeContext';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const SPRING_CONFIG = { damping: 16, stiffness: 180, mass: 0.7 };

type TabMeta = {
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
};

const TAB_ICONS: Record<string, TabMeta> = {
  dashboard: { iconActive: 'grid', iconInactive: 'grid-outline' },
  calendar: { iconActive: 'calendar', iconInactive: 'calendar-outline' },
  documents: { iconActive: 'document-text', iconInactive: 'document-text-outline' },
  jobs: { iconActive: 'briefcase', iconInactive: 'briefcase-outline' },
};

const VISIBLE_TAB_NAMES = new Set(['dashboard', 'calendar', 'documents', 'jobs']);

// ─── Specular Highlight ───

const SpecularHighlight = ({ isDark, width: w }: { isDark: boolean; width: number }) => (
  <LinearGradient
    colors={
      isDark
        ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'transparent']
        : ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.15)', 'transparent']
    }
    locations={[0, 0.4, 1]}
    start={{ x: 0.5, y: 0 }}
    end={{ x: 0.5, y: 1 }}
    style={[styles.specular, { width: Math.max(w - 24, 0), left: 12 }]}
  />
);


// ═══════════════════════════════════════
//  LIQUID GLASS TAB BAR
// ═══════════════════════════════════════

export default function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);
  const [navWidth, setNavWidth] = useState(0);

  // Track each visible item's center-x and width
  const [itemLayouts, setItemLayouts] = useState<{ cx: number; width: number }[]>([]);
  const itemLayoutsRef = useRef<Record<number, { x: number; width: number }>>({});

  // Pill animation
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const pillScale = useSharedValue(1);

  const lastHapticIndex = useRef(-1);

  // Theme
  const themeProgress = useDerivedValue(() =>
    withTiming(isDark ? 1 : 0, { duration: 500 }),
  );

  const visibleRoutes = state.routes.filter((route) => VISIBLE_TAB_NAMES.has(route.name));

  const activeVisibleIndex = visibleRoutes.findIndex(
    (r) => r.key === state.routes[state.index]?.key,
  );

  const handleItemLayout = useCallback(
    (visibleIdx: number, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      itemLayoutsRef.current[visibleIdx] = { x, width };

      // Rebuild array when we have all items
      const entries = Object.entries(itemLayoutsRef.current);
      if (entries.length === visibleRoutes.length) {
        const arr = entries
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, v]) => ({ cx: v.x + v.width / 2, width: v.width }));
        setItemLayouts(arr);
      }
    },
    [visibleRoutes.length],
  );

  // Snap pill to active tab
  useEffect(() => {
    const layout = itemLayoutsRef.current[activeVisibleIndex];
    if (!layout) return;
    pillX.value = withSpring(layout.x, SPRING_CONFIG);
    pillW.value = withSpring(layout.width, SPRING_CONFIG);
  }, [activeVisibleIndex, itemLayouts, pillX, pillW]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scaleX: pillScale.value },
      { scaleY: pillScale.value },
    ],
    width: pillW.value,
  }));

  const pillBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      ['rgba(120,120,130,0.28)', 'rgba(160,160,170,0.32)'],
    ),
  }));

  // Find which tab index a given X position is closest to
  const findClosestTab = useCallback(
    (x: number): number => {
      if (itemLayouts.length === 0) return activeVisibleIndex;
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < itemLayouts.length; i++) {
        const dist = Math.abs(x - itemLayouts[i].cx);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      return closest;
    },
    [itemLayouts, activeVisibleIndex],
  );

  const navigateToIndex = useCallback(
    (idx: number) => {
      const route = visibleRoutes[idx];
      if (!route) return;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation, visibleRoutes],
  );

  const fireHaptic = useCallback((idx: number) => {
    if (lastHapticIndex.current !== idx) {
      lastHapticIndex.current = idx;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // JS-thread handlers called via runOnJS from gesture callbacks
  const handleDragUpdate = useCallback(
    (touchX: number) => {
      const closest = findClosestTab(touchX);
      const layout = itemLayoutsRef.current[closest];
      if (layout) {
        pillX.value = withSpring(layout.x, { damping: 22, stiffness: 280, mass: 0.5 });
        pillW.value = withSpring(layout.width, { damping: 22, stiffness: 280, mass: 0.5 });
        fireHaptic(closest);
      }
      // Expand while dragging
      pillScale.value = withSpring(1.15, { damping: 18, stiffness: 200, mass: 0.6 });
    },
    [findClosestTab, fireHaptic, pillX, pillW, pillScale],
  );

  const handleDragEnd = useCallback(
    (touchX: number) => {
      const closest = findClosestTab(touchX);
      const layout = itemLayoutsRef.current[closest];
      if (layout) {
        pillX.value = withSpring(layout.x, SPRING_CONFIG);
        pillW.value = withSpring(layout.width, SPRING_CONFIG);
      }
      // Shrink back to normal
      pillScale.value = withSpring(1, SPRING_CONFIG);
      navigateToIndex(closest);
      lastHapticIndex.current = -1;
    },
    [findClosestTab, navigateToIndex, pillX, pillW, pillScale],
  );

  const handleTap = useCallback(
    (touchX: number) => {
      const closest = findClosestTab(touchX);
      const layout = itemLayoutsRef.current[closest];
      if (layout) {
        pillX.value = withSpring(layout.x, SPRING_CONFIG);
        pillW.value = withSpring(layout.width, SPRING_CONFIG);
      }
      navigateToIndex(closest);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [findClosestTab, navigateToIndex, pillX, pillW],
  );

  // Pan gesture — drag the pill across tabs
  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      runOnJS(handleDragUpdate)(e.x);
    })
    .onEnd((e) => {
      runOnJS(handleDragEnd)(e.x);
    })
;

  // Tap gesture — regular tab press
  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(handleTap)(e.x);
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const showPill = activeVisibleIndex >= 0;

  return (
    <View style={[styles.barOuter, { paddingBottom: bottomPad }]}>
      {/* Shadow wrapper (no overflow hidden so glow renders) */}
      <View style={[styles.glassShellShadow, isDark ? styles.glowDark : styles.glowLight]}>
        <GestureDetector gesture={composedGesture}>
          {/* Inner clipped container */}
          <Animated.View
            style={[styles.glassShellInner, isDark && styles.glassShellInnerDark]}
            onLayout={(e) => setNavWidth(e.nativeEvent.layout.width)}
          >
            {/* Blur */}
            <BlurView
              intensity={isDark ? 50 : 80}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            <SpecularHighlight isDark={isDark} width={navWidth} />

            {/* Sliding pill */}
            {showPill && (
              <Animated.View style={[styles.pill, pillStyle]}>
                <Animated.View style={[styles.pillInner, pillBgStyle]} />
              </Animated.View>
            )}

            {/* Icons */}
            <View style={styles.navItems}>
              {visibleRoutes.map((route, visibleIdx) => {
                const isActive = route.key === state.routes[state.index]?.key;
                const meta = TAB_ICONS[route.name] || { iconActive: 'ellipse', iconInactive: 'ellipse-outline' };
                const activeColor = '#3B82F6';
                const inactiveColor = isDark ? 'rgba(240,240,255,0.92)' : 'rgba(20,20,40,0.88)';

                return (
                  <View
                    key={route.key}
                    style={styles.navItem}
                    onLayout={(e) => handleItemLayout(visibleIdx, e)}
                  >
                    <Ionicons
                      name={isActive ? meta.iconActive : meta.iconInactive}
                      size={26}
                      color={isActive ? activeColor : inactiveColor}
                    />
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════

const NAV_HEIGHT = 64;

const styles = StyleSheet.create({
  barOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },

  // Outer shadow wrapper
  glassShellShadow: {
    borderRadius: NAV_HEIGHT / 2,
  },
  glowLight: {
    shadowColor: 'rgba(120,160,255,1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 20,
  },
  glowDark: {
    shadowColor: 'rgba(100,140,255,1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 20,
  },

  // Inner clipped glass
  glassShellInner: {
    height: NAV_HEIGHT,
    borderRadius: NAV_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  glassShellInnerDark: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Specular
  specular: {
    position: 'absolute',
    top: 1,
    height: '45%',
    borderRadius: NAV_HEIGHT / 2,
    zIndex: 2,
    pointerEvents: 'none',
  },

  // Sliding pill
  pill: {
    position: 'absolute',
    top: 8,
    left: 0,
    bottom: 8,
    zIndex: 1,
  },
  pillInner: {
    flex: 1,
    borderRadius: (NAV_HEIGHT - 16) / 2,
  },

  // Nav items
  navItems: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: NAV_HEIGHT - 16,
    borderRadius: (NAV_HEIGHT - 16) / 2,
  },
});
