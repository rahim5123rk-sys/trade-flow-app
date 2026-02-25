import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getStatusStyle } from '../src/utils/formatting';

interface StatusBadgeProps {
  status: string;
  /** Show a small icon before the label */
  showIcon?: boolean;
  /** Compact sizing for list rows */
  compact?: boolean;
}

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  accepted: 'checkmark-outline',
  on_the_way: 'car-outline',
  in_progress: 'play-circle-outline',
  complete: 'checkmark-circle-outline',
  paid: 'checkmark-done-circle-outline',
  cancelled: 'close-circle-outline',
};

export function StatusBadge({
  status,
  showIcon = false,
  compact = false,
}: StatusBadgeProps) {
  const { label, color, bg } = getStatusStyle(status);
  const iconName = STATUS_ICONS[status] || 'ellipse-outline';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        compact && styles.compact,
      ]}
    >
      {showIcon && (
        <Ionicons
          name={iconName}
          size={compact ? 10 : 12}
          color={color}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.text,
          { color },
          compact && styles.compactText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compactText: {
    fontSize: 10,
  },
});