import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';

export default function OwnerSettings() {
  const { clear } = useAuthStore();

  return (
    <View style={styles.container}>
      <ProfileScreen />
      <TouchableOpacity
        style={styles.signOut}
        onPress={() => { supabase.auth.signOut(); clear(); }}
      >
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F12' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    margin: 16,
    padding: 14,
    borderRadius: 10,
  },
  signOutText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
