import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
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
  refreshProfile: () => Promise<void>; // Added to manually trigger profile fetch
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  userProfile: null,
  isLoading: true,
  role: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setUserProfile(data);
      } else {
        console.log("No profile found for user:", userId);
      }
    } catch (e) {
      console.error('Error loading profile', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
    setIsLoading(true);
    await supabase.auth.signOut();
    setUserProfile(null);
    setSession(null);
    setIsLoading(false);
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
        refreshProfile: () => session?.user ? fetchProfile(session.user.id) : Promise.resolve(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};