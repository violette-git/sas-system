// Clock tab: a big live timer while on the clock, otherwise today's
// clockable visits with Clock in buttons and today's worked total.
// Ported from app/(employee)/clock.tsx + useTimeEntries.ts.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/formatters.dart';
import '../../core/router.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'employee_repository.dart';
import 'employee_widgets.dart';

class ClockScreen extends ConsumerStatefulWidget {
  const ClockScreen({super.key});

  @override
  ConsumerState<ClockScreen> createState() => _ClockScreenState();
}

class _ClockScreenState extends ConsumerState<ClockScreen> {
  /// Schedule id being clocked in to, or 'out' while clocking out.
  String? _busy;

  Future<void> _refresh() async {
    ref.invalidate(openEntryProvider);
    ref.invalidate(myVisitsProvider(VisitRange.today));
    ref.invalidate(todayEntriesProvider);
    try {
      await ref.read(openEntryProvider.future);
    } catch (_) {
      // Error state renders from the provider.
    }
  }

  Future<void> _clockIn(Schedule s) async {
    if (_busy != null) return;
    setState(() => _busy = s.id);
    await runClockIn(context, ref, s);
    if (mounted) setState(() => _busy = null);
  }

  Future<void> _clockOut(TimeEntry entry, String? clientName) async {
    if (_busy != null) return;
    setState(() => _busy = 'out');
    await runClockOut(context, ref, entry, clientName: clientName);
    if (mounted) setState(() => _busy = null);
  }

  @override
  Widget build(BuildContext context) {
    final openAsync = ref.watch(openEntryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Clock')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: openAsync.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const SkeletonList(count: 3, height: 140),
          error: (e, _) => ScrollableFill(
            child: ErrorState(
              error: e,
              onRetry: () => ref.invalidate(openEntryProvider),
            ),
          ),
          data: (open) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding:
                const EdgeInsets.fromLTRB(Space.lg, Space.sm, Space.lg, 48),
            children: [
              ContentWidth(
                maxWidth: 640,
                child: open != null ? _clockedIn(open) : _idle(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── On the clock ────────────────────────────────────────────────────────

  Widget _clockedIn(TimeEntry open) {
    final visit = ref.watch(visitProvider(open.scheduleId)).valueOrNull;
    final s = visit?.schedule;
    final clientName = visit?.client?.name ?? s?.clientName;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(Space.xxl),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF14532D), Color(0xFF0F2A1C)],
            ),
            borderRadius: BorderRadius.circular(Radii.xl),
            border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
          ),
          child: Column(
            children: [
              const OnTheClockBadge(),
              const SizedBox(height: Space.lg),
              Text(
                clientName ?? 'Current visit',
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              if (s != null) ...[
                const SizedBox(height: 4),
                Text(
                  [
                    Fmt.timeRange(s.startTime, s.endTime),
                    if (s.serviceTypeName != null) s.serviceTypeName!,
                  ].join('  ·  '),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: Space.xl),
              LiveTicker(builder: (context, now) {
                var d = now.difference(open.clockedInAt);
                if (d.isNegative) d = Duration.zero;
                return Column(
                  children: [
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        Fmt.clock(d),
                        style: const TextStyle(
                          fontSize: 64,
                          fontWeight: FontWeight.w200,
                          letterSpacing: 2,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    const SizedBox(height: Space.lg),
                    Row(
                      children: [
                        _chip('Units', '${unitsFor(d)}'),
                        const SizedBox(width: Space.sm),
                        _chip('Hours', (d.inSeconds / 3600).toStringAsFixed(2)),
                        const SizedBox(width: Space.sm),
                        _chip('Since', Fmt.time(open.clockedInAt)),
                      ],
                    ),
                  ],
                );
              }),
              const SizedBox(height: Space.xxl),
              BigActionButton(
                label: 'Clock out',
                icon: Icons.stop_circle_outlined,
                color: AppColors.danger,
                height: 72,
                loading: _busy == 'out',
                onPressed: () => _clockOut(open, clientName),
              ),
              const SizedBox(height: Space.sm),
              TextButton.icon(
                style: TextButton.styleFrom(minimumSize: const Size(0, 48)),
                onPressed: () =>
                    context.go(Routes.employeeVisit(open.scheduleId)),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('View visit details'),
              ),
            ],
          ),
        ),
        const SizedBox(height: Space.lg),
        _todayTotalCard(),
      ],
    );
  }

  Widget _chip(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: Space.md),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(Radii.md),
        ),
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                letterSpacing: 0.8,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  // ── Not clocked in ──────────────────────────────────────────────────────

  Widget _idle() {
    final visits = ref.watch(myVisitsProvider(VisitRange.today));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _todayTotalCard(),
        const SectionHeader('Ready to clock in'),
        visits.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const Padding(
            padding: EdgeInsets.all(Space.xl),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) => AppCard(
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppColors.danger),
                const SizedBox(width: Space.md),
                Expanded(child: Text(friendlyError(e))),
                AppButton(
                  label: 'Retry',
                  compact: true,
                  variant: ButtonVariant.secondary,
                  onPressed: () =>
                      ref.invalidate(myVisitsProvider(VisitRange.today)),
                ),
              ],
            ),
          ),
          data: (list) {
            final clockable = list.where(isClockable).toList();
            if (clockable.isEmpty) {
              return EmptyState(
                icon: Icons.timer_off_outlined,
                title: list.isEmpty
                    ? 'No visits today'
                    : 'All done for today',
                message: list.isEmpty
                    ? 'Visits scheduled for today will show up here.'
                    : 'Every visit today has been completed.',
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final s in clockable) ...[
                  VisitCard(
                    schedule: s,
                    onTap: () => context.go(Routes.employeeVisit(s.id)),
                    trailing: BigActionButton(
                      label: 'Clock in',
                      icon: Icons.play_circle_outline,
                      color: AppColors.success,
                      height: 56,
                      loading: _busy == s.id,
                      onPressed: _busy != null ? null : () => _clockIn(s),
                    ),
                  ),
                  const SizedBox(height: Space.md),
                ],
              ],
            );
          },
        ),
      ],
    );
  }

  /// "Worked today" total. Ticks live when an entry is open.
  Widget _todayTotalCard() {
    final entries = ref.watch(todayEntriesProvider);
    return AppCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.accentDim,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: const Icon(Icons.schedule, color: AppColors.accentLight),
          ),
          const SizedBox(width: Space.lg),
          const Expanded(
            child: Text(
              'Worked today',
              style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
            ),
          ),
          entries.when(
            skipLoadingOnRefresh: true,
            skipLoadingOnReload: true,
            loading: () => const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            error: (e, _) => IconButton(
              tooltip: 'Retry',
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(todayEntriesProvider),
            ),
            data: (list) => LiveTicker(builder: (context, now) {
              final total = totalWorked(list, now);
              return Text(
                Fmt.minutes(total.inMinutes),
                style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.w700),
              );
            }),
          ),
        ],
      ),
    );
  }
}
