// One visit for the signed-in caregiver: client info, call / directions,
// clock in or out, time entries and visit notes.
// Ported from app/(employee)/visit/[id].tsx.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/formatters.dart';
import '../../core/providers.dart';
import '../../core/router.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'employee_repository.dart';
import 'employee_widgets.dart';

class VisitDetailScreen extends ConsumerStatefulWidget {
  const VisitDetailScreen({super.key, required this.scheduleId});
  final String scheduleId;

  @override
  ConsumerState<VisitDetailScreen> createState() => _VisitDetailScreenState();
}

class _VisitDetailScreenState extends ConsumerState<VisitDetailScreen> {
  bool _busy = false;

  String get _id => widget.scheduleId;

  Future<void> _refresh() async {
    ref.invalidate(visitProvider(_id));
    ref.invalidate(visitEntriesProvider(_id));
    ref.invalidate(visitNotesProvider(_id));
    ref.invalidate(openEntryProvider);
    try {
      await ref.read(visitProvider(_id).future);
    } catch (_) {
      // Error state renders from the provider.
    }
  }

  Future<void> _clockIn(Schedule s) async {
    setState(() => _busy = true);
    await runClockIn(context, ref, s);
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _clockOut(TimeEntry entry, String? clientName) async {
    setState(() => _busy = true);
    await runClockOut(context, ref, entry, clientName: clientName);
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _launch(Uri uri, String what) async {
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) showSnack(context, 'Could not open $what.', error: true);
    } catch (_) {
      if (mounted) showSnack(context, 'Could not open $what.', error: true);
    }
  }

  void _call(String phone) {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    _launch(Uri(scheme: 'tel', path: digits), 'the dialer');
  }

  void _directions(String address) {
    _launch(
      Uri.https('www.google.com', '/maps/search/', {
        'api': '1',
        'query': address,
      }),
      'maps',
    );
  }

  Future<void> _openNoteSheet({VisitNote? existing}) async {
    final result = await showFormSheet<String>(
      context,
      title: existing == null ? 'Add visit note' : 'Edit draft note',
      builder: (ctx) => _NoteForm(
        initialBody: existing?.body ?? '',
        onSave: (body, submit) async {
          if (existing == null) {
            await createVisitNote(
              scheduleId: _id,
              authorId: ref.read(userIdProvider),
              companyId: ref.read(companyIdProvider),
              body: body,
              submit: submit,
            );
          } else {
            await updateVisitNote(
                noteId: existing.id, body: body, submit: submit);
          }
        },
      ),
    );
    if (result == null || !mounted) return;
    ref.invalidate(visitNotesProvider(_id));
    showSnack(context, result == 'submitted' ? 'Note submitted' : 'Draft saved');
  }

