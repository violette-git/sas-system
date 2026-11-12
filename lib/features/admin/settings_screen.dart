// Admin settings, ported from app/(admin)/settings.tsx: company card,
// service types CRUD (useServiceTypes.ts), my account, sign out.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/password_validation.dart';
import '../../core/providers.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import '../auth/auth_controller.dart';
import 'settings/service_types_repository.dart';

/// Shown in the footer. CI can override with --dart-define=APP_VERSION=x.y.z.
const _appVersion =
    String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');

class AdminSettingsScreen extends ConsumerWidget {
  const AdminSettingsScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(serviceTypesProvider);
    try {
      await ref.read(authProvider).refreshProfile();
      await ref.read(serviceTypesProvider.future);
    } catch (_) {
      // Sections render their own error states.
    }
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final ok = await confirmDialog(
      context,
      title: 'Sign out',
      message: 'You will need your company code, email and password to sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (!ok) return;
    await ref.read(authProvider).signOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding:
              const EdgeInsets.fromLTRB(Space.lg, 0, Space.lg, Space.xxxl),
          children: [
            ContentWidth(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _CompanySection(),
                  const _ServiceTypesSection(),
                  const _AccountSection(),
                  const SizedBox(height: Space.xxl),
                  AppButton(
                    label: 'Sign out',
                    icon: Icons.logout,
                    variant: ButtonVariant.danger,
                    fullWidth: true,
                    onPressed: () => _signOut(context, ref),
                  ),
                  const SizedBox(height: Space.xxl),
                  const Center(
                    child: Text(
                      'SAS System v$_appVersion',
                      style:
                          TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Company ───────────────────────────────────────────────────────────────

class _CompanySection extends ConsumerWidget {
  const _CompanySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final company = ref.watch(companyProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader('Company'),
        if (company == null)
          const AppCard(
            child: Text('Company details are unavailable.',
                style: TextStyle(color: AppColors.textSecondary)),
          )
        else
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.admin.withValues(alpha: 0.13),
                        borderRadius: BorderRadius.circular(Radii.md),
                      ),
                      child: const Icon(Icons.business,
                          color: AppColors.admin, size: 22),
                    ),
                    const SizedBox(width: Space.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(company.label,
                              style: const TextStyle(
                                  fontSize: 17, fontWeight: FontWeight.w700)),
                          if (company.label != company.name)
                            Text(company.name,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    company.isActive
                        ? const Pill('Active', color: AppColors.success)
                        : const Pill('Inactive', color: AppColors.danger),
                  ],
                ),
                const SizedBox(height: Space.lg),
                const Text('Company access code',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: Space.xs),
                Container(
                  padding: const EdgeInsets.only(left: Space.md),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(Radii.md),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          company.accessCode.isEmpty
                              ? '-'
                              : company.accessCode,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Copy code',
                        icon: const Icon(Icons.copy_rounded,
                            size: 20, color: AppColors.accentLight),
                        onPressed: company.accessCode.isEmpty
                            ? null
                            : () async {
                                await Clipboard.setData(
                                    ClipboardData(text: company.accessCode));
                                if (context.mounted) {
                                  showSnack(context, 'Access code copied');
                                }
                              },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: Space.xs),
                const Text(
                  'Staff enter this code with their email and password to sign in.',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ── Service types ─────────────────────────────────────────────────────────

class _ServiceTypesSection extends ConsumerWidget {
  const _ServiceTypesSection();

  Future<void> _openForm(BuildContext context, WidgetRef ref,
      [ServiceType? type]) async {
    final saved = await showFormSheet<bool>(
      context,
      title: type == null ? 'New service type' : 'Edit service type',
      builder: (_) => _ServiceTypeForm(type: type),
    );
    if (saved == true) {
      ref.invalidate(serviceTypesProvider);
      if (context.mounted) {
        showSnack(context,
            type == null ? 'Service type added' : 'Service type updated');
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(serviceTypesProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          'Service types',
          trailing: TextButton.icon(
            onPressed: () => _openForm(context, ref),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add'),
          ),
        ),
        AsyncView<List<ServiceType>>(
          value: async,
          loading: const SizedBox(height: 190, child: SkeletonList(count: 2)),
          onRetry: () => ref.invalidate(serviceTypesProvider),
          data: (types) {
            if (types.isEmpty) {
              return const AppCard(
                child: Text(
                  'No service types yet. Add Behavioral Aide, Visitation Supervision, Counseling, etc.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              );
            }
            return Column(
              children: [
                for (final t in types)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Space.sm),
                    child: AppCard(
                      padding: const EdgeInsets.all(Space.md),
                      accentColor: t.isActive ? null : AppColors.textMuted,
                      onTap: () => _openForm(context, ref, t),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        t.name,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: t.isActive
                                              ? AppColors.text
                                              : AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                    if (t.shortCode?.isNotEmpty == true) ...[
                                      const SizedBox(width: Space.sm),
                                      Pill(t.shortCode!,
                                          color: AppColors.accentLight),
                                    ],
                                    if (!t.isActive) ...[
                                      const SizedBox(width: Space.sm),
                                      const Pill('Inactive',
                                          color: AppColors.textMuted),
                                    ],
                                  ],
                                ),
                                if (t.description?.isNotEmpty == true)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text(
                                      t.description!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right,
                              color: AppColors.textMuted),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _ServiceTypeForm extends ConsumerStatefulWidget {
  const _ServiceTypeForm({this.type});
  final ServiceType? type;

  @override
  ConsumerState<_ServiceTypeForm> createState() => _ServiceTypeFormState();
}

class _ServiceTypeFormState extends ConsumerState<_ServiceTypeForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name =
      TextEditingController(text: widget.type?.name ?? '');
  late final TextEditingController _code =
      TextEditingController(text: widget.type?.shortCode ?? '');
  late final TextEditingController _desc =
      TextEditingController(text: widget.type?.description ?? '');
  late bool _active = widget.type?.isActive ?? true;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _desc.dispose();
    super.dispose();
  }

  String? _orNull(TextEditingController c) {
    final v = c.text.trim();
    return v.isEmpty ? null : v;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final repo = ref.read(serviceTypesRepositoryProvider);
      final existing = widget.type;
      if (existing == null) {
        await repo.create(
          companyId: ref.read(companyIdProvider),
          name: _name.text.trim(),
          shortCode: _orNull(_code)?.toUpperCase(),
          description: _orNull(_desc),
          isActive: _active,
        );
      } else {
        await repo.update(
          existing.id,
          name: _name.text.trim(),
          shortCode: _orNull(_code)?.toUpperCase(),
          description: _orNull(_desc),
          isActive: _active,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showSnack(context, friendlyError(e), error: true);
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
            controller: _name,
            label: 'Name *',
            hint: 'e.g. Behavioral Aide',
            validator: requiredField,
            textCapitalization: TextCapitalization.words,
          ),
          AppField(
            controller: _code,
            label: 'Short code',
            hint: 'e.g. BA',
            textCapitalization: TextCapitalization.characters,
          ),
          AppField(
            controller: _desc,
            label: 'Description',
            hint: 'Optional',
            maxLines: 3,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _active,
            onChanged: (v) => setState(() => _active = v),
            title: const Text('Active'),
            subtitle: const Text(
              'Inactive service types cannot be picked for new visits or authorizations.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ),
          const SizedBox(height: Space.md),
          AppButton(
            label: widget.type == null ? 'Add service type' : 'Save changes',
            loading: _saving,
            fullWidth: true,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

// ── My account ────────────────────────────────────────────────────────────

class _AccountSection extends ConsumerWidget {
  const _AccountSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader('My account'),
        if (profile == null)
          const AppCard(
            child: Text('Not signed in.',
                style: TextStyle(color: AppColors.textSecondary)),
          )
        else
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    AppAvatar(
                        name: profile.fullName,
                        url: profile.avatarUrl,
                        size: 52),
                    const SizedBox(width: Space.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            profile.fullName.isEmpty
                                ? 'Unnamed'
                                : profile.fullName,
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(profile.email,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary)),
                          const SizedBox(height: Space.xs),
                          RolePill(profile.role),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: Space.md),
                InfoRow(
                    icon: Icons.call_outlined,
                    label: 'Phone',
                    value: profile.phone),
                const SizedBox(height: Space.md),
                Wrap(
                  spacing: Space.sm,
                  runSpacing: Space.sm,
                  children: [
                    AppButton(
                      label: 'Edit profile',
                      icon: Icons.edit_outlined,
                      variant: ButtonVariant.secondary,
                      compact: true,
                      onPressed: () async {
                        final saved = await showFormSheet<bool>(
                          context,
                          title: 'Edit profile',
                          builder: (_) => _EditProfileForm(profile: profile),
                        );
                        if (saved == true && context.mounted) {
                          showSnack(context, 'Profile updated');
                        }
                      },
                    ),
                    AppButton(
                      label: 'Change password',
                      icon: Icons.lock_outline,
                      variant: ButtonVariant.secondary,
                      compact: true,
                      onPressed: () async {
                        final saved = await showFormSheet<bool>(
                          context,
                          title: 'Change password',
                          builder: (_) => const _ChangePasswordForm(),
                        );
                        if (saved == true && context.mounted) {
                          showSnack(context, 'Password changed');
                        }
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _EditProfileForm extends ConsumerStatefulWidget {
  const _EditProfileForm({required this.profile});
  final UserProfile profile;

  @override
  ConsumerState<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends ConsumerState<_EditProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name =
      TextEditingController(text: widget.profile.fullName);
  late final TextEditingController _phone =
      TextEditingController(text: widget.profile.phone ?? '');
  late final TextEditingController _email =
      TextEditingController(text: widget.profile.email);
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final phone = _phone.text.trim();
      await sb.from('users').update({
        'full_name': _name.text.trim(),
        'phone': phone.isEmpty ? null : phone,
      }).eq('id', widget.profile.id);
      await ref.read(authProvider).refreshProfile();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showSnack(context, friendlyError(e), error: true);
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
            controller: _name,
            label: 'Full name *',
            validator: requiredField,
            prefixIcon: Icons.person_outline,
            textCapitalization: TextCapitalization.words,
            autofillHints: const [AutofillHints.name],
          ),
          AppField(
            controller: _phone,
            label: 'Phone',
            hint: '(555) 000-0000',
            keyboardType: TextInputType.phone,
            prefixIcon: Icons.call_outlined,
            autofillHints: const [AutofillHints.telephoneNumber],
          ),
          AppField(
            controller: _email,
            label: 'Email',
            prefixIcon: Icons.mail_outline,
            enabled: false,
          ),
          const SizedBox(height: Space.sm),
          AppButton(
            label: 'Save',
            loading: _saving,
            fullWidth: true,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

class _ChangePasswordForm extends StatefulWidget {
  const _ChangePasswordForm();

  @override
  State<_ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<_ChangePasswordForm> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _password.addListener(_onChanged);
    _confirm.addListener(_onChanged);
  }

  void _onChanged() => setState(() {});

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await sb.auth.updateUser(UserAttributes(password: _password.text));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showSnack(context, friendlyError(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final check = PasswordCheck(_password.text);
    final matches =
        _confirm.text.isNotEmpty && _confirm.text == _password.text;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppField(
            controller: _password,
            label: 'New password',
            obscure: _obscure,
            prefixIcon: Icons.lock_outline,
            autofillHints: const [AutofillHints.newPassword],
            suffix: IconButton(
              icon: Icon(_obscure
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
            validator: (v) => PasswordCheck(v ?? '').isValid
                ? null
                : 'Password does not meet all requirements',
          ),
          if (_password.text.isNotEmpty) ...[
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: check.score / 5,
                      minHeight: 6,
                      color: check.color,
                      backgroundColor: AppColors.border,
                    ),
                  ),
                ),
                const SizedBox(width: Space.md),
                Text(check.label,
                    style: TextStyle(
                        color: check.color,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: Space.sm),
          ],
          for (final (label, ok) in check.rules)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Icon(
                    ok ? Icons.check_circle : Icons.radio_button_unchecked,
                    size: 16,
                    color: ok ? AppColors.success : AppColors.textMuted,
                  ),
                  const SizedBox(width: Space.sm),
                  Text(label,
                      style: TextStyle(
                          fontSize: 12,
                          color: ok
                              ? AppColors.text
                              : AppColors.textSecondary)),
                ],
              ),
            ),
          const SizedBox(height: Space.md),
          AppField(
            controller: _confirm,
            label: 'Confirm new password',
            obscure: _obscure,
            prefixIcon: Icons.lock_outline,
            autofillHints: const [AutofillHints.newPassword],
            validator: (v) =>
                v == _password.text ? null : 'Passwords do not match',
            suffix: _confirm.text.isEmpty
                ? null
                : Icon(
                    matches ? Icons.check_circle : Icons.cancel_outlined,
                    color: matches ? AppColors.success : AppColors.danger,
                    size: 20,
                  ),
          ),
          const SizedBox(height: Space.sm),
          AppButton(
            label: 'Update password',
            loading: _saving,
            fullWidth: true,
            onPressed: (_saving || !check.isValid || !matches) ? null : _save,
          ),
        ],
      ),
    );
  }
}
