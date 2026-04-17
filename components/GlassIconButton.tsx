// ============================================
// FILE: components/GlassIconButton.tsx
// Reusable liquid-glass icon button (Apple-style)
// ============================================

import {Ionicons} from '@expo/vector-icons';
import React from 'react';
import {StyleSheet, TouchableOpacity, type ViewStyle} from 'react-native';
import {UI} from '../constants/theme';
import {useAppTheme} from '../src/context/ThemeContext';

interface GlassIconButtonProps {
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  onPress: () => void;
  style?: ViewStyle;
  activeOpacity?: number;
  hitSlop?: number;
}

export function GlassIconButton({
  icon = 'chevron-back',
  size = 20,
  color,
  onPress,
  style,
  activeOpacity = 0.7,
  hitSlop,
}: GlassIconButtonProps) {
  const {theme, isDark} = useAppTheme();
  const iconColor = color ?? theme.text.title;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={activeOpacity}
      hitSlop={hitSlop}
      style={[
        styles.button,
        isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border},
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
