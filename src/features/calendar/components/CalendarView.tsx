import { useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import type { CalendarViewMode, CalendarEvent } from '@/features/calendar/hooks/useCalendarData';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Date helpers ──────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const HOUR_START = 7;  // 7 AM
const HOUR_END   = 21; // 9 PM
const HOUR_HEIGHT = 64;

// ── View mode toggle ──────────────────────────────────────────────────────────

interface ViewToggleProps {
  mode: CalendarViewMode;
  onChange: (m: CalendarViewMode) => void;
}

export function CalendarViewToggle({ mode, onChange }: ViewToggleProps) {
  const modes: CalendarViewMode[] = ['day', 'week', 'month'];
  return (
    <View style={toggleStyles.row}>
      {modes.map(m => (
        <TouchableOpacity
          key={m}
          style={[toggleStyles.btn, mode === m && toggleStyles.btnActive]}
          onPress={() => onChange(m)}
        >
          <Text style={[toggleStyles.label, mode === m && toggleStyles.labelActive]}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row:         { flexDirection: 'row', backgroundColor: colors.elevated, borderRadius: radius.md, padding: 2 },
  btn:         { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: radius.sm },
  btnActive:   { backgroundColor: colors.accent },
  label:       { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  labelActive: { color: '#fff' },
});

// ── CalendarView ──────────────────────────────────────────────────────────────

interface CalendarViewProps {
  mode: CalendarViewMode;
  focusDate: Date;
  events: CalendarEvent[];
  onNavigate: (direction: 'prev' | 'next') => void;
}

export function CalendarView({ mode, focusDate, events, onNavigate }: CalendarViewProps) {
  switch (mode) {
    case 'month': return <MonthView focusDate={focusDate} events={events} onNavigate={onNavigate} />;
    case 'week':  return <WeekView  focusDate={focusDate} events={events} onNavigate={onNavigate} />;
    case 'day':   return <DayView   focusDate={focusDate} events={events} onNavigate={onNavigate} />;
  }
}

// ── Nav header shared by all views ────────────────────────────────────────────

function NavHeader({ title, onPrev, onNext }: { title: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={navStyles.row}>
      <TouchableOpacity onPress={onPrev} style={navStyles.btn}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text style={navStyles.title}>{title}</Text>
      <TouchableOpacity onPress={onNext} style={navStyles.btn}>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const navStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  btn:   { padding: spacing.sm },
  title: { flex: 1, textAlign: 'center', ...typography.md, color: colors.text, fontWeight: '700' },
});

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({ focusDate, events, onNavigate }: Omit<CalendarViewProps, 'mode'>) {
  const router = useRouter();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const cells = useMemo(() => {
    const monthStart = startOfMonth(focusDate);
    const gridStart  = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [focusDate]);

  const eventsForDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.startMs), day));

  return (
    <View style={{ flex: 1 }}>
      <NavHeader
        title={`${MONTH_NAMES[focusDate.getMonth()]} ${focusDate.getFullYear()}`}
        onPrev={() => onNavigate('prev')}
        onNext={() => onNavigate('next')}
      />

      {/* Day-of-week header */}
      <View style={monthStyles.weekRow}>
        {DAY_SHORT.map(d => (
          <Text key={d} style={monthStyles.weekLabel}>{d}</Text>
        ))}
      </View>

      {/* 6-row grid */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {Array.from({ length: 6 }, (_, row) => (
          <View key={row} style={monthStyles.row}>
            {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
              const inMonth  = day.getMonth() === focusDate.getMonth();
              const isToday  = isSameDay(day, today);
              const dayEvts  = eventsForDay(day);
              return (
                <View
                  key={col}
                  style={[
                    monthStyles.cell,
                    isToday && monthStyles.cellToday,
                    !inMonth && monthStyles.cellOtherMonth,
                  ]}
                >
                  <Text style={[monthStyles.cellNum, !inMonth && monthStyles.cellNumMuted, isToday && monthStyles.cellNumToday]}>
                    {day.getDate()}
                  </Text>
                  {dayEvts.slice(0, 3).map(e => (
                    <TouchableOpacity
                      key={e.id}
                      style={[monthStyles.eventDot, { backgroundColor: e.color }]}
                      onPress={() => router.push({ pathname: '/(admin)/schedule/[id]', params: { id: e.id } })}
                    >
                      <Text style={monthStyles.eventDotText} numberOfLines={1}>
                        {e.schedule.clients?.name ?? '—'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {dayEvts.length > 3 && (
                    <Text style={monthStyles.moreText}>+{dayEvts.length - 3}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const monthStyles = StyleSheet.create({
  weekRow:     { flexDirection: 'row', paddingHorizontal: spacing.sm },
  weekLabel:   { flex: 1, textAlign: 'center', ...typography.xs, color: colors.textMuted, fontWeight: '700', paddingVertical: spacing.xs },
  row:         { flexDirection: 'row', paddingHorizontal: spacing.sm },
  cell:        { flex: 1, minHeight: 68, padding: 3, borderWidth: 0.5, borderColor: colors.border, gap: 2 },
  cellToday:   { backgroundColor: colors.accentDim },
  cellOtherMonth: { opacity: 0.35 },
  cellNum:     { ...typography.xs, color: colors.textSecondary, fontWeight: '600' },
  cellNumMuted:{ color: colors.textMuted },
  cellNumToday:{ color: colors.accentLight, fontWeight: '700' },
  eventDot:    { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  eventDotText:{ fontSize: 9, color: '#fff', fontWeight: '600' },
  moreText:    { fontSize: 9, color: colors.textMuted },
});

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({ focusDate, events, onNavigate }: Omit<CalendarViewProps, 'mode'>) {
  const router = useRouter();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekStart = useMemo(() => startOfWeek(focusDate), [focusDate]);
  const days      = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    [],
  );

  const COL_W = Math.floor((SCREEN_W - 40) / 7);

  const eventsForDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.startMs), day));

  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={{ flex: 1 }}>
      <NavHeader
        title={`${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`}
        onPrev={() => onNavigate('prev')}
        onNext={() => onNavigate('next')}
      />

      {/* Day header */}
      <View style={weekStyles.headerRow}>
        <View style={weekStyles.timeGutter} />
        {days.map((d, i) => (
          <View key={i} style={[weekStyles.dayHead, { width: COL_W }]}>
            <Text style={[weekStyles.dayLabel, isSameDay(d, today) && weekStyles.dayLabelToday]}>{DAY_SHORT[i]}</Text>
            <View style={[weekStyles.dayCircle, isSameDay(d, today) && weekStyles.dayCircleToday]}>
              <Text style={[weekStyles.dayNum, isSameDay(d, today) && weekStyles.dayNumToday]}>{d.getDate()}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Time grid */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row' }}>
          {/* Hour labels */}
          <View style={weekStyles.timeGutter}>
            {hours.map(h => (
              <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', paddingTop: 2 }}>
                <Text style={weekStyles.hourLabel}>
                  {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
                </Text>
              </View>
            ))}
          </View>

          {/* Day columns */}
          {days.map((day, di) => {
            const dayEvts = eventsForDay(day);
            return (
              <View key={di} style={[weekStyles.col, { width: COL_W }]}>
                {/* Hour grid lines */}
                {hours.map(h => (
                  <View key={h} style={[weekStyles.hourLine, { height: HOUR_HEIGHT }]} />
                ))}
                {/* Events */}
                {dayEvts.map(e => {
                  const startHour = new Date(e.startMs).getHours() + new Date(e.startMs).getMinutes() / 60;
                  const endHour   = new Date(e.endMs).getHours()   + new Date(e.endMs).getMinutes() / 60;
                  const top    = Math.max(0, (startHour - HOUR_START)) * HOUR_HEIGHT;
                  const height = Math.max(20, (endHour - startHour) * HOUR_HEIGHT);
                  const hasConflict = e.schedule.status !== 'cancelled' && dayEvts.some(
                    other => other.id !== e.id &&
                      other.startMs < e.endMs && e.startMs < other.endMs
                  );
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[weekStyles.event, { top, height, backgroundColor: e.color, borderColor: hasConflict ? '#EF4444' : 'transparent', borderWidth: hasConflict ? 2 : 0 }]}
                      onPress={() => router.push({ pathname: '/(admin)/schedule/[id]', params: { id: e.id } })}
                    >
                      <Text style={weekStyles.eventText} numberOfLines={2}>
                        {e.schedule.clients?.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const weekStyles = StyleSheet.create({
  headerRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 0 },
  timeGutter:   { width: 40, paddingLeft: 4 },
  dayHead:      { alignItems: 'center', paddingVertical: spacing.xs },
  dayLabel:     { ...typography.xs, color: colors.textMuted, fontWeight: '700' },
  dayLabelToday:{ color: colors.accentLight },
  dayCircle:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayCircleToday: { backgroundColor: colors.accent },
  dayNum:       { ...typography.xs, color: colors.textSecondary, fontWeight: '600' },
  dayNumToday:  { color: '#fff', fontWeight: '700' },
  col:          { position: 'relative' },
  hourLine:     { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  hourLabel:    { ...typography.xs, color: colors.textMuted, fontSize: 9 },
  event:        { position: 'absolute', left: 1, right: 1, borderRadius: 3, padding: 2, overflow: 'hidden', opacity: 0.9 },
  eventText:    { fontSize: 9, color: '#fff', fontWeight: '600' },
});

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ focusDate, events, onNavigate }: Omit<CalendarViewProps, 'mode'>) {
  const router = useRouter();
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    [],
  );
  const dayEvents = useMemo(
    () => events.filter(e => isSameDay(new Date(e.startMs), focusDate)),
    [events, focusDate],
  );

  const title = focusDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={{ flex: 1 }}>
      <NavHeader title={title} onPrev={() => onNavigate('prev')} onNext={() => onNavigate('next')} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md }}>
          {/* Hour gutter */}
          <View style={{ width: 48 }}>
            {hours.map(h => (
              <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: 'flex-start', paddingTop: 2 }}>
                <Text style={dayStyles.hourLabel}>
                  {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                </Text>
              </View>
            ))}
          </View>

          {/* Event column */}
          <View style={{ flex: 1, position: 'relative' }}>
            {hours.map(h => (
              <View key={h} style={[dayStyles.hourRow, { height: HOUR_HEIGHT }]} />
            ))}
            {dayEvents.map(e => {
              const startHour = new Date(e.startMs).getHours() + new Date(e.startMs).getMinutes() / 60;
              const endHour   = new Date(e.endMs).getHours()   + new Date(e.endMs).getMinutes() / 60;
              const top    = Math.max(0, (startHour - HOUR_START)) * HOUR_HEIGHT;
              const height = Math.max(36, (endHour - startHour) * HOUR_HEIGHT);
              const hasConflict = dayEvents.some(
                other => other.id !== e.id &&
                  other.startMs < e.endMs && e.startMs < other.endMs
              );
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[dayStyles.event, { top, height, borderLeftWidth: 4, borderLeftColor: e.color, borderColor: hasConflict ? colors.danger : 'transparent', borderWidth: hasConflict ? 1.5 : 0 }]}
                  onPress={() => router.push({ pathname: '/(admin)/schedule/[id]', params: { id: e.id } })}
                >
                  <Text style={[dayStyles.eventClient, { color: e.color }]} numberOfLines={1}>
                    {e.schedule.clients?.name ?? '—'}
                  </Text>
                  <Text style={dayStyles.eventEmployee} numberOfLines={1}>
                    {e.schedule.users?.full_name}
                  </Text>
                  <Text style={dayStyles.eventTime}>
                    {fmtTime(e.startMs)} – {fmtTime(e.endMs)}
                  </Text>
                  {e.schedule.service_types && (
                    <Text style={dayStyles.eventService} numberOfLines={1}>
                      {e.schedule.service_types.name}
                    </Text>
                  )}
                  {hasConflict && (
                    <View style={dayStyles.conflictBadge}>
                      <Text style={dayStyles.conflictText}>Conflict</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {dayEvents.length === 0 && (
          <View style={dayStyles.empty}>
            <Text style={dayStyles.emptyText}>No appointments this day</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const dayStyles = StyleSheet.create({
  hourLabel:     { fontSize: 10, color: colors.textMuted },
  hourRow:       { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  event:         { position: 'absolute', left: 4, right: 0, backgroundColor: colors.elevated, borderRadius: radius.sm, padding: spacing.sm, overflow: 'hidden' },
  eventClient:   { ...typography.sm, fontWeight: '700' },
  eventEmployee: { ...typography.xs, color: colors.textSecondary },
  eventTime:     { ...typography.xs, color: colors.textMuted },
  eventService:  { ...typography.xs, color: colors.textMuted },
  conflictBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.dangerDim, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  conflictText:  { fontSize: 9, color: colors.danger, fontWeight: '700' },
  empty:         { alignItems: 'center', paddingTop: 60 },
  emptyText:     { ...typography.base, color: colors.textMuted },
});
