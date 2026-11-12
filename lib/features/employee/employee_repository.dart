// Data access for the employee (caregiver) portal.
// Ported from src/features/schedules/hooks/useSchedules.ts (useMySchedules,
// useSchedule), src/features/time-entries/hooks/useTimeEntries.ts and
// src/features/visit-notes/hooks/useVisitNotes.ts +
// src/features/case-notes/hooks/useCaseNotes.ts.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../core/providers.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';

/// Joins needed by visit cards. The employee join is left out on purpose:
/// the signed-in employee is always the assignee.
const _listSelect =
    '*, clients(name, address_line1, city, state), service_types(name, short_code)';

/// Full client row for the detail screen (phone, contact, zip, coordinates).
const _detailSelect = '*, clients(*), service_types(name, short_code)';

enum VisitRange { today, upcoming, past }

extension VisitRangeX on VisitRange {
  String get label => switch (this) {
        VisitRange.today => 'Today',
        VisitRange.upcoming => 'Upcoming',
        VisitRange.past => 'Past',
      };
}

/// How far the Upcoming / Past tabs look.
const upcomingDays = 14;
const pastDays = 30;

DateTime startOfToday() {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
}

String _utc(DateTime d) => d.toUtc().toIso8601String();

/// A schedule plus its full client row.
class VisitDetail {
  const VisitDetail({required this.schedule, this.client});
  final Schedule schedule;
  final Client? client;
}

// ── Queries ───────────────────────────────────────────────────────────────

/// The signed-in employee's visits for a range. Cancelled visits are hidden,
/// matching useMySchedules.
final myVisitsProvider = FutureProvider.autoDispose
    .family<List<Schedule>, VisitRange>((ref, range) async {
  final uid = ref.watch(userIdProvider);
  final today = startOfToday();
  final tomorrow = DateTime(today.year, today.month, today.day + 1);

  final q = sb
      .from('schedules')
      .select(_listSelect)
      .eq('employee_id', uid)
      .neq('status', ScheduleStatus.cancelled.db);

  final List<Map<String, dynamic>> rows;
  switch (range) {
    case VisitRange.today:
      rows = await q
          .gte('start_time', _utc(today))
          .lt('start_time', _utc(tomorrow))
          .order('start_time', ascending: true);
    case VisitRange.upcoming:
      final end = DateTime(today.year, today.month, today.day + 1 + upcomingDays);
      rows = await q
          .gte('start_time', _utc(tomorrow))
          .lt('start_time', _utc(end))
          .order('start_time', ascending: true)
          .limit(200);
    case VisitRange.past:
      final from = DateTime(today.year, today.month, today.day - pastDays);
      rows = await q
          .gte('start_time', _utc(from))
          .lt('start_time', _utc(today))
          .order('start_time', ascending: false)
          .limit(200);
  }
  return rows.map(Schedule.fromJson).toList();
});

/// The employee's currently open time entry (clocked_out_at is null), if any.
/// Mirrors useActiveTimeEntry; ordered + limited so a stray duplicate open
/// row does not make maybeSingle() throw.
final openEntryProvider = FutureProvider.autoDispose<TimeEntry?>((ref) async {
  final uid = ref.watch(userIdProvider);
  return fetchOpenEntry(uid);
});

Future<TimeEntry?> fetchOpenEntry(String employeeId) async {
  final row = await sb
      .from('time_entries')
      .select()
      .eq('employee_id', employeeId)
      .isFilter('clocked_out_at', null)
      .order('clocked_in_at', ascending: false)
      .limit(1)
      .maybeSingle();
  return row == null ? null : TimeEntry.fromJson(row);
}

