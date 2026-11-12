// Company users (admins + employees) with search and invite. Ported from
// app/(admin)/employees.tsx and src/features/employees/hooks/useEmployees.ts.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/router.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'employees/employees_repository.dart';

class EmployeesScreen extends ConsumerStatefulWidget {
  const EmployeesScreen({super.key});

  @override
  ConsumerState<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends ConsumerState<EmployeesScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(companyUsersProvider);
    try {
      await ref.read(companyUsersProvider.future);
    } catch (_) {
      // The error state renders it.
    }
  }

  Future<void> _invite() async {
    final email = await showFormSheet<String>(
      context,
      title: 'Invite team member',
      builder: (ctx) => const _InviteForm(),
    );
    if (email != null && mounted) {
      showSnack(context, 'Invite sent to $email');
    }
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(companyUsersProvider);
    final me = ref.watch(profileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Employees')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'admin-employees-fab',
        onPressed: _invite,
        icon: const Icon(Icons.mail_outline),
        label: const Text('Invite'),
      ),
      body: ContentWidth(
        child: SizedBox(
          width: double.infinity,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    Space.lg, Space.sm, Space.lg, Space.sm),
                child: TextField(
                  controller: _search,
                  onChanged: (v) => setState(() => _query = v.trim()),
                  decoration: InputDecoration(
                    hintText: 'Search by name or email',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () {
                              _search.clear();
                              setState(() => _query = '');
                            },
                          ),
                  ),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: AsyncView<List<UserProfile>>(
                    value: usersAsync,
                    onRetry: () => ref.invalidate(companyUsersProvider),
                    data: (users) => _list(users, me?.id),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _list(List<UserProfile> users, String? myId) {
    final q = _query.toLowerCase();
    final filtered = q.isEmpty
        ? users
        : users
            .where((u) =>
                u.fullName.toLowerCase().contains(q) ||
                u.email.toLowerCase().contains(q))
            .toList();

    if (filtered.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: Space.xxl),
          users.isEmpty
              ? EmptyState(
                  icon: Icons.people_outline,
                  title: 'No team members yet',
                  message: 'Invite employees and admins to get started.',
                  action: AppButton(
                    label: 'Invite',
                    icon: Icons.mail_outline,
                    onPressed: _invite,
                  ),
                )
              : EmptyState(
                  icon: Icons.search_off,
                  title: 'No matches',
                  message: 'Nobody matches "$_query".',
                ),
        ],
      );
    }

    final activeCount = users.where((u) => u.isActive).length;
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(Space.lg, 0, Space.lg, 96),
      itemCount: filtered.length + 1,
      separatorBuilder: (_, i) =>
          i == 0 ? const SizedBox.shrink() : const SizedBox(height: Space.sm),
      itemBuilder: (context, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: Space.sm, top: Space.xs),
            child: Text(
              '${users.length} member${users.length == 1 ? '' : 's'}, $activeCount active',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textMuted),
            ),
          );
        }
        final u = filtered[i - 1];
        return _UserCard(
          user: u,
          isMe: u.id == myId,
          onTap: () => context.push(Routes.adminEmployee(u.id)),
        );
      },
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({required this.user, required this.isMe, this.onTap});
  final UserProfile user;
  final bool isMe;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = user;
    return Opacity(
      opacity: u.isActive ? 1 : 0.6,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(
            horizontal: Space.lg, vertical: Space.md),
        child: Row(
          children: [
            AppAvatar(name: u.fullName, url: u.avatarUrl),
            const SizedBox(width: Space.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isMe ? '${u.fullName} (you)' : u.fullName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    u.email,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      RolePill(u.role),
                      if (!u.isActive)
                        const Pill('Inactive', color: AppColors.danger),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

/// Invite form. Pops with the invited email on success.
class _InviteForm extends ConsumerStatefulWidget {
  const _InviteForm();

  @override
  ConsumerState<_InviteForm> createState() => _InviteFormState();
}

class _InviteFormState extends ConsumerState<_InviteForm> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  UserRole _role = UserRole.employee;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final email = _email.text.trim();
    try {
      await ref.read(employeesRepositoryProvider).invite(
            fullName: _name.text,
            email: email,
            role: _role,
          );
      invalidateEmployeeData(ref);
      if (!mounted) return;
      Navigator.pop(context, email);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showSnack(context, friendlyError(e), error: true);
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
            controller: _name,
            label: 'Full name',
            hint: 'Jane Smith',
            prefixIcon: Icons.person_outline,
            textCapitalization: TextCapitalization.words,
            validator: requiredField,
            enabled: !_saving,
          ),
          AppField(
            controller: _email,
            label: 'Email',
            hint: 'jane@company.com',
            prefixIcon: Icons.mail_outline,
            keyboardType: TextInputType.emailAddress,
            validator: emailField,
            enabled: !_saving,
          ),
          const Text(
            'Role',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: Space.sm),
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
            selected: {_role},
            onSelectionChanged:
                _saving ? null : (s) => setState(() => _role = s.first),
          ),
          const SizedBox(height: Space.sm),
          Text(
            _role == UserRole.admin
                ? 'Admins can manage employees, clients and schedules.'
                : 'Employees see their own visits and clock in and out.',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: Space.lg),
          Container(
            padding: const EdgeInsets.all(Space.md),
            decoration: BoxDecoration(
              color: AppColors.accentDim,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline,
                    size: 18, color: AppColors.accentLight),
                SizedBox(width: Space.sm),
                Expanded(
                  child: Text(
                    'They will get an email with a link to set their own password.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: Space.xl),
          AppButton(
            label: 'Send invite',
            icon: Icons.send_outlined,
            fullWidth: true,
            loading: _saving,
            onPressed: _saving ? null : _submit,
          ),
        ],
      ),
    );
  }
}
