// ============================================
// FILE: components/forms/FormHeader.tsx
// Reusable form header with back button + title
// ============================================

import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {UI} from '../../constants/theme';
import {useAppTheme} from '../../src/context/ThemeContext';

interface FormHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function FormHeader({title, subtitle, onBack}: FormHeaderProps) {
  const {theme, isDark} = useAppTheme();

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
      <TouchableOpacity
        style={[
          styles.backBtn,
          isDark && {backgroundColor: theme.glass.bg, borderColor: theme.glass.border},
        ]}
        onPress={onBack ?? (() => router.back())}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={20} color={theme.brand.primary} />
      </TouchableOpacity>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.glass.bg,
    borderWidth: 1,
    borderColor: UI.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
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
