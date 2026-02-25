import { Platform } from 'react-native';

export const Colors = {
  primary: '#2563EB',      // Professional Blue
  primaryDark: '#1E40AF',
  secondary: '#64748B',    // Slate Grey
  background: '#F8FAFC',   // Very light blue-grey
  card: '#FFFFFF',
  text: '#0F172A',         // Dark Slate
  textLight: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
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