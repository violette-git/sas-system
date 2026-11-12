// Shared building blocks for the employee portal screens: big thumb-sized
// buttons, a 1s ticker for live timers, the visit card, and the clock in /
// clock out flows (confirm, write, snack, refresh).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formatters.dart';
import '../../core/providers.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'employee_repository.dart';

// ── Live ticker ───────────────────────────────────────────────────────────

/// Rebuilds its builder once a second with the current time. The timer is
/// cancelled in dispose.
class LiveTicker extends StatefulWidget {
  const LiveTicker({super.key, required this.builder});
  final Widget Function(BuildContext context, DateTime now) builder;

  @override
  State<LiveTicker> createState() => _LiveTickerState();
}

class _LiveTickerState extends State<LiveTicker> {
  Timer? _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _now);
}

/// Elapsed time since [since], as 00:00:00, ticking every second.
class ElapsedText extends StatelessWidget {
  const ElapsedText({super.key, required this.since, this.style});
  final DateTime since;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return LiveTicker(builder: (context, now) {
      var d = now.difference(since);
      if (d.isNegative) d = Duration.zero;
      return Text(
        Fmt.clock(d),
        style: (style ?? const TextStyle()).copyWith(
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      );
    });
  }
}

// ── Buttons ───────────────────────────────────────────────────────────────

