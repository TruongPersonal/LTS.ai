import { createContext } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Profile } from '../types/database';

export interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
