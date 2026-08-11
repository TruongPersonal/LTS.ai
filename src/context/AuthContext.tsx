import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  clearGoogleAccessToken,
  getGoogleAccessToken,
  getStoredGoogleAccessToken,
  persistGoogleProviderToken,
  supabase,
} from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (authUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile from DB:', error);
      }

      if (data) {
        setProfile(data);
      } else {
        setProfile({
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const acceptGoogleSession = async (authUser: SupabaseUser, accessToken?: string) => {
    const token = accessToken || getStoredGoogleAccessToken();
    if (!token) {
      console.error('Google OAuth session is missing the Drive provider token.');
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setUser(authUser);
    await fetchProfile(authUser);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const providerToken = persistGoogleProviderToken(session);
      if (session?.user) {
        const accessToken = providerToken || await getGoogleAccessToken();
        void acceptGoogleSession(session.user, accessToken);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const providerToken = persistGoogleProviderToken(session);
      if (session?.user) {
        void acceptGoogleSession(session.user, providerToken || getStoredGoogleAccessToken());
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
        },
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      clearGoogleAccessToken();
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Error signing out:', err);
      throw err;
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        updateProfile,
      }}
    >
      {children}
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
