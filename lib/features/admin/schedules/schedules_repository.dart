// Data access for admin schedules, time entries and visit notes.
// Ported from src/features/schedules/hooks/useSchedules.ts,
// src/features/time-entries/hooks/useTimeEntries.ts and
// src/features/visit-notes/hooks/useVisitNotes.ts.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';

// ── Date helpers (local time, DST safe) ───────────────────────────────────

DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

DateTime addDays(DateTime d, int n) => DateTime(d.year, d.month, d.day + n);

/// Sunday-based week, like the Expo app's week strip.
DateTime startOfWeek(DateTime d) {
  final s = startOfDay(d);
  return addDays(s, -(s.weekday % 7));
}

bool isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

String _iso(DateTime d) => d.toUtc().toIso8601String();

/// Same joins as Schedule.select but without service_types.short_code,
/// which is not created by any SQL file in the repo. Used only as a
/// fallback when the database rejects the canonical select.
const _scheduleSelectFallback =
    '*, users!schedules_employee_id_fkey(full_name), clients(name, address_line1, city, state), service_types(name)';

Future<T> _withScheduleSelect<T>(Future<T> Function(String select) run) async {
  try {
    return await run(Schedule.select);
  } on PostgrestException catch (e) {
    if (e.message.contains('short_code')) return run(_scheduleSelectFallback);
    rethrow;
  }
}

// ── Inputs ────────────────────────────────────────────────────────────────

class ScheduleInput {
  const ScheduleInput({
    required this.employeeId,
    required this.clientId,
    required this.start,
    required this.end,
    this.serviceTypeId,
    this.title,
  });

  final String employeeId;
  final String clientId;
  final String? serviceTypeId;
  final String? title;
  final DateTime start;
  final DateTime end;

  /// Note: `notes` is intentionally not written (not a guaranteed column).
  Map<String, dynamic> toJson() => {
        'employee_id': employeeId,
        'client_id': clientId,
        'service_type_id': serviceTypeId,
        'title': (title == null || title!.trim().isEmpty) ? null : title!.trim(),
        'start_time': _iso(start),
        'end_time': _iso(end),
      };
}

typedef DateRange = ({DateTime from, DateTime to});

// ── Repository ────────────────────────────────────────────────────────────

class SchedulesRepository {
  SchedulesRepository({required this.companyId, required this.userId});

  final String companyId;
  final String userId;

  /// Schedules whose start_time is in [from, to).
  Future<List<Schedule>> inRange(DateTime from, DateTime to,
      {String? employeeId}) async {
    final rows = await _withScheduleSelect<List<Map<String, dynamic>>>((select) {
      var q = sb
          .from('schedules')
          .select(select)
          .eq('company_id', companyId)
          .gte('start_time', _iso(from))
          .lt('start_time', _iso(to));
      if (employeeId != null) q = q.eq('employee_id', employeeId);
      return q.order('start_time', ascending: true);
    });
    return rows.map(Schedule.fromJson).toList();
  }

  Future<Schedule?> byId(String id) async {
    final row = await _withScheduleSelect<Map<String, dynamic>?>(
      (select) =>
          sb.from('schedules').select(select).eq('id', id).maybeSingle(),
    );
    return row == null ? null : Schedule.fromJson(row);
  }

  /// Upcoming (from the start of today), non-cancelled visits for one
  /// employee.
  Future<List<Schedule>> upcomingForEmployee(String employeeId,
      {int limit = 25}) async {
    final from = startOfDay(DateTime.now());
    final rows = await _withScheduleSelect<List<Map<String, dynamic>>>((select) => sb
        .from('schedules')
        .select(select)
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .neq('status', ScheduleStatus.cancelled.db)
        .gte('start_time', _iso(from))
        .order('start_time', ascending: true)
        .limit(limit));
    return rows.map(Schedule.fromJson).toList();
  }

  /// Non-cancelled schedules for [employeeId] that overlap [start, end).
  Future<List<Schedule>> conflicts({
    required String employeeId,
    required DateTime start,
    required DateTime end,
    String? excludeId,
  }) async {
    final rows = await _withScheduleSelect<List<Map<String, dynamic>>>((select) {
      var q = sb
          .from('schedules')
          .select(select)
          .eq('company_id', companyId)
          .eq('employee_id', employeeId)
          .neq('status', ScheduleStatus.cancelled.db)
          .lt('start_time', _iso(end))
          .gt('end_time', _iso(start));
      if (excludeId != null) q = q.neq('id', excludeId);
      return q.order('start_time', ascending: true);
    });
    return rows.map(Schedule.fromJson).toList();
  }

  Future<void> create(ScheduleInput input) async {
    await sb.from('schedules').insert({
      ...input.toJson(),
      'company_id': companyId,
      'created_by': userId,
      'status': ScheduleStatus.scheduled.db,
    });
  }

  Future<void> update(String id, ScheduleInput input) async {
    await sb.from('schedules').update(input.toJson()).eq('id', id);
  }

  Future<void> setStatus(String id, ScheduleStatus status) async {
    await sb.from('schedules').update({'status': status.db}).eq('id', id);
  }

