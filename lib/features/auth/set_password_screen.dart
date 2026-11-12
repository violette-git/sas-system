// Ported from app/(auth)/set-password.tsx. Reached from an invite or
// password recovery email link. On success AuthController clears
// needsPasswordSetup and the router redirects to the user's portal.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/password_validation.dart';
import '../../shared/widgets/ui.dart';
import 'auth_controller.dart';
import 'auth_widgets.dart';

class SetPasswordScreen extends ConsumerStatefulWidget {
  const SetPasswordScreen({super.key});

  @override
  ConsumerState<SetPasswordScreen> createState() => _SetPasswordScreenState();
}

class _SetPasswordScreenState extends ConsumerState<SetPasswordScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _mismatch =>
      _confirm.text.isNotEmpty && _confirm.text != _password.text;

  bool get _canSubmit =>
      PasswordCheck(_password.text).isValid &&
      _confirm.text.isNotEmpty &&
      _confirm.text == _password.text;

  Future<void> _submit() async {
    if (_loading || !_canSubmit) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    final err = await ref.read(authProvider).setPassword(_password.text);
    if (!mounted) return;
    if (err != null) {
      setState(() {
        _loading = false;
        _error = err;
      });
      return;
    }
    // The router redirect replaces this screen.
    setState(() => _loading = false);
    showSnack(context, 'Password saved. Welcome!');
  }

  Future<void> _signOut() async {
    await ref.read(authProvider).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(authProvider).profile;
    final name = profile?.fullName.trim() ?? '';
    final greeting = name.isEmpty ? 'Welcome!' : 'Welcome, $name!';

    return AuthScaffold(
      title: 'Set your password',
      subtitle: '$greeting Choose a secure password to finish setting up your account.',
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) AuthBanner(message: _error!),
            PasswordField(
              controller: _password,
              label: 'New password',
              hint: 'Create a password',
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() {}),
            ),
            PasswordStrengthMeter(password: _password.text),
            PasswordField(
              controller: _confirm,
              label: 'Confirm password',
              hint: 'Re-enter your password',
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.done,
              errorText: _mismatch ? 'Passwords do not match' : null,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: Space.sm),
            AppButton(
              label: 'Save password',
              icon: Icons.check,
              fullWidth: true,
              loading: _loading,
              onPressed: _canSubmit ? _submit : null,
            ),
            const SizedBox(height: Space.md),
            TextButton(
              onPressed: _loading ? null : _signOut,
              style:
                  TextButton.styleFrom(foregroundColor: AppColors.textSecondary),
              child: const Text('Not you? Sign out'),
            ),
          ],
        ),
      ),
    );
  }
}
