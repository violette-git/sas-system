import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator, ScrollView, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSchedules, useCreateSchedule } from '@/features/schedules/hooks/useSchedules';
import type { ScheduleWithRelations, ScheduleInput } from '@/features/schedules/hooks/useSchedules';
import { useClients } from '@/features/clients/hooks/useClients';
import { useEmployees } from '@/features/employees/hooks/useEmployees';
import { useAuthorizations } from '@/features/authorizations/hooks/useAuthorizations';

// ── helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - day.getDay()); // Sunday
  return day;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:   { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' },
  in_progress: { bg: '#fef9c3', text: '#92400e', label: 'In Progress' },
  completed:   { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  cancelled:   { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
};

// ── schedule card ─────────────────────────────────────────────────────────────

function scheduledUnits(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 900000);
}

function ScheduleCard({ item, onPress }: { item: ScheduleWithRelations; onPress: () => void }) {
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled;
  const units  = scheduledUnits(item.start_time, item.end_time);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTime}>
        <Text style={styles.cardTimeText}>{fmtTime(item.start_time)}</Text>
        <Text style={styles.cardTimeDivider}>–</Text>
        <Text style={styles.cardTimeText}>{fmtTime(item.end_time)}</Text>
        <Text style={styles.cardUnits}>{units}u</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardClient} numberOfLines={1}>{item.clients?.name ?? '—'}</Text>
        <Text style={styles.cardEmployee} numberOfLines={1}>{item.users?.full_name ?? '—'}</Text>
        {item.service_types && (
          <Text style={styles.cardService} numberOfLines={1}>{item.service_types.name}</Text>
        )}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function AdminSchedules() {
  const router = useRouter();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [modalVisible, setModalVisible] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dateFrom = fmtDateISO(weekStart);
  const dateTo   = fmtDateISO(addDays(weekStart, 6)) + 'T23:59:59';

  const queryClient = useQueryClient();
  const { data: schedules, isLoading, refetch } = useSchedules({ dateFrom, dateTo });

  // Refetch whenever this screen comes back into focus (e.g. after modal closes)
  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
  }, [queryClient]));

  const daySchedules = useMemo(
    () => (schedules ?? []).filter(s => isSameDay(new Date(s.start_time), selectedDay)),
    [schedules, selectedDay],
  );

  const monthLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  return (
    <View style={styles.container}>
      {/* Week strip */}
      <View style={styles.weekHeader}>
        <TouchableOpacity onPress={() => setWeekStart(w => addDays(w, -7))} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </TouchableOpacity>
        <View style={styles.weekDays}>
          {weekDays.map((day, i) => {
            const isToday    = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDay);
            const count      = (schedules ?? []).filter(s => isSameDay(new Date(s.start_time), day)).length;
            return (
              <TouchableOpacity key={i} style={styles.dayCol} onPress={() => setSelectedDay(day)}>
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>{DAY_LABELS[i]}</Text>
                <View style={[
                  styles.dayCircle,
                  isSelected && styles.dayCircleSelected,
                  isToday && !isSelected && styles.dayCircleToday,
                ]}>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{day.getDate()}</Text>
                </View>
                {count > 0 && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => setWeekStart(w => addDays(w, 7))} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Selected day label */}
      <View style={styles.dayBanner}>
        <Text style={styles.dayBannerText}>
          {isSameDay(selectedDay, today)
            ? 'Today'
            : selectedDay.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={styles.dayBannerCount}>{daySchedules.length} visit{daySchedules.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Day list */}
      {isLoading
        ? <ActivityIndicator style={styles.loader} color="#2563eb" />
        : (
          <FlatList
            data={daySchedules}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <ScheduleCard item={item} onPress={() => router.push(`/(admin)/schedule/${item.id}`)} />
            )}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No visits scheduled</Text>
              </View>
            }
          />
        )
      }

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <CreateScheduleModal
        visible={modalVisible}
        defaultDate={selectedDay}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ── create modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  visible: boolean;
  defaultDate: Date;
  onClose: () => void;
}

