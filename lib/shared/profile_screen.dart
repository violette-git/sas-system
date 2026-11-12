// Shared profile tab for the owner and employee portals. Ported from
// src/features/profile/screens/ProfileScreen.tsx (avatar upload, language
// picker and notification toggles are not ported yet).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../core/supabase.dart';
import '../features/auth/auth_controller.dart';
import '../models/models.dart';
import 'profile/change_password_form.dart';
import 'profile/profile_repository.dart';
import 'widgets/ui.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = ref.read(profileProvider);
    _name.text = p?.fullName ?? '';
    _phone.text = p?.phone ?? '';
    _name.addListener(_onEdit);
    _phone.addListener(_onEdit);
  }

  void _onEdit() => setState(() {});

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  bool _dirty(UserProfile p) =>
      _name.text.trim() != p.fullName.trim() ||
      _phone.text.trim() != (p.phone ?? '').trim();

  Future<void> _save(UserProfile p) async {
    if (_saving) return;
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      await ProfileRepository.updateProfile(
        userId: p.id,
        fullName: _name.text,
        phone: _phone.text,
      );
      await ref.read(authProvider).refreshProfile();
      if (mounted) showSnack(context, 'Profile updated');
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _changePassword(UserProfile p) async {
    final ok = await showFormSheet<bool>(
      context,
      title: 'Change password',
      builder: (_) => ChangePasswordForm(email: p.email),
    );
    if (ok == true && mounted) showSnack(context, 'Password changed');
  }

  Future<void> _signOut() async {
    final ok = await confirmDialog(
      context,
      title: 'Sign out?',
      message: 'You will need your company code, email and password to sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await ref.read(authProvider).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    final company = ref.watch(companyProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: profile == null
          ? const SkeletonList(count: 3, height: 96)
          : ContentWidth(
              maxWidth: 640,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                    Space.lg, Space.sm, Space.lg, 48),
                children: [
                  _Header(
                    profile: profile,
                    companyLabel: profile.role == UserRole.owner
                        ? 'Platform owner'
                        : company?.label,
                  ),
                  const SectionHeader('Personal information'),
                  AppCard(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AppField(
                            controller: _name,
                            label: 'Full name',
                            prefixIcon: Icons.person_outline,
                            textCapitalization: TextCapitalization.words,
                            autofillHints: const [AutofillHints.name],
                            validator: requiredField,
                            enabled: !_saving,
                          ),
                          AppField(
                            controller: _phone,
                            label: 'Phone',
                            hint: '+1 (555) 000-0000',
                            prefixIcon: Icons.phone_outlined,
                            keyboardType: TextInputType.phone,
                            autofillHints: const [
                              AutofillHints.telephoneNumber
                            ],
                            enabled: !_saving,
                          ),
                          InfoRow(
                            icon: Icons.mail_outline,
                            label: 'Email',
                            value: profile.email,
                          ),
                          const SizedBox(height: Space.md),
                          Align(
                            alignment: Alignment.centerRight,
                            child: AppButton(
                              label: 'Save changes',
                              icon: Icons.check,
                              loading: _saving,
                              onPressed:
                                  _dirty(profile) ? () => _save(profile) : null,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SectionHeader('Security'),
                  AppCard(
                    padding: EdgeInsets.zero,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: Space.lg, vertical: Space.xs),
                      leading: const Icon(Icons.lock_outline,
                          color: AppColors.accentLight),
                      title: const Text('Change password'),
                      subtitle: const Text(
                        'Update the password you use to sign in',
                        style: TextStyle(
                            color: AppColors.textSecondary, fontSize: 12.5),
                      ),
                      trailing: const Icon(Icons.chevron_right,
                          color: AppColors.textMuted),
                      onTap: () => _changePassword(profile),
                    ),
                  ),
                  const SectionHeader('Account'),
                  AppButton(
                    label: 'Sign out',
                    icon: Icons.logout,
                    variant: ButtonVariant.danger,
                    fullWidth: true,
                    onPressed: _signOut,
                  ),
                ],
              ),
            ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.profile, this.companyLabel});
  final UserProfile profile;
  final String? companyLabel;

  @override
  Widget build(BuildContext context) {
    final name =
        profile.fullName.trim().isEmpty ? profile.email : profile.fullName;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Space.xl),
      child: Column(
        children: [
          AppAvatar(name: name, url: profile.avatarUrl, size: 84),
          const SizedBox(height: Space.md),
          Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            profile.email,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: Space.md),
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: Space.sm,
            runSpacing: Space.xs,
            children: [
              RolePill(profile.role),
              if (companyLabel != null && companyLabel!.isNotEmpty)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.business_outlined,
                        size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      companyLabel!,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
