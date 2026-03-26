import { useMemo } from 'react';
import { useSchedules } from '@/features/schedules/hooks/useSchedules';
import type { ScheduleWithRelations } from '@/features/schedules/hooks/useSchedules';

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfWeek(d: Date): Date {
  const r = startOfWeek(d);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59);
  return r;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  schedule: ScheduleWithRelations;
  startMs: number;
  endMs: number;
  color: string;
}

// ── Deterministic color from a string ────────────────────────────────────────

const EVENT_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
];

export function colorForClient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCalendarData(mode: CalendarViewMode, focusDate: Date) {
  const { dateFrom, dateTo } = useMemo(() => {
    switch (mode) {
      case 'day':
        return { dateFrom: toISO(focusDate), dateTo: toISO(focusDate) + 'T23:59:59' };
      case 'week':
        return {
          dateFrom: toISO(startOfWeek(focusDate)),
          dateTo:   toISO(endOfWeek(focusDate)) + 'T23:59:59',
        };
      case 'month': {
        const ms = startOfMonth(focusDate);
        const me = endOfMonth(focusDate);
        // Expand to full calendar grid weeks
        return {
          dateFrom: toISO(startOfWeek(ms)),
          dateTo:   toISO(endOfWeek(me)) + 'T23:59:59',
        };
      }
    }
  }, [mode, focusDate]);

  const { data: schedules = [], isLoading, refetch } = useSchedules({ dateFrom, dateTo });

  const events: CalendarEvent[] = useMemo(
    () => schedules.map(s => ({
      id:       s.id,
      schedule: s,
      startMs:  new Date(s.start_time).getTime(),
      endMs:    new Date(s.end_time).getTime(),
      color:    colorForClient(s.clients?.name ?? s.id),
    })),
    [schedules],
  );

  return { events, schedules, isLoading, refetch, dateFrom, dateTo };
}
