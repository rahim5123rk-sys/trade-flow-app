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

      if (data) {
        console.log('Profile loaded successfully');
        setUserProfile(data);
        return data;
      }

      console.log('No profile found for user');
      return null;
    } catch (e) {
      console.error('Error loading profile', e);
      return null;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (isRegistering.current) {
        console.log('Auth state changed during registration — skipping');
        return;
      }

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setUserProfile(null);
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
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      setSession(currentSession);
      const profile = await fetchProfile(currentSession.user.id);
      return profile;
    }
    console.log('refreshProfile: no active session');
    return null;
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