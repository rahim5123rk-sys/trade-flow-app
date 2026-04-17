// ============================================
// FILE: components/forms/FormHeader.tsx
// Reusable form header with back button + title
// ============================================

import {router} from 'expo-router';
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {UI} from '../../constants/theme';
import {useAppTheme} from '../../src/context/ThemeContext';
import {GlassIconButton} from '../GlassIconButton';

interface FormHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function FormHeader({title, subtitle, onBack}: FormHeaderProps) {
  const {theme} = useAppTheme();

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
      <GlassIconButton onPress={onBack ?? (() => router.back())} />
      <View>
        <Text style={[styles.title, {color: theme.text.title}]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, {color: theme.text.muted}]}>{subtitle}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
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
});
