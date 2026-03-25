import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { UserProfile } from '@/lib/supabase';

interface SignInParams {
  accessCode: string;
  email: string;
  password: string;
}

interface SignInError {
  field: 'accessCode' | 'email' | 'password' | 'general';
  message: string;
}

export function useSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const { setSession, setProfile, setLoading } = useAuthStore();

  async function signIn({ accessCode, email, password }: SignInParams) {
    setIsLoading(true);
    setError(null);

    const code = accessCode.trim();

    try {
      // ── Step 1: Authenticate ─────────────────────────────────
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError({ field: 'general', message: 'Invalid email or password.' });
        return;
      }

      // ── Step 2: Load profile ─────────────────────────────────
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      console.log('[useSignIn] step2 profile result:', { profile: !!profile, error: profileError });

      if (profileError || !profile) {
        console.log('[useSignIn] signing out — profile load failed');
        await supabase.auth.signOut();
        setError({ field: 'general', message: 'User profile not found. Contact your administrator.' });
        return;
      }

      const userProfile = profile as UserProfile;

      // ── Step 3: Owner — no company code needed ───────────────
      if (userProfile.role === 'owner') {
        setSession(authData.session);
        setProfile(userProfile);
        setLoading(false);  // unblock the AuthGate
        return;
      }

      // ── Step 4: Non-owner — company code required ────────────
      if (!code) {
        console.log('[useSignIn] signing out — no company code');
        await supabase.auth.signOut();
        setError({ field: 'accessCode', message: 'Enter your company code to sign in.' });
        return;
      }

      const { data: companies, error: codeError } = await supabase
        .rpc('resolve_company_code', { p_code: code });

      console.log('[useSignIn] resolve_company_code result:', { companies, codeError });

      if (codeError) throw codeError;

      if (!companies || companies.length === 0) {
        console.log('[useSignIn] signing out — code not found');
        await supabase.auth.signOut();
        setError({ field: 'accessCode', message: 'Company code not found.' });
        return;
      }

      // resolve_company_code returns { company_id, company_name, is_active }
      const resolved = companies[0] as { company_id: string; company_name: string; is_active: boolean };

      if (!resolved.is_active) {
        console.log('[useSignIn] signing out — company inactive');
        await supabase.auth.signOut();
        setError({ field: 'accessCode', message: 'This company account is inactive.' });
        return;
      }

      if (userProfile.company_id !== resolved.company_id) {
        console.log('[useSignIn] signing out — wrong company. profile:', userProfile.company_id, 'code resolved to:', resolved.company_id);
        await supabase.auth.signOut();
        setError({ field: 'accessCode', message: 'This account does not belong to that company.' });
        return;
      }

      console.log('[useSignIn] all checks passed, completing login');

      setSession(authData.session);
      setProfile(userProfile);
      setLoading(false);  // unblock the AuthGate
      // company will be set by useSession.loadProfile via onAuthStateChange

    } catch (err: any) {
      setError({ field: 'general', message: err.message ?? 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  }

  return { signIn, isLoading, error };
}