  /// Deletes a schedule only when it has no time entries.
  Future<void> delete(String id) async {
    final entries = await sb
        .from('time_entries')
        .select('id')
        .eq('schedule_id', id)
        .limit(1);
    if (entries.isNotEmpty) {
      throw Exception(
          'This visit has time entries and cannot be deleted. Cancel it instead.');
    }
    await sb.from('schedules').delete().eq('id', id);
  }

  Future<List<TimeEntry>> timeEntries(String scheduleId) async {
    final rows = await sb
        .from('time_entries')
        .select()
        .eq('schedule_id', scheduleId)
        .order('clocked_in_at', ascending: true);
    return rows.map(TimeEntry.fromJson).toList();
  }

  Future<List<VisitNote>> visitNotes(String scheduleId) async {
    // visit_notes has two FKs to users (author_id, reviewed_by), so the
    // join must name the author constraint.
    final rows = await sb
        .from('visit_notes')
        .select('*, users!visit_notes_author_id_fkey(full_name)')
        .eq('schedule_id', scheduleId)
        .order('created_at', ascending: false);
    return rows.map(VisitNote.fromJson).toList();
  }

  /// Only the base-schema columns are written; status keeps its default.
  Future<void> addNote(String scheduleId, String body) async {
    await sb.from('visit_notes').insert({
      'schedule_id': scheduleId,
      'author_id': userId,
      'company_id': companyId,
      'body': body.trim(),
    });
  }

  /// Total closed minutes logged since [from] (optionally for one employee).
  Future<int> minutesLoggedSince(DateTime from, {String? employeeId}) async {
    var q = sb
        .from('time_entries')
        .select('duration_minutes')
        .eq('company_id', companyId)
        .gte('clocked_in_at', _iso(from));
    if (employeeId != null) q = q.eq('employee_id', employeeId);
    final rows = await q;
    var total = 0;
    for (final r in rows) {
      total += (r['duration_minutes'] as num?)?.toInt() ?? 0;
    }
    return total;
  }

  /// Active clients for pickers (kept here so this feature does not depend
  /// on the clients feature).
  Future<List<Client>> activeClients() async {
    final rows = await sb
        .from('clients')
        .select()
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
    return rows.map(Client.fromJson).toList();
  }

  Future<List<ServiceType>> activeServiceTypes() async {
    final rows = await sb
        .from('service_types')
        .select()
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
    return rows.map(ServiceType.fromJson).toList();
  }
}

// ── Providers ─────────────────────────────────────────────────────────────

final schedulesRepositoryProvider =
    Provider.autoDispose<SchedulesRepository>((ref) => SchedulesRepository(
          companyId: ref.watch(companyIdProvider),
          userId: ref.watch(userIdProvider),
        ));

final schedulesInRangeProvider =
    FutureProvider.autoDispose.family<List<Schedule>, DateRange>(
  (ref, range) =>
      ref.watch(schedulesRepositoryProvider).inRange(range.from, range.to),
);

final scheduleProvider = FutureProvider.autoDispose.family<Schedule?, String>(
  (ref, id) => ref.watch(schedulesRepositoryProvider).byId(id),
);

final scheduleTimeEntriesProvider =
    FutureProvider.autoDispose.family<List<TimeEntry>, String>(
  (ref, id) => ref.watch(schedulesRepositoryProvider).timeEntries(id),
);

final scheduleVisitNotesProvider =
    FutureProvider.autoDispose.family<List<VisitNote>, String>(
  (ref, id) => ref.watch(schedulesRepositoryProvider).visitNotes(id),
);

final employeeUpcomingSchedulesProvider =
    FutureProvider.autoDispose.family<List<Schedule>, String>(
  (ref, employeeId) =>
      ref.watch(schedulesRepositoryProvider).upcomingForEmployee(employeeId),
);

/// Minutes an employee has logged since the start of this week.
final employeeWeekMinutesProvider =
    FutureProvider.autoDispose.family<int, String>(
  (ref, employeeId) => ref.watch(schedulesRepositoryProvider).minutesLoggedSince(
        startOfWeek(DateTime.now()),
        employeeId: employeeId,
      ),
);

final schedulePickerClientsProvider =
    FutureProvider.autoDispose<List<Client>>(
  (ref) => ref.watch(schedulesRepositoryProvider).activeClients(),
);

final activeServiceTypesProvider =
    FutureProvider.autoDispose<List<ServiceType>>(
  (ref) => ref.watch(schedulesRepositoryProvider).activeServiceTypes(),
);

/// Bumped after admin writes so long-lived screens in other tabs (the
/// dashboard) refetch without importing every feature's providers.
final adminDataVersionProvider = StateProvider<int>((ref) => 0);

/// Call after any schedule write so every list and detail refreshes.
void invalidateScheduleData(WidgetRef ref) {
  ref.read(adminDataVersionProvider.notifier).state++;
  ref.invalidate(schedulesInRangeProvider);
  ref.invalidate(scheduleProvider);
  ref.invalidate(employeeUpcomingSchedulesProvider);
}