/// One visit with its client. Null when not found or not visible (RLS).
final visitProvider = FutureProvider.autoDispose
    .family<VisitDetail?, String>((ref, scheduleId) async {
  final row = await sb
      .from('schedules')
      .select(_detailSelect)
      .eq('id', scheduleId)
      .maybeSingle();
  if (row == null) return null;
  final clientJson = row['clients'];
  Client? client;
  if (clientJson is Map && clientJson['id'] != null) {
    client = Client.fromJson(clientJson.cast<String, dynamic>());
  }
  return VisitDetail(schedule: Schedule.fromJson(row), client: client);
});

/// Time entries for a visit, oldest first (useTimeEntriesForSchedule).
final visitEntriesProvider = FutureProvider.autoDispose
    .family<List<TimeEntry>, String>((ref, scheduleId) async {
  final List<Map<String, dynamic>> rows = await sb
      .from('time_entries')
      .select()
      .eq('schedule_id', scheduleId)
      .order('clocked_in_at', ascending: true);
  return rows.map(TimeEntry.fromJson).toList();
});

/// The signed-in employee's own notes on a visit, newest first.
final visitNotesProvider = FutureProvider.autoDispose
    .family<List<VisitNote>, String>((ref, scheduleId) async {
  final uid = ref.watch(userIdProvider);
  final List<Map<String, dynamic>> rows = await sb
      .from('visit_notes')
      .select()
      .eq('schedule_id', scheduleId)
      .eq('author_id', uid)
      .order('created_at', ascending: false);
  return rows.map(VisitNote.fromJson).toList();
});

/// Every time entry the employee started today (for "worked today").
final todayEntriesProvider =
    FutureProvider.autoDispose<List<TimeEntry>>((ref) async {
  final uid = ref.watch(userIdProvider);
  final List<Map<String, dynamic>> rows = await sb
      .from('time_entries')
      .select()
      .eq('employee_id', uid)
      .gte('clocked_in_at', _utc(startOfToday()))
      .order('clocked_in_at', ascending: true);
  return rows.map(TimeEntry.fromJson).toList();
});

/// Total worked across entries; open entries count up to [now].
Duration totalWorked(List<TimeEntry> entries, DateTime now) {
  var total = Duration.zero;
  for (final e in entries) {
    if (e.clockedOutAt != null) {
      total += e.durationMinutes != null
          ? Duration(minutes: e.durationMinutes!)
          : e.clockedOutAt!.difference(e.clockedInAt);
    } else {
      total += now.difference(e.clockedInAt);
    }
  }
  return total.isNegative ? Duration.zero : total;
}

/// 1 billable unit = 15 full minutes (same rule as the generated
/// billable_units column, computed locally because we never read or write it).
int unitsFor(Duration d) => d.inMinutes ~/ 15;

bool isClockable(Schedule s) =>
    s.status == ScheduleStatus.scheduled ||
    s.status == ScheduleStatus.inProgress;

// ── Mutations ─────────────────────────────────────────────────────────────

/// Clock in to a visit. Mirrors useClockIn: inserts the time entry, then
/// marks the schedule in_progress (only when it is still scheduled or
/// already in progress, so a cancelled or completed visit is never revived).
///
/// clocked_in_at is not sent: the server sets it from its own clock (a DB
/// trigger overwrites it for non-admins), so a wrong device clock cannot
/// skew billable time.
///
/// [lat]/[lon] are reserved for the geofencing wave. They are only sent
/// when present, because clocked_in_lat / clocked_in_lon are not in the
/// repo's SQL yet.
Future<TimeEntry> clockIn({
  required String scheduleId,
  required String employeeId,
  required String companyId,
  double? lat,
  double? lon,
}) async {
  // Prevent a double clock-in anywhere (friendly message for the common
  // case; the unique index below is the real guard against races).
  final open = await fetchOpenEntry(employeeId);
  if (open != null) {
    throw Exception(open.scheduleId == scheduleId
        ? 'You are already clocked in to this visit.'
        : 'You are already clocked in to another visit. Clock out of it first.');
  }

  final payload = <String, dynamic>{
    'schedule_id': scheduleId,
    'employee_id': employeeId,
    'company_id': companyId,
  };
  if (lat != null) payload['clocked_in_lat'] = lat;
  if (lon != null) payload['clocked_in_lon'] = lon;

  final Map<String, dynamic> row;
  try {
    row = await sb.from('time_entries').insert(payload).select().single();
  } on PostgrestException catch (e) {
    // Unique violation: the one-open-entry-per-employee index fired.
    if (e.code == '23505') {
      throw Exception('You are already clocked in to another visit.');
    }
    rethrow;
  }

  await sb
      .from('schedules')
      .update({'status': ScheduleStatus.inProgress.db})
      .eq('id', scheduleId)
      .inFilter('status', [
        ScheduleStatus.scheduled.db,
        ScheduleStatus.inProgress.db,
      ]);

  return TimeEntry.fromJson(row);
}

