import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, Company } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  company: Company | null;
  isLoading: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  company: null,
  isLoading: true,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setCompany: (company) => set({ company }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ session: null, profile: null, company: null, isLoading: false }),
}));