  @override
  Widget build(BuildContext context) {
    final visit = ref.watch(visitProvider(_id));

    return Scaffold(
      appBar: AppBar(title: const Text('Visit')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: visit.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const SkeletonList(count: 4, height: 110),
          error: (e, _) => ScrollableFill(
            child: ErrorState(
              error: e,
              onRetry: () => ref.invalidate(visitProvider(_id)),
            ),
          ),
          data: (detail) {
            if (detail == null) {
              return ScrollableFill(
                child: EmptyState(
                  icon: Icons.event_busy_outlined,
                  title: 'Visit not found',
                  message: 'It may have been removed or reassigned.',
                  action: AppButton(
                    label: 'Back to my visits',
                    variant: ButtonVariant.secondary,
                    onPressed: () => context.go(Routes.employeeVisits),
                  ),
                ),
              );
            }
            return _body(detail);
          },
        ),
      ),
    );
  }

  Widget _body(VisitDetail detail) {
    final s = detail.schedule;
    final client = detail.client;
    final clientName = client?.name ?? s.clientName ?? 'Client';
    final address = (client != null && client.address.isNotEmpty)
        ? client.address
        : (s.clientAddress ?? '');
    final phone = client?.contactPhone?.trim() ?? '';
    final clientNotes = client?.notes?.trim() ?? '';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(Space.lg, Space.sm, Space.lg, 48),
      children: [
        ContentWidth(
          maxWidth: 720,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Header ─────────────────────────────────────────────
              AppCard(
                accentColor: scheduleStatusColor(s.status),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            Fmt.dateShort(s.startTime),
                            style: const TextStyle(
                                color: AppColors.textSecondary, fontSize: 14),
                          ),
                        ),
                        ScheduleStatusPill(s.status),
                      ],
                    ),
                    const SizedBox(height: Space.sm),
                    Text(
                      clientName,
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: Space.sm),
                    Text(
                      Fmt.timeRange(s.startTime, s.endTime),
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accentLight,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Planned ${Fmt.minutes(s.plannedDuration.inMinutes)}'
                      '${s.serviceTypeName != null ? '  ·  ${s.serviceTypeName}' : ''}',
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: Space.lg),

              // ── Primary action ─────────────────────────────────────
              _actionSection(s, clientName),

              // ── Client ─────────────────────────────────────────────
              const SectionHeader('Client'),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    InfoRow(
                        icon: Icons.person_outline,
                        label: 'Name',
                        value: clientName),
                    InfoRow(
                        icon: Icons.place_outlined,
                        label: 'Address',
                        value: address),
                    InfoRow(
                        icon: Icons.contact_phone_outlined,
                        label: 'Contact',
                        value: client?.contactName),
                    InfoRow(
                        icon: Icons.phone_outlined,
                        label: 'Phone',
                        value: phone.isEmpty ? null : phone),
                    const SizedBox(height: Space.md),
                    Row(
                      children: [
                        Expanded(
                          child: TileActionButton(
                            label: 'Call',
                            icon: Icons.call,
                            color: AppColors.success,
                            onPressed: phone.isEmpty ? null : () => _call(phone),
                          ),
                        ),
                        const SizedBox(width: Space.md),
                        Expanded(
                          child: TileActionButton(
                            label: 'Directions',
                            icon: Icons.directions,
                            onPressed: address.isEmpty
                                ? null
                                : () => _directions(address),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (s.notes != null && s.notes!.trim().isNotEmpty) ...[
                const SectionHeader('Visit instructions'),
                AppCard(child: Text(s.notes!)),
              ],
              if (clientNotes.isNotEmpty) ...[
                const SectionHeader('Client notes'),
                AppCard(child: Text(clientNotes)),
              ],

              // ── Time entries ───────────────────────────────────────
              _entriesSection(),

              // ── Notes ──────────────────────────────────────────────
              _notesSection(s),
            ],
          ),
        ),
      ],
    );
  }

  Widget _actionSection(Schedule s, String clientName) {
    final openAsync = ref.watch(openEntryProvider);
    if (openAsync.isLoading && !openAsync.hasValue) {
      return const SizedBox(
        height: 64,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (openAsync.hasError && !openAsync.hasValue) {
      return AppCard(
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger),
            const SizedBox(width: Space.md),
            const Expanded(child: Text('Could not check your clock status.')),
            AppButton(
              label: 'Retry',
              compact: true,
              variant: ButtonVariant.secondary,
              onPressed: () => ref.invalidate(openEntryProvider),
            ),
          ],
        ),
      );
    }
    final open = openAsync.valueOrNull;

    // On the clock for this visit.
    if (open != null && open.scheduleId == s.id) {
      return Container(
        padding: const EdgeInsets.all(Space.xl),
        decoration: BoxDecoration(
          color: AppColors.successDim,
          borderRadius: BorderRadius.circular(Radii.xl),
          border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
        ),
        child: Column(
          children: [
            const OnTheClockBadge(),
            const SizedBox(height: Space.md),
            ElapsedText(
              since: open.clockedInAt,
              style: const TextStyle(
                fontSize: 44,
                fontWeight: FontWeight.w300,
                letterSpacing: 2,
              ),
            ),
            Text(
              'Since ${Fmt.time(open.clockedInAt)}',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: Space.lg),
            BigActionButton(
              label: 'Clock out',
              icon: Icons.stop_circle_outlined,
              color: AppColors.danger,
              loading: _busy,
              onPressed: () => _clockOut(open, clientName),
            ),
          ],
        ),
      );
    }

    // On the clock somewhere else.
    if (open != null) {
      return AppCard(
        accentColor: AppColors.warning,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'You are on the clock at another visit.',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            const Text(
              'Clock out of it before clocking in here.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: Space.md),
            BigActionButton(
              label: 'Go to active visit',
              icon: Icons.arrow_forward,
              color: AppColors.accent,
              height: 56,
              onPressed: () =>
                  context.go(Routes.employeeVisit(open.scheduleId)),
            ),
          ],
        ),
      );
    }

    if (isClockable(s)) {
      return BigActionButton(
        label: 'Clock in',
        icon: Icons.play_circle_outline,
        color: AppColors.success,
        loading: _busy,
        onPressed: () => _clockIn(s),
      );
    }

    final (icon, text, color) = s.status == ScheduleStatus.completed
        ? (Icons.check_circle_outline, 'Visit completed', AppColors.success)
        : (Icons.block, 'Visit cancelled', AppColors.textMuted);
    return AppCard(
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: Space.md),
          Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _entriesSection() {
    final entries = ref.watch(visitEntriesProvider(_id));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader('Time entries'),
        entries.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const Padding(
            padding: EdgeInsets.all(Space.lg),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) => _inlineError(
              e, () => ref.invalidate(visitEntriesProvider(_id))),
          data: (list) {
            if (list.isEmpty) {
              return const AppCard(
                child: Text(
                  'No time recorded yet.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              );
            }
            return LiveTicker(builder: (context, now) {
              final total = totalWorked(list, now);
              return AppCard(
                padding: const EdgeInsets.symmetric(
                    horizontal: Space.lg, vertical: Space.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final e in list) _entryRow(e, now),
                    const Divider(height: Space.lg),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Text('Total',
                                style: TextStyle(fontWeight: FontWeight.w700)),
                          ),
                          Text(
                            '${Fmt.minutes(total.inMinutes)}  ·  ${unitsFor(total)} units',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            });
          },
        ),
      ],
    );
  }

  Widget _entryRow(TimeEntry e, DateTime now) {
    final out = e.clockedOutAt;
    final dur = out == null
        ? now.difference(e.clockedInAt)
        : (e.durationMinutes != null
            ? Duration(minutes: e.durationMinutes!)
            : out.difference(e.clockedInAt));
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(
            out == null ? Icons.timer : Icons.timer_off_outlined,
            size: 20,
            color: out == null ? AppColors.success : AppColors.textMuted,
          ),
          const SizedBox(width: Space.md),
          Expanded(
            child: Text(
              out == null
                  ? 'In ${Fmt.time(e.clockedInAt)}  ·  on the clock'
                  : '${Fmt.time(e.clockedInAt)} to ${Fmt.time(out)}',
              style: const TextStyle(fontSize: 14),
            ),
          ),
          Text(
            out == null ? Fmt.clock(dur) : Fmt.minutes(dur.inMinutes),
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: out == null ? AppColors.success : AppColors.text,
            ),
          ),
        ],
      ),
    );
  }

  Widget _notesSection(Schedule s) {
    final notes = ref.watch(visitNotesProvider(_id));
    // Same rule as the Expo screen: notes once the visit has started.
    final canAdd = s.status == ScheduleStatus.inProgress ||
        s.status == ScheduleStatus.completed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader('My visit notes'),
        notes.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const Padding(
            padding: EdgeInsets.all(Space.lg),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) =>
              _inlineError(e, () => ref.invalidate(visitNotesProvider(_id))),
          data: (list) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (list.isEmpty)
                const AppCard(
                  child: Text(
                    'No notes yet.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              for (final n in list) ...[
                _noteCard(n),
                const SizedBox(height: Space.md),
              ],
            ],
          ),
        ),
        const SizedBox(height: Space.md),
        if (canAdd)
          BigActionButton(
            label: 'Add note',
            icon: Icons.edit_note,
            color: AppColors.accent,
            height: 56,
            onPressed: () => _openNoteSheet(),
          )
        else
          const Text(
            'You can add notes once the visit has started.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted),
          ),
      ],
    );
  }

  Widget _noteCard(VisitNote n) {
    final isDraft = n.status == 'draft';
    return AppCard(
      onTap: isDraft ? () => _openNoteSheet(existing: n) : null,
      accentColor: _noteStatusColor(n.status),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(Fmt.titleCase(n.status), color: _noteStatusColor(n.status)),
              const Spacer(),
              if (n.createdAt != null)
                Text(
                  Fmt.dateTime(n.createdAt!),
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textMuted),
                ),
            ],
          ),
          const SizedBox(height: Space.sm),
          Text(n.body.isEmpty ? '(empty)' : n.body,
              style: const TextStyle(fontSize: 15, height: 1.4)),
          if (isDraft) ...[
            const SizedBox(height: Space.sm),
            const Text(
              'Tap to edit or submit',
              style: TextStyle(fontSize: 12, color: AppColors.accentLight),
            ),
          ],
        ],
      ),
    );
  }

  Widget _inlineError(Object e, VoidCallback retry) {
    return AppCard(
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger),
          const SizedBox(width: Space.md),
          Expanded(child: Text(friendlyError(e))),
          AppButton(
            label: 'Retry',
            compact: true,
            variant: ButtonVariant.secondary,
            onPressed: retry,
          ),
        ],
      ),
    );
  }
}

