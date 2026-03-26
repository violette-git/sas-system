import { useEffect } from 'react';
import { View, StatusBar } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/features/auth/hooks/useSession';
import { useAuthStore } from '@/features/auth/store/authStore';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

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

    // Owner with no company outside auth group → onboarding
    if (session && profile && profile.role === 'owner' && !profile.company_id && !inAuthGroup) {
      router.replace('/(auth)/onboarding');
      return;
    }

    if (session && profile && inAuthGroup) {
      // Keep new users on set-password until they complete account setup
      if ((segments as string[])[1] === 'set-password') return;
      // Keep owners on onboarding until they finish setup
      if ((segments as string[])[1] === 'onboarding') return;

      // New owner with no company → start onboarding
      if (profile.role === 'owner' && !profile.company_id) {
        router.replace('/(auth)/onboarding');
        return;
      }

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
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: '#0D0F12' }}>
          <StatusBar barStyle="light-content" backgroundColor="#0D0F12" />
          <AuthGate />
        </View>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
