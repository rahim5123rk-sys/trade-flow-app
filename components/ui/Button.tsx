import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Colors } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const isGradient = ['primary', 'danger', 'success'].includes(variant);
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';

  const textColor = {
    primary: '#FFFFFF',
    secondary: '#334155',
    danger: '#FFFFFF',
    success: '#FFFFFF',
    ghost: Colors.primary,
  }[variant];

  const gradientColors: Record<'primary' | 'danger' | 'success', readonly [string, string]> = {
    primary: ['#6366F1', '#3B82F6'],
    danger: ['#EF4444', '#DC2626'],
    success: ['#10B981', '#34D399'],
  };

  const paddingVertical = { sm: 10, md: 14, lg: 18 }[size];
  const fontSize = { sm: 13, md: 15, lg: 17 }[size];
  const iconSize = { sm: 16, md: 18, lg: 22 }[size];
  const radius = { sm: 12, md: 14, lg: 16 }[size];

  const isDisabled = disabled || loading;

  const content = loading ? (
    <ActivityIndicator color={textColor} size="small" />
  ) : (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={textColor}
          style={{ marginRight: 8 }}
        />
      )}
      <Text style={[styles.text, { color: textColor, fontSize }]}>
        {title}
      </Text>
    </>
  );

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { borderRadius: radius },
        isSecondary && styles.secondaryContainer,
        isGhost && styles.ghostContainer,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {isGradient ? (
        <LinearGradient
          colors={gradientColors[variant as 'primary' | 'danger' | 'success']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.inner, { borderRadius: radius, paddingVertical }]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.inner,
            { borderRadius: radius, paddingVertical },
            isSecondary && styles.secondaryInner,
            isGhost && styles.ghostInner,
          ]}
        >
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  secondaryInner: {
    backgroundColor: 'transparent',
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostInner: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  text: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});