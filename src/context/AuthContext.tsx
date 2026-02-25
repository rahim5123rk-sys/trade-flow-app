import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  role: UserRole | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userProfile: null,
  isLoading: true,
  role: null,
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // In a real app, we fetch the claims or user doc here
        // For now, we simulate a fetch
        try {
            const tokenResult = await currentUser.getIdTokenResult();
            const role = tokenResult.claims.role as UserRole;
            const companyId = tokenResult.claims.companyId as string;

            setUserProfile({
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || '',
                role: role || 'worker', // Default fallback
                companyId: companyId || 'unknown'
            });
        } catch (e) {
            console.error("Error fetching user profile", e);
        }
      } else {
        setUserProfile(null);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        userProfile, 
        isLoading, 
        role: userProfile?.role || null,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};