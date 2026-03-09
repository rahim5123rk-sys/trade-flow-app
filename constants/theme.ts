import { Platform, ViewStyle } from 'react-native';

// ──────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH – every colour, gradient,
// shadow & glass value lives here.  No hex literals
// anywhere else in the codebase.
// ──────────────────────────────────────────────────

// ─── Raw palette (private) ───────────────────────
const P = {
  // Blues
  blue25:  '#EAF3FF',
  blue50:  '#EFF6FF',
  blue100: '#DBEAFE',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue700: '#1D4ED8',
  blue900: '#1E3A8A',

  // Violet
  violet500: '#8B5CF6',
  violet600: '#7C3AED',
  violet300: '#A78BFA',

  // Emerald
  emerald50:  '#F0FDF4',
  emerald300: '#34D399',
  emerald500: '#10B981',
  emerald600: '#059669',

  // Amber
  amber500: '#F59E0B',
  amber400: '#FBBF24',
  amber700: '#D97706',

  // Red
  red500: '#EF4444',
  red600: '#DC2626',

  // Orange
  orange500: '#F97316',
  orange700: '#C2410C',

  // Sky
  sky500: '#0EA5E9',

  // Slate (neutrals)
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50:  '#F8FAFC',

  white:   '#FFFFFF',
} as const;

// ─── Semantic design tokens ──────────────────────
export const UI = {
  // Brand colours
  brand: {
    primary:     P.blue700,
    primaryDark: P.blue900,
    secondary:   P.violet600,
    accent:      P.blue600,
    success:     P.emerald600,
    warning:     P.amber700,
    danger:      P.red600,
  },

  // Job / payment status
  status: {
    inProgress: P.blue500,
    pending:    P.amber500,
    complete:   P.emerald500,
    paid:       P.violet500,
  },

  // Pre-built gradient pairs
  gradients: {
    appBackground: [P.blue25, P.blue50, P.white]        as const,
    primary:       [P.blue700,  P.blue600]               as const,
    primaryDark:   [P.blue700,  P.blue900]               as const,
    blue:          [P.blue600,  P.blue500]               as const,
    blueLight:     [P.blue500,  '#60A5FA']               as const,
    success:       [P.emerald600, P.emerald500]          as const,
    successLight:  [P.emerald500, P.emerald300]          as const,
    danger:        [P.red600,   P.red500]                as const,
    amber:         [P.amber700, P.amber500]              as const,
    amberLight:    [P.amber500, P.amber400]              as const,
    amberOrange:   [P.amber500, P.orange500]             as const,
    violet:        [P.violet500, P.violet300]            as const,
    cp12:          [P.sky500,   P.blue600]               as const,
    soft:          [P.blue100,  P.blue50]                as const,
  },

  // Glassmorphism
  glass: {
    bg:     Platform.OS === 'ios' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)',
    border: 'rgba(255,255,255,0.80)',
  },

  // Typography colours
  text: {
    title:       P.slate900,   // headings
    body:        P.slate800,   // main body copy
    bodyLight:   P.slate700,   // secondary body
    secondary:   P.slate600,   // metadata
    muted:       P.slate500,   // labels, captions
    placeholder: P.slate400,   // input placeholders
    white:       P.white,
    inverse:     P.white,
  },

  // Surface / background colours
  surface: {
    base:         '#F8F9FA',   // page background (cool light gray)
    card:         P.white,
    elevated:     P.slate100,  // slightly raised surfaces
    primaryLight: P.blue100,   // blue-tinted badges/chips
    divider:      P.slate200,  // hairlines & separators
    border:       P.slate300,  // card/input borders
    muted:        P.slate200,  // subtle bg fills
  },

  // Reusable shadows
  shadow: {
    shadowColor: P.slate600,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  } as ViewStyle,

  shadowLight: {
    shadowColor: P.slate600,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
};

// ─── Compatibility layer (older components) ──────
export const Colors = {
  primary:     UI.brand.primary,
  primaryDark: UI.brand.primaryDark,
  secondary:   P.slate600,
  background:  P.slate50,
  card:        P.white,
  text:        P.slate900,
  textLight:   P.slate600,
  border:      P.slate300,
  success:     UI.brand.success,
  warning:     UI.brand.warning,
  danger:      UI.brand.danger,

  light: {
    text:            P.slate900,
    background:      P.slate50,
    tint:            UI.brand.primary,
    icon:            P.slate600,
    tabIconDefault:  P.slate500,
    tabIconSelected: UI.brand.primary,
    card:            P.white,
    border:          P.slate300,
  },
  dark: {
    text:            P.slate50,
    background:      '#0B1220',
    tint:            P.blue500,
    icon:            P.slate300,
    tabIconDefault:  P.slate500,
    tabIconSelected: P.blue500,
    card:            '#111827',
    border:          '#1F2937',
  },

  shadow: UI.shadow,
};

