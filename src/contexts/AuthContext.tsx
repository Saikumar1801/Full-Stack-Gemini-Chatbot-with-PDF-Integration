// src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client'; // Adjust path if your lib is not under src/

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createSupabaseBrowserClient(); // This will be created in the next step
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const getSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession(); // Renamed to avoid conflict
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentAuthSession) => { // Renamed to avoid conflict
        setSession(currentAuthSession);
        setUser(currentAuthSession?.user ?? null);
        setIsLoading(false); // Also set loading to false here
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase.auth]); // Dependency array for useEffect

  const signOut = async () => {
    await supabase.auth.signOut();
    // setUser and setSession will be updated by onAuthStateChange,
    // or you can explicitly set them to null here if preferred for immediate UI update
    // setUser(null);
    // setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {!isLoading && children} {/* Optionally only render children when not initial loading */}
      {/* Or simply {children} if you handle loading state within consuming components */}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};