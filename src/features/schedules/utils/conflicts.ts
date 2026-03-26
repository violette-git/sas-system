import type { ScheduleWithRelations } from '@/features/schedules/hooks/useSchedules';

export interface ConflictCandidate {
  employee_id: string;
  start_time: string;
  end_time: string;
}

/**
 * Find existing schedules that overlap with a new/edited appointment for the
 * same employee. Two intervals [a,b) and [c,d) overlap when a < d && c < b.
 *
 * @param candidate  The schedule being created / edited
 * @param existing   All existing schedules for the company (pre-fetched)
 * @param excludeId  ID of the schedule being edited (skip self-comparison)
 */
export function detectConflicts(
  candidate: ConflictCandidate,
  existing: ScheduleWithRelations[],
  excludeId?: string,
): ScheduleWithRelations[] {
  const newStart = new Date(candidate.start_time).getTime();
  const newEnd   = new Date(candidate.end_time).getTime();

  return existing.filter(s => {
    if (excludeId && s.id === excludeId) return false;
    if (s.status === 'cancelled') return false;
    if (s.employee_id !== candidate.employee_id) return false;

    const sStart = new Date(s.start_time).getTime();
    const sEnd   = new Date(s.end_time).getTime();

    // Overlap: new starts before existing ends AND existing starts before new ends
    return newStart < sEnd && sStart < newEnd;
  });
}
