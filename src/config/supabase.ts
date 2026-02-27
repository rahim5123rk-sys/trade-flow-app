import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Supabase-compatible secure storage adapter
// SecureStore has a 2048-byte value limit, so we chunk large values
const CHUNK_SIZE = 2000; // leave some headroom below the 2048 limit

function chunkKeys(key: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${key}__chunk_${i}`);
}

// Helper: race a promise against a timeout (returns null on timeout)
const withStoreTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

const STORE_TIMEOUT = 5000; // 5 seconds max per SecureStore operation

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    try {
      const result = await withStoreTimeout(( async () => {
        // Check if value was chunked
        const countRaw = await SecureStore.getItemAsync(`${key}__chunks`);
        if (countRaw) {
          const count = parseInt(countRaw, 10);
          const parts: string[] = [];
          for (const ck of chunkKeys(key, count)) {
            const part = await SecureStore.getItemAsync(ck);
            if (part === null) return null; // corrupted — treat as missing
            parts.push(part);
          }
          return parts.join('');
        }
        // Not chunked — read directly
        return await SecureStore.getItemAsync(key);
      })(), STORE_TIMEOUT);
      return result;
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    try {
      await withStoreTimeout((async () => {
        // Clean up any previous chunks first
        await SecureStoreAdapter.removeItem(key);

        if (value.length <= CHUNK_SIZE) {
          await SecureStore.setItemAsync(key, value);
          return;
        }

        // Split into chunks
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }

        // Store chunk count, then each chunk
        await SecureStore.setItemAsync(`${key}__chunks`, String(chunks.length));
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i]);
        }
      })(), STORE_TIMEOUT);
    } catch {
      // Silently fail — session will be re-fetched on next app open
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    try {
      // Remove chunked data if it exists
      const countRaw = await SecureStore.getItemAsync(`${key}__chunks`);
      if (countRaw) {
        const count = parseInt(countRaw, 10);
        for (const ck of chunkKeys(key, count)) {
          await SecureStore.deleteItemAsync(ck);
        }
        await SecureStore.deleteItemAsync(`${key}__chunks`);
      }
      // Always try removing the base key too
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});