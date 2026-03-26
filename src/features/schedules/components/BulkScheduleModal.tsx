import { useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import { useEmployees } from '@/features/employees/hooks/useEmployees';
import { useClients } from '@/features/clients/hooks/useClients';
import { useCreateSchedule } from '@/features/schedules/hooks/useSchedules';
import { generateOccurrences } from '@/features/schedules/utils/recurrence';
import type { RepeatType, DayOfWeek } from '@/features/schedules/utils/recurrence';

// ── Types ─────────────────────────────────────────────────────────────────────

type BulkMode = 'template' | 'manual';

interface TemplatePattern {
  label: string;
  repeatType: RepeatType;
  days: DayOfWeek[];
  startHour: number;
  endHour: number;
}

const TEMPLATES: TemplatePattern[] = [
  { label: 'Mon–Fri 9 AM–5 PM',  repeatType: 'weekly',    days: [1,2,3,4,5], startHour: 9,  endHour: 17 },
  { label: 'Mon/Wed/Fri AM',      repeatType: 'weekly',    days: [1,3,5],     startHour: 9,  endHour: 12 },
  { label: 'Tue/Thu Afternoon',   repeatType: 'weekly',    days: [2,4],       startHour: 13, endHour: 17 },
  { label: 'Daily 9 AM–1 PM',     repeatType: 'daily',     days: [],          startHour: 9,  endHour: 13 },
  { label: 'Biweekly Mon & Thu',  repeatType: 'biweekly',  days: [1,4],       startHour: 9,  endHour: 17 },
];

interface BulkSchedulePreview {
  date: string;
  employeeId: string;
  employeeName: string;
  clientId: string;
  clientName: string;
  startIso: string;
  endIso: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date: string, hour: number, minute = 0): string {
  const d = new Date(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`);
  return d.toISOString();
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function BulkScheduleModal({ visible, onClose }: Props) {
  const { data: employees = [] } = useEmployees();
  const { data: clients = [] }   = useClients();
  const createSchedule = useCreateSchedule();

  const [mode, setMode] = useState<BulkMode>('template');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Template mode
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  // Manual mode
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedClients, setSelectedClients]     = useState<string[]>([]);
  const [repeatType, setRepeatType]               = useState<RepeatType>('weekly');
  const [repeatDays, setRepeatDays]               = useState<DayOfWeek[]>([1,3,5]);
  const [startHour, setStartHour]                 = useState(9);
  const [endHour, setEndHour]                     = useState(17);

  // Common
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd]     = useState('');

  // Preview + creation
  const [preview, setPreview]   = useState<BulkSchedulePreview[]>([]);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);

  function reset() {
    setMode('template');
    setStep(1);
    setSelectedTemplate(null);
    setSelectedEmployees([]);
    setSelectedClients([]);
    setRepeatType('weekly');
    setRepeatDays([1,3,5]);
    setStartHour(9);
    setEndHour(17);
    setRangeStart('');
    setRangeEnd('');
    setPreview([]);
    setCreating(false);
    setProgress(0);
  }

  function handleClose() { reset(); onClose(); }

  // ── Build preview ──────────────────────────────────────────────────────────

  function buildPreview() {
    if (!rangeStart || !rangeEnd) {
      Alert.alert('Date Range', 'Please enter a start and end date.');
      return;
    }
    if (rangeEnd < rangeStart) {
      Alert.alert('Invalid Range', 'End date must be after start date.');
      return;
    }

    const items: BulkSchedulePreview[] = [];

    if (mode === 'template' && selectedTemplate !== null) {
      const tmpl = TEMPLATES[selectedTemplate];
      const dates = generateOccurrences(
        rangeStart,
        { type: tmpl.repeatType, days: tmpl.days },
        rangeStart,
        rangeEnd,
      );
      for (const empId of selectedEmployees) {
        for (const clientId of selectedClients) {
          const emp    = employees.find(e => e.id === empId);
          const client = clients.find(c => c.id === clientId);
          for (const date of dates) {
            items.push({
              date,
              employeeId:   empId,
              employeeName: emp?.full_name ?? empId,
              clientId,
              clientName:   client?.name ?? clientId,
              startIso:     toISO(date, tmpl.startHour),
              endIso:       toISO(date, tmpl.endHour),
            });
          }
        }
      }
    } else if (mode === 'manual') {
      const dates = generateOccurrences(
        rangeStart,
        { type: repeatType, days: repeatDays },
        rangeStart,
        rangeEnd,
      );
      for (const empId of selectedEmployees) {
        for (const clientId of selectedClients) {
          const emp    = employees.find(e => e.id === empId);
          const client = clients.find(c => c.id === clientId);
          for (const date of dates) {
            items.push({
              date,
              employeeId:   empId,
              employeeName: emp?.full_name ?? empId,
              clientId,
              clientName:   client?.name ?? clientId,
              startIso:     toISO(date, startHour),
              endIso:       toISO(date, endHour),
            });
          }
        }
      }
    }

    if (items.length === 0) {
      Alert.alert('No Occurrences', 'No matching dates found in the selected range with the current pattern.');
      return;
    }

    setPreview(items);
    setStep(3);
  }

  // ── Create all ─────────────────────────────────────────────────────────────

  async function handleCreate() {
    setCreating(true);
    setProgress(0);
    let done = 0;
    for (const item of preview) {
      try {
        await new Promise<void>((resolve, reject) => {
          createSchedule.mutate(
            {
              employee_id:      item.employeeId,
              client_id:        item.clientId,
              authorization_id: null,
              service_type_id:  null,
              start_time:       item.startIso,
              end_time:         item.endIso,
              notes:            null,
            },
            { onSuccess: () => resolve(), onError: reject },
          );
        });
      } catch {
        // continue on error
      }
      done++;
      setProgress(done);
    }
    setCreating(false);
    Alert.alert('Done', `Created ${done} of ${preview.length} schedules.`, [
      { text: 'Close', onPress: handleClose },
    ]);
  }

  const activeEmployees = useMemo(() => employees.filter(e => e.is_active && e.role === 'employee'), [employees]);
  const activeClients   = useMemo(() => clients.filter(c => c.is_active), [clients]);

  function toggleEmployee(id: string) {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleClient(id: string) {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleDay(d: DayOfWeek) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  const canAdvance1 = selectedEmployees.length > 0 && selectedClients.length > 0;
  const canAdvance2 = (mode === 'template' ? selectedTemplate !== null : repeatDays.length > 0) && !!rangeStart && !!rangeEnd;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Bulk Create Schedules</Text>
          <Text style={styles.stepLabel}>Step {step}/3</Text>
        </View>

        {/* Step dots */}
        <View style={styles.stepRow}>
          {[1,2,3].map(n => (
            <View key={n} style={[styles.stepDot, step >= n && styles.stepDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {/* ── Step 1: People ── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Select Employees & Clients</Text>

              <Text style={styles.label}>Employees</Text>
              {activeEmployees.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.pill, selectedEmployees.includes(e.id) && styles.pillActive]}
                  onPress={() => toggleEmployee(e.id)}
                >
                  <Text style={[styles.pillText, selectedEmployees.includes(e.id) && styles.pillTextActive]}>
                    {e.full_name}
                  </Text>
                  {selectedEmployees.includes(e.id) && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.label, { marginTop: spacing.md }]}>Clients</Text>
              {activeClients.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, selectedClients.includes(c.id) && styles.pillActive]}
                  onPress={() => toggleClient(c.id)}
                >
                  <Text style={[styles.pillText, selectedClients.includes(c.id) && styles.pillTextActive]}>
                    {c.name}
                  </Text>
                  {selectedClients.includes(c.id) && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Step 2: Pattern & Range ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Schedule Pattern</Text>

              {/* Mode toggle */}
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'template' && styles.modeBtnActive]}
                  onPress={() => setMode('template')}
                >
                  <Text style={[styles.modeBtnText, mode === 'template' && styles.modeBtnTextActive]}>Template</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
                  onPress={() => setMode('manual')}
                >
                  <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>Manual</Text>
                </TouchableOpacity>
              </View>

              {mode === 'template' ? (
                <>
                  <Text style={styles.label}>Choose a template</Text>
                  {TEMPLATES.map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.pill, selectedTemplate === i && styles.pillActive]}
                      onPress={() => setSelectedTemplate(i)}
                    >
                      <Text style={[styles.pillText, selectedTemplate === i && styles.pillTextActive]}>{t.label}</Text>
                      {selectedTemplate === i && <Ionicons name="checkmark" size={14} color={colors.accent} />}
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  {/* Repeat type */}
                  <Text style={styles.label}>Repeat</Text>
                  <View style={styles.repeatRow}>
                    {(['daily','weekly','biweekly','monthly'] as RepeatType[]).map(rt => (
                      <TouchableOpacity
                        key={rt}
                        style={[styles.repeatChip, repeatType === rt && styles.repeatChipActive]}
                        onPress={() => setRepeatType(rt)}
                      >
                        <Text style={[styles.repeatChipText, repeatType === rt && styles.repeatChipTextActive]}>
                          {rt.charAt(0).toUpperCase() + rt.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {(repeatType === 'weekly' || repeatType === 'biweekly') && (
                    <>
                      <Text style={[styles.label, { marginTop: spacing.sm }]}>Days</Text>
                      <View style={styles.daysRow}>
                        {([0,1,2,3,4,5,6] as DayOfWeek[]).map(d => (
                          <TouchableOpacity
                            key={d}
                            style={[styles.dayChip, repeatDays.includes(d) && styles.dayChipActive]}
                            onPress={() => toggleDay(d)}
                          >
                            <Text style={[styles.dayChipText, repeatDays.includes(d) && styles.dayChipTextActive]}>
                              {DAY_NAMES[d]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Hours */}
                  <Text style={[styles.label, { marginTop: spacing.sm }]}>Start Hour (0–23)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={2}
                    value={String(startHour)}
                    onChangeText={v => setStartHour(parseInt(v,10) || 0)}
                    placeholderTextColor={colors.placeholder}
                  />
                  <Text style={[styles.label, { marginTop: spacing.sm }]}>End Hour (0–23)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={2}
                    value={String(endHour)}
                    onChangeText={v => setEndHour(parseInt(v,10) || 0)}
                    placeholderTextColor={colors.placeholder}
                  />
                </>
              )}

              {/* Date range */}
              <Text style={[styles.label, { marginTop: spacing.md }]}>Date Range Start (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-04-01"
                placeholderTextColor={colors.placeholder}
                value={rangeStart}
                onChangeText={setRangeStart}
              />
              <Text style={[styles.label, { marginTop: spacing.sm }]}>Date Range End (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-04-30"
                placeholderTextColor={colors.placeholder}
                value={rangeEnd}
                onChangeText={setRangeEnd}
              />
            </View>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Preview ({preview.length} schedules)</Text>
              <Text style={styles.previewHint}>
                {selectedEmployees.length} employee{selectedEmployees.length > 1 ? 's' : ''} ×{' '}
                {selectedClients.length} client{selectedClients.length > 1 ? 's' : ''}
              </Text>

              {creating && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${(progress / preview.length) * 100}%` as any }]} />
                  <Text style={styles.progressText}>{progress}/{preview.length}</Text>
                </View>
              )}

              {preview.slice(0, 50).map((item, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewDate}>{item.date}</Text>
                  <Text style={styles.previewNames} numberOfLines={1}>
                    {item.employeeName} → {item.clientName}
                  </Text>
                  <Text style={styles.previewTime}>
                    {new Date(item.startIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                    {new Date(item.endIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
              {preview.length > 50 && (
                <Text style={styles.moreText}>… and {preview.length - 50} more</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => (s - 1) as 1|2|3)}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}

          {step === 1 && (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance1 && styles.btnDisabled]}
              disabled={!canAdvance1}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          )}

          {step === 2 && (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance2 && styles.btnDisabled]}
              disabled={!canAdvance2}
              onPress={buildPreview}
            >
              <Text style={styles.nextBtnText}>Preview</Text>
            </TouchableOpacity>
          )}

          {step === 3 && (
            <TouchableOpacity
              style={[styles.nextBtn, creating && styles.btnDisabled]}
              disabled={creating}
              onPress={handleCreate}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>Create {preview.length} Schedules</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal:     { flex: 1, backgroundColor: colors.bg },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:     { ...typography.md, color: colors.text, fontWeight: '700' },
  stepLabel: { ...typography.sm, color: colors.textMuted },

  stepRow:       { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: spacing.sm },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.accent },

  body:        { padding: spacing.lg, paddingBottom: 40 },
  stepContent: { gap: spacing.md },
  stepTitle:   { ...typography.lg, color: colors.text, fontWeight: '700' },
  label:       { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },

  pill:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pillActive:   { borderColor: colors.accent, backgroundColor: colors.accentDim },
  pillText:     { ...typography.sm, color: colors.textSecondary },
  pillTextActive:{ color: colors.accent, fontWeight: '600' },

  modeRow:         { flexDirection: 'row', backgroundColor: colors.elevated, borderRadius: radius.md, padding: 2 },
  modeBtn:         { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  modeBtnActive:   { backgroundColor: colors.accent },
  modeBtnText:     { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  modeBtnTextActive:{ color: '#fff' },

  repeatRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  repeatChip:        { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  repeatChipActive:  { backgroundColor: colors.accentDim, borderColor: colors.accent },
  repeatChipText:    { ...typography.xs, color: colors.textSecondary, fontWeight: '600' },
  repeatChipTextActive:{ color: colors.accent },

  daysRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dayChip:        { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dayChipActive:  { backgroundColor: colors.accentDim, borderColor: colors.accent },
  dayChipText:    { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  dayChipTextActive: { color: colors.accent },

  input: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text, marginTop: spacing.xs },

  progressBar:  { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  progressText: { ...typography.xs, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },

  previewHint: { ...typography.sm, color: colors.textMuted },
  previewRow:  { backgroundColor: colors.card, borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
  previewDate: { ...typography.xs, color: colors.textMuted },
  previewNames:{ ...typography.sm, color: colors.text, fontWeight: '600' },
  previewTime: { ...typography.xs, color: colors.textSecondary },
  moreText:    { ...typography.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },

  footer:      { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  backBtn:     { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  backBtnText: { ...typography.base, color: colors.textSecondary, fontWeight: '600' },
  nextBtn:     { flex: 2, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  nextBtnText: { ...typography.base, color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },
});
