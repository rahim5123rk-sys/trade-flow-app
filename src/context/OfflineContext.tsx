import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const OFFLINE_MODE_KEY = 'offline_mode_enabled_v1';

interface OfflineContextValue {
  offlineModeEnabled: boolean;
  setOfflineModeEnabled: (value: boolean) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  offlineModeEnabled: false,
  setOfflineModeEnabled: async () => {},
});

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [offlineModeEnabled, setOfflineModeEnabledState] = useState(false);

  useEffect(() => {
    const loadOfflineMode = async () => {
      try {
        const stored = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
        setOfflineModeEnabledState(stored === '1');
      } catch {
        setOfflineModeEnabledState(false);
      }
    };

    void loadOfflineMode();
  }, []);

  const setOfflineModeEnabled = async (value: boolean) => {
    setOfflineModeEnabledState(value);
    if (value) {
      await AsyncStorage.setItem(OFFLINE_MODE_KEY, '1');
    } else {
      await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
    }
  };

  const value = useMemo(
    () => ({
      offlineModeEnabled,
      setOfflineModeEnabled,
    }),
    [offlineModeEnabled],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineMode() {
  return useContext(OfflineContext);
}
