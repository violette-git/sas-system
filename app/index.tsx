import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

export default function Index() {
  // On web, check URL hash for Supabase auth redirects (invite, password reset)
  // before doing anything else — otherwise we'd wipe the hash by navigating away.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      return <Redirect href="/(auth)/set-password" />;
    }
  }

  // AuthGate in _layout.tsx handles redirect once auth state resolves.
  return <Redirect href="/(auth)/login" />;
}
