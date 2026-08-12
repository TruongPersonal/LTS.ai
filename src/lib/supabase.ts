import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const SESSION_START_KEY = 'lts_session_start_time';
const ONE_HOUR_MS = 60 * 60 * 1000;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'lts_ai' },
});

export function persistGoogleProviderToken(session: Session | null): string {
  const token = session?.provider_token?.trim() || '';
  if (token && typeof window !== 'undefined') {
    window.localStorage.setItem(GOOGLE_TOKEN_KEY, token);
    if (!window.localStorage.getItem(SESSION_START_KEY)) {
      window.localStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }
  }
  return token;
}

export function isOneHourSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const startStr = window.localStorage.getItem(SESSION_START_KEY);
  if (!startStr) return false;
  const startTime = Number(startStr);
  return Number.isFinite(startTime) && Date.now() - startTime >= ONE_HOUR_MS;
}

export function getStoredGoogleAccessToken(): string {
  if (typeof window === 'undefined') return '';
  if (isOneHourSessionExpired()) return '';
  return window.localStorage.getItem(GOOGLE_TOKEN_KEY) || '';
}

export async function getGoogleAccessToken(): Promise<string> {
  if (isOneHourSessionExpired()) return '';
  const { data: { session } } = await supabase.auth.getSession();
  const token = persistGoogleProviderToken(session);
  return token || getStoredGoogleAccessToken();
}

export function clearGoogleAccessToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(GOOGLE_TOKEN_KEY);
    window.localStorage.removeItem(SESSION_START_KEY);
  }
}

export const isSupabaseConfigured = () =>
  Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://demo-placeholder.supabase.co'
  );

// Sync Google token when auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearGoogleAccessToken();
    return;
  }
  persistGoogleProviderToken(session);
});
