import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabase/browser';
import type { UserRole, Database } from '../lib/supabase/types';

type UserRow = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];

interface UserProfile {
  id: string;
  authId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: AuthError | Error | null; user?: User }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | Error | null }>;
  resendOtp: (email: string) => Promise<{ error: AuthError | Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from our users table
  const fetchProfile = async (authId: string): Promise<UserProfile | null> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_id, email, full_name, role')
        .eq('auth_id', authId)
        .maybeSingle<UserRow>();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (!data) {
        // No app-side profile row (yet). Caller handles self-heal.
        return null;
      }

      return {
        id: data.id,
        authId: data.auth_id,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
      };
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  // Load the profile, self-healing if the app-side row is missing. An auth user
  // can exist without a public.users row if signup provisioning was interrupted
  // before the handle_new_user trigger was in place. In that case we recreate
  // the row (server-side, idempotent) from the auth metadata, then refetch.
  const ensureProfile = async (authUser: User): Promise<UserProfile | null> => {
    const existing = await fetchProfile(authUser.id);
    if (existing) return existing;

    // Only heal confirmed accounts to avoid provisioning unverified signups.
    if (!authUser.email_confirmed_at) return null;

    try {
      await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authId: authUser.id,
          email: authUser.email,
          fullName: authUser.user_metadata?.full_name || authUser.email,
          role: authUser.user_metadata?.role || 'owner',
        }),
      });
    } catch (err) {
      console.error('Self-heal profile creation failed:', err);
      return null;
    }

    return fetchProfile(authUser.id);
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            const userProfile = await ensureProfile(initialSession.user);
            if (mounted) {
              setProfile(userProfile);
            }
          }
          setLoading(false);
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            if (mounted) {
              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (newSession?.user) {
                const userProfile = await ensureProfile(newSession.user);
                if (mounted) {
                  setProfile(userProfile);
                }
              } else {
                setProfile(null);
              }
              setLoading(false);
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Sign up with Supabase Auth.
      // emailRedirectTo ensures that if the user confirms via the magic link
      // (instead of entering the 6-digit code inline), they land on /login,
      // which runs redirectBasedOnRole and forwards appraisers into onboarding
      // — rather than dropping them on the home page with no next step.
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (authError) {
        return { error: authError };
      }

      if (!data.user) {
        return { error: new Error('Failed to create user') };
      }

      // Profile will be created via /api/auth/create-profile after email confirmation
      // This allows for proper invite token handling and onboarding draft creation
      return { error: null, user: data.user };
    } catch (err) {
      console.error('Sign up error:', err);
      return { error: err as Error };
    }
  };

  // Verify the 6-digit signup code. On success Supabase establishes a session,
  // which onAuthStateChange picks up and runs ensureProfile.
  const verifyOtp = async (email: string, token: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    return { error };
  };

  // Re-send the signup confirmation code.
  const resendOtp = async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        verifyOtp,
        resendOtp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
