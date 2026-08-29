import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const TOKEN_EXPIRES_AT_KEY = 'lts_google_token_expires_at';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'lts_ai' },
});

let inMemoryGoogleToken = '';
let refreshPromise: Promise<string> | null = null;

function readSessionValue(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeSessionValue(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

function removeSessionValue(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

export function persistGoogleProviderToken(session: Session | null): string {
  const token = session?.provider_token?.trim() || '';
  if (token) {
    inMemoryGoogleToken = token;
    writeSessionValue(GOOGLE_TOKEN_KEY, token);
    const expiresInMs = (session?.expires_in || 3600) * 1000;
    writeSessionValue(TOKEN_EXPIRES_AT_KEY, String(Date.now() + expiresInMs));
  }

  const refreshToken = (session as any)?.provider_refresh_token?.trim() || '';
  if (refreshToken && session?.user?.id) {
    void supabase
      .from('profiles')
      .update({ google_refresh_token: refreshToken })
      .eq('id', session.user.id);
  }

  return token;
}

export function getStoredGoogleAccessToken(): string {
  if (!inMemoryGoogleToken) {
    inMemoryGoogleToken = readSessionValue(GOOGLE_TOKEN_KEY);
  }
  return inMemoryGoogleToken;
}

export function isGoogleTokenExpired(): boolean {
  const expiresAt = Number(readSessionValue(TOKEN_EXPIRES_AT_KEY) || '0');
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - 5 * 60 * 1000;
}

export async function refreshGoogleAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-media', {
        body: { action: 'get_google_access_token' },
      });

      if (error || !data?.access_token) {
        throw new Error(data?.error || error?.message || 'Unable to refresh Google access token.');
      }

      const freshToken = String(data.access_token);
      inMemoryGoogleToken = freshToken;
      writeSessionValue(GOOGLE_TOKEN_KEY, freshToken);
      const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
      writeSessionValue(TOKEN_EXPIRES_AT_KEY, String(Date.now() + expiresInMs));

      return freshToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getGoogleAccessToken(forceRefresh = false): Promise<string> {
  const token = getStoredGoogleAccessToken();
  if (token && !isGoogleTokenExpired() && !forceRefresh) {
    return token;
  }

  try {
    const refreshedToken = await refreshGoogleAccessToken();
    if (refreshedToken) return refreshedToken;
  } catch (err) {
    console.warn('Backend Google token refresh fallback error:', err);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionToken = persistGoogleProviderToken(session);

  if (sessionToken) {
    return sessionToken;
  }

  if (token && !forceRefresh) {
    return token;
  }

  throw new Error('Google provider access token is unavailable.');
}

export function clearGoogleAccessToken(): void {
  inMemoryGoogleToken = '';
  removeSessionValue(GOOGLE_TOKEN_KEY);
  removeSessionValue(TOKEN_EXPIRES_AT_KEY);
}

export const isSupabaseConfigured = () =>
  Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://demo-placeholder.supabase.co'
  );

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearGoogleAccessToken();
    return;
  }
  persistGoogleProviderToken(session);
});
