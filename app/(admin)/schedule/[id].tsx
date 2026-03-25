import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchedule, useCancelSchedule } from '@/features/schedules/hooks/useSchedules';
import { useTimeEntriesForSchedule } from '@/features/time-entries/hooks/useTimeEntries';
import { useVisitNotes } from '@/features/visit-notes/hooks/useVisitNotes';
import type { TimeEntry } from '@/lib/supabase';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:   { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' },
  in_progress: { bg: '#fef9c3', text: '#92400e', label: 'In Progress' },
  completed:   { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  cancelled:   { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function TimeEntryRow({ entry }: { entry: TimeEntry }) {
  const active = entry.clocked_out_at == null;
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryDot} />
      <View style={styles.entryBody}>
        <Text style={styles.entryTime}>
          {fmtTime(entry.clocked_in_at)} – {active ? 'Active' : fmtTime(entry.clocked_out_at!)}
        </Text>
        <Text style={styles.entryMeta}>
          {active ? 'Clocked in' : `${fmtDuration(entry.duration_minutes)} · ${entry.billable_units ?? 0} units`}
        </Text>
      </View>
      {active && (
        <View style={styles.activePill}>
          <Text style={styles.activePillText}>Live</Text>
        </View>
      )}
    </View>
  );
}

export default function AdminScheduleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: schedule, isLoading } = useSchedule(id);
  const { data: timeEntries = [] } = useTimeEntriesForSchedule(id);
  const { data: visitNotes = [] } = useVisitNotes(id);
  const cancelSchedule = useCancelSchedule();

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />;
  }

  if (!schedule) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Schedule not found</Text>
      </View>
    );
  }

  const status = STATUS_CONFIG[schedule.status] ?? STATUS_CONFIG.scheduled;
  const canCancel = schedule.status === 'scheduled' || schedule.status === 'in_progress';

  const scheduledUnits = Math.floor(
    (new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 900000
  );
  const totalUnits = timeEntries.reduce((sum, e) => sum + (e.billable_units ?? 0), 0);
  const totalHours = (totalUnits / 4).toFixed(2);

  function handleCancel() {
    Alert.alert(
      'Cancel Visit',
      'Are you sure you want to cancel this scheduled visit?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Visit', style: 'destructive',
          onPress: () => cancelSchedule.mutate(id, { onSuccess: () => router.back() }),
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color="#2563eb" />
        <Text style={styles.backText}>Schedules</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
        <Text style={styles.clientName}>{schedule.clients?.name ?? '—'}</Text>
        <Text style={styles.dateText}>{fmtDateTime(schedule.start_time)} – {fmtTime(schedule.end_time)}</Text>
        <Text style={styles.unitsText}>{scheduledUnits} units · {(scheduledUnits / 4).toFixed(2)} hrs scheduled</Text>
      </View>

      {/* Details card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <InfoRow icon="person-outline" label="Employee" value={schedule.users?.full_name ?? '—'} />
        {schedule.service_types && (
          <InfoRow icon="medical-outline" label="Service" value={schedule.service_types.name} />
        )}
        {schedule.authorizations && (
          <InfoRow icon="document-text-outline" label="Authorization" value={schedule.authorizations.auth_number} />
        )}
        {schedule.notes && (
          <InfoRow icon="create-outline" label="Notes" value={schedule.notes} />
        )}
      </View>

      {/* Time entries */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Time Entries</Text>
          {timeEntries.length > 0 && (
            <Text style={styles.cardSub}>{totalUnits} units · {totalHours} hrs</Text>
          )}
        </View>
        {timeEntries.length === 0
          ? <Text style={styles.emptyText}>No time entries yet</Text>
          : timeEntries.map(e => <TimeEntryRow key={e.id} entry={e} />)
        }
      </View>

      {/* Visit notes */}
      {visitNotes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visit Notes</Text>
          {visitNotes.map(note => (
            <View key={note.id} style={styles.noteItem}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteMeta}>
                  {note.is_draft ? '📝 Draft' : '✓ Submitted'}
                </Text>
              </View>
              {note.body ? <Text style={styles.noteBody}>{note.body}</Text> : null}
              {note.goals_addressed ? (
                <View style={styles.noteField}>
                  <Text style={styles.noteFieldLabel}>Goals Addressed</Text>
                  <Text style={styles.noteFieldValue}>{note.goals_addressed}</Text>
                </View>
              ) : null}
              {note.client_response ? (
                <View style={styles.noteField}>
                  <Text style={styles.noteFieldLabel}>Client Response</Text>
                  <Text style={styles.noteFieldValue}>{note.client_response}</Text>
                </View>
              ) : null}
              {note.next_steps ? (
                <View style={styles.noteField}>
                  <Text style={styles.noteFieldLabel}>Next Steps</Text>
                  <Text style={styles.noteFieldValue}>{note.next_steps}</Text>
                </View>
              ) : null}
              {note.supervisor_notified && (
                <Text style={styles.supervisorTag}>Supervisor notified</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Cancel button */}
      {canCancel && (
        <TouchableOpacity
          style={[styles.cancelBtn, cancelSchedule.isPending && styles.btnDisabled]}
          onPress={handleCancel}
          disabled={cancelSchedule.isPending}
        >
          {cancelSchedule.isPending
            ? <ActivityIndicator color="#ef4444" />
            : (
              <>
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.cancelBtnText}>Cancel Visit</Text>
              </>
            )
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#6b7280" style={{ marginTop: 1 }} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content:   { padding: 16, gap: 12 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound:  { color: '#6b7280', fontSize: 16 },

  backRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backText:  { color: '#2563eb', fontSize: 15 },

  header:    { alignItems: 'center', gap: 6, paddingVertical: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  statusText:  { fontSize: 12, fontWeight: '700' },
  clientName:  { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  dateText:    { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  unitsText:   { fontSize: 12, color: '#2563eb', fontWeight: '600', textAlign: 'center' },

  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:    { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardSub:      { fontSize: 12, color: '#6b7280' },
  emptyText:    { fontSize: 13, color: '#9ca3af' },

  infoRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoLabel:  { fontSize: 13, fontWeight: '600', color: '#6b7280', minWidth: 90 },
  infoValue:  { fontSize: 13, color: '#374151', flex: 1 },

  entryRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#93c5fd' },
  entryBody:  { flex: 1 },
  entryTime:  { fontSize: 13, fontWeight: '600', color: '#374151' },
  entryMeta:  { fontSize: 12, color: '#6b7280' },
  activePill: { backgroundColor: '#dcfce7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  activePillText: { fontSize: 11, fontWeight: '700', color: '#166534' },

  noteItem:        { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  noteHeader:      { flexDirection: 'row', justifyContent: 'space-between' },
  noteMeta:        { fontSize: 12, color: '#6b7280' },
  noteBody:        { fontSize: 14, color: '#374151', lineHeight: 20 },
  noteField:       { gap: 2 },
  noteFieldLabel:  { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
  noteFieldValue:  { fontSize: 13, color: '#374151' },
  supervisorTag:   { fontSize: 12, color: '#7c3aed', fontWeight: '600' },

  cancelBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 10, paddingVertical: 13 },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  btnDisabled:   { opacity: 0.5 },
});
