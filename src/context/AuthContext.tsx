import React, { useCallback, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  clearGoogleAccessToken,
  getStoredGoogleAccessToken,
  persistGoogleProviderToken,
  supabase,
} from '../lib/supabase';
import { normalizePlan, normalizeUserRole, type Profile } from '../types/database';
import { systemService } from '../services/systemService';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const signOut = useCallback(async () => {
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
  }, []);

  const fetchProfile = useCallback(async (authUser: SupabaseUser) => {
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
        const rawPlan = normalizePlan(data.plan);
        const isPlanExpired =
          rawPlan !== 'free' &&
          Boolean(data.plan_expires_at) &&
          !Number.isNaN(new Date(data.plan_expires_at).getTime()) &&
          new Date(data.plan_expires_at).getTime() <= Date.now();

        setProfile({
          ...data,
          plan: isPlanExpired ? 'free' : rawPlan,
          plan_expires_at: isPlanExpired ? null : data.plan_expires_at,
          role: normalizeUserRole(data.role),
        });
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
        };
        const { data: createdData } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .select('*')
          .single();

        setProfile(
          createdData
            ? {
                ...createdData,
                plan: normalizePlan(createdData.plan),
                role: normalizeUserRole(createdData.role),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const acceptGoogleSession = useCallback(async (authUser: SupabaseUser, accessToken?: string) => {
    const token = accessToken || getStoredGoogleAccessToken();
    if (!token) {
      console.warn('Google OAuth session is active without cached Drive provider token.');
    }

    setUser(authUser);
    await fetchProfile(authUser);
  }, [fetchProfile]);

  useEffect(() => {
    void systemService.fetchAndApplyQuotas();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const providerToken = persistGoogleProviderToken(session);
        const accessToken = providerToken || getStoredGoogleAccessToken();
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
      if (session?.user) {
        const providerToken = persistGoogleProviderToken(session);
        void acceptGoogleSession(session.user, providerToken || getStoredGoogleAccessToken());
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [acceptGoogleSession]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly email profile',
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
        redirectTo: `${window.location.origin}/projects`,
      },
    });
    if (error) throw error;
  };

  const updateProfile = async (data: Pick<Profile, 'full_name'>) => {
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
