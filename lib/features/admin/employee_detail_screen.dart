// Admin view of one team member: profile, contact, role, activation,
// upcoming visits and hours this week.

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
import 'employees/employees_repository.dart';
import 'schedules/schedule_tile.dart';
import 'schedules/schedules_repository.dart';

class EmployeeDetailScreen extends ConsumerStatefulWidget {
  const EmployeeDetailScreen({super.key, required this.employeeId});
  final String employeeId;

  @override
  ConsumerState<EmployeeDetailScreen> createState() =>
      _EmployeeDetailScreenState();
}

class _EmployeeDetailScreenState extends ConsumerState<EmployeeDetailScreen> {
  bool _busy = false;

  String get _id => widget.employeeId;

  Future<void> _refresh() async {
    ref.invalidate(employeeProvider(_id));
    ref.invalidate(employeeUpcomingSchedulesProvider(_id));
    ref.invalidate(employeeWeekMinutesProvider(_id));
    try {
      await Future.wait([
        ref.read(employeeProvider(_id).future),
        ref.read(employeeUpcomingSchedulesProvider(_id).future),
        ref.read(employeeWeekMinutesProvider(_id).future),
      ]);
    } catch (_) {
      // Error states render it.
    }
  }

  Future<void> _launch(Uri uri) async {
    try {
      final ok = await launchUrl(uri);
      if (!ok && mounted) {
        showSnack(context, 'Could not open ${uri.path}', error: true);
      }
    } catch (_) {
      if (mounted) {
        showSnack(context, 'Could not open ${uri.path}', error: true);
      }
    }
  }

  Future<void> _changeRole(UserProfile u, UserRole role) async {
    if (role == u.role) return;
    final toAdmin = role == UserRole.admin;
    final ok = await confirmDialog(
      context,
      title: toAdmin ? 'Make admin?' : 'Make employee?',
      message: toAdmin
          ? '${u.fullName} will be able to manage employees, clients and schedules.'
          : '${u.fullName} will lose admin access and only see their own visits.',
      confirmLabel: toAdmin ? 'Make admin' : 'Make employee',
    );
    if (!ok || !mounted) return;
    await _run(
      () => ref.read(employeesRepositoryProvider).setRole(u.id, role),
      'Role updated',
    );
  }

