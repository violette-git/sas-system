import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

export default function OwnerSettings() {
  const { profile, clear } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0).toUpperCase() ?? 'O'}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>{profile?.full_name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <Text style={styles.roleBadge}>Platform Owner</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.signOut}
        onPress={() => { supabase.auth.signOut(); clear(); }}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, padding: 24, backgroundColor: '#f8f9fa' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 24 },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: '#fff', fontSize: 22, fontWeight: '700' },
  name:        { fontSize: 17, fontWeight: '700', color: '#111827' },
  email:       { fontSize: 13, color: '#6b7280', marginTop: 2 },
  roleBadge:   { fontSize: 11, fontWeight: '600', color: '#7c3aed', marginTop: 4 },
  signOut:     { backgroundColor: '#ef4444', padding: 14, borderRadius: 10, alignItems: 'center' },
  signOutText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
