import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const TOKEN_EXPIRES_AT_KEY = 'lts_google_token_expires_at';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'lts_ai' },
});

let inMemoryGoogleToken = '';

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
  }
  return token;
}

export function getStoredGoogleAccessToken(): string {
  if (!inMemoryGoogleToken) {
    inMemoryGoogleToken = readSessionValue(GOOGLE_TOKEN_KEY);
  }
  return inMemoryGoogleToken;
}

export async function getGoogleAccessToken(): Promise<string> {
  const token = getStoredGoogleAccessToken();
  if (token) {
    return token;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionToken = persistGoogleProviderToken(session);

  if (sessionToken) {
    return sessionToken;
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