  Future<void> _toggleActive(UserProfile u) async {
    final deactivate = u.isActive;
    final ok = await confirmDialog(
      context,
      title: deactivate ? 'Deactivate ${u.fullName}?' : 'Activate ${u.fullName}?',
      message: deactivate
          ? 'They will not be able to sign in, and they will no longer appear when scheduling visits. Existing visits are kept.'
          : 'They will be able to sign in again and can be assigned visits.',
      confirmLabel: deactivate ? 'Deactivate' : 'Activate',
      destructive: deactivate,
    );
    if (!ok || !mounted) return;
    await _run(
      () => ref.read(employeesRepositoryProvider).setActive(u.id, !u.isActive),
      deactivate ? 'Deactivated' : 'Activated',
    );
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      invalidateEmployeeData(ref);
      if (mounted) showSnack(context, success);
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(employeeProvider(_id));
    final minutesAsync = ref.watch(employeeWeekMinutesProvider(_id));
    final upcomingAsync = ref.watch(employeeUpcomingSchedulesProvider(_id));
    final myId = ref.watch(profileProvider)?.id;

    return Scaffold(
      appBar: AppBar(title: const Text('Team member')),
      body: AsyncView<UserProfile?>(
        value: userAsync,
        onRetry: () => ref.invalidate(employeeProvider(_id)),
        data: (u) {
          if (u == null) {
            return EmptyState(
              icon: Icons.person_off_outlined,
              title: 'Not found',
              message: 'This person is not part of your company.',
              action: AppButton(
                label: 'Back to employees',
                variant: ButtonVariant.secondary,
                onPressed: () => context.go(Routes.adminEmployees),
              ),
            );
          }
          final isMe = u.id == myId;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ContentWidth(
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                    Space.lg, Space.sm, Space.lg, Space.xxxl),
                children: [
                  _header(u, isMe),
                  const SizedBox(height: Space.lg),
                  _stats(minutesAsync, upcomingAsync),
                  const SectionHeader('Contact'),
                  _contact(u),
                  const SectionHeader('Access'),
                  _access(u, isMe),
                  const SectionHeader('Upcoming visits'),
                  _upcoming(upcomingAsync),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Sections ────────────────────────────────────────────────────────────

  Widget _header(UserProfile u, bool isMe) {
    return Row(
      children: [
        AppAvatar(name: u.fullName, url: u.avatarUrl, size: 64),
        const SizedBox(width: Space.lg),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isMe ? '${u.fullName} (you)' : u.fullName,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  RolePill(u.role),
                  u.isActive
                      ? const Pill('Active', color: AppColors.success)
                      : const Pill('Inactive', color: AppColors.danger),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stats(AsyncValue<int> minutes, AsyncValue<List<Schedule>> upcoming) {
    final upcomingCount = upcoming.valueOrNull
        ?.where((s) => s.status == ScheduleStatus.scheduled)
        .length;
    return StatGrid(children: [
      StatCard(
        icon: Icons.timer_outlined,
        label: 'Hours this week',
        value: minutes.hasValue ? Fmt.minutes(minutes.valueOrNull ?? 0) : '...',
        color: AppColors.pink,
      ),
      StatCard(
        icon: Icons.event_note_outlined,
        label: 'Upcoming visits',
        value: upcomingCount == null ? '...' : '$upcomingCount',
        color: AppColors.info,
      ),
    ]);
  }

  Widget _contact(UserProfile u) {
    final phone = u.phone?.trim() ?? '';
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: Space.xs),
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.mail_outline, color: AppColors.textMuted),
            title: Text(u.email.isEmpty ? '-' : u.email),
            subtitle: const Text('Email'),
            trailing: u.email.isEmpty
                ? null
                : const Icon(Icons.open_in_new,
                    size: 18, color: AppColors.textMuted),
            onTap: u.email.isEmpty
                ? null
                : () => _launch(Uri(scheme: 'mailto', path: u.email)),
          ),
          const Divider(indent: Space.lg, endIndent: Space.lg),
          ListTile(
            leading:
                const Icon(Icons.phone_outlined, color: AppColors.textMuted),
            title: Text(phone.isEmpty ? 'No phone on file' : phone),
            subtitle: const Text('Phone'),
            trailing: phone.isEmpty
                ? null
                : const Icon(Icons.call_outlined,
                    size: 18, color: AppColors.textMuted),
            onTap: phone.isEmpty
                ? null
                : () => _launch(Uri(scheme: 'tel', path: phone)),
          ),
        ],
      ),
    );
  }

  Widget _access(UserProfile u, bool isMe) {
    final roleEditable =
        !isMe && (u.role == UserRole.admin || u.role == UserRole.employee);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Role',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: Space.sm),
          if (roleEditable)
            SegmentedButton<UserRole>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(
                  value: UserRole.employee,
                  label: Text('Employee'),
                  icon: Icon(Icons.badge_outlined),
                ),
                ButtonSegment(
                  value: UserRole.admin,
                  label: Text('Admin'),
                  icon: Icon(Icons.admin_panel_settings_outlined),
                ),
              ],
              selected: {u.role},
              onSelectionChanged:
                  _busy ? null : (s) => _changeRole(u, s.first),
            )
          else
            Row(
              children: [
                RolePill(u.role),
                if (isMe) ...[
                  const SizedBox(width: Space.sm),
                  const Expanded(
                    child: Text(
                      'You cannot change your own role.',
                      style:
                          TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ),
                ],
              ],
            ),
          const SizedBox(height: Space.lg),
          const Divider(),
          const SizedBox(height: Space.md),
          if (isMe)
            const Text(
              'You cannot deactivate your own account.',
              style: TextStyle(fontSize: 13, color: AppColors.textMuted),
            )
          else
            Row(
              children: [
                Expanded(
                  child: Text(
                    u.isActive
                        ? 'Active: can sign in and be assigned visits.'
                        : 'Inactive: cannot sign in.',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                  ),
                ),
                const SizedBox(width: Space.md),
                AppButton(
                  label: u.isActive ? 'Deactivate' : 'Activate',
                  icon: u.isActive
                      ? Icons.pause_circle_outline
                      : Icons.play_circle_outline,
                  compact: true,
                  variant: u.isActive
                      ? ButtonVariant.danger
                      : ButtonVariant.success,
                  loading: _busy,
                  onPressed: _busy ? null : () => _toggleActive(u),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _upcoming(AsyncValue<List<Schedule>> value) {
    return value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      loading: () => const Padding(
        padding: EdgeInsets.all(Space.lg),
        child: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
      error: (e, _) => AppCard(
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
            const SizedBox(width: Space.md),
            Expanded(
              child: Text(friendlyError(e),
                  style: const TextStyle(color: AppColors.textSecondary)),
            ),
            TextButton(
              onPressed: () =>
                  ref.invalidate(employeeUpcomingSchedulesProvider(_id)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return const AppCard(
            child: Text('No upcoming visits.',
                style: TextStyle(color: AppColors.textSecondary)),
          );
        }
        return Column(
          children: [
            for (final s in list)
              Padding(
                padding: const EdgeInsets.only(bottom: Space.sm),
                child: ScheduleListTile(
                  schedule: s,
                  showEmployee: false,
                  showDate: true,
                  onTap: () => context.go(Routes.adminSchedule(s.id)),
                ),
              ),
          ],
        );
      },
    );
  }
}
