// Admin home. Ported from app/(admin)/index.tsx: greeting, KPI cards,
// today's visits and visits that need attention. Charts / analytics are a
// later wave.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/formatters.dart';
import '../../core/providers.dart';
import '../../core/router.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'dashboard/dashboard_repository.dart';
import 'schedules/schedule_tile.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(adminDashboardProvider);
    try {
      await ref.read(adminDashboardProvider.future);
    } catch (_) {
      // The error state renders it.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(adminDashboardProvider);
    final profile = ref.watch(profileProvider);
    final company = ref.watch(companyProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: ContentWidth(
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
                Space.lg, Space.sm, Space.lg, Space.xxxl),
            children: [
              _Greeting(
                companyLabel: company?.label,
                name: profile?.fullName ?? '',
              ),
              const SizedBox(height: Space.xl),
              ...dashboardAsync.when<List<Widget>>(
                skipLoadingOnRefresh: true,
                skipLoadingOnReload: true,
                loading: () => [const _DashboardSkeleton()],
                error: (e, _) => [
                  ErrorState(
                    error: e,
                    onRetry: () => ref.invalidate(adminDashboardProvider),
                  ),
                ],
                data: (d) => _content(context, d),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, AdminDashboardData d) {
    final visibleToday =
        d.today.where((s) => s.status != ScheduleStatus.cancelled).toList();
    final lateIds = d.late.map((s) => s.id).toSet();

    return [
      StatGrid(children: [
        StatCard(
          icon: Icons.event_note_outlined,
          label: "Today's visits",
          value: '${visibleToday.length}',
          color: AppColors.info,
          onTap: () => context.go(Routes.adminSchedules),
        ),
        StatCard(
          icon: Icons.play_circle_outline,
          label: 'In progress now',
          value: '${d.inProgressNow}',
          color: AppColors.warning,
        ),
        StatCard(
          icon: Icons.people_outline,
          label: 'Active employees',
          value: '${d.activeEmployees}',
          color: AppColors.admin,
          onTap: () => context.go(Routes.adminEmployees),
        ),
        StatCard(
          icon: Icons.home_work_outlined,
          label: 'Active clients',
          value: '${d.activeClients}',
          color: AppColors.accentLight,
          onTap: () => context.go(Routes.adminClients),
        ),
        StatCard(
          icon: Icons.timer_outlined,
          label: 'Hours logged this week',
          value: _hours(d.minutesThisWeek),
          color: AppColors.pink,
        ),
      ]),
      if (d.late.isNotEmpty) ...[
        SectionHeader(
          'Needs attention',
          trailing: Pill('${d.late.length} late', color: AppColors.danger),
        ),
        for (final s in d.late)
          Padding(
            padding: const EdgeInsets.only(bottom: Space.sm),
            child: ScheduleListTile(
              schedule: s,
              accentColor: AppColors.danger,
              trailing: Pill(_lateBy(s.startTime), color: AppColors.danger),
              onTap: () => context.go(Routes.adminSchedule(s.id)),
            ),
          ),
      ],
      SectionHeader(
        'Today',
        trailing: TextButton(
          onPressed: () => context.go(Routes.adminSchedules),
          child: const Text('View all'),
        ),
      ),
      if (visibleToday.isEmpty)
        AppCard(
          child: Row(
            children: [
              const Icon(Icons.wb_sunny_outlined,
                  color: AppColors.textMuted, size: 22),
              const SizedBox(width: Space.md),
              const Expanded(
                child: Text(
                  'No visits scheduled for today.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
              AppButton(
                label: 'Schedule',
                icon: Icons.add,
                compact: true,
                variant: ButtonVariant.secondary,
                onPressed: () => context.go(Routes.adminSchedules),
              ),
            ],
          ),
        )
      else
        for (final s in visibleToday)
          Padding(
            padding: const EdgeInsets.only(bottom: Space.sm),
            child: ScheduleListTile(
              schedule: s,
              accentColor: lateIds.contains(s.id) ? AppColors.danger : null,
              onTap: () => context.go(Routes.adminSchedule(s.id)),
            ),
          ),
    ];
  }

  static String _hours(int minutes) {
    if (minutes == 0) return '0h';
    final h = minutes / 60;
    return h >= 10 ? '${h.round()}h' : '${h.toStringAsFixed(1)}h';
  }

  static String _lateBy(DateTime start) {
    final mins = DateTime.now().difference(start).inMinutes;
    return 'Late ${Fmt.minutes(mins < 1 ? 1 : mins)}';
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.companyLabel, required this.name});
  final String? companyLabel;
  final String name;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final part = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    final first = name.trim().split(RegExp(r'\s+')).first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (companyLabel != null && companyLabel!.isNotEmpty)
          Text(
            companyLabel!.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.admin,
            ),
          ),
        const SizedBox(height: 2),
        Text(
          first.isEmpty ? part : '$part, $first',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(
          Fmt.date(DateTime.now()),
          style: const TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    // SkeletonList is itself a ListView, so give it a fixed height here.
    return const SizedBox(
      height: 480,
      child: SkeletonList(count: 5, height: 84),
    );
  }
}
