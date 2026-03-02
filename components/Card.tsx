import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../src/context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Remove shadow for flat appearance */
  flat?: boolean;
  /** Add padding. Default true */
  padded?: boolean;
}

export function Card({
  children,
  style,
  flat = false,
  padded = true,
}: CardProps) {
  const { theme, isDark } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface.card, borderColor: isDark ? theme.glass.border : 'transparent', borderWidth: isDark ? 1 : 0 },
        padded && styles.padded,
        !flat && theme.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
  },
  padded: {
    padding: 16,
  },
});