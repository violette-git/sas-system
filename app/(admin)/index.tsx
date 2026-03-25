import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useSchedules } from '@/features/schedules/hooks/useSchedules';
import { useAuthorizations } from '@/features/authorizations/hooks/useAuthorizations';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function AdminDashboard() {
  const router = useRouter();
  const { profile, company, clear } = useAuthStore();

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const tomorrow = useMemo(() => new Date(today.getTime() + 86400000), [today]);

  const { data: todaySchedules, isLoading: loadingSchedules } = useSchedules({
    dateFrom: today.toISOString(),
    dateTo: tomorrow.toISOString(),
  });

  const { data: allAuths, isLoading: loadingAuths } = useAuthorizations();

  // Stats
  const stats = useMemo(() => {
    const schedules = todaySchedules ?? [];
    const auths = allAuths ?? [];
    const in30Days = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    return {
      todayCount:     schedules.length,
      inProgress:     schedules.filter(s => s.status === 'in_progress').length,
      completed:      schedules.filter(s => s.status === 'completed').length,
      expiringAuths:  auths.filter(a => a.is_active && a.end_date <= in30Days && a.end_date >= todayStr).length,
    };
  }, [todaySchedules, allAuths, today]);

  const isLoading = loadingSchedules || loadingAuths;

  // Expiring authorizations (within 30 days)
  const expiringAuths = useMemo(() => {
    if (!allAuths) return [];
    const in30Days = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    return allAuths
      .filter(a => a.is_active && a.end_date <= in30Days && a.end_date >= todayStr)
      .sort((a, b) => a.end_date.localeCompare(b.end_date))
      .slice(0, 5);
  }, [allAuths, today]);

  // Today's in-progress visits
  const liveVisits = useMemo(
    () => (todaySchedules ?? []).filter(s => s.status === 'in_progress'),
    [todaySchedules]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.companyLabel}>{company?.trade_name ?? company?.name}</Text>
          <Text style={styles.greeting}>Hello, {profile?.full_name?.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity onPress={() => { supabase.auth.signOut(); clear(); }} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563eb" />
      ) : (
        <>
          {/* Stat cards */}
          <View style={styles.statsGrid}>
            <StatCard icon="calendar-outline" label="Today's Visits" value={stats.todayCount} color="#2563eb" />
            <StatCard icon="radio-button-on-outline" label="In Progress" value={stats.inProgress} color="#d97706" />
            <StatCard icon="checkmark-circle-outline" label="Completed" value={stats.completed} color="#059669" />
            <StatCard
              icon="warning-outline"
              label="Expiring Soon"
              value={stats.expiringAuths}
              color={stats.expiringAuths > 0 ? '#dc2626' : '#6b7280'}
            />
          </View>

          {/* Live visits */}
          {liveVisits.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Live Now</Text>
              {liveVisits.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.liveCard}
                  onPress={() => router.push(`/(admin)/schedule/${s.id}`)}
                >
                  <View style={styles.liveDot} />
                  <View style={styles.liveBody}>
                    <Text style={styles.liveClient}>{s.clients?.name ?? '—'}</Text>
                    <Text style={styles.liveMeta}>{s.users?.full_name ?? '—'} · {fmtTime(s.start_time)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Today's schedule */}
          {(todaySchedules?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {todaySchedules!.filter(s => s.status !== 'cancelled').map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.scheduleRow}
                  onPress={() => router.push(`/(admin)/schedule/${s.id}`)}
                >
                  <Text style={styles.scheduleTime}>{fmtTime(s.start_time)}</Text>
                  <View style={styles.scheduleBody}>
                    <Text style={styles.scheduleClient}>{s.clients?.name ?? '—'}</Text>
                    <Text style={styles.scheduleMeta}>{s.users?.full_name ?? '—'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Expiring authorizations */}
          {expiringAuths.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Expiring Authorizations</Text>
              {expiringAuths.map(a => {
                const daysLeft = Math.ceil((new Date(a.end_date).getTime() - today.getTime()) / 86400000);
                const urgent = daysLeft <= 7;
                return (
                  <View key={a.id} style={styles.authRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color={urgent ? '#dc2626' : '#d97706'}
                    />
                    <View style={styles.authBody}>
                      <Text style={styles.authClient}>{a.clients?.name ?? '—'}</Text>
                      <Text style={styles.authMeta}>{a.auth_number} · {a.service_types?.name}</Text>
                    </View>
                    <Text style={[styles.authDays, urgent && styles.authDaysUrgent]}>
                      {daysLeft}d
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Empty state */}
          {(todaySchedules?.length ?? 0) === 0 && expiringAuths.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="sunny-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No visits scheduled today</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content:   { padding: 20, gap: 16, paddingBottom: 32 },

  pageHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  companyLabel: { fontSize: 12, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.8 },
  greeting:     { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 2 },
  signOutBtn:   { padding: 8 },
  loader:       { marginTop: 48 },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:   { flex: 1, minWidth: '44%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  statValue:  { fontSize: 28, fontWeight: '700' },
  statLabel:  { fontSize: 11, color: '#6b7280', textAlign: 'center' },

  section:      { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },

  liveCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10, borderLeftWidth: 3, borderLeftColor: '#22c55e' },
  liveDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveBody:   { flex: 1 },
  liveClient: { fontSize: 14, fontWeight: '600', color: '#111827' },
  liveMeta:   { fontSize: 12, color: '#6b7280' },

  scheduleRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 10 },
  scheduleTime:   { fontSize: 12, fontWeight: '700', color: '#6b7280', minWidth: 60 },
  scheduleBody:   { flex: 1 },
  scheduleClient: { fontSize: 14, fontWeight: '600', color: '#111827' },
  scheduleMeta:   { fontSize: 12, color: '#6b7280' },

  authRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 10 },
  authBody:     { flex: 1 },
  authClient:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  authMeta:     { fontSize: 12, color: '#9ca3af' },
  authDays:     { fontSize: 13, fontWeight: '700', color: '#d97706' },
  authDaysUrgent: { color: '#dc2626' },

  empty:      { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText:  { fontSize: 14, color: '#9ca3af' },
});
