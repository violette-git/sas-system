import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useMySchedules } from '@/features/schedules/hooks/useSchedules';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ScheduleWithRelations } from '@/features/schedules/hooks/useSchedules';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:   { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' },
  in_progress: { bg: '#fef9c3', text: '#92400e', label: 'In Progress' },
  completed:   { bg: '#dcfce7', text: '#166534', label: 'Completed' },
};

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  if (d >= today && d < tomorrow) return 'Today';
  if (d >= tomorrow && d < new Date(tomorrow.getTime()+86400000)) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function VisitCard({ item, onPress }: { item: ScheduleWithRelations; onPress: () => void }) {
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled;
  const dayLabel = fmtDay(item.start_time);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardDay}>{dayLabel}</Text>
        <Text style={styles.cardTime}>{fmtTime(item.start_time)}</Text>
        <Text style={styles.cardTimeSub}>– {fmtTime(item.end_time)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardClient} numberOfLines={1}>{item.clients?.name ?? '—'}</Text>
        {item.service_types && (
          <Text style={styles.cardService} numberOfLines={1}>{item.service_types.name}</Text>
        )}
        {item.authorizations && (
          <Text style={styles.cardAuth} numberOfLines={1}>Auth: {item.authorizations.auth_number}</Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" style={{ marginTop: 6 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function EmployeeSchedule() {
  const router = useRouter();
  const { profile, company, clear } = useAuthStore();
  const { data: schedules, isLoading, isFetching, refetch } = useMySchedules();

  const today = new Date(); today.setHours(0,0,0,0);
  const todaySchedules     = (schedules ?? []).filter(s => {
    const d = new Date(s.start_time); d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });
  const upcomingSchedules  = (schedules ?? []).filter(s => {
    const d = new Date(s.start_time); d.setHours(0,0,0,0);
    return d.getTime() > today.getTime();
  });

  return (
    <View style={styles.container}>
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

      {isLoading
        ? <SkeletonList count={4} showAvatar={false} />
        : (
          <FlatList
            data={schedules}
            keyExtractor={s => s.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor="#2563eb"
                colors={['#2563eb']}
              />
            }
            ListHeaderComponent={
              schedules?.length === 0 ? null : (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {todaySchedules.length > 0 ? `Today · ${todaySchedules.length} visit${todaySchedules.length !== 1 ? 's' : ''}` : 'Upcoming 7 Days'}
                  </Text>
                </View>
              )
            }
            renderItem={({ item, index }) => {
              // Insert "Upcoming" header before first non-today item
              const prevItem = schedules?.[index - 1];
              const isFirstUpcoming = todaySchedules.length > 0 && upcomingSchedules.includes(item) && (!prevItem || todaySchedules.includes(prevItem));
              return (
                <View>
                  {isFirstUpcoming && (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Upcoming</Text>
                    </View>
                  )}
                  <VisitCard item={item} onPress={() => router.push({ pathname: '/(employee)/visit/[id]', params: { id: item.id } })} />
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title="No visits this week"
                description="Your schedule for the next 7 days will appear here."
              />
            }
          />
        )
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8f9fa' },
  loader:      { marginTop: 60 },

  pageHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  companyLabel: { fontSize: 12, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.8 },
  greeting:     { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 2 },
  signOutBtn:   { padding: 8 },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },

  list: { paddingHorizontal: 12, paddingBottom: 24 },

  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardLeft:    { width: 64, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f3f4f6', marginRight: 12, paddingRight: 12 },
  cardDay:     { fontSize: 11, fontWeight: '700', color: '#2563eb', textAlign: 'center' },
  cardTime:    { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 },
  cardTimeSub: { fontSize: 11, color: '#9ca3af' },
  cardBody:    { flex: 1, gap: 2 },
  cardClient:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardService: { fontSize: 12, color: '#6b7280' },
  cardAuth:    { fontSize: 11, color: '#9ca3af' },
  cardRight:   { alignItems: 'flex-end' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 11, fontWeight: '600' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  emptyHint:  { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 },
});
