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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile query error:', error.message, error.code);
        return null;
      }

      if (data) {
        console.log('Profile loaded successfully');
        setUserProfile(data);
        return data;
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
      // Show login immediately; load session/profile in background
      setIsLoading(false);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          // If session exists but no profile, sign out to avoid stuck state
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