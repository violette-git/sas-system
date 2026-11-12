// Admin schedules list. Ported from app/(admin)/schedules.tsx: date
// navigation, Day / Week view, status filter, list grouped by day.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/formatters.dart';
import '../../core/router.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'schedules/schedule_form.dart';
import 'schedules/schedule_tile.dart';
import 'schedules/schedules_repository.dart';

enum _ViewMode { day, week }

class SchedulesScreen extends ConsumerStatefulWidget {
  const SchedulesScreen({super.key});

  @override
  ConsumerState<SchedulesScreen> createState() => _SchedulesScreenState();
}

class _SchedulesScreenState extends ConsumerState<SchedulesScreen> {
  DateTime _day = startOfDay(DateTime.now());
  _ViewMode _mode = _ViewMode.day;
  ScheduleStatus? _status;

  DateRange get _range {
    if (_mode == _ViewMode.day) return (from: _day, to: addDays(_day, 1));
    final from = startOfWeek(_day);
    return (from: from, to: addDays(from, 7));
  }

  void _shift(int direction) {
    setState(() {
      _day = addDays(_day, direction * (_mode == _ViewMode.day ? 1 : 7));
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _day = startOfDay(picked));
  }

  Future<void> _refresh() async {
    final range = _range;
    ref.invalidate(schedulesInRangeProvider(range));
    try {
      await ref.read(schedulesInRangeProvider(range).future);
    } catch (_) {
      // The error state renders it.
    }
  }

  Future<void> _create() async {
    final saved = await openScheduleForm(context, defaultDate: _day);
    if (saved && mounted) showSnack(context, 'Schedule created');
  }

  String get _rangeLabel {
    final today = startOfDay(DateTime.now());
    if (_mode == _ViewMode.day) {
      if (isSameDay(_day, today)) return 'Today, ${Fmt.dateShort(_day)}';
      if (isSameDay(_day, addDays(today, 1))) {
        return 'Tomorrow, ${Fmt.dateShort(_day)}';
      }
      if (isSameDay(_day, addDays(today, -1))) {
        return 'Yesterday, ${Fmt.dateShort(_day)}';
      }
      return Fmt.dateShort(_day);
    }
    final r = _range;
    return '${Fmt.dateShort(r.from)} - ${Fmt.dateShort(addDays(r.to, -1))}';
  }

  bool get _showsToday {
    final today = startOfDay(DateTime.now());
    final r = _range;
    return !today.isBefore(r.from) && today.isBefore(r.to);
  }

  @override
  Widget build(BuildContext context) {
    final range = _range;
    final schedulesAsync = ref.watch(schedulesInRangeProvider(range));

    return Scaffold(
      appBar: AppBar(title: const Text('Schedules')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'admin-schedules-fab',
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('New schedule'),
      ),
      body: ContentWidth(
        child: SizedBox(
          width: double.infinity,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildNavigator(),
              _buildFilters(schedulesAsync.valueOrNull),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: AsyncView<List<Schedule>>(
                    value: schedulesAsync,
                    onRetry: () =>
                        ref.invalidate(schedulesInRangeProvider(range)),
                    data: _buildList,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavigator() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.sm, 0, Space.lg, Space.sm),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: Space.sm,
        runSpacing: Space.sm,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: _mode == _ViewMode.day ? 'Previous day' : 'Previous week',
                icon: const Icon(Icons.chevron_left),
                onPressed: () => _shift(-1),
              ),
              InkWell(
                borderRadius: BorderRadius.circular(Radii.md),
                onTap: _pickDate,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: Space.sm, vertical: Space.sm),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.calendar_today_outlined,
                          size: 16, color: AppColors.accentLight),
                      const SizedBox(width: Space.sm),
                      Text(
                        _rangeLabel,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
              IconButton(
                tooltip: _mode == _ViewMode.day ? 'Next day' : 'Next week',
                icon: const Icon(Icons.chevron_right),
                onPressed: () => _shift(1),
              ),
            ],
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!_showsToday)
                TextButton(
                  onPressed: () =>
                      setState(() => _day = startOfDay(DateTime.now())),
                  child: const Text('Today'),
                ),
              const SizedBox(width: Space.xs),
              SegmentedButton<_ViewMode>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: _ViewMode.day, label: Text('Day')),
                  ButtonSegment(value: _ViewMode.week, label: Text('Week')),
                ],
                selected: {_mode},
                onSelectionChanged: (s) => setState(() => _mode = s.first),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilters(List<Schedule>? all) {
    int count(ScheduleStatus? s) => all == null
        ? 0
        : (s == null ? all.length : all.where((x) => x.status == s).length);
    String label(String text, ScheduleStatus? s) =>
        all == null ? text : '$text (${count(s)})';

    final options = <(String, ScheduleStatus?)>[
      ('All', null),
      for (final s in ScheduleStatus.values) (s.label, s),
    ];
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Space.lg),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: Space.sm),
        itemBuilder: (_, i) {
          final (text, status) = options[i];
          return Center(
            child: ChoiceChip(
              label: Text(label(text, status)),
              selected: _status == status,
              onSelected: (_) => setState(() => _status = status),
            ),
          );
        },
      ),
    );
  }

  Widget _buildList(List<Schedule> all) {
    final items = _status == null
        ? all
        : all.where((s) => s.status == _status).toList();

    if (items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: Space.xxl),
          EmptyState(
            icon: Icons.event_busy_outlined,
            title: all.isEmpty ? 'No visits scheduled' : 'No matching visits',
            message: all.isEmpty
                ? (_mode == _ViewMode.day
                    ? 'Nothing on this day yet.'
                    : 'Nothing this week yet.')
                : 'Try a different status filter.',
            action: all.isEmpty
                ? AppButton(
                    label: 'Schedule a visit',
                    icon: Icons.add,
                    onPressed: _create,
                  )
                : null,
          ),
        ],
      );
    }

    // Group by local calendar day (list is already sorted by start time).
    final groups = <DateTime, List<Schedule>>{};
    for (final s in items) {
      groups.putIfAbsent(startOfDay(s.startTime), () => []).add(s);
    }
    final today = startOfDay(DateTime.now());

    final children = <Widget>[];
    groups.forEach((day, list) {
      final dayLabel = isSameDay(day, today)
          ? 'Today, ${Fmt.dateShort(day)}'
          : Fmt.dateShort(day);
      children.add(SectionHeader(
        dayLabel,
        trailing: Text(
          '${list.length} visit${list.length == 1 ? '' : 's'}',
          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
        ),
      ));
      for (final s in list) {
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: Space.sm),
          child: ScheduleListTile(
            schedule: s,
            onTap: () => context.push(Routes.adminSchedule(s.id)),
          ),
        ));
      }
    });

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(Space.lg, 0, Space.lg, 96),
      children: children,
    );
  }
}
