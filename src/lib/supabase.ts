import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const TOKEN_EXPIRES_AT_KEY = 'lts_google_token_expires_at';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'lts_ai' },
});

let inMemoryGoogleToken = '';
let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google GIS script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google GIS script.'));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
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

export async function refreshGoogleAccessToken(forcePrompt = false): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.');
  }

  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:
          'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file email profile',
        prompt: forcePrompt ? 'consent' : '',
        callback: (response: { access_token?: string; error?: string; expires_in?: number }) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || 'Failed to obtain Google access token.'));
            return;
          }
          const token = response.access_token;
          inMemoryGoogleToken = token;
          writeSessionValue(GOOGLE_TOKEN_KEY, token);
          const expiresInMs = (Number(response.expires_in) || 3600) * 1000;
          writeSessionValue(TOKEN_EXPIRES_AT_KEY, String(Date.now() + expiresInMs));
          resolve(token);
        },
        error_callback: (error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error || 'Google token client error')));
        },
      });

      client.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
    } catch (err) {
      reject(err);
    }
  });
}

export async function getGoogleAccessToken(): Promise<string> {
  const token = getStoredGoogleAccessToken();
  if (token && !isGoogleTokenExpired()) {
    return token;
  }

  try {
    const refreshedToken = await refreshGoogleAccessToken(false);
    if (refreshedToken) return refreshedToken;
  } catch (gisError) {
    console.warn('Silent Google token refresh via GIS encountered an error, using fallback:', gisError);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionToken = persistGoogleProviderToken(session);

  if (sessionToken) {
    return sessionToken;
  }

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

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    clearGoogleAccessToken();
    return;
  }
  persistGoogleProviderToken(session);
});
