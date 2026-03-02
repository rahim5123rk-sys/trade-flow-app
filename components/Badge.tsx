// ============================================
// FILE: components/ui/Badge.tsx
// ============================================

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../src/context/ThemeContext';

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  style?: ViewStyle;
}

export function Badge({
  label,
  color,
  bg,
  style,
}: BadgeProps) {
  const { theme, isDark } = useAppTheme();
  const resolvedColor = color ?? theme.text.body;
  const resolvedBg = bg ?? (isDark ? theme.surface.elevated : '#F3F4F6');

  return (
    <View style={[styles.badge, { backgroundColor: resolvedBg }, style]}>
      <Text style={[styles.text, { color: resolvedColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});