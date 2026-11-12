// KPIs and lists for the admin dashboard. Ported from app/(admin)/index.tsx
// (charts / analytics come in a later wave).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';
import '../schedules/schedules_repository.dart';

class AdminDashboardData {
  const AdminDashboardData({
    required this.today,
    required this.inProgressNow,
    required this.activeEmployees,
    required this.activeClients,
    required this.minutesThisWeek,
    required this.lateVisits,
  });

  /// Today's schedules (all statuses), sorted by start time.
  final List<Schedule> today;

  /// Visits currently in progress (any start date).
  final int inProgressNow;
  final int activeEmployees;
  final int activeClients;

  /// Sum of closed time_entries.duration_minutes since the week start.
  final int minutesThisWeek;

  /// Scheduled visits whose start time has passed with no clock-in.
  final List<Schedule> lateVisits;
}

final adminDashboardProvider =
    FutureProvider.autoDispose<AdminDashboardData>((ref) async {
  ref.watch(adminDataVersionProvider);
  final repo = ref.watch(schedulesRepositoryProvider);
  final companyId = ref.watch(companyIdProvider);
  final now = DateTime.now();
  final dayStart = startOfDay(now);

  // Postgrest builders only send their request once awaited, so wrap them
  // in an async call to start every query in parallel.
  Future<int> count(Future<List<Map<String, dynamic>>> query) async =>
      (await query).length;

  final todayF = repo.inRange(dayStart, addDays(dayStart, 1));
  final minutesF = repo.minutesLoggedSince(startOfWeek(now));
  final inProgressF = count(sb
      .from('schedules')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', ScheduleStatus.inProgress.db));
  final employeesF = count(sb
      .from('users')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'employee')
      .eq('is_active', true));
  final clientsF = count(sb
      .from('clients')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true));

  // Every future, including today's schedules, is awaited by this one
  // Future.wait, so a failure in any of them is never left unhandled.
  final results = await Future.wait<Object>(
      [todayF, minutesF, inProgressF, employeesF, clientsF]);
  final today = results[0] as List<Schedule>;
  final minutes = results[1] as int;
  final inProgress = results[2] as int;
  final employees = results[3] as int;
  final clients = results[4] as int;

  // Late = still "scheduled", start time passed, and no time entry at all.
  var lateVisits = today
      .where((s) =>
          s.status == ScheduleStatus.scheduled && s.startTime.isBefore(now))
      .toList();
  if (lateVisits.isNotEmpty) {
    final rows = await sb
        .from('time_entries')
        .select('schedule_id')
        .inFilter('schedule_id', lateVisits.map((s) => s.id).toList());
    final clockedIn = rows.map((r) => r['schedule_id'] as String).toSet();
    lateVisits = lateVisits.where((s) => !clockedIn.contains(s.id)).toList();
  }

  return AdminDashboardData(
    today: today,
    inProgressNow: inProgress,
    activeEmployees: employees,
    activeClients: clients,
    minutesThisWeek: minutes,
    lateVisits: lateVisits,
  );
});
