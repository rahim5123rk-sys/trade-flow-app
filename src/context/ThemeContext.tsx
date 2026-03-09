// ============================================
// FILE: src/context/ThemeContext.tsx
// App-wide dark mode context with AsyncStorage persistence
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useContext, useEffect, useState} from 'react';
import {ViewStyle} from 'react-native';
import {Colors, DarkColors, DarkUI, UI} from '../../constants/theme';

const STORAGE_KEY = '@pilotlight_dark_mode';

type ThemeMode = 'light' | 'dark';

/** Gradient tuple type compatible with expo-linear-gradient */
type GradientPair = readonly [string, string, ...string[]];

/** Structural type matching both UI and DarkUI */
export interface ThemeTokens {
  brand: {primary: string; primaryDark: string; secondary: string; accent: string; success: string; warning: string; danger: string};
  status: {inProgress: string; pending: string; complete: string; paid: string};
  gradients: Record<string, GradientPair>;
  glass: {bg: string; border: string};
  text: {title: string; body: string; bodyLight: string; secondary: string; muted: string; placeholder: string; white: string; inverse: string};
  surface: {base: string; card: string; elevated: string; primaryLight: string; divider: string; border: string; muted: string};
  shadow: ViewStyle;
  shadowLight: ViewStyle;
}

interface ColorsCompat {
  primary: string; primaryDark: string; secondary: string; background: string;
  card: string; text: string; textLight: string; border: string;
  success: string; warning: string; danger: string;
  light: Record<string, string>; dark: Record<string, string>;
  shadow: ViewStyle;
}

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  theme: ThemeTokens;
  colors: ColorsCompat;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  isDark: false,
  toggleTheme: () => { },
  setMode: () => { },
  theme: UI as ThemeTokens,
  colors: Colors as ColorsCompat,
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  // Load persisted preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
        }
      } catch {
        // Fallback to light
      }
    })();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => { });
  };

  const toggleTheme = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  const isDark = mode === 'dark';
  const theme = isDark ? DarkUI : UI;
  const colors = isDark ? DarkColors : Colors;

  return (
    <ThemeContext.Provider value={{mode, isDark, toggleTheme, setMode, theme, colors}}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Access current theme – use this everywhere instead of importing UI / Colors directly */
export function useAppTheme() {
  return useContext(ThemeContext);
}
