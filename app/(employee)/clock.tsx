import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActiveTimeEntry, useClockIn, useClockOut } from '@/features/time-entries/hooks/useTimeEntries';
import { useMySchedules } from '@/features/schedules/hooks/useSchedules';
import type { ScheduleWithRelations } from '@/features/schedules/hooks/useSchedules';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Active clock-in state ──────────────────────────────────────────────────────

function ClockedInCard({ entry, schedules }: { entry: any; schedules: ScheduleWithRelations[] }) {
  const clockOut = useClockOut();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(entry.clocked_in_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [entry.clocked_in_at]);

  const schedule = schedules.find(s => s.id === entry.schedule_id);
  const units = Math.floor(elapsed / 900);
  const hours = (elapsed / 3600).toFixed(2);

  function handleClockOut() {
    clockOut.mutate({
      id: entry.id,
      schedule_id: entry.schedule_id,
    });
  }

  return (
    <View style={styles.clockedInCard}>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Clocked In</Text>
      </View>

      {schedule && (
        <View style={styles.activeVisitInfo}>
          <Text style={styles.activeClient}>{schedule.clients?.name ?? '—'}</Text>
          {schedule.service_types && (
            <Text style={styles.activeService}>{schedule.service_types.name}</Text>
          )}
          <Text style={styles.activeTime}>
            {fmtTime(schedule.start_time)} – {fmtTime(schedule.end_time)}
          </Text>
        </View>
      )}

      <Text style={styles.timer}>{fmtElapsed(elapsed)}</Text>

      <View style={styles.unitRow}>
        <View style={styles.unitChip}>
          <Text style={styles.unitLabel}>Units</Text>
          <Text style={styles.unitValue}>{units}</Text>
        </View>
        <View style={styles.unitChip}>
          <Text style={styles.unitLabel}>Hours</Text>
          <Text style={styles.unitValue}>{hours}</Text>
        </View>
        <View style={styles.unitChip}>
          <Text style={styles.unitLabel}>Since</Text>
          <Text style={styles.unitValue}>{fmtTime(entry.clocked_in_at)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.clockBtn, styles.clockOutBtn, clockOut.isPending && styles.btnDisabled]}
        onPress={handleClockOut}
        disabled={clockOut.isPending}
      >
        {clockOut.isPending
          ? <ActivityIndicator color="#fff" />
          : (
            <>
              <Ionicons name="stop-circle-outline" size={22} color="#fff" />
              <Text style={styles.clockBtnText}>Clock Out</Text>
            </>
          )
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Idle state ─────────────────────────────────────────────────────────────────

function IdleCard({ schedules }: { schedules: ScheduleWithRelations[] }) {
  const clockIn = useClockIn();
  const [selected, setSelected] = useState<string | null>(null);

  const now = new Date();
  const upcoming = schedules.filter(s => s.status === 'scheduled' || s.status === 'in_progress');

  // Auto-select first in-progress or scheduled visit today
  const autoSelect = upcoming.find(s => {
    const start = new Date(s.start_time);
    const end   = new Date(s.end_time);
    const today = new Date(); today.setHours(0,0,0,0);
    return start >= today && start <= new Date(today.getTime() + 86400000);
  });

  const scheduleId = selected ?? autoSelect?.id ?? null;
  const targetSchedule = upcoming.find(s => s.id === scheduleId);

  function handleClockIn() {
    if (!scheduleId) {
      Alert.alert('Select a Visit', 'Please select a visit to clock into.');
      return;
    }
    clockIn.mutate({ schedule_id: scheduleId });
  }

  return (
    <View style={styles.idleCard}>
      <Ionicons name="time-outline" size={48} color="#93c5fd" />
      <Text style={styles.idleTitle}>Ready to Clock In?</Text>
      <Text style={styles.idleHint}>Select a visit below then tap Clock In</Text>

      {upcoming.length === 0 ? (
        <Text style={styles.noVisits}>No upcoming visits this week</Text>
      ) : (
        <View style={styles.visitPicker}>
          {upcoming.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.visitOption, scheduleId === s.id && styles.visitOptionSelected]}
              onPress={() => setSelected(s.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.visitOptionClient, scheduleId === s.id && styles.visitOptionClientSelected]}>
                  {s.clients?.name ?? '—'}
                </Text>
                <Text style={styles.visitOptionMeta}>
                  {fmtDay(s.start_time)} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                </Text>
                {s.service_types && (
                  <Text style={styles.visitOptionService}>{s.service_types.name}</Text>
                )}
              </View>
              {scheduleId === s.id && <Ionicons name="checkmark-circle" size={20} color="#2563eb" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.clockBtn, styles.clockInBtn, (!scheduleId || clockIn.isPending) && styles.btnDisabled]}
        onPress={handleClockIn}
        disabled={!scheduleId || clockIn.isPending}
      >
        {clockIn.isPending
          ? <ActivityIndicator color="#fff" />
          : (
            <>
              <Ionicons name="play-circle-outline" size={22} color="#fff" />
              <Text style={styles.clockBtnText}>Clock In</Text>
            </>
          )
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EmployeeClock() {
  const { data: activeEntry, isLoading: loadingEntry } = useActiveTimeEntry();
  const { data: schedules = [], isLoading: loadingSchedules } = useMySchedules();

  if (loadingEntry || loadingSchedules) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Clock In / Out</Text>

      {activeEntry
        ? <ClockedInCard entry={activeEntry} schedules={schedules} />
        : <IdleCard schedules={schedules} />
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content:   { padding: 20, gap: 16 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },

  // Clocked in card
  clockedInCard: { backgroundColor: '#1d4ed8', borderRadius: 20, padding: 24, alignItems: 'center', gap: 16 },
  liveRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80' },
  liveText:      { fontSize: 13, fontWeight: '700', color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: 1 },
  activeVisitInfo:{ alignItems: 'center', gap: 2 },
  activeClient:  { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  activeService: { fontSize: 13, color: '#93c5fd' },
  activeTime:    { fontSize: 12, color: '#bfdbfe' },
  timer:         { fontSize: 48, fontWeight: '200', color: '#fff', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  unitRow:       { flexDirection: 'row', gap: 12 },
  unitChip:      { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  unitLabel:     { fontSize: 10, color: '#93c5fd', textTransform: 'uppercase', fontWeight: '600' },
  unitValue:     { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },

  // Idle card
  idleCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  idleTitle:  { fontSize: 20, fontWeight: '700', color: '#111827' },
  idleHint:   { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  noVisits:   { fontSize: 13, color: '#9ca3af' },

  // Visit picker
  visitPicker: { width: '100%', gap: 8 },
  visitOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, gap: 10 },
  visitOptionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  visitOptionClient:   { fontSize: 14, fontWeight: '600', color: '#374151' },
  visitOptionClientSelected: { color: '#1d4ed8' },
  visitOptionMeta:     { fontSize: 12, color: '#6b7280', marginTop: 2 },
  visitOptionService:  { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  // Clock buttons
  clockBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', justifyContent: 'center' },
  clockInBtn:   { backgroundColor: '#2563eb' },
  clockOutBtn:  { backgroundColor: '#ef4444' },
  clockBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  btnDisabled:  { opacity: 0.45 },
});
