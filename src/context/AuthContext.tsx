import AsyncStorage from '@react-native-async-storage/async-storage';
import {Session, User} from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {router} from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {supabase} from '../config/supabase';
import type {UserProfile, UserRole} from '../types';
import {TimeoutError, withAbortTimeout} from '../utils/withTimeout';

const PENDING_REGISTRATION_KEY = 'gaspilot_pending_registration';
const LEGACY_PENDING_REGISTRATION_KEY = 'pilotlight_pending_registration';
const LAST_HANDLED_AUTH_URL_KEY = '@gaspilot_last_handled_auth_url';
const LEGACY_LAST_HANDLED_AUTH_URL_KEY = '@pilotlight_last_handled_auth_url';
const PROFILE_CACHE_KEY = '@gaspilot_cached_profile';
const PROFILE_FETCH_TIMEOUT_MS = 8000;
const PROFILE_RETRY_INTERVAL_MS = 4000;

/** Simple hash to avoid storing raw auth URLs (which contain tokens) */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function isRetryableProfileError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (!(error instanceof Error)) return false;
  return /network request failed|fetch failed|timed out/i.test(error.message);
}

interface AuthState {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  role: UserRole | null;
  reminderDaysBefore: number;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  setRegistering: (value: boolean) => void;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  userProfile: null,
  isLoading: true,
  role: null,
  reminderDaysBefore: 30,
  signOut: async () => { },
  refreshProfile: async () => null,
  setRegistering: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(30);
  const isRegistering = useRef(false);
  const handledUrls = useRef<Set<string>>(new Set());
  const isRecoveryFlow = useRef(false);
  const profileRetryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const isMountedRef = useRef(true);

