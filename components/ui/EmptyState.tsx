import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, UI } from '../../constants/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={34} color={Colors.textLight} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {message && <Text style={styles.message}>{message}</Text>}
        {actionLabel && onAction && (
          <TouchableOpacity style={styles.actionWrap} onPress={onAction} activeOpacity={0.8}>
            <LinearGradient
              colors={UI.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.action}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    shadowColor: UI.text.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  accent: {
    height: 3,
    backgroundColor: UI.brand.accent,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: UI.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.text.bodyLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: UI.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionWrap: {
    marginTop: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  action: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  actionText: {
    color: UI.surface.card,
    fontWeight: '700',
    fontSize: 14,
  },
});