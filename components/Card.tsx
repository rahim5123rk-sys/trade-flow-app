import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from './../constants/theme';

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
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        !flat && Colors.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
  },
  padded: {
    padding: 16,
  },
});