import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/features/auth/hooks/useSession';
import { useAuthStore } from '@/features/auth/store/authStore';

function AuthGate() {
  const router   = useRouter();
  const segments = useSegments();
  const { session, profile, isLoading } = useAuthStore();

  useSession(); // bootstraps session on launch

  useEffect(() => {
    console.log('[AuthGate]', { isLoading, hasSession: !!session, role: profile?.role, segments });

    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (session && profile && inAuthGroup) {
      // Keep new users on set-password until they complete account setup
      if (segments[1] === 'set-password') return;

      switch (profile.role) {
        case 'owner':    router.replace('/(owner)');    break;
        case 'admin':    router.replace('/(admin)');    break;
        case 'employee': router.replace('/(employee)'); break;
      }
    }
  }, [session, profile, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