/// Clock out of an open entry. Mirrors useClockOut. clocked_out_at must be
/// in the update to close the entry, but the server replaces the value with
/// its own clock (DB trigger for non-admins). duration_minutes /
/// billable_units are generated by the DB and never written.
///
/// Throws when the entry was already closed (zero rows updated); the
/// schedule is then left alone. Otherwise marks the schedule completed,
/// only if it is still in_progress (a cancelled visit stays cancelled).
Future<void> clockOut({
  required TimeEntry entry,
  double? lat,
  double? lon,
}) async {
  final payload = <String, dynamic>{
    'clocked_out_at': DateTime.now().toUtc().toIso8601String(),
  };
  if (lat != null) payload['clocked_out_lat'] = lat;
  if (lon != null) payload['clocked_out_lon'] = lon;

  final List<Map<String, dynamic>> closed = await sb
      .from('time_entries')
      .update(payload)
      .eq('id', entry.id)
      .isFilter('clocked_out_at', null)
      .select();
  if (closed.isEmpty) {
    throw Exception('This visit was already clocked out.');
  }

  await sb
      .from('schedules')
      .update({'status': ScheduleStatus.completed.db})
      .eq('id', entry.scheduleId)
      .eq('status', ScheduleStatus.inProgress.db);
}

/// Create a visit note. Mirrors useCreateCaseNote: status plus the legacy
/// is_draft flag kept in sync, author_id and company_id from the profile.
Future<void> createVisitNote({
  required String scheduleId,
  required String authorId,
  required String companyId,
  required String body,
  required bool submit,
}) async {
  await sb.from('visit_notes').insert({
    'schedule_id': scheduleId,
    'body': body,
    'author_id': authorId,
    'company_id': companyId,
    'status': submit ? 'submitted' : 'draft',
    'is_draft': !submit,
  });
}

/// Update a draft note (useUpdateCaseNote): body, status and is_draft.
Future<void> updateVisitNote({
  required String noteId,
  required String body,
  required bool submit,
}) async {
  await sb.from('visit_notes').update({
    'body': body,
    'status': submit ? 'submitted' : 'draft',
    'is_draft': !submit,
  }).eq('id', noteId);
}

/// Refresh everything a clock action can change, so My Visits, the visit
/// detail and the Clock tab all update together.
void invalidateClockState(WidgetRef ref, String scheduleId) {
  ref.invalidate(openEntryProvider);
  ref.invalidate(myVisitsProvider);
  ref.invalidate(todayEntriesProvider);
  ref.invalidate(visitProvider(scheduleId));
  ref.invalidate(visitEntriesProvider(scheduleId));
}

/// Same as [invalidateClockState], for callers that captured the
/// ProviderContainer before an await (the widget may be gone by then, and
/// the refresh must still happen).
void invalidateClockStateIn(ProviderContainer container, String scheduleId) {
  container.invalidate(openEntryProvider);
  container.invalidate(myVisitsProvider);
  container.invalidate(todayEntriesProvider);
  container.invalidate(visitProvider(scheduleId));
  container.invalidate(visitEntriesProvider(scheduleId));
}
