import { Platform } from 'react-native';

const BRAND = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#8B5CF6',
  accent: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export const UI = {
  brand: BRAND,
  gradients: {
    appBackground: ['#EEF2FF', '#E0F2FE', '#F0FDFA'] as const,
    primary: ['#6366F1', '#818CF8'] as const,
    blue: ['#3B82F6', '#60A5FA'] as const,
    amber: ['#F59E0B', '#FBBF24'] as const,
  },
  glass: {
    bg: Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)',
    border: 'rgba(255,255,255,0.65)',
  },
  text: {
    title: '#0F172A',
    body: '#334155',
    muted: '#94A3B8',
  },
};

export const Colors = {
  primary: BRAND.primary,
  primaryDark: BRAND.primaryDark,
  secondary: '#64748B',    // Slate Grey
  background: '#F8FAFC',   // Very light blue-grey
  card: '#FFFFFF',
  text: '#0F172A',         // Dark Slate
  textLight: '#64748B',
  border: '#E2E8F0',
  success: BRAND.success,
  warning: BRAND.warning,
  danger: BRAND.danger,

  // Expo template compatibility (used by `useThemeColor` + a few UI components)
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    tint: BRAND.primary,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: BRAND.primary,
    card: '#FFFFFF',
    border: '#E2E8F0',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0B1220',
    tint: '#60A5FA',
    icon: '#CBD5E1',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#60A5FA',
    card: '#111827',
    border: '#1F2937',
  },

  shadow: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'Roboto',
    serif: 'serif',
    mono: 'monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    mono: 'monospace',
  },
});