interface FormState {
  date: string;
  startHour: string;
  startMin: string;
  startAmpm: 'AM' | 'PM';
  endHour: string;
  endMin: string;
  endAmpm: 'AM' | 'PM';
  client_id: string;
  authorization_id: string;
  notes: string;
  employee_id: string;
  service_type_id: string;
}

function to24(hour: string, min: string, ampm: 'AM' | 'PM'): string {
  let h = parseInt(hour, 10) || 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2,'0')}:${(min || '00').padStart(2,'0')}`;
}

function localTzOffset(): string {
  const off = new Date().getTimezoneOffset(); // e.g. 300 for UTC-5
  const sign = off <= 0 ? '+' : '-';
  const abs  = Math.abs(off);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function buildISO(date: string, hour: string, min: string, ampm: 'AM' | 'PM'): string {
  return `${date}T${to24(hour, min, ampm)}:00${localTzOffset()}`;
}

function CreateScheduleModal({ visible, defaultDate, onClose }: CreateModalProps) {
  const createSchedule = useCreateSchedule();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => ({
    date: fmtDateISO(defaultDate),
    startHour: '9', startMin: '00', startAmpm: 'AM',
    endHour: '10',  endMin: '00',  endAmpm: 'AM',
    client_id: '', authorization_id: '', notes: '',
    employee_id: '', service_type_id: '',
  }));

  const { data: authList = [] } = useAuthorizations(form.client_id || undefined);

  // Reset form with the current selectedDay every time the modal opens
  useEffect(() => {
    if (visible) {
      setStep(1);
      setForm({
        date: fmtDateISO(defaultDate),
        startHour: '9', startMin: '00', startAmpm: 'AM',
        endHour: '10',  endMin: '00',  endAmpm: 'AM',
        client_id: '', authorization_id: '', notes: '',
        employee_id: '', service_type_id: '',
      });
    }
  }, [visible, defaultDate]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function reset() {
    setStep(1);
    setForm({
      date: fmtDateISO(defaultDate),
      startHour: '9', startMin: '00', startAmpm: 'AM',
      endHour: '10',  endMin: '00',  endAmpm: 'AM',
      client_id: '', authorization_id: '', notes: '',
      employee_id: '', service_type_id: '',
    });
  }

  function handleClose() { reset(); onClose(); }

  function handleSubmit() {
    const start_time = buildISO(form.date, form.startHour, form.startMin, form.startAmpm);
    const end_time   = buildISO(form.date, form.endHour,   form.endMin,   form.endAmpm);
    if (end_time <= start_time) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }

    const selectedAuth = authList.find(a => a.id === form.authorization_id);

    const input: ScheduleInput = {
      employee_id:      form.employee_id,
      client_id:        form.client_id,
      authorization_id: form.authorization_id || null,
      service_type_id:  (selectedAuth?.service_type_id ?? form.service_type_id) || null,
      start_time,
      end_time,
      notes: form.notes || null,
    };

    createSchedule.mutate(input, { onSuccess: () => { reset(); onClose(); } });
  }

  const step1Valid = !!form.date && !!form.startHour && !!form.endHour;
  const step2Valid = !!form.client_id;
  const step3Valid = !!form.employee_id;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Schedule</Text>
          <Text style={styles.stepLabel}>Step {step}/3</Text>
        </View>

        {/* Step indicators */}
        <View style={styles.stepRow}>
          {[1,2,3].map(n => (
            <View key={n} style={[styles.stepDot, step >= n && styles.stepDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <Step1
              form={form} set={set}
            />
          )}
          {step === 2 && (
            <Step2
              form={form} set={set}
              clients={clients} authList={authList}
            />
          )}
          {step === 3 && (
            <Step3
              form={form} set={set}
              employees={employees}
            />
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <TouchableOpacity
              style={[styles.nextBtn, !(step === 1 ? step1Valid : step2Valid) && styles.btnDisabled]}
              disabled={!(step === 1 ? step1Valid : step2Valid)}
              onPress={() => setStep(s => s + 1)}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, (!step3Valid || createSchedule.isPending) && styles.btnDisabled]}
              disabled={!step3Valid || createSchedule.isPending}
              onPress={handleSubmit}
            >
              {createSchedule.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>Create</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── step components ────────────────────────────────────────────────────────────

function Step1({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Date & Time</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={form.date}
          onChangeText={v => set('date', v)}
        />
      </View>

      <Text style={styles.label}>Start Time</Text>
      <TimeRow
        hour={form.startHour} min={form.startMin} ampm={form.startAmpm}
        onHour={v => set('startHour', v)}
        onMin={v => set('startMin', v)}
        onAmpm={v => set('startAmpm', v)}
      />

      <Text style={[styles.label, { marginTop: 12 }]}>End Time</Text>
      <TimeRow
        hour={form.endHour} min={form.endMin} ampm={form.endAmpm}
        onHour={v => set('endHour', v)}
        onMin={v => set('endMin', v)}
        onAmpm={v => set('endAmpm', v)}
      />
    </View>
  );
}

function TimeRow({
  hour, min, ampm, onHour, onMin, onAmpm,
}: {
  hour: string; min: string; ampm: 'AM' | 'PM';
  onHour: (v: string) => void; onMin: (v: string) => void; onAmpm: (v: 'AM' | 'PM') => void;
}) {
  return (
    <View style={styles.timeRow}>
      <TextInput
        style={[styles.input, styles.timeInput]}
        placeholder="9"
        keyboardType="numeric"
        maxLength={2}
        value={hour}
        onChangeText={onHour}
      />
      <Text style={styles.timeSep}>:</Text>
      <TextInput
        style={[styles.input, styles.timeInput]}
        placeholder="00"
        keyboardType="numeric"
        maxLength={2}
        value={min}
        onChangeText={onMin}
      />
      <TouchableOpacity style={styles.ampmBtn} onPress={() => onAmpm(ampm === 'AM' ? 'PM' : 'AM')}>
        <Text style={styles.ampmText}>{ampm}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Step2({
  form, set, clients, authList,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  clients: any[];
  authList: any[];
}) {
  const activeAuths = authList.filter(a => a.is_active);

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Client & Authorization</Text>

      <Text style={styles.label}>Client <Text style={styles.required}>*</Text></Text>
      <ScrollView style={styles.pickerList} nestedScrollEnabled>
        {clients.filter(c => c.is_active).map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.pickerItem, form.client_id === c.id && styles.pickerItemSelected]}
            onPress={() => { set('client_id', c.id); set('authorization_id', ''); }}
          >
            <Text style={[styles.pickerItemText, form.client_id === c.id && styles.pickerItemTextSelected]}>
              {c.name}
            </Text>
            {form.client_id === c.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {form.client_id !== '' && (
        <>
          <Text style={[styles.label, { marginTop: 16 }]}>Authorization (optional)</Text>
          {activeAuths.length === 0
            ? <Text style={styles.hint}>No active authorizations for this client.</Text>
            : (
              <ScrollView style={styles.pickerList} nestedScrollEnabled>
                <TouchableOpacity
                  style={[styles.pickerItem, form.authorization_id === '' && styles.pickerItemSelected]}
                  onPress={() => set('authorization_id', '')}
                >
                  <Text style={[styles.pickerItemText, form.authorization_id === '' && styles.pickerItemTextSelected]}>
                    None
                  </Text>
                </TouchableOpacity>
                {activeAuths.map(a => {
                  const hours = (a.authorized_units / 4).toFixed(1);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.pickerItem, form.authorization_id === a.id && styles.pickerItemSelected]}
                      onPress={() => set('authorization_id', a.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerItemText, form.authorization_id === a.id && styles.pickerItemTextSelected]}>
                          {a.auth_number}
                        </Text>
                        <Text style={styles.authMeta}>
                          {a.service_types?.name} · {hours} hrs · ends {a.end_date}
                        </Text>
                      </View>
                      {form.authorization_id === a.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )
          }
        </>
      )}

      <View style={[styles.field, { marginTop: 16 }]}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special instructions, access notes..."
          multiline
          numberOfLines={3}
          value={form.notes}
          onChangeText={v => set('notes', v)}
        />
      </View>
    </View>
  );
}

function Step3({
  form, set, employees,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  employees: any[];
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Assign Employee</Text>
      <Text style={styles.label}>Employee <Text style={styles.required}>*</Text></Text>
      <ScrollView style={styles.pickerList} nestedScrollEnabled>
        {employees.filter(e => e.is_active && e.role === 'employee').map(e => (
          <TouchableOpacity
            key={e.id}
            style={[styles.pickerItem, form.employee_id === e.id && styles.pickerItemSelected]}
            onPress={() => set('employee_id', e.id)}
          >
            <Text style={[styles.pickerItemText, form.employee_id === e.id && styles.pickerItemTextSelected]}>
              {e.full_name}
            </Text>
            {form.employee_id === e.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },

  // Week strip
  weekHeader:  { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  navBtn:      { padding: 8 },
  weekDays:    { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  dayCol:      { alignItems: 'center', gap: 2 },
  dayLabel:    { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  dayLabelSelected: { color: '#2563eb' },
  dayCircle:   { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayCircleSelected: { backgroundColor: '#2563eb' },
  dayCircleToday:    { backgroundColor: '#dbeafe' },
  dayNum:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  dayNumSelected: { color: '#fff' },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: '#93c5fd' },
  dotSelected: { backgroundColor: '#fff' },

  // Day banner
  dayBanner:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  dayBannerText:  { fontSize: 15, fontWeight: '700', color: '#111827' },
  dayBannerCount: { fontSize: 13, color: '#6b7280' },

  // List
  loader: { marginTop: 48 },
  list:   { padding: 12, gap: 8 },
  empty:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af' },

  // Card
  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardTime:     { alignItems: 'center', minWidth: 52 },
  cardTimeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  cardTimeDivider: { fontSize: 10, color: '#9ca3af' },
  cardUnits:    { fontSize: 11, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  cardBody:     { flex: 1, gap: 2 },
  cardClient:   { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardEmployee: { fontSize: 12, color: '#6b7280' },
  cardService:  { fontSize: 11, color: '#9ca3af' },
  statusBadge:  { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:   { fontSize: 11, fontWeight: '600' },

  // FAB
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },

  // Modal
  modal:        { flex: 1, backgroundColor: '#f8f9fa' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#111827' },
  stepLabel:    { fontSize: 13, color: '#6b7280' },
  stepRow:      { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 12 },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  stepDotActive:{ backgroundColor: '#2563eb' },
  modalBody:    { padding: 16, paddingBottom: 32 },
  modalFooter:  { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },

  stepContent:  { gap: 12 },
  stepTitle:    { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },

  // Form
  field:   { gap: 4 },
  label:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  required:{ color: '#ef4444' },
  hint:    { fontSize: 13, color: '#9ca3af' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 11 },

  // Time row
  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { width: 56, textAlign: 'center' },
  timeSep:   { fontSize: 18, color: '#374151', fontWeight: '700' },
  ampmBtn:   { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  ampmText:  { fontSize: 14, fontWeight: '700', color: '#374151' },

  // Picker list
  pickerList: { maxHeight: 200, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fff' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerItemSelected: { backgroundColor: '#eff6ff' },
  pickerItemText: { flex: 1, fontSize: 14, color: '#374151' },
  pickerItemTextSelected: { color: '#2563eb', fontWeight: '600' },
  authMeta: { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  // Footer buttons
  backBtn:      { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  backBtnText:  { fontSize: 15, fontWeight: '600', color: '#374151' },
  nextBtn:      { flex: 2, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  nextBtnText:  { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled:  { opacity: 0.45 },
});
