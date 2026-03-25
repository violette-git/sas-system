import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchedule } from '@/features/schedules/hooks/useSchedules';
import { useTimeEntriesForSchedule } from '@/features/time-entries/hooks/useTimeEntries';
import { useVisitNotes, useCreateVisitNote, useUpdateVisitNote, useSubmitVisitNote } from '@/features/visit-notes/hooks/useVisitNotes';
import type { VisitNote } from '@/lib/supabase';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:   { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' },
  in_progress: { bg: '#fef9c3', text: '#92400e', label: 'In Progress' },
  completed:   { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  cancelled:   { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
};

// ── Note form ─────────────────────────────────────────────────────────────────

interface NoteFormState {
  body: string;
  goals_addressed: string;
  client_response: string;
  next_steps: string;
  supervisor_notified: boolean;
}

const EMPTY_NOTE: NoteFormState = {
  body: '', goals_addressed: '', client_response: '', next_steps: '', supervisor_notified: false,
};

function NoteForm({
  scheduleId,
  existingNote,
  onDone,
}: {
  scheduleId: string;
  existingNote?: VisitNote | null;
  onDone: () => void;
}) {
  const createNote  = useCreateVisitNote();
  const updateNote  = useUpdateVisitNote();
  const submitNote  = useSubmitVisitNote();

  const [form, setForm] = useState<NoteFormState>(() =>
    existingNote ? {
      body:                existingNote.body ?? '',
      goals_addressed:     existingNote.goals_addressed ?? '',
      client_response:     existingNote.client_response ?? '',
      next_steps:          existingNote.next_steps ?? '',
      supervisor_notified: existingNote.supervisor_notified ?? false,
    } : EMPTY_NOTE
  );

  function set<K extends keyof NoteFormState>(k: K, v: NoteFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function buildPayload(isDraft: boolean) {
    return {
      schedule_id:         scheduleId,
      body:                form.body || '',
      goals_addressed:     form.goals_addressed || null,
      client_response:     form.client_response || null,
      next_steps:          form.next_steps || null,
      supervisor_notified: form.supervisor_notified,
      is_draft:            isDraft,
    };
  }

  function handleSaveDraft() {
    if (existingNote) {
      updateNote.mutate(
        { id: existingNote.id, schedule_id: scheduleId, ...buildPayload(true) },
        { onSuccess: onDone }
      );
    } else {
      createNote.mutate(buildPayload(true), { onSuccess: onDone });
    }
  }

  function handleSubmit() {
    if (!form.body.trim()) {
      Alert.alert('Note Required', 'Please write a note before submitting.');
      return;
    }
    if (existingNote) {
      updateNote.mutate(
        { id: existingNote.id, schedule_id: scheduleId, ...buildPayload(false) },
        {
          onSuccess: () => {
            submitNote.mutate({ id: existingNote.id, schedule_id: scheduleId }, { onSuccess: onDone });
          },
        }
      );
    } else {
      createNote.mutate(buildPayload(false), { onSuccess: onDone });
    }
  }

  const isBusy = createNote.isPending || updateNote.isPending || submitNote.isPending;

  return (
    <View style={styles.noteForm}>
      <Text style={styles.sectionLabel}>Visit Note</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Notes / Summary <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe what happened during the visit..."
          multiline
          numberOfLines={4}
          value={form.body}
          onChangeText={v => set('body', v)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Goals Addressed</Text>
        <TextInput
          style={[styles.input, styles.textAreaSm]}
          placeholder="Which goals were worked on?"
          multiline
          numberOfLines={3}
          value={form.goals_addressed}
          onChangeText={v => set('goals_addressed', v)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Client Response</Text>
        <TextInput
          style={[styles.input, styles.textAreaSm]}
          placeholder="How did the client respond?"
          multiline
          numberOfLines={3}
          value={form.client_response}
          onChangeText={v => set('client_response', v)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Next Steps</Text>
        <TextInput
          style={[styles.input, styles.textAreaSm]}
          placeholder="Plan for the next visit..."
          multiline
          numberOfLines={3}
          value={form.next_steps}
          onChangeText={v => set('next_steps', v)}
        />
      </View>

      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.fieldLabel}>Supervisor Notified</Text>
          <Text style={styles.toggleHint}>Toggle if supervisor was contacted</Text>
        </View>
        <Switch
          value={form.supervisor_notified}
          onValueChange={v => set('supervisor_notified', v)}
          trackColor={{ true: '#2563eb', false: '#e5e7eb' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.noteActions}>
        <TouchableOpacity
          style={[styles.draftBtn, isBusy && styles.btnDisabled]}
          onPress={handleSaveDraft}
          disabled={isBusy}
        >
          <Text style={styles.draftBtnText}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, isBusy && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={isBusy}
        >
          {isBusy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit Note</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EmployeeVisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const { data: schedule, isLoading } = useSchedule(id);
  const { data: timeEntries = [] }    = useTimeEntriesForSchedule(id);
  const { data: visitNotes = [] }     = useVisitNotes(id);

  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />;
  if (!schedule) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>Visit not found</Text>
    </View>
  );

  const status = STATUS_CONFIG[schedule.status] ?? STATUS_CONFIG.scheduled;
  const draftNote = visitNotes.find(n => n.is_draft);
  const submittedNotes = visitNotes.filter(n => !n.is_draft);
  const totalUnits = timeEntries.reduce((sum, e) => sum + (e.billable_units ?? 0), 0);
  const canAddNote = schedule.status === 'in_progress' || schedule.status === 'completed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color="#2563eb" />
        <Text style={styles.backText}>Schedule</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
        <Text style={styles.clientName}>{schedule.clients?.name ?? '—'}</Text>
        <Text style={styles.dateText}>
          {fmtTime(schedule.start_time)} – {fmtTime(schedule.end_time)}
        </Text>
        {schedule.service_types && (
          <Text style={styles.serviceText}>{schedule.service_types.name}</Text>
        )}
      </View>

      {/* Time summary */}
      {timeEntries.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Units</Text>
            <Text style={styles.summaryValue}>{totalUnits}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Hours</Text>
            <Text style={styles.summaryValue}>{(totalUnits / 4).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>
              {fmtDuration(timeEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0))}
            </Text>
          </View>
        </View>
      )}

      {/* Submitted notes */}
      {submittedNotes.map(note => (
        <View key={note.id} style={styles.submittedNote}>
          <View style={styles.submittedNoteHeader}>
            <Ionicons name="checkmark-circle" size={14} color="#166534" />
            <Text style={styles.submittedNoteLabel}>Submitted Note</Text>
          </View>
          {note.body ? <Text style={styles.noteBody}>{note.body}</Text> : null}
          {note.goals_addressed ? (
            <View style={styles.noteField}>
              <Text style={styles.noteFieldLabel}>Goals</Text>
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

      {/* Note form / draft */}
      {canAddNote && (
        showForm || draftNote ? (
          <NoteForm
            scheduleId={id}
            existingNote={draftNote}
            onDone={() => setShowForm(false)}
          />
        ) : (
          <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="create-outline" size={18} color="#2563eb" />
            <Text style={styles.addNoteBtnText}>
              {submittedNotes.length > 0 ? 'Add Another Note' : 'Add Visit Note'}
            </Text>
          </TouchableOpacity>
        )
      )}

      {/* Authorization */}
      {schedule.authorizations && (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Authorization</Text>
          <Text style={styles.authNumber}>{schedule.authorizations.auth_number}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content:   { padding: 16, gap: 12, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound:  { color: '#6b7280', fontSize: 16 },

  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backText: { color: '#2563eb', fontSize: 15 },

  header:      { alignItems: 'center', gap: 6, paddingVertical: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  statusText:  { fontSize: 12, fontWeight: '700' },
  clientName:  { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  dateText:    { fontSize: 13, color: '#6b7280' },
  serviceText: { fontSize: 12, color: '#9ca3af' },

  summaryRow:   { flexDirection: 'row', gap: 10 },
  summaryChip:  { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  summaryLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 4 },

  submittedNote:       { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  submittedNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  submittedNoteLabel:  { fontSize: 12, fontWeight: '700', color: '#166534' },
  noteBody:      { fontSize: 14, color: '#374151', lineHeight: 20 },
  noteField:     { gap: 2 },
  noteFieldLabel:{ fontSize: 10, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  noteFieldValue:{ fontSize: 13, color: '#374151' },
  supervisorTag: { fontSize: 12, color: '#7c3aed', fontWeight: '600' },

  addNoteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#2563eb', justifyContent: 'center' },
  addNoteBtnText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },

  noteForm:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  field:        { gap: 4 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  required:     { color: '#ef4444' },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea:   { height: 100, textAlignVertical: 'top', paddingTop: 10 },
  textAreaSm: { height: 72,  textAlignVertical: 'top', paddingTop: 10 },

  toggleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleHint:  { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  noteActions:  { flexDirection: 'row', gap: 10 },
  draftBtn:     { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  draftBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn:    { flex: 2, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitBtnText:{ fontSize: 14, fontWeight: '600', color: '#fff' },
  btnDisabled:  { opacity: 0.45 },

  infoCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  authNumber: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
