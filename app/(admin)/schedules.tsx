import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator, ScrollView, TextInput, Alert, RefreshControl,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSchedules, useCreateSchedule } from '@/features/schedules/hooks/useSchedules';
import type { ScheduleWithRelations, ScheduleInput } from '@/features/schedules/hooks/useSchedules';
import { useClients } from '@/features/clients/hooks/useClients';
import { useEmployees } from '@/features/employees/hooks/useEmployees';
import { useAuthorizations } from '@/features/authorizations/hooks/useAuthorizations';
import { CalendarView, CalendarViewToggle } from '@/features/calendar/components/CalendarView';
import { useCalendarData } from '@/features/calendar/hooks/useCalendarData';
import type { CalendarViewMode } from '@/features/calendar/hooks/useCalendarData';
import { detectConflicts } from '@/features/schedules/utils/conflicts';
import { generateOccurrences } from '@/features/schedules/utils/recurrence';
import type { RecurrenceRule, RepeatType, DayOfWeek } from '@/features/schedules/utils/recurrence';
import { BulkScheduleModal } from '@/features/schedules/components/BulkScheduleModal';

// ── helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - day.getDay());
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
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_FULL    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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
  const hasRecurrence = !!(item as any).recurrence_rule;
  return (
    <TouchableOpacity style={listStyles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={listStyles.cardTime}>
        <Text style={listStyles.cardTimeText}>{fmtTime(item.start_time)}</Text>
        <Text style={listStyles.cardTimeDivider}>–</Text>
        <Text style={listStyles.cardTimeText}>{fmtTime(item.end_time)}</Text>
        <Text style={listStyles.cardUnits}>{units}u</Text>
      </View>
      <View style={listStyles.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={listStyles.cardClient} numberOfLines={1}>{item.clients?.name ?? '—'}</Text>
          {hasRecurrence && <Ionicons name="repeat" size={12} color="#6366F1" />}
        </View>
        <Text style={listStyles.cardEmployee} numberOfLines={1}>{item.users?.full_name ?? '—'}</Text>
        {item.service_types && (
          <Text style={listStyles.cardService} numberOfLines={1}>{item.service_types.name}</Text>
        )}
      </View>
      <View style={[listStyles.statusBadge, { backgroundColor: status.bg }]}>
        <Text style={[listStyles.statusText, { color: status.text }]}>{status.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

type ScreenMode = 'list' | 'calendar';

export default function AdminSchedules() {
  const router = useRouter();
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const [screenMode, setScreenMode]     = useState<ScreenMode>('list');
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('week');
  const [calendarFocus, setCalendarFocus] = useState(today);

  // List-mode state
  const [weekStart, setWeekStart]   = useState(() => startOfWeek(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible]     = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dateFrom = fmtDateISO(weekStart);
  const dateTo   = fmtDateISO(addDays(weekStart, 6)) + 'T23:59:59';

  const queryClient = useQueryClient();
  const { data: schedules, isLoading, refetch } = useSchedules({ dateFrom, dateTo });

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
  }, [queryClient]));

  const daySchedules = useMemo(
    () => (schedules ?? []).filter(s => isSameDay(new Date(s.start_time), selectedDay)),
    [schedules, selectedDay],
  );

  // ── Calendar mode data ──────────────────────────────────────────────────────
  const { events, isLoading: calLoading } = useCalendarData(calendarMode, calendarFocus);

  function navigateCalendar(dir: 'prev' | 'next') {
    const delta = dir === 'next' ? 1 : -1;
    setCalendarFocus(prev => {
      const d = new Date(prev);
      switch (calendarMode) {
        case 'day':   d.setDate(d.getDate() + delta); break;
        case 'week':  d.setDate(d.getDate() + delta * 7); break;
        case 'month': d.setMonth(d.getMonth() + delta); break;
      }
      return d;
    });
  }

  return (
    <View style={styles.container}>

      {/* Top toolbar */}
      <View style={styles.toolbar}>
        {/* List / Calendar toggle */}
        <View style={styles.screenModeRow}>
          <TouchableOpacity
            style={[styles.screenModeBtn, screenMode === 'list' && styles.screenModeBtnActive]}
            onPress={() => setScreenMode('list')}
          >
            <Ionicons name="list" size={16} color={screenMode === 'list' ? '#fff' : '#374151'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.screenModeBtn, screenMode === 'calendar' && styles.screenModeBtnActive]}
            onPress={() => setScreenMode('calendar')}
          >
            <Ionicons name="calendar" size={16} color={screenMode === 'calendar' ? '#fff' : '#374151'} />
          </TouchableOpacity>
        </View>

        {/* Calendar view-mode toggle (only shown in calendar mode) */}
        {screenMode === 'calendar' && (
          <CalendarViewToggle mode={calendarMode} onChange={setCalendarMode} />
        )}

        {/* Bulk create button */}
        <TouchableOpacity style={styles.bulkBtn} onPress={() => setBulkModalVisible(true)}>
          <Ionicons name="copy-outline" size={14} color="#6366F1" />
          <Text style={styles.bulkBtnText}>Bulk</Text>
        </TouchableOpacity>
      </View>

      {/* ── LIST MODE ── */}
      {screenMode === 'list' && (
        <>
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

          <View style={styles.dayBanner}>
            <Text style={styles.dayBannerText}>
              {isSameDay(selectedDay, today)
                ? 'Today'
                : selectedDay.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.dayBannerCount}>
              {daySchedules.length} visit{daySchedules.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {isLoading
            ? <SkeletonList count={3} showAvatar={false} />
            : (
              <FlatList
                data={daySchedules}
                keyExtractor={s => s.id}
                renderItem={({ item }) => (
                  <ScheduleCard
                    item={item}
                    onPress={() => router.push({ pathname: '/(admin)/schedule/[id]', params: { id: item.id } })}
                  />
                )}
                contentContainerStyle={listStyles.list}
                refreshControl={
                  <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#2563eb" colors={['#2563eb']} />
                }
                ListEmptyComponent={
                  <EmptyState
                    icon="calendar-outline"
                    title="No visits scheduled"
                    description="No visits on this day. Tap + to schedule one."
                    action={{ label: 'Schedule Visit', onPress: () => setCreateModalVisible(true) }}
                  />
                }
              />
            )
          }

          {/* FAB */}
          <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* ── CALENDAR MODE ── */}
      {screenMode === 'calendar' && (
        <View style={{ flex: 1 }}>
          {calLoading && <ActivityIndicator style={{ marginTop: 16 }} color="#6366F1" />}
          <CalendarView
            mode={calendarMode}
            focusDate={calendarFocus}
            events={events}
            onNavigate={navigateCalendar}
          />
          {/* FAB */}
          <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modals ── */}
      <CreateScheduleModal
        visible={createModalVisible}
        defaultDate={screenMode === 'list' ? selectedDay : calendarFocus}
        onClose={() => setCreateModalVisible(false)}
      />

      <BulkScheduleModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
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
  // Recurrence
  repeatType: RepeatType;
  repeatDays: DayOfWeek[];
  repeatEndDate: string;
  repeatCount: string;
}

function to24(hour: string, min: string, ampm: 'AM' | 'PM'): string {
  let h = parseInt(hour, 10) || 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2,'0')}:${(min || '00').padStart(2,'0')}`;
}

function localTzOffset(): string {
  const off  = new Date().getTimezoneOffset();
  const sign = off <= 0 ? '+' : '-';
  const abs  = Math.abs(off);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2,'0')}:${String(abs % 60).padStart(2,'0')}`;
}

function buildISO(date: string, hour: string, min: string, ampm: 'AM' | 'PM'): string {
  return `${date}T${to24(hour, min, ampm)}:00${localTzOffset()}`;
}

function CreateScheduleModal({ visible, defaultDate, onClose }: CreateModalProps) {
  const createSchedule = useCreateSchedule();
  const { data: clients   = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const queryClient = useQueryClient();

  // We need all schedules to check conflicts
  const { data: allSchedules = [] } = useSchedules({});

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => defaultFormState(defaultDate));
  const [conflictWarning, setConflictWarning] = useState<ScheduleWithRelations[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const { data: authList = [] } = useAuthorizations(form.client_id || undefined);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setForm(defaultFormState(defaultDate));
      setConflictWarning([]);
    }
  }, [visible, defaultDate]);

  function defaultFormState(d: Date): FormState {
    return {
      date: fmtDateISO(d),
      startHour: '9', startMin: '00', startAmpm: 'AM',
      endHour: '10',  endMin: '00',  endAmpm: 'AM',
      client_id: '', authorization_id: '', notes: '',
      employee_id: '', service_type_id: '',
      repeatType: 'none', repeatDays: [], repeatEndDate: '', repeatCount: '',
    };
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleClose() { setForm(defaultFormState(defaultDate)); setStep(1); onClose(); }

  function doCreate(force = false) {
    const start_time = buildISO(form.date, form.startHour, form.startMin, form.startAmpm);
    const end_time   = buildISO(form.date, form.endHour,   form.endMin,   form.endAmpm);

    if (end_time <= start_time) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }

    // Conflict check
    if (!force && form.employee_id) {
      const conflicts = detectConflicts({ employee_id: form.employee_id, start_time, end_time }, allSchedules);
      if (conflicts.length > 0) {
        setConflictWarning(conflicts);
        setShowConflictModal(true);
        return;
      }
    }

    const selectedAuth = authList.find(a => a.id === form.authorization_id);
    const baseInput: ScheduleInput = {
      employee_id:      form.employee_id,
      client_id:        form.client_id,
      authorization_id: form.authorization_id || null,
      service_type_id:  (selectedAuth?.service_type_id ?? form.service_type_id) || null,
      start_time,
      end_time,
      notes: form.notes || null,
    };

    // Build recurrence rule if applicable
    const hasRecurrence = form.repeatType !== 'none';

    if (!hasRecurrence) {
      createSchedule.mutate(baseInput, { onSuccess: () => { handleClose(); } });
      return;
    }

    // Generate occurrences
    const rule: RecurrenceRule = {
      type: form.repeatType,
      days: form.repeatDays.length > 0 ? form.repeatDays : undefined,
      end_date: form.repeatEndDate || undefined,
      count: form.repeatCount ? parseInt(form.repeatCount, 10) : undefined,
    };

    const rangeEnd = form.repeatEndDate || fmtDateISO(addDays(new Date(form.date), 365));
    const dates    = generateOccurrences(form.date, rule, form.date, rangeEnd, 200);

    if (dates.length === 0) {
      Alert.alert('No Occurrences', 'The recurrence rule produces no dates.');
      return;
    }

    const duration = new Date(end_time).getTime() - new Date(start_time).getTime();

    // Create all occurrences
    let created = 0;
    const total = dates.length;

    const createNext = (index: number) => {
      if (index >= dates.length) {
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        handleClose();
        return;
      }
      const date = dates[index];
      const s = buildISO(date, form.startHour, form.startMin, form.startAmpm);
      const e = new Date(new Date(s).getTime() + duration).toISOString();
      createSchedule.mutate(
        { ...baseInput, start_time: s, end_time: e },
        { onSuccess: () => { created++; createNext(index + 1); }, onError: () => createNext(index + 1) },
      );
    };

    createNext(0);
  }

  const step1Valid = !!form.date && !!form.startHour && !!form.endHour;
  const step2Valid = !!form.client_id;
  const step3Valid = !!form.employee_id;

  const totalSteps = 4;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={modalStyles.modal}>
        <View style={modalStyles.modalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={modalStyles.modalTitle}>New Schedule</Text>
          <Text style={modalStyles.stepLabel}>Step {step}/{totalSteps}</Text>
        </View>

        <View style={modalStyles.stepRow}>
          {Array.from({ length: totalSteps }, (_, n) => (
            <View key={n} style={[modalStyles.stepDot, step > n && modalStyles.stepDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={modalStyles.modalBody} keyboardShouldPersistTaps="handled">
          {step === 1 && <Step1 form={form} set={set} />}
          {step === 2 && <Step2 form={form} set={set} clients={clients} authList={authList} />}
          {step === 3 && <Step3 form={form} set={set} employees={employees} />}
          {step === 4 && <StepRecurrence form={form} set={set} />}
        </ScrollView>

        <View style={modalStyles.modalFooter}>
          {step > 1 && (
            <TouchableOpacity style={modalStyles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={modalStyles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < totalSteps ? (
            <TouchableOpacity
              style={[modalStyles.nextBtn,
                !(step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid) && modalStyles.btnDisabled]}
              disabled={!(step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid)}
              onPress={() => setStep(s => s + 1)}
            >
              <Text style={modalStyles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[modalStyles.nextBtn, (!step3Valid || createSchedule.isPending) && modalStyles.btnDisabled]}
              disabled={!step3Valid || createSchedule.isPending}
              onPress={() => doCreate(false)}
            >
              {createSchedule.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={modalStyles.nextBtnText}>
                    {form.repeatType !== 'none' ? 'Create Series' : 'Create'}
                  </Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conflict warning modal */}
      <Modal visible={showConflictModal} transparent animationType="fade">
        <View style={conflictStyles.overlay}>
          <View style={conflictStyles.box}>
            <Text style={conflictStyles.title}>Schedule Conflict</Text>
            <Text style={conflictStyles.desc}>
              This employee has {conflictWarning.length} overlapping appointment{conflictWarning.length > 1 ? 's' : ''}:
            </Text>
            {conflictWarning.map(c => (
              <View key={c.id} style={conflictStyles.conflictRow}>
                <Text style={conflictStyles.conflictClient}>{c.clients?.name ?? '—'}</Text>
                <Text style={conflictStyles.conflictTime}>
                  {fmtTime(c.start_time)} – {fmtTime(c.end_time)}
                </Text>
              </View>
            ))}
            <View style={conflictStyles.btnRow}>
              <TouchableOpacity
                style={conflictStyles.cancelBtn}
                onPress={() => setShowConflictModal(false)}
              >
                <Text style={conflictStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={conflictStyles.proceedBtn}
                onPress={() => { setShowConflictModal(false); doCreate(true); }}
              >
                <Text style={conflictStyles.proceedBtnText}>Proceed Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ── step components ────────────────────────────────────────────────────────────

function Step1({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <View style={modalStyles.stepContent}>
      <Text style={modalStyles.stepTitle}>Date & Time</Text>

      <View style={modalStyles.field}>
        <Text style={modalStyles.label}>Date</Text>
        <TextInput
          style={modalStyles.input}
          placeholder="YYYY-MM-DD"
          value={form.date}
          onChangeText={v => set('date', v)}
        />
      </View>

      <Text style={modalStyles.label}>Start Time</Text>
      <TimeRow
        hour={form.startHour} min={form.startMin} ampm={form.startAmpm}
        onHour={v => set('startHour', v)}
        onMin={v => set('startMin', v)}
        onAmpm={v => set('startAmpm', v)}
      />

      <Text style={[modalStyles.label, { marginTop: 12 }]}>End Time</Text>
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
    <View style={modalStyles.timeRow}>
      <TextInput
        style={[modalStyles.input, modalStyles.timeInput]}
        placeholder="9" keyboardType="numeric" maxLength={2}
        value={hour} onChangeText={onHour}
      />
      <Text style={modalStyles.timeSep}>:</Text>
      <TextInput
        style={[modalStyles.input, modalStyles.timeInput]}
        placeholder="00" keyboardType="numeric" maxLength={2}
        value={min} onChangeText={onMin}
      />
      <TouchableOpacity style={modalStyles.ampmBtn} onPress={() => onAmpm(ampm === 'AM' ? 'PM' : 'AM')}>
        <Text style={modalStyles.ampmText}>{ampm}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Step2({
  form, set, clients, authList,
}: {
  form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  clients: any[]; authList: any[];
}) {
  const activeAuths = authList.filter(a => a.is_active);
  return (
    <View style={modalStyles.stepContent}>
      <Text style={modalStyles.stepTitle}>Client & Authorization</Text>

      <Text style={modalStyles.label}>Client <Text style={modalStyles.required}>*</Text></Text>
      <ScrollView style={modalStyles.pickerList} nestedScrollEnabled>
        {clients.filter(c => c.is_active).map(c => (
          <TouchableOpacity
            key={c.id}
            style={[modalStyles.pickerItem, form.client_id === c.id && modalStyles.pickerItemSelected]}
            onPress={() => { set('client_id', c.id); set('authorization_id', ''); }}
          >
            <Text style={[modalStyles.pickerItemText, form.client_id === c.id && modalStyles.pickerItemTextSelected]}>
              {c.name}
            </Text>
            {form.client_id === c.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {form.client_id !== '' && (
        <>
          <Text style={[modalStyles.label, { marginTop: 16 }]}>Authorization (optional)</Text>
          {activeAuths.length === 0
            ? <Text style={modalStyles.hint}>No active authorizations for this client.</Text>
            : (
              <ScrollView style={modalStyles.pickerList} nestedScrollEnabled>
                <TouchableOpacity
                  style={[modalStyles.pickerItem, form.authorization_id === '' && modalStyles.pickerItemSelected]}
                  onPress={() => set('authorization_id', '')}
                >
                  <Text style={[modalStyles.pickerItemText, form.authorization_id === '' && modalStyles.pickerItemTextSelected]}>
                    None
                  </Text>
                </TouchableOpacity>
                {activeAuths.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[modalStyles.pickerItem, form.authorization_id === a.id && modalStyles.pickerItemSelected]}
                    onPress={() => set('authorization_id', a.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[modalStyles.pickerItemText, form.authorization_id === a.id && modalStyles.pickerItemTextSelected]}>
                        {a.auth_number}
                      </Text>
                      <Text style={modalStyles.authMeta}>
                        {a.service_types?.name} · ends {a.end_date}
                      </Text>
                    </View>
                    {form.authorization_id === a.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          }
        </>
      )}

      <View style={[modalStyles.field, { marginTop: 16 }]}>
        <Text style={modalStyles.label}>Notes</Text>
        <TextInput
          style={[modalStyles.input, modalStyles.textArea]}
          placeholder="Special instructions, access notes..."
          multiline numberOfLines={3}
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
  form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  employees: any[];
}) {
  return (
    <View style={modalStyles.stepContent}>
      <Text style={modalStyles.stepTitle}>Assign Employee</Text>
      <Text style={modalStyles.label}>Employee <Text style={modalStyles.required}>*</Text></Text>
      <ScrollView style={modalStyles.pickerList} nestedScrollEnabled>
        {employees.filter(e => e.is_active && e.role === 'employee').map(e => (
          <TouchableOpacity
            key={e.id}
            style={[modalStyles.pickerItem, form.employee_id === e.id && modalStyles.pickerItemSelected]}
            onPress={() => set('employee_id', e.id)}
          >
            <Text style={[modalStyles.pickerItemText, form.employee_id === e.id && modalStyles.pickerItemTextSelected]}>
              {e.full_name}
            </Text>
            {form.employee_id === e.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function StepRecurrence({ form, set }: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  function toggleDay(d: DayOfWeek) {
    const current = form.repeatDays;
    if (current.includes(d)) {
      set('repeatDays', current.filter(x => x !== d) as DayOfWeek[]);
    } else {
      set('repeatDays', [...current, d] as DayOfWeek[]);
    }
  }

  const repeatTypes: { value: RepeatType; label: string }[] = [
    { value: 'none',      label: 'No Repeat' },
    { value: 'daily',     label: 'Daily' },
    { value: 'weekly',    label: 'Weekly' },
    { value: 'biweekly',  label: 'Biweekly' },
    { value: 'monthly',   label: 'Monthly' },
  ];

  return (
    <View style={modalStyles.stepContent}>
      <Text style={modalStyles.stepTitle}>Recurrence (optional)</Text>

      <Text style={modalStyles.label}>Repeat</Text>
      <View style={{ gap: 6 }}>
        {repeatTypes.map(rt => (
          <TouchableOpacity
            key={rt.value}
            style={[modalStyles.pickerItem, form.repeatType === rt.value && modalStyles.pickerItemSelected]}
            onPress={() => set('repeatType', rt.value)}
          >
            <Text style={[modalStyles.pickerItemText, form.repeatType === rt.value && modalStyles.pickerItemTextSelected]}>
              {rt.label}
            </Text>
            {form.repeatType === rt.value && <Ionicons name="checkmark" size={16} color="#2563eb" />}
          </TouchableOpacity>
        ))}
      </View>

      {(form.repeatType === 'weekly' || form.repeatType === 'biweekly') && (
        <>
          <Text style={[modalStyles.label, { marginTop: 12 }]}>Repeat on days</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {DAY_FULL.map((name, d) => (
              <TouchableOpacity
                key={d}
                style={[modalStyles.dayChip, form.repeatDays.includes(d as DayOfWeek) && modalStyles.dayChipActive]}
                onPress={() => toggleDay(d as DayOfWeek)}
              >
                <Text style={[modalStyles.dayChipText, form.repeatDays.includes(d as DayOfWeek) && modalStyles.dayChipTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {form.repeatType !== 'none' && (
        <>
          <Text style={[modalStyles.label, { marginTop: 12 }]}>End Date (YYYY-MM-DD, optional)</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="2026-12-31"
            value={form.repeatEndDate}
            onChangeText={v => set('repeatEndDate', v)}
          />
          <Text style={[modalStyles.label, { marginTop: 8 }]}>Max Occurrences (optional)</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. 12"
            keyboardType="numeric"
            value={form.repeatCount}
            onChangeText={v => set('repeatCount', v)}
          />
        </>
      )}
    </View>
  );
}

// ── Top-level styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },

  toolbar:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  screenModeRow:    { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 2 },
  screenModeBtn:    { padding: 6, borderRadius: 6 },
  screenModeBtnActive: { backgroundColor: '#2563eb' },
  bulkBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#6366F1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 'auto' },
  bulkBtnText:      { fontSize: 12, fontWeight: '700', color: '#6366F1' },

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

  // FAB
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});

// ── List mode card styles ─────────────────────────────────────────────────────
const listStyles = StyleSheet.create({
  list:   { padding: 12, gap: 8 },
  card:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardTime:        { alignItems: 'center', minWidth: 52 },
  cardTimeText:    { fontSize: 12, fontWeight: '600', color: '#374151' },
  cardTimeDivider: { fontSize: 10, color: '#9ca3af' },
  cardUnits:       { fontSize: 11, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  cardBody:        { flex: 1, gap: 2 },
  cardClient:      { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardEmployee:    { fontSize: 12, color: '#6b7280' },
  cardService:     { fontSize: 11, color: '#9ca3af' },
  statusBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:      { fontSize: 11, fontWeight: '600' },
});

// ── Modal styles ──────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  modal:        { flex: 1, backgroundColor: '#f8f9fa' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#111827' },
  stepLabel:    { fontSize: 13, color: '#6b7280' },
  stepRow:      { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 12 },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  stepDotActive:{ backgroundColor: '#2563eb' },
  modalBody:    { padding: 16, paddingBottom: 32 },
  modalFooter:  { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },

  stepContent: { gap: 12 },
  stepTitle:   { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },

  field:    { gap: 4 },
  label:    { fontSize: 13, fontWeight: '600', color: '#374151' },
  required: { color: '#ef4444' },
  hint:     { fontSize: 13, color: '#9ca3af' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 11 },

  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { width: 56, textAlign: 'center' },
  timeSep:   { fontSize: 18, color: '#374151', fontWeight: '700' },
  ampmBtn:   { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  ampmText:  { fontSize: 14, fontWeight: '700', color: '#374151' },

  pickerList:           { maxHeight: 200, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fff' },
  pickerItem:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerItemSelected:   { backgroundColor: '#eff6ff' },
  pickerItemText:       { flex: 1, fontSize: 14, color: '#374151' },
  pickerItemTextSelected:{ color: '#2563eb', fontWeight: '600' },
  authMeta:             { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  dayChip:         { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  dayChipActive:   { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  dayChipText:     { fontSize: 12, fontWeight: '600', color: '#374151' },
  dayChipTextActive:{ color: '#2563eb' },

  backBtn:      { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  backBtnText:  { fontSize: 15, fontWeight: '600', color: '#374151' },
  nextBtn:      { flex: 2, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  nextBtnText:  { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled:  { opacity: 0.45 },
});

// ── Conflict modal styles ─────────────────────────────────────────────────────
const conflictStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  box:         { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  title:       { fontSize: 17, fontWeight: '700', color: '#111827' },
  desc:        { fontSize: 14, color: '#374151' },
  conflictRow: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, gap: 2 },
  conflictClient:{ fontSize: 14, fontWeight: '600', color: '#991b1b' },
  conflictTime:  { fontSize: 12, color: '#6b7280' },
  btnRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:   { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '600', color: '#374151' },
  proceedBtn:  { flex: 1, backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  proceedBtnText:{ fontSize: 14, fontWeight: '600', color: '#fff' },
});