Color _noteStatusColor(String status) => switch (status) {
      'submitted' => AppColors.info,
      'approved' => AppColors.success,
      'revision_requested' => AppColors.warning,
      'rejected' => AppColors.danger,
      _ => AppColors.textMuted,
    };

// ── Note form (inside showFormSheet) ──────────────────────────────────────

class _NoteForm extends StatefulWidget {
  const _NoteForm({required this.initialBody, required this.onSave});
  final String initialBody;

  /// Writes the note. Throws on failure.
  final Future<void> Function(String body, bool submit) onSave;

  @override
  State<_NoteForm> createState() => _NoteFormState();
}

class _NoteFormState extends State<_NoteForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _body =
      TextEditingController(text: widget.initialBody);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _body.dispose();
    super.dispose();
  }

  Future<void> _save(bool submit) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(_body.text.trim(), submit);
      if (mounted) Navigator.pop(context, submit ? 'submitted' : 'draft');
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = friendlyError(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppField(
            controller: _body,
            label: 'What happened during the visit?',
            hint: 'Care provided, client condition, anything the office should know',
            maxLines: 8,
            textCapitalization: TextCapitalization.sentences,
            validator: requiredField,
            enabled: !_saving,
          ),
          if (_error != null) ...[
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
            const SizedBox(height: Space.md),
          ],
          BigActionButton(
            label: 'Submit note',
            icon: Icons.send,
            color: AppColors.accent,
            height: 56,
            loading: _saving,
            onPressed: () => _save(true),
          ),
          const SizedBox(height: Space.md),
          SizedBox(
            height: 52,
            child: AppButton(
              label: 'Save as draft',
              variant: ButtonVariant.secondary,
              fullWidth: true,
              onPressed: _saving ? null : () => _save(false),
            ),
          ),
        ],
      ),
    );
  }
}