/// Large, full-width action button sized for a thumb (64px tall).
class BigActionButton extends StatelessWidget {
  const BigActionButton({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    this.onPressed,
    this.loading = false,
    this.height = 64,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onPressed;
  final bool loading;
  final double height;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || loading;
    return Opacity(
      opacity: disabled && !loading ? 0.45 : 1,
      child: SizedBox(
        width: double.infinity,
        height: height,
        child: Material(
          color: color,
          borderRadius: BorderRadius.circular(Radii.xl),
          child: InkWell(
            borderRadius: BorderRadius.circular(Radii.xl),
            onTap: disabled ? null : onPressed,
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 26,
                      height: 26,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.5, color: Colors.white),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, color: Colors.white, size: 26),
                        const SizedBox(width: Space.md),
                        Text(
                          label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Square-ish secondary action (Call, Directions) with a 56px target.
class TileActionButton extends StatelessWidget {
  const TileActionButton({
    super.key,
    required this.label,
    required this.icon,
    this.onPressed,
    this.color = AppColors.accentLight,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onPressed == null ? 0.45 : 1,
      child: Material(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(Radii.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.lg),
          onTap: onPressed,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.lg),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: color, size: 22),
                  const SizedBox(width: Space.sm),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Segmented control ─────────────────────────────────────────────────────

/// Today / Upcoming / Past switcher with 48px tall segments.
class RangeSegments extends StatelessWidget {
  const RangeSegments({super.key, required this.value, required this.onChanged});
  final VisitRange value;
  final ValueChanged<VisitRange> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          for (final r in VisitRange.values)
            Expanded(
              child: _Segment(
                label: r.label,
                selected: r == value,
                onTap: () => onChanged(r),
              ),
            ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AppColors.accent : Colors.transparent,
        borderRadius: BorderRadius.circular(Radii.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: onTap,
          child: SizedBox(
            height: 44,
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Visit card ────────────────────────────────────────────────────────────

/// Green "On the clock" badge for an open time entry.
class OnTheClockBadge extends StatelessWidget {
  const OnTheClockBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.successDim,
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 8, color: AppColors.success),
          SizedBox(width: 6),
          Text(
            'On the clock',
            style: TextStyle(
              color: AppColors.success,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class VisitCard extends StatelessWidget {
  const VisitCard({
    super.key,
    required this.schedule,
    required this.onTap,
    this.openEntry,
    this.showDate = false,
    this.trailing,
  });

  final Schedule schedule;
  final VoidCallback onTap;

  /// The open time entry for this visit, if the employee is on the clock.
  final TimeEntry? openEntry;
  final bool showDate;

  /// Optional extra content under the card body (e.g. a Clock in button).
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final s = schedule;
    final onClock = openEntry != null;
    return AppCard(
      onTap: onTap,
      accentColor: onClock ? AppColors.success : scheduleStatusColor(s.status),
      color: onClock ? const Color(0xFF13251B) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  showDate
                      ? '${Fmt.dateShort(s.startTime)}  ·  ${Fmt.timeRange(s.startTime, s.endTime)}'
                      : Fmt.timeRange(s.startTime, s.endTime),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentLight,
                  ),
                ),
              ),
              ScheduleStatusPill(s.status),
            ],
          ),
          const SizedBox(height: Space.sm),
          Text(
            s.clientName ?? 'Client',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          if (s.clientAddress != null && s.clientAddress!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.place_outlined,
                    size: 16, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    s.clientAddress!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ],
          if (s.serviceTypeName != null) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.medical_services_outlined,
                    size: 16, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    s.serviceTypeName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ],
          if (onClock) ...[
            const SizedBox(height: Space.md),
            Row(
              children: [
                const OnTheClockBadge(),
                const Spacer(),
                ElapsedText(
                  since: openEntry!.clockedInAt,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
          ],
          if (trailing != null) ...[
            const SizedBox(height: Space.md),
            trailing!,
          ],
        ],
      ),
    );
  }
}

// ── Pull to refresh helpers ───────────────────────────────────────────────

/// Makes a non-list state (empty / error) scrollable so RefreshIndicator
/// still works on it.
class ScrollableFill extends StatelessWidget {
  const ScrollableFill({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: c.maxHeight),
          child: Center(child: child),
        ),
      );
    });
  }
}

// ── Clock actions ─────────────────────────────────────────────────────────

/// Clock in flow shared by the detail and Clock screens. Returns true on
/// success. Shows its own snacks and refreshes every clock-related provider.
Future<bool> runClockIn(
  BuildContext context,
  WidgetRef ref,
  Schedule schedule,
) async {
  // Captured before any await: the refresh below must run even if this
  // widget is gone by the time the write finishes.
  final container = ProviderScope.containerOf(context, listen: false);
  final today = startOfToday();
  final start = schedule.startTime;
  final isToday = start.year == today.year &&
      start.month == today.month &&
      start.day == today.day;
  if (!isToday) {
    final ok = await confirmDialog(
      context,
      title: 'Not a visit for today',
      message:
          'This visit is scheduled for ${Fmt.dateShort(start)} at ${Fmt.time(start)}. Clock in now anyway?',
      confirmLabel: 'Clock in',
    );
    if (!ok || !context.mounted) return false;
  }

  var success = false;
  try {
    final uid = ref.read(userIdProvider);
    final cid = ref.read(companyIdProvider);
    // GPS / geofence check goes here in a later wave; pass lat/lon through.
    await clockIn(scheduleId: schedule.id, employeeId: uid, companyId: cid);
    success = true;
    if (context.mounted) {
      showSnack(context, 'Clocked in to ${schedule.clientName ?? 'visit'}');
    }
  } catch (e) {
    if (context.mounted) showSnack(context, friendlyError(e), error: true);
  } finally {
    invalidateClockStateIn(container, schedule.id);
  }
  return success;
}

/// Clock out flow: confirms first, then writes and refreshes.
Future<bool> runClockOut(
  BuildContext context,
  WidgetRef ref,
  TimeEntry entry, {
  String? clientName,
}) async {
  // Captured before any await, same reason as in runClockIn.
  final container = ProviderScope.containerOf(context, listen: false);
  final worked = DateTime.now().difference(entry.clockedInAt);
  final ok = await confirmDialog(
    context,
    title: 'Clock out?',
    message:
        'End your time${clientName == null ? '' : ' at $clientName'}? You have been on the clock for ${Fmt.minutes(worked.inMinutes)}.',
    confirmLabel: 'Clock out',
    destructive: true,
  );
  if (!ok || !context.mounted) return false;

  var success = false;
  try {
    await clockOut(entry: entry);
    success = true;
    if (context.mounted) showSnack(context, 'Clocked out. Visit completed.');
  } catch (e) {
    if (context.mounted) showSnack(context, friendlyError(e), error: true);
  } finally {
    invalidateClockStateIn(container, entry.scheduleId);
  }
  return success;
}
