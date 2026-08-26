import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const TOKEN_EXPIRES_AT_KEY = 'lts_google_token_expires_at';
// Google OAuth access tokens are valid for ~1 hour (expires_in ≈ 3599s).
const GOOGLE_TOKEN_TTL_MS = 60 * 60 * 1000;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'lts_ai' },
});

// The Google Drive provider token is kept in memory to reduce XSS exposure.
// sessionStorage is used only so the token survives a reload within the same tab.
let inMemoryGoogleToken = '';

// One-time cleanup of legacy localStorage keys from the previous implementation.
if (typeof window !== 'undefined') {
  window.localStorage.removeItem(GOOGLE_TOKEN_KEY);
  window.localStorage.removeItem('lts_session_start_time');
}

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
  } catch {
    // sessionStorage may be unavailable (private mode); in-memory token still works.
  }
}

function removeSessionValue(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function persistGoogleProviderToken(session: Session | null): string {
  const token = session?.provider_token?.trim() || '';
  if (token) {
    // Only stamp a fresh expiry when a new token value is issued.
    if (token !== inMemoryGoogleToken || !readSessionValue(TOKEN_EXPIRES_AT_KEY)) {
      writeSessionValue(TOKEN_EXPIRES_AT_KEY, String(Date.now() + GOOGLE_TOKEN_TTL_MS));
    }
    inMemoryGoogleToken = token;
    writeSessionValue(GOOGLE_TOKEN_KEY, token);
  }
  return token;
}

export function isGoogleTokenExpired(): boolean {
  const expiresAtStr = readSessionValue(TOKEN_EXPIRES_AT_KEY);
  if (!expiresAtStr) return false;
  const expiresAt = Number(expiresAtStr);
  return Number.isFinite(expiresAt) && Date.now() >= expiresAt;
}

export function getStoredGoogleAccessToken(): string {
  if (isGoogleTokenExpired()) return '';
  if (!inMemoryGoogleToken) {
    inMemoryGoogleToken = readSessionValue(GOOGLE_TOKEN_KEY);
  }
  return inMemoryGoogleToken;
}

export async function getGoogleAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = persistGoogleProviderToken(session);

  if (token) {
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

// Sync Google token when auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearGoogleAccessToken();
    return;
  }
  persistGoogleProviderToken(session);
});
