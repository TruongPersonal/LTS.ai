import React, { useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  clearGoogleAccessToken,
  getGoogleAccessToken,
  getStoredGoogleAccessToken,
  isOneHourSessionExpired,
  persistGoogleProviderToken,
  supabase,
} from '../lib/supabase';
import { normalizePlan, type Profile } from '../types/database';
import { AuthContext } from './auth-context';

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
        setProfile({ ...data, plan: normalizePlan(data.plan) });
      } else {
        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'User';
        const profilePayload = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: name,
          plan: 'free' as const,
        };
        const { data: createdData } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .select('*')
          .single();

        setProfile(
          createdData
            ? { ...createdData, plan: normalizePlan(createdData.plan) }
            : {
                ...profilePayload,
                created_at: new Date().toISOString(),
              }
        );
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const acceptGoogleSession = async (authUser: SupabaseUser, accessToken?: string) => {
    if (isOneHourSessionExpired()) {
      void signOut();
      return;
    }
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
    if (typeof window !== 'undefined') {
      if (window.location.hash || window.location.href.endsWith('#')) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl || '/');
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const providerToken = persistGoogleProviderToken(session);
      if (session?.user && !isOneHourSessionExpired()) {
        const accessToken = providerToken || (await getGoogleAccessToken());
        void acceptGoogleSession(session.user, accessToken);
      } else {
        if (isOneHourSessionExpired()) void signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const providerToken = persistGoogleProviderToken(session);
      if (session?.user && !isOneHourSessionExpired()) {
        void acceptGoogleSession(session.user, providerToken || getStoredGoogleAccessToken());
      } else {
        if (isOneHourSessionExpired()) void signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      if (isOneHourSessionExpired()) {
        void signOut();
      }
    }, 10000);
    return () => window.clearInterval(interval);
  }, [user]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
        },
        redirectTo: `${window.location.origin}/projects`,
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
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Error signing out:', err);
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(data).eq('id', user.id);

    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, ...data } : null));
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
