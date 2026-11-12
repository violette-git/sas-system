// Employee home: the signed-in caregiver's visits.
// Ported from app/(employee)/index.tsx + useMySchedules.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/formatters.dart';
import '../../core/providers.dart';
import '../../core/router.dart';
import '../../shared/widgets/ui.dart';
import 'employee_repository.dart';
import 'employee_widgets.dart';

class MyVisitsScreen extends ConsumerStatefulWidget {
  const MyVisitsScreen({super.key});

  @override
  ConsumerState<MyVisitsScreen> createState() => _MyVisitsScreenState();
}

class _MyVisitsScreenState extends ConsumerState<MyVisitsScreen> {
  VisitRange _range = VisitRange.today;

  Future<void> _refresh() async {
    ref.invalidate(myVisitsProvider(_range));
    ref.invalidate(openEntryProvider);
    try {
      await ref.read(myVisitsProvider(_range).future);
    } catch (_) {
      // The error state renders from the provider itself.
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    final firstName = (profile?.fullName ?? '').trim().split(' ').first;
    final visits = ref.watch(myVisitsProvider(_range));
    final openEntry = ref.watch(openEntryProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Visits'),
      ),
      body: ContentWidth(
        maxWidth: 720,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  Space.lg, Space.sm, Space.lg, Space.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    firstName.isEmpty ? 'Hello' : 'Hello, $firstName',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    Fmt.dateShort(DateTime.now()),
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: Space.lg),
                  RangeSegments(
                    value: _range,
                    onChanged: (r) => setState(() => _range = r),
                  ),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: visits.when(
                  skipLoadingOnRefresh: true,
                  skipLoadingOnReload: true,
                  loading: () => const SkeletonList(count: 4, height: 120),
                  error: (e, _) => ScrollableFill(
                    child: ErrorState(
                      error: e,
                      onRetry: () => ref.invalidate(myVisitsProvider(_range)),
                    ),
                  ),
                  data: (list) {
                    if (list.isEmpty) {
                      return ScrollableFill(child: _empty());
                    }
                    return ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(
                          Space.lg, 0, Space.lg, Space.xxxl),
                      itemCount: list.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: Space.md),
                      itemBuilder: (context, i) {
                        final s = list[i];
                        final open = (openEntry != null &&
                                openEntry.scheduleId == s.id)
                            ? openEntry
                            : null;
                        return VisitCard(
                          schedule: s,
                          openEntry: open,
                          showDate: _range != VisitRange.today,
                          onTap: () => context.go(Routes.employeeVisit(s.id)),
                        );
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _empty() => switch (_range) {
        VisitRange.today => const EmptyState(
            icon: Icons.event_available_outlined,
            title: 'No visits today',
            message: 'Pull down to refresh, or check Upcoming.',
          ),
        VisitRange.upcoming => const EmptyState(
            icon: Icons.calendar_month_outlined,
            title: 'Nothing scheduled',
            message:
                'Visits for the next $upcomingDays days will appear here.',
          ),
        VisitRange.past => const EmptyState(
            icon: Icons.history,
            title: 'No past visits',
            message: 'Visits from the last $pastDays days will appear here.',
          ),
      };
}
