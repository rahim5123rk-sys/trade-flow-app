import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';

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
  signOut: async () => {},
  refreshProfile: async () => null,
  setRegistering: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRegistering = useRef(false);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

      // Get the current session token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) {
        console.log('No token available for profile fetch');
        return null;
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
        console.error('Profile fetch failed:', response.status);
        return null;
      }

      const rows = await response.json();
      if (rows && rows.length > 0) {
        console.log('Profile loaded successfully');
        setUserProfile(rows[0]);
        return rows[0];
      }

      console.log('No profile found for user');
      return null;
    } catch (e) {
      console.error('Error loading profile:', e);
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(false);
      try {
        // Don't do anything if we're in the middle of registration
        if (isRegistering.current) return;

        const { data: { session } } = await supabase.auth.getSession();

        // Check again after await — registration may have started while we were waiting
        if (isRegistering.current) return;

        setSession(session);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (!profile && !isRegistering.current) {
            console.log('Session exists but no profile — signing out');
            await supabase.auth.signOut();
            setSession(null);
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
      }
    };
    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Guard FIRST — don't touch any state during registration
      if (isRegistering.current) {
        console.log('Auth state changed during registration — skipping entirely');
        return;
      }

      setSession(session);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
      // Prefer the in-memory session to avoid SecureStore hangs
      if (session?.user) {
        return await fetchProfile(session.user.id);
      }

      // Fallback to getSession with a timeout safeguard
      const sessionResult: any = await Promise.race([
        supabase.auth.getSession(),
        new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);

      if (!sessionResult || !sessionResult.data?.session) {
        console.warn('refreshProfile: no session or timed out');
        return null;
      }

      const currentSession = sessionResult.data.session as Session;
      setSession(currentSession);
      return await fetchProfile(currentSession.user.id);
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