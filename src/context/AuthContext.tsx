import AsyncStorage from '@react-native-async-storage/async-storage';
import {Session, User} from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {router} from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {supabase} from '../config/supabase';

const PENDING_REGISTRATION_KEY = 'gaspilot_pending_registration';
const LEGACY_PENDING_REGISTRATION_KEY = 'pilotlight_pending_registration';
const LAST_HANDLED_AUTH_URL_KEY = '@gaspilot_last_handled_auth_url';
const LEGACY_LAST_HANDLED_AUTH_URL_KEY = '@pilotlight_last_handled_auth_url';

/** Simple hash to avoid storing raw auth URLs (which contain tokens) */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

type UserRole = 'admin' | 'worker';
interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  company_id: string;
  role: UserRole;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  role: UserRole | null;
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
  signOut: async () => { },
  refreshProfile: async () => null,
  setRegistering: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRegistering = useRef(false);
  const handledUrls = useRef<Set<string>>(new Set());
  const isRecoveryFlow = useRef(false);

  // We change the return type to distinguish between "No Profile" (null) and "Network Error" (throw)
  const fetchProfile = async (userId: string, tokenToUse?: string): Promise<UserProfile | null> => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    let token = tokenToUse || session?.access_token;

    if (!token) {
      const {data: {session: currentSession}} = await supabase.auth.getSession();
      token = currentSession?.access_token;
    }

    if (!token) {
      console.log('No token available for profile fetch');
      throw new Error('No authentication token');
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // THROW instead of returning null. We don't want to sign the user out for a 500 or network drop.
      throw new Error(`Profile fetch failed: ${response.status}`);
    }

    const rows = await response.json();
    if (rows && rows.length > 0) {
      console.log('Profile loaded successfully');
      setUserProfile(rows[0]);
      return rows[0];
    }

    console.log('No profile found for user in the database');
    return null; // This safely indicates the profile TRULY does not exist
  };

  /**
   * Check for pending registration data saved during email-confirmation flow.
   * If found, call the appropriate RPC to create the company/profile, then clean up.
   * Returns true if pending reg was found and completed successfully.
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

      if (pendingData.mode === 'create') {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_company_and_profile`, {
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
        console.log('[Auth] Pending create RPC succeeded');
      } else {
        // Join mode (worker)
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/join_company_and_profile`, {
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

      // Only remove pending data after successful completion
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

  useEffect(() => {
    const parseParams = (url: string): Record<string, string> => {
      const parsed = Linking.parse(url);
      const params = {...(parsed.queryParams || {})} as Record<string, string>;
      const hash = url.split('#')[1];

      if (hash) {
        hash.split('&').forEach((pair) => {
          const [rawKey, rawValue] = pair.split('=');
          if (!rawKey) return;
          const key = decodeURIComponent(rawKey);
          const value = decodeURIComponent(rawValue || '');
          params[key] = value;
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

        const hasAuthPayload = Boolean(code || (accessToken && refreshToken));
        if (!hasAuthPayload) {
          return;
        }

        // Deduplicate in-memory for this runtime.
        if (handledUrls.current.has(url)) {
          console.log('[Auth] Skipping already-handled URL (runtime)');
          return;
        }

        // Deduplicate across app restarts.
        const lastHandledUrl =
          (await AsyncStorage.getItem(LAST_HANDLED_AUTH_URL_KEY)) ||
          (await AsyncStorage.getItem(LEGACY_LAST_HANDLED_AUTH_URL_KEY));
        if (lastHandledUrl === hashString(url)) {
          console.log('[Auth] Skipping already-handled URL (persisted)');
          return;
        }

        handledUrls.current.add(url);

        // Only treat as recovery if the URL explicitly says so
        if (type === 'recovery') {
          isRecoveryFlow.current = true;
        }

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          await AsyncStorage.setItem(LAST_HANDLED_AUTH_URL_KEY, hashString(url));
          if (type === 'recovery') {
            router.replace('/(auth)/reset-password');
          }
          return;
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({access_token: accessToken, refresh_token: refreshToken});
          await AsyncStorage.setItem(LAST_HANDLED_AUTH_URL_KEY, hashString(url));
          if (type === 'recovery') {
            router.replace('/(auth)/reset-password');
          }
        }
      } catch (e) {
        console.warn('Auth deep link parse error:', e);
      }
    };

    Linking.getInitialURL().then((url) => {
      handleAuthUrl(url);
    });

    const urlSub = Linking.addEventListener('url', ({url}) => {
      handleAuthUrl(url);
    });

    const initAuth = async () => {
      try {
        if (isRegistering.current) return;

        const {data: {session: currentSession}} = await supabase.auth.getSession();

        if (isRegistering.current) return;

        setSession(currentSession);

        if (currentSession?.user) {
          try {
            const profile = await fetchProfile(currentSession.user.id, currentSession.access_token);

            // Strictly check for null (database confirmed missing). 
            // Ignore if it threw an error (handled by the catch block below)
            if (profile === null && !isRegistering.current) {
              // Check for pending registration data (email confirmation flow)
              const didComplete = await completePendingRegistration(
                currentSession.user.id,
                currentSession.access_token
              );
              if (didComplete) {
                // Profile should now exist — fetch it
                const newProfile = await fetchProfile(currentSession.user.id, currentSession.access_token);
                if (newProfile) {
                  console.log('[Auth] Pending registration completed on init — profile loaded');
                  return; // All good, don't sign out
                }
              }

              console.log('Database confirmed no profile exists — signing out orphaned user');
              await supabase.auth.signOut();
              setSession(null);
            }
          } catch (fetchError) {
            // It was a network or token error, DO NOT SIGN OUT.
            console.warn('Could not fetch profile on boot, but session remains active:', fetchError);
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
      } finally {
        setIsLoading(false); // Make sure we always stop loading
      }
    };
    initAuth();

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);

      if (_event === 'PASSWORD_RECOVERY') {
        // Only redirect if this recovery was triggered by a fresh deep link,
        // NOT from a stale session being reloaded on cold start.
        if (isRecoveryFlow.current) {
          isRecoveryFlow.current = false; // consume the flag — handle once only
          router.replace('/(auth)/reset-password');
        } else {
          console.log('[Auth] Ignoring stale PASSWORD_RECOVERY event (no active recovery deep link)');
        }
        return;
      }

      if (isRegistering.current) {
        return;
      }

      if (currentSession?.user) {
        try {
          const profile = await fetchProfile(currentSession.user.id, currentSession.access_token);

          // If profile is null, check for pending registration (email confirmation flow)
          if (profile === null) {
            const didComplete = await completePendingRegistration(
              currentSession.user.id,
              currentSession.access_token
            );
            if (didComplete) {
              await fetchProfile(currentSession.user.id, currentSession.access_token);
              console.log('[Auth] Pending registration completed on auth state change');
            }
          }
        } catch (e) {
          console.warn('onAuthStateChange profile fetch error:', e);
        }
      } else {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      urlSub.remove();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUserProfile(null);
      setSession(null);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    try {
      let currentSession = session;

      if (!currentSession?.user) {
        const sessionResult: any = await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);

        if (sessionResult?.data?.session) {
          currentSession = sessionResult.data.session;
          setSession(currentSession);
        }
      }

      if (!currentSession?.user) {
        console.warn('refreshProfile: no session or timed out');
        return null;
      }

      return await fetchProfile(currentSession.user.id, currentSession.access_token);
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
        signOut,
        refreshProfile,
        setRegistering,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};