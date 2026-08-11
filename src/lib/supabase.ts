import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const GOOGLE_ACCESS_TOKEN_KEY = 'google_access_token';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'lts_ai',
  },
});

export function persistGoogleProviderToken(session: Session | null): string {
  const providerToken = session?.provider_token?.trim() || '';
  if (providerToken && typeof window !== 'undefined') {
    window.localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, providerToken);
  }
  return providerToken;
}

export function getStoredGoogleAccessToken(): string {
  return getStoredGoogleAccessToken();
}

export async function getGoogleAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const providerToken = persistGoogleProviderToken(session);
  if (providerToken) return providerToken;

  return getStoredGoogleAccessToken();
}

export function clearGoogleAccessToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
  }
}

// Register at the Supabase client boundary so the OAuth callback token is captured
// even if React mounts after Supabase has already processed the redirect session.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearGoogleAccessToken();
    return;
  }
  persistGoogleProviderToken(session);
});

export const isSupabaseConfigured = () => {
  return (
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://demo-placeholder.supabase.co'
  );
};
