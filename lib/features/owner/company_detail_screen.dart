// Owner view of one tenant: info, status, access code, and its users.
// Adds what the Expo app was missing: owners can invite a company's first
// admin (or employees) through the invite-user edge function.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formatters.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'owner_repository.dart';
import 'owner_widgets.dart';

class OwnerCompanyDetailScreen extends ConsumerStatefulWidget {
  const OwnerCompanyDetailScreen({super.key, required this.companyId});
  final String companyId;

  @override
  ConsumerState<OwnerCompanyDetailScreen> createState() =>
      _OwnerCompanyDetailScreenState();
}

class _OwnerCompanyDetailScreenState
    extends ConsumerState<OwnerCompanyDetailScreen> {
  bool _busy = false;

  String get _id => widget.companyId;

  void _invalidateAll() {
    ref.invalidate(ownerCompanyProvider(_id));
    ref.invalidate(ownerCompanyUsersProvider(_id));
    ref.invalidate(ownerCompaniesProvider);
  }

  Future<void> _refresh() async {
    try {
      await Future.wait([
        ref.refresh(ownerCompanyProvider(_id).future),
        ref.refresh(ownerCompanyUsersProvider(_id).future),
      ]);
    } catch (_) {
      // Error states render from the providers.
    }
  }

  Future<void> _edit(Company company) async {
    final saved = await showFormSheet<bool>(
      context,
      title: 'Edit company',
      builder: (_) => CompanyForm(existing: company),
    );
    if (saved != true || !mounted) return;
    _invalidateAll();
    showSnack(context, 'Company updated');
  }

  Future<void> _toggleActive(Company company) async {
    final activate = !company.isActive;
    final ok = await confirmDialog(
      context,
      title: activate ? 'Activate company?' : 'Deactivate company?',
      message: activate
          ? '${company.label} will be able to sign in again.'
          : 'Nobody at ${company.label} will be able to sign in until you reactivate it. Their data is kept.',
      confirmLabel: activate ? 'Activate' : 'Deactivate',
      destructive: !activate,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      await OwnerRepository.setActive(company.id, activate);
      if (!mounted) return;
      _invalidateAll();
      showSnack(context,
          activate ? '${company.label} activated' : '${company.label} deactivated');
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _regenerate(Company company) async {
    final ok = await confirmDialog(
      context,
      title: 'Regenerate access code?',
      message:
          'The current code ${company.accessCode} will stop working right away. Everyone at ${company.label} will need the new code to sign in.',
      confirmLabel: 'Regenerate',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      final code = await OwnerRepository.regenerateAccessCode(company);
      if (!mounted) return;
      _invalidateAll();
      showSnack(context, 'New access code: $code');
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _invite(UserRole role) async {
    final email = await showFormSheet<String>(
      context,
      title: role == UserRole.admin ? 'Invite admin' : 'Invite user',
      builder: (_) => InviteUserForm(companyId: _id, initialRole: role),
    );
    if (email == null || !mounted) return;
    ref.invalidate(ownerCompanyUsersProvider(_id));
    ref.invalidate(ownerCompaniesProvider);
    showSnack(context, 'Invite sent to $email');
  }

  @override
  Widget build(BuildContext context) {
    final companyAsync = ref.watch(ownerCompanyProvider(_id));
    final company = companyAsync.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(company?.label ?? 'Company'),
        actions: [
          if (company != null)
            IconButton(
              tooltip: 'Edit',
              icon: const Icon(Icons.edit_outlined),
              onPressed: _busy ? null : () => _edit(company),
            ),
        ],
      ),
      body: ContentWidth(
        child: AsyncView<Company>(
          value: companyAsync,
          onRetry: () => ref.invalidate(ownerCompanyProvider(_id)),
          data: (c) => RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding:
                  const EdgeInsets.fromLTRB(Space.lg, Space.sm, Space.lg, 48),
              children: [
                _HeaderCard(company: c),
                const SectionHeader('Access code'),
                _AccessCodeCard(
                  company: c,
                  busy: _busy,
                  onRegenerate: () => _regenerate(c),
                ),
                const SectionHeader('Details'),
                AppCard(
                  child: Column(
                    children: [
                      InfoRow(
                          icon: Icons.gavel_outlined,
                          label: 'Legal name',
                          value: c.name),
                      InfoRow(
                          icon: Icons.storefront_outlined,
                          label: 'Trade name',
                          value: c.tradeName),
                      if ((c.displayName ?? '').isNotEmpty)
                        InfoRow(
                            icon: Icons.badge_outlined,
                            label: 'Display name',
                            value: c.displayName),
                      InfoRow(
                          icon: Icons.event_outlined,
                          label: 'Created',
                          value: c.createdAt == null
                              ? null
                              : Fmt.date(c.createdAt!)),
                    ],
                  ),
                ),
                const SizedBox(height: Space.md),
                AppButton(
                  label: c.isActive ? 'Deactivate company' : 'Activate company',
                  icon: c.isActive
                      ? Icons.pause_circle_outline
                      : Icons.play_circle_outline,
                  variant: c.isActive
                      ? ButtonVariant.secondary
                      : ButtonVariant.success,
                  fullWidth: true,
                  onPressed: _busy ? null : () => _toggleActive(c),
                ),
                _UsersSection(
                  companyId: _id,
                  onInvite: _invite,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.company});
  final Company company;

  @override
  Widget build(BuildContext context) {
    final c = company;
    final hasTrade = (c.tradeName ?? '').trim().isNotEmpty;
    return AppCard(
      accentColor: c.isActive ? AppColors.owner : AppColors.textMuted,
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.owner.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(Radii.lg),
            ),
            child: const Icon(Icons.business, color: AppColors.owner, size: 26),
          ),
          const SizedBox(width: Space.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasTrade ? c.tradeName! : c.name,
                  style: const TextStyle(
                      fontSize: 19, fontWeight: FontWeight.w700),
                ),
                if (hasTrade) ...[
                  const SizedBox(height: 2),
                  Text(c.name,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 13)),
                ],
                const SizedBox(height: Space.sm),
                ActivePill(c.isActive),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AccessCodeCard extends StatelessWidget {
  const _AccessCodeCard({
    required this.company,
    required this.busy,
    required this.onRegenerate,
  });
  final Company company;
  final bool busy;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SelectableText(
            company.accessCode,
            style: monoStyle.copyWith(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: AppColors.accentLight,
              letterSpacing: 3,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Staff enter this code with their email and password to sign in.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: Space.lg),
          Wrap(
            spacing: Space.sm,
            runSpacing: Space.sm,
            children: [
              AppButton(
                label: 'Copy',
                icon: Icons.copy_rounded,
                compact: true,
                variant: ButtonVariant.secondary,
                onPressed: () => copyAccessCode(context, company.accessCode),
              ),
              AppButton(
                label: 'Regenerate',
                icon: Icons.autorenew,
                compact: true,
                variant: ButtonVariant.ghost,
                onPressed: busy ? null : onRegenerate,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UsersSection extends ConsumerWidget {
  const _UsersSection({required this.companyId, required this.onInvite});
  final String companyId;
  final void Function(UserRole role) onInvite;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(ownerCompanyUsersProvider(companyId));
    final users = usersAsync.valueOrNull;
    final hasAdmin =
        users?.any((u) => u.role == UserRole.admin && u.isActive) ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          users == null ? 'Users' : 'Users (${users.length})',
          trailing: PopupMenuButton<UserRole>(
            tooltip: 'Invite',
            onSelected: onInvite,
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: UserRole.admin,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.admin_panel_settings_outlined),
                  title: Text('Invite admin'),
                ),
              ),
              PopupMenuItem(
                value: UserRole.employee,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.badge_outlined),
                  title: Text('Invite employee'),
                ),
              ),
            ],
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.person_add_alt_1_outlined,
                      size: 16, color: AppColors.accentLight),
                  SizedBox(width: 4),
                  Text('Invite',
                      style: TextStyle(
                          color: AppColors.accentLight,
                          fontWeight: FontWeight.w600,
                          fontSize: 13)),
                ],
              ),
            ),
          ),
        ),
        if (users != null && !hasAdmin)
          Padding(
            padding: const EdgeInsets.only(bottom: Space.md),
            child: AppCard(
              color: AppColors.warning.withValues(alpha: 0.08),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.info_outline,
                          size: 18, color: AppColors.warning),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'This company has no admin yet',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Invite someone to manage schedules, clients and staff. They will get an email to set their password.',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: Space.md),
                  AppButton(
                    label: 'Invite admin',
                    icon: Icons.person_add_alt_1_outlined,
                    compact: true,
                    onPressed: () => onInvite(UserRole.admin),
                  ),
                ],
              ),
            ),
          ),
        usersAsync.when(
          skipLoadingOnRefresh: true,
          skipLoadingOnReload: true,
          loading: () => const Padding(
            padding: EdgeInsets.all(Space.xl),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
          error: (e, _) => ErrorState(
            error: e,
            onRetry: () => ref.invalidate(ownerCompanyUsersProvider(companyId)),
          ),
          data: (list) => list.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: Space.lg),
                  child: Text(
                    'No users yet.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                )
              : Column(
                  children: [
                    for (final u in list) ...[
                      _UserTile(user: u),
                      const SizedBox(height: Space.sm),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user});
  final UserProfile user;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: user.isActive ? 1 : 0.55,
      child: AppCard(
        padding: const EdgeInsets.symmetric(
            horizontal: Space.lg, vertical: Space.md),
        child: Row(
          children: [
            AppAvatar(name: user.fullName, url: user.avatarUrl, size: 38),
            const SizedBox(width: Space.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.fullName.isEmpty ? user.email : user.fullName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user.email,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 12.5),
                  ),
                ],
              ),
            ),
            const SizedBox(width: Space.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                RolePill(user.role),
                if (!user.isActive) ...[
                  const SizedBox(height: 4),
                  const Pill('Inactive', color: AppColors.textMuted),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
