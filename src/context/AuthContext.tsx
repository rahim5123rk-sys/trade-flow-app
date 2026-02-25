import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'worker';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  companyId: string;
}

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  role: UserRole | null;
  isAuthenticated: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  user: null,
  userProfile: null,
  isLoading: true,
  role: null,
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          // READ FROM FIRESTORE — not ID token claims.
          // Custom claims require the Firebase Admin SDK (Cloud Functions).
          // Until we have that, the source of truth is the 'users' Firestore doc
          // written during register-company.tsx and add.tsx.
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile({
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: data.displayName || currentUser.displayName || '',
              role: data.role as UserRole,
              companyId: data.companyId || '',
            });
          } else {
            // User exists in Firebase Auth but has no Firestore profile yet.
            // This can happen if registration failed halfway through.
            // Clear the profile so the app falls back to login.
            console.warn(`No Firestore profile found for UID: ${currentUser.uid}`);
            setUserProfile(null);
          }
        } catch (e) {
          console.error('Error fetching user profile from Firestore:', e);
          setUserProfile(null);
        }
      } else {
        // Logged out — clear everything
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
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
