import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** true once we've confirmed the signed-in email is on the allowlist (checked via RLS-gated read) */
  allowed: boolean | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAllowed(null);
      return;
    }
    // The allowlist table itself is RLS-gated by the same check, so a
    // successful read (any row) is proof the signed-in user is allowed.
    // This is a real server-side check, not just a UI-level gate: every
    // other table's RLS policy calls the same dailyarc_is_allowed() function.
    supabase
      .from('dailyarc_allowlist')
      .select('email', { count: 'exact', head: true })
      .then(({ error, count }) => {
        if (error) {
          setAllowed(false);
        } else {
          setAllowed((count ?? 0) > 0);
        }
      });
  }, [session]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, allowed, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
