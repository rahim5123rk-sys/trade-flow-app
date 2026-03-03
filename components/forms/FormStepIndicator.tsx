// ============================================
// FILE: components/forms/FormStepIndicator.tsx
// Reusable step indicator for all form flows
// ============================================

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { UI } from '../../constants/theme';
import { useAppTheme } from '../../src/context/ThemeContext';

interface FormStepIndicatorProps {
  steps: string[];
  current: number; // 1-based
}

export function FormStepIndicator({ steps, current }: FormStepIndicatorProps) {
  const { isDark, theme } = useAppTheme();

  return (
    <View
      style={[
        styles.stepRow,
        isDark && { backgroundColor: theme.glass.bg, borderColor: theme.glass.border },
      ]}
    >
      {steps.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isDone && styles.stepDotDone,
              ]}
            >
              {isDone ? (
                <Ionicons name="checkmark" size={12} color={UI.text.white} />
              ) : (
                <Text
                  style={[
                    styles.stepDotText,
                    (isActive || isDone) && { color: UI.text.white },
                    isDark && !isActive && !isDone && { color: theme.text.muted },
                  ]}
                >
                  {step}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                isActive ? { color: theme.brand.primary } : isDark && { color: theme.text.muted },
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const GLASS_BG = UI.glass.bg;
const GLASS_BORDER = UI.glass.border;

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
    paddingVertical: 14,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: UI.surface.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: { backgroundColor: UI.brand.primary },
  stepDotDone: { backgroundColor: UI.status.complete },
  stepDotText: { fontSize: 12, fontWeight: '700', color: UI.text.muted },
  stepLabel: { fontSize: 11, fontWeight: '600', color: UI.text.muted },
});
