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

  // We change the return type to distinguish between "No Profile" (null) and "Network Error" (throw)
  const fetchProfile = async (userId: string, tokenToUse?: string): Promise<UserProfile | null> => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    let token = tokenToUse || session?.access_token;
    
    if (!token) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isRegistering.current) return;

        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (isRegistering.current) return;

        setSession(currentSession);
        
        if (currentSession?.user) {
          try {
            const profile = await fetchProfile(currentSession.user.id, currentSession.access_token);
            
            // Strictly check for null (database confirmed missing). 
            // Ignore if it threw an error (handled by the catch block below)
            if (profile === null && !isRegistering.current) {
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
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);

      if (isRegistering.current) {
        return;
      }

      if (currentSession?.user) {
        try {
          await fetchProfile(currentSession.user.id, currentSession.access_token);
        } catch (e) {
          console.warn('onAuthStateChange profile fetch error:', e);
        }
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