// ─── Dark-mode tokens (monochrome / Apple-inspired) ─
const D = {
  black:    '#000000',
  grey950:  '#0A0A0A',
  grey900:  '#1C1C1E',   // Apple system background (dark)
  grey850:  '#2C2C2E',   // Apple secondary bg (dark)
  grey800:  '#3A3A3C',   // Apple tertiary bg (dark)
  grey700:  '#48484A',
  grey600:  '#636366',   // Apple separator
  grey500:  '#8E8E93',   // Apple tertiary label
  grey400:  '#AEAEB2',   // Apple secondary label
  grey300:  '#C7C7CC',   // Apple separator (light)
  grey200:  '#D1D1D6',
  grey100:  '#E5E5EA',   // Apple system gray 5
  grey50:   '#F2F2F7',   // Apple system grouped bg
  white:    '#FFFFFF',
} as const;

export const DarkUI = {
  brand: {
    primary:     D.white,
    primaryDark: D.grey300,
    secondary:   D.grey400,
    accent:      D.white,
    success:     D.grey300,
    warning:     D.grey400,
    danger:      '#FF453A',  // Apple system red (dark)
  },
  status: {
    inProgress: D.grey400,
    pending:    D.grey500,
    complete:   D.grey300,
    paid:       D.grey400,
  },
  gradients: {
    appBackground: [D.black, D.grey950, D.grey900]  as const,
    primary:       [D.grey800, D.grey700]            as const,
    primaryDark:   [D.grey900, D.black]              as const,
    blue:          [D.grey700, D.grey600]             as const,
    blueLight:     [D.grey600, D.grey500]             as const,
    success:       [D.grey700, D.grey600]             as const,
    successLight:  [D.grey600, D.grey500]             as const,
    danger:        ['#FF453A', '#D70015']              as const,
    amber:         [D.grey700, D.grey600]              as const,
    amberLight:    [D.grey600, D.grey500]              as const,
    amberOrange:   [D.grey600, D.grey500]              as const,
    violet:        [D.grey700, D.grey600]              as const,
    cp12:          [D.grey700, D.grey600]              as const,
    soft:          [D.grey900, D.grey850]              as const,
  },
  glass: {
    bg:     Platform.OS === 'ios' ? 'rgba(28,28,30,0.82)' : 'rgba(28,28,30,0.95)',
    border: 'rgba(255,255,255,0.08)',
  },
  text: {
    title:       D.white,
    body:        D.grey100,
    bodyLight:   D.grey200,
    secondary:   D.grey400,
    muted:       D.grey500,
    placeholder: D.grey600,
    white:       D.white,
    inverse:     D.black,
  },
  surface: {
    base:         D.black,
    card:         D.grey900,
    elevated:     D.grey850,
    primaryLight: D.grey850,
    divider:      'rgba(255,255,255,0.08)',
    border:       D.grey800,
    muted:        D.grey850,
  },
  shadow: {
    shadowColor: D.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 4,
  } as ViewStyle,
  shadowLight: {
    shadowColor: D.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
};

export const DarkColors = {
  primary:     DarkUI.brand.primary,
  primaryDark: DarkUI.brand.primaryDark,
  secondary:   D.grey500,
  background:  D.black,
  card:        D.grey900,
  text:        D.white,
  textLight:   D.grey400,
  border:      D.grey800,
  success:     DarkUI.brand.success,
  warning:     DarkUI.brand.warning,
  danger:      DarkUI.brand.danger,
  light: Colors.dark,
  dark:  Colors.dark,
  shadow: DarkUI.shadow,
};

// ─── Fonts ───────────────────────────────────────
export const Fonts = Platform.select({
  ios:     { sans: 'system-ui',  serif: 'ui-serif',  mono: 'ui-monospace' },
  android: { sans: 'Roboto',     serif: 'serif',     mono: 'monospace' },
  default: { sans: 'sans-serif', serif: 'serif',     mono: 'monospace' },
});