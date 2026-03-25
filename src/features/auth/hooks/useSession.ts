import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { UserProfile, Company } from '@/lib/supabase';

export function useSession() {
  const { setSession, setProfile, setCompany, setLoading, clear } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          clear();
          return;
        }

        if (!session) {
          // No session yet (e.g. INITIAL_SESSION on fresh load) — just stop the spinner.
          // Don't call clear() here: Strict Mode double-mount can fire this after a
          // successful login and would wipe valid state.
          setLoading(false);
          return;
        }

        setSession(session);

        // Defer the DB query to avoid Supabase auth lock deadlock.
        // onAuthStateChange holds an internal lock while the callback runs;
        // calling supabase.from() inside it tries to re-acquire the same lock → hang.
        const userId = session.user.id;
        setTimeout(() => {
          loadProfile(userId)
            .catch((e) => console.error('[useSession] loadProfile error', e))
            .finally(() => setLoading(false));
        }, 0);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) { console.error('[useSession] loadProfile error', error); return; }
    if (!profile) return;

    setProfile(profile as UserProfile);

    // Owner has no company_id — skip company load (RLS would deny it anyway)
    if (profile.company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
      if (!companyError && company) setCompany(company as Company);
    }
  }
}