  // Keep sessionRef in sync
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Persist profile to AsyncStorage whenever it changes
  const setAndCacheProfile = useCallback((profile: UserProfile | null) => {
    if (!isMountedRef.current) return;
    setUserProfile(profile);
    if (profile) {
      AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)).catch(() => {});
    }
  }, []);

  // Stop any pending retry timer
  const stopRetryTimer = useCallback(() => {
    if (profileRetryTimer.current) {
      clearInterval(profileRetryTimer.current);
      profileRetryTimer.current = null;
    }
  }, []);

  /**
   * Fetch profile from Supabase REST API. Returns the profile on success,
   * null if the profile truly doesn't exist, or throws on network error.
   */
  const fetchProfileFromAPI = useCallback(async (userId: string, token: string): Promise<UserProfile | null> => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    const response = await withAbortTimeout(
      ({signal}) =>
        fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
            signal,
          }
        ),
      { timeoutMs: PROFILE_FETCH_TIMEOUT_MS, label: 'Profile fetch' }
    );

    if (!response.ok) {
      throw new Error(`Profile fetch HTTP ${response.status}`);
    }

    const rows = await response.json();
    if (rows && rows.length > 0) {
      return rows[0] as UserProfile;
    }
    return null; // Profile truly doesn't exist in DB
  }, []);

  /**
   * Fetch profile + cache it + fetch company settings.
   * This is the ONE function all paths call to load a fresh profile.
   */
  const loadFreshProfile = useCallback(async (userId: string, token: string): Promise<UserProfile | null> => {
    const profile = await fetchProfileFromAPI(userId, token);

    if (profile && isMountedRef.current) {
      console.log('[Auth] Profile loaded from network');
      setAndCacheProfile(profile);
      stopRetryTimer();

      // Fire-and-forget: load company reminder days
      if (profile.company_id) {
        Promise.resolve(
          supabase
            .from('companies')
            .select('reminder_days_before')
            .eq('id', profile.company_id)
            .single()
        )
          .then(({ data }) => {
            if (isMountedRef.current) setReminderDaysBefore(data?.reminder_days_before ?? 30);
          })
          .catch(() => {});
      }
    }

    return profile;
  }, [fetchProfileFromAPI, setAndCacheProfile, stopRetryTimer]);

  /**
   * Check for pending registration data saved during email-confirmation flow.
   */
  const completePendingRegistration = async (userId: string, accessToken: string): Promise<boolean> => {
    try {
      const raw =
        (await SecureStore.getItemAsync(PENDING_REGISTRATION_KEY)) ||
        (await SecureStore.getItemAsync(LEGACY_PENDING_REGISTRATION_KEY));
      if (!raw) return false;

      const pendingData = JSON.parse(raw);
      console.log('[Auth] Found pending registration data for mode:', pendingData.mode);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const rpcHeaders = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`,
      };

      const fetchWithRetry = async (url: string, options: any, maxRetries = 3): Promise<Response> => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fetch(url, options);
          } catch (err) {
            if (i === maxRetries - 1) throw err;
            console.log(`[Auth] Fetch failed, retrying (${i + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        throw new Error('Fetch failed after retries');
      };

      if (pendingData.mode === 'create') {
        const response = await fetchWithRetry(`${supabaseUrl}/rest/v1/rpc/create_company_and_profile`, {
          method: 'POST',
          headers: rpcHeaders,
          body: JSON.stringify({
            p_user_id: userId,
            p_email: pendingData.email,
            p_display_name: pendingData.fullName,
            p_company_name: pendingData.companyName,
            p_company_address: pendingData.businessAddress || '',
            p_company_phone: pendingData.businessPhone || '',
            p_trade: pendingData.trade,
            p_invite_code: pendingData.inviteCode,
            p_role: 'admin',
            p_consent_given_at: pendingData.consentGivenAt,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          console.error('[Auth] Pending create RPC failed:', response.status, err);
          return false;
        }

        const rpcData = await response.json();
        const companyId = rpcData.company_id;

        if (companyId && !pendingData.isApprentice && pendingData.gasSafeRegisterNumber && pendingData.acceptedGasSafeTerms) {
          await supabase.rpc('merge_company_settings', {
            p_company_id: companyId,
            p_settings: {
              userDetailsById: {
                [userId]: {
                  gasSafeRegisterNumber: pendingData.gasSafeRegisterNumber.trim(),
                  acceptedGasSafeTerms: true,
                },
              },
            },
          });
          await supabase.from('profiles').update({ accepted_gas_safe_terms: true }).eq('id', userId);
        }
        console.log('[Auth] Pending create RPC succeeded');
      } else {
        const response = await fetchWithRetry(`${supabaseUrl}/rest/v1/rpc/join_company_and_profile`, {
          method: 'POST',
          headers: rpcHeaders,
          body: JSON.stringify({
            p_user_id: userId,
            p_company_id: pendingData.companyId,
            p_email: pendingData.email,
            p_display_name: pendingData.fullName,
            p_role: 'worker',
            p_consent_given_at: pendingData.consentGivenAt,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          console.error('[Auth] Pending join RPC failed:', response.status, err);
          return false;
        }
        console.log('[Auth] Pending join RPC succeeded');
      }

      await Promise.all([
        SecureStore.deleteItemAsync(PENDING_REGISTRATION_KEY),
        SecureStore.deleteItemAsync(LEGACY_PENDING_REGISTRATION_KEY),
      ]);
      console.log('[Auth] Pending registration completed and cleaned up');
      return true;
    } catch (e) {
      console.error('[Auth] Error completing pending registration:', e);
      return false;
    }
  };

  // ─── Main initialization effect ────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    // ── Deep link handling ──
    const parseParams = (url: string): Record<string, string> => {
      const parsed = Linking.parse(url);
      const params = {...(parsed.queryParams || {})} as Record<string, string>;
      const hash = url.split('#')[1];
      if (hash) {
        hash.split('&').forEach((pair) => {
          const [rawKey, rawValue] = pair.split('=');
          if (!rawKey) return;
          params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue || '');
        });
      }
      return params;
    };

    const handleAuthUrl = async (url: string | null) => {
      if (!url) return;
      try {
        const params = parseParams(url);
        const code = params.code;
        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;
        const type = params.type;

        if (!code && !(accessToken && refreshToken)) return;

        if (handledUrls.current.has(url)) return;
        const lastHandled =
          (await AsyncStorage.getItem(LAST_HANDLED_AUTH_URL_KEY)) ||
          (await AsyncStorage.getItem(LEGACY_LAST_HANDLED_AUTH_URL_KEY));
        if (lastHandled === hashString(url)) return;

        handledUrls.current.add(url);
        if (type === 'recovery') isRecoveryFlow.current = true;

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          await AsyncStorage.setItem(LAST_HANDLED_AUTH_URL_KEY, hashString(url));
          if (type === 'recovery') router.replace('/(auth)/reset-password');
          return;
        }
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({access_token: accessToken, refresh_token: refreshToken});
          await AsyncStorage.setItem(LAST_HANDLED_AUTH_URL_KEY, hashString(url));
          if (type === 'recovery') router.replace('/(auth)/reset-password');
        }
      } catch (e) {
        console.warn('Auth deep link parse error:', e);
      }
    };

    Linking.getInitialURL().then(handleAuthUrl);
    const urlSub = Linking.addEventListener('url', ({url}) => handleAuthUrl(url));

    // ── Safety timeout — absolute backstop ──
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsLoading((prev) => {
          if (prev) console.warn('[Auth] Safety timeout — forcing isLoading to false');
          return false;
        });
      }
    }, 6000);

    // ── Start cached profile restore early (AsyncStorage = fast, ~10-50ms) ──
    const cachePromise = AsyncStorage.getItem(PROFILE_CACHE_KEY).then(raw => {
      if (raw) {
        try { return JSON.parse(raw) as UserProfile; } catch {}
      }
      return null;
    }).catch(() => null);

    // ── Profile retry timer (background) ──
    const startProfileRetry = () => {
      if (profileRetryTimer.current) return;
      console.log('[Auth] Starting profile retry timer');
      profileRetryTimer.current = setInterval(async () => {
        const s = sessionRef.current;
        if (!s?.user) return;
        try {
          await loadFreshProfile(s.user.id, s.access_token);
        } catch (e) {
          console.warn('[Auth] Profile retry failed:', e);
        }
      }, PROFILE_RETRY_INTERVAL_MS);
    };

    // ── Handle INITIAL_SESSION: cold start path ──
    const handleInitialSession = async (currentSession: Session | null) => {
      if (!isMountedRef.current) return;
      setSession(currentSession);

      if (!currentSession?.user) {
        // No stored session → go to login
        setIsLoading(false);
        return;
      }

      // 1. Immediately restore cached profile (fast path — makes app usable)
      const cachedProfile = await cachePromise;
      if (cachedProfile && isMountedRef.current) {
        console.log('[Auth] Using cached profile for', cachedProfile.display_name);
        setUserProfile(cachedProfile);
        // APP IS NOW USABLE — stop blocking the UI
        setIsLoading(false);
      }

      // 2. Fetch fresh profile from network (background — updates cache)
      try {
        const profile = await loadFreshProfile(currentSession.user.id, currentSession.access_token);

        if (profile === null && !isRegistering.current) {
          // Profile truly doesn't exist — try pending registration
          const didComplete = await completePendingRegistration(currentSession.user.id, currentSession.access_token);
          if (didComplete) {
            const newProfile = await loadFreshProfile(currentSession.user.id, currentSession.access_token);
            if (newProfile) {
              console.log('[Auth] Pending registration completed on init');
              setIsLoading(false);
              return;
            }
          }

          if (!cachedProfile) {
            // No cache AND no profile in DB → orphaned user
            console.log('[Auth] No profile found — signing out orphaned user');
            await supabase.auth.signOut();
            if (isMountedRef.current) { setSession(null); setUserProfile(null); }
          }
        }
      } catch (fetchError) {
        console.warn('[Auth] Network profile fetch failed:', fetchError);
        if (!cachedProfile) {
          // No cache — need to retry until profile loads
          startProfileRetry();
        }
      }

      // Ensure loading stops even if we didn't have a cache
      if (isMountedRef.current) setIsLoading(false);
    };

    // ── Handle subsequent auth events (SIGNED_IN, TOKEN_REFRESHED, etc.) ──
    const handleAuthEvent = async (event: string, currentSession: Session | null) => {
      if (!isMountedRef.current) return;
      setSession(currentSession);

      if (event === 'PASSWORD_RECOVERY') {
        if (isRecoveryFlow.current) {
          isRecoveryFlow.current = false;
          router.replace('/(auth)/reset-password');
        }
        return;
      }

      if (isRegistering.current) return;

      if (event === 'SIGNED_OUT' || !currentSession?.user) {
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      // SIGNED_IN or TOKEN_REFRESHED — fetch fresh profile
      if (event === 'SIGNED_IN') {
        try {
          const profile = await loadFreshProfile(currentSession.user.id, currentSession.access_token);
          if (profile === null) {
            const didComplete = await completePendingRegistration(currentSession.user.id, currentSession.access_token);
            if (didComplete) {
              await loadFreshProfile(currentSession.user.id, currentSession.access_token);
              console.log('[Auth] Pending registration completed on sign-in');
            }
          }
        } catch (e) {
          console.warn('[Auth] Profile fetch on sign-in failed:', e);
        }
      }
      // TOKEN_REFRESHED — just update session ref, don't refetch profile
    };

    // ── Subscribe to auth state changes (sole source of session) ──
    // Supabase fires INITIAL_SESSION automatically when subscribing.
    // This replaces the old getSession() call entirely.
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('[Auth] onAuthStateChange:', event);

      if (event === 'INITIAL_SESSION') {
        await handleInitialSession(currentSession);
      } else {
        await handleAuthEvent(event, currentSession);
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimer);
      stopRetryTimer();
      subscription.unsubscribe();
      urlSub.remove();
    };
  }, []);

  const signOut = async () => {
    try {
      stopRetryTimer();
      await supabase.auth.signOut();
      setUserProfile(null);
      setSession(null);
      await Promise.all([
        AsyncStorage.removeItem(PROFILE_CACHE_KEY),
        AsyncStorage.removeItem('@gaspilot_is_pro_cached'),
      ]).catch(() => {});
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    try {
      const s = sessionRef.current;
      if (!s?.user) {
        console.warn('refreshProfile: no session');
        return null;
      }
      return await loadFreshProfile(s.user.id, s.access_token);
    } catch (e) {
      console.error('refreshProfile error:', e);
      return null;
    }
  };

  const setRegistering = (value: boolean) => {
    isRegistering.current = value;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        userProfile,
        isLoading,
        role: userProfile?.role ?? null,
        reminderDaysBefore,
        signOut,
        refreshProfile,
        setRegistering,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};