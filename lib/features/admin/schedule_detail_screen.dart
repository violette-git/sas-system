// Admin view of one visit. Ported from app/(admin)/schedule/[id].tsx and
// extended with edit, complete, delete and admin notes.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/formatters.dart';
import '../../core/router.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'schedules/schedule_form.dart';
import 'schedules/schedules_repository.dart';

class ScheduleDetailScreen extends ConsumerStatefulWidget {
  const ScheduleDetailScreen({super.key, required this.scheduleId});
  final String scheduleId;

  @override
  ConsumerState<ScheduleDetailScreen> createState() =>
      _ScheduleDetailScreenState();
}

class _ScheduleDetailScreenState extends ConsumerState<ScheduleDetailScreen> {
  final _note = TextEditingController();
  bool _busy = false;
  bool _savingNote = false;

  String get _id => widget.scheduleId;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(scheduleProvider(_id));
    ref.invalidate(scheduleTimeEntriesProvider(_id));
    ref.invalidate(scheduleVisitNotesProvider(_id));
    try {
      await Future.wait([
        ref.read(scheduleProvider(_id).future),
        ref.read(scheduleTimeEntriesProvider(_id).future),
        ref.read(scheduleVisitNotesProvider(_id).future),
      ]);
    } catch (_) {
      // Error states render it.
    }
  }

  void _leave() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.adminSchedules);
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      invalidateScheduleData(ref);
      if (mounted) showSnack(context, success);
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(Schedule s) async {
    final saved = await openScheduleForm(context, initial: s);
    if (saved && mounted) showSnack(context, 'Schedule updated');
  }

  Future<void> _complete(Schedule s, List<TimeEntry> entries) async {
    final open = entries.any((e) => e.isOpen);
    final ok = await confirmDialog(
      context,
      title: 'Mark as completed?',
      message: open
          ? '${s.employeeName ?? 'The employee'} is still clocked in. The visit will be marked completed, but the open time entry stays open.'
          : 'The visit will be marked completed.',
      confirmLabel: 'Mark completed',
    );
    if (!ok || !mounted) return;
    await _run(
      () => ref
          .read(schedulesRepositoryProvider)
          .setStatus(s.id, ScheduleStatus.completed),
      'Visit marked completed',
    );
  }

  Future<void> _cancel(Schedule s) async {
    final ok = await confirmDialog(
      context,
      title: 'Cancel visit?',
      message: 'Are you sure you want to cancel this scheduled visit?',
      confirmLabel: 'Cancel visit',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _run(
      () => ref
          .read(schedulesRepositoryProvider)
          .setStatus(s.id, ScheduleStatus.cancelled),
      'Visit cancelled',
    );
  }

  Future<void> _reopen(Schedule s) async {
    await _run(
      () => ref
          .read(schedulesRepositoryProvider)
          .setStatus(s.id, ScheduleStatus.scheduled),
      'Visit restored',
    );
  }

  Future<void> _delete(Schedule s) async {
    final ok = await confirmDialog(
      context,
      title: 'Delete visit?',
      message:
          'This permanently removes the visit and its notes. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(schedulesRepositoryProvider).delete(s.id);
      invalidateScheduleData(ref);
      if (!mounted) return;
      showSnack(context, 'Visit deleted');
      _leave();
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      showSnack(context, friendlyError(e), error: true);
    }
  }

  Future<void> _addNote() async {
    final body = _note.text.trim();
    if (body.isEmpty) return;
    setState(() => _savingNote = true);
    try {
      await ref.read(schedulesRepositoryProvider).addNote(_id, body);
      _note.clear();
      ref.invalidate(scheduleVisitNotesProvider(_id));
      if (mounted) {
        FocusScope.of(context).unfocus();
        showSnack(context, 'Note added');
      }
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _savingNote = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheduleAsync = ref.watch(scheduleProvider(_id));
    final entriesAsync = ref.watch(scheduleTimeEntriesProvider(_id));
    final notesAsync = ref.watch(scheduleVisitNotesProvider(_id));
    final schedule = scheduleAsync.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visit'),
        actions: [
          if (schedule != null)
            IconButton(
              tooltip: 'Edit',
              icon: const Icon(Icons.edit_outlined),
              onPressed: _busy ? null : () => _edit(schedule),
            ),
        ],
      ),
      body: AsyncView<Schedule?>(
        value: scheduleAsync,
        onRetry: () => ref.invalidate(scheduleProvider(_id)),
        data: (s) {
          if (s == null) {
            return EmptyState(
              icon: Icons.event_busy_outlined,
              title: 'Visit not found',
              message: 'It may have been deleted.',
              action: AppButton(
                label: 'Back to schedules',
                variant: ButtonVariant.secondary,
                onPressed: () => context.go(Routes.adminSchedules),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ContentWidth(
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                    Space.lg, Space.sm, Space.lg, Space.xxxl),
                children: [
                  _header(s),
                  const SizedBox(height: Space.lg),
                  _details(s),
                  _actions(s, entriesAsync.valueOrNull),
                  SectionHeader(
                    'Time entries',
                    trailing: _entriesTotal(entriesAsync.valueOrNull),
                  ),
                  _timeEntries(entriesAsync),
                  const SectionHeader('Visit notes'),
                  _noteComposer(),
                  const SizedBox(height: Space.md),
                  _notes(notesAsync, s),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Sections ────────────────────────────────────────────────────────────

  Widget _header(Schedule s) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ScheduleStatusPill(s.status),
        const SizedBox(height: Space.sm),
        Text(
          s.clientName ?? 'Client',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
        if (s.title != null && s.title!.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(s.title!,
              style: const TextStyle(
                  fontSize: 15, color: AppColors.textSecondary)),
        ],
        const SizedBox(height: Space.xs),
        Text(
          '${Fmt.dateShort(s.startTime)}, ${Fmt.timeRange(s.startTime, s.endTime)}',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _details(Schedule s) {
    return AppCard(
      child: Column(
        children: [
          InfoRow(
              icon: Icons.home_work_outlined,
              label: 'Client',
              value: s.clientName),
          if (s.clientAddress != null && s.clientAddress!.isNotEmpty)
            InfoRow(
                icon: Icons.place_outlined,
                label: 'Address',
                value: s.clientAddress),
          InfoRow(
              icon: Icons.person_outline,
              label: 'Employee',
              value: s.employeeName),
          InfoRow(
              icon: Icons.medical_services_outlined,
              label: 'Service',
              value: s.serviceTypeName),
          InfoRow(
              icon: Icons.calendar_today_outlined,
              label: 'Date',
              value: Fmt.date(s.startTime)),
          InfoRow(
            icon: Icons.schedule,
            label: 'Planned',
            value:
                '${Fmt.timeRange(s.startTime, s.endTime)} (${Fmt.minutes(s.plannedDuration.inMinutes)})',
          ),
        ],
      ),
    );
  }

  Widget _actions(Schedule s, List<TimeEntry>? entries) {
    final active = s.status == ScheduleStatus.scheduled ||
        s.status == ScheduleStatus.inProgress;
    // Delete only once we know there are no time entries.
    final canDelete = entries != null && entries.isEmpty;

    return Padding(
      padding: const EdgeInsets.only(top: Space.lg),
      child: Wrap(
        spacing: Space.sm,
        runSpacing: Space.sm,
        children: [
          AppButton(
            label: 'Edit',
            icon: Icons.edit_outlined,
            variant: ButtonVariant.secondary,
            compact: true,
            onPressed: _busy ? null : () => _edit(s),
          ),
          if (active)
            AppButton(
              label: 'Mark completed',
              icon: Icons.check_circle_outline,
              variant: ButtonVariant.success,
              compact: true,
              onPressed:
                  _busy ? null : () => _complete(s, entries ?? const []),
            ),
          if (active)
            AppButton(
              label: 'Cancel visit',
              icon: Icons.cancel_outlined,
              variant: ButtonVariant.secondary,
              compact: true,
              onPressed: _busy ? null : () => _cancel(s),
            ),
          if (s.status == ScheduleStatus.cancelled)
            AppButton(
              label: 'Restore',
              icon: Icons.restore,
              variant: ButtonVariant.secondary,
              compact: true,
              onPressed: _busy ? null : () => _reopen(s),
            ),
          if (canDelete)
            AppButton(
              label: 'Delete',
              icon: Icons.delete_outline,
              variant: ButtonVariant.danger,
              compact: true,
              onPressed: _busy ? null : () => _delete(s),
            ),
        ],
      ),
    );
  }

  Widget? _entriesTotal(List<TimeEntry>? entries) {
    if (entries == null || entries.isEmpty) return null;
    final total =
        entries.fold<int>(0, (sum, e) => sum + (e.durationMinutes ?? 0));
    return Text(
      'Total ${Fmt.minutes(total)}',
      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
    );
  }

  Widget _timeEntries(AsyncValue<List<TimeEntry>> value) {
    return value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      loading: () => const _InlineLoading(),
      error: (e, _) => _InlineError(
        error: e,
        onRetry: () => ref.invalidate(scheduleTimeEntriesProvider(_id)),
      ),
      data: (entries) {
        if (entries.isEmpty) {
          return const _InlineEmpty('No time entries yet.');
        }
        return AppCard(
          padding: const EdgeInsets.symmetric(
              horizontal: Space.lg, vertical: Space.sm),
          child: Column(
            children: [
              for (var i = 0; i < entries.length; i++) ...[
                if (i > 0) const Divider(),
                _TimeEntryRow(entry: entries[i]),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _noteComposer() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppField(
            controller: _note,
            label: 'Add a note',
            hint: 'Visible to admins on this visit',
            maxLines: 3,
            textCapitalization: TextCapitalization.sentences,
            enabled: !_savingNote,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: AppButton(
              label: 'Add note',
              icon: Icons.note_add_outlined,
              compact: true,
              loading: _savingNote,
              onPressed: _savingNote ? null : _addNote,
            ),
          ),
        ],
      ),
    );
  }

  Widget _notes(AsyncValue<List<VisitNote>> value, Schedule s) {
    return value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      loading: () => const _InlineLoading(),
      error: (e, _) => _InlineError(
        error: e,
        onRetry: () => ref.invalidate(scheduleVisitNotesProvider(_id)),
      ),
      data: (notes) {
        if (notes.isEmpty) return const _InlineEmpty('No notes yet.');
        return Column(
          children: [
            for (final n in notes)
              Padding(
                padding: const EdgeInsets.only(bottom: Space.sm),
                child: _NoteCard(note: n, employeeId: s.employeeId),
              ),
          ],
        );
      },
    );
  }
}

// ── Pieces ────────────────────────────────────────────────────────────────

class _TimeEntryRow extends StatelessWidget {
  const _TimeEntryRow({required this.entry});
  final TimeEntry entry;

  @override
  Widget build(BuildContext context) {
    final e = entry;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Space.sm),
      child: Row(
        children: [
          Icon(
            e.isOpen ? Icons.radio_button_checked : Icons.timer_outlined,
            size: 18,
            color: e.isOpen ? AppColors.success : AppColors.textMuted,
          ),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  e.isOpen
                      ? 'In at ${Fmt.time(e.clockedInAt)}'
                      : '${Fmt.time(e.clockedInAt)} - ${Fmt.time(e.clockedOutAt!)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  Fmt.dateShort(e.clockedInAt),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (e.isOpen)
            _LiveClock(since: e.clockedInAt)
          else
            Text(
              Fmt.minutes(e.durationMinutes ??
                  e.clockedOutAt!.difference(e.clockedInAt).inMinutes),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
        ],
      ),
    );
  }
}

/// "On the clock" pill with a ticking elapsed timer.
class _LiveClock extends StatefulWidget {
  const _LiveClock({required this.since});
  final DateTime since;

  @override
  State<_LiveClock> createState() => _LiveClockState();
}

class _LiveClockState extends State<_LiveClock> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    var elapsed = DateTime.now().difference(widget.since);
    if (elapsed.isNegative) elapsed = Duration.zero;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const Pill('On the clock', color: AppColors.success),
        const SizedBox(height: 4),
        Text(
          Fmt.clock(elapsed),
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.success,
          ),
        ),
      ],
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({required this.note, required this.employeeId});
  final VisitNote note;
  final String employeeId;

  @override
  Widget build(BuildContext context) {
    final n = note;
    // Admin-written notes keep the column default ('draft'), so only show
    // the review status for notes written by the assigned employee or once
    // they have moved past draft.
    final showStatus = n.status != 'draft' || n.authorId == employeeId;
    final statusColor = switch (n.status) {
      'approved' => AppColors.success,
      'submitted' => AppColors.info,
      'revision_requested' => AppColors.warning,
      'rejected' => AppColors.danger,
      _ => AppColors.textMuted,
    };
    final author = n.authorName ?? 'Unknown';
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppAvatar(name: author, size: 28),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(author,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (n.createdAt != null)
                      Text(
                        Fmt.dateTime(n.createdAt!),
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textMuted),
                      ),
                  ],
                ),
              ),
              if (showStatus) Pill(Fmt.titleCase(n.status), color: statusColor),
            ],
          ),
          const SizedBox(height: Space.sm),
          Text(n.body, style: const TextStyle(height: 1.4)),
        ],
      ),
    );
  }
}

class _InlineLoading extends StatelessWidget {
  const _InlineLoading();
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.all(Space.lg),
        child: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
}

class _InlineEmpty extends StatelessWidget {
  const _InlineEmpty(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => AppCard(
        child: Text(text,
            style: const TextStyle(color: AppColors.textSecondary)),
      );
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => AppCard(
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
            const SizedBox(width: Space.md),
            Expanded(
              child: Text(friendlyError(error),
                  style: const TextStyle(color: AppColors.textSecondary)),
            ),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}
