import 'package:flutter/material.dart';

import '../../core/password_validation.dart';
import '../../core/supabase.dart';
import '../../features/auth/auth_widgets.dart';
import '../widgets/ui.dart';
import 'profile_repository.dart';

/// Body for showFormSheet. Pops with `true` once the password is changed.
class ChangePasswordForm extends StatefulWidget {
  const ChangePasswordForm({super.key, required this.email});
  final String email;

  @override
  State<ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<ChangePasswordForm> {
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _mismatch => _confirm.text.isNotEmpty && _confirm.text != _new.text;

  bool get _canSubmit =>
      _current.text.isNotEmpty &&
      PasswordCheck(_new.text).isValid &&
      _confirm.text == _new.text;

  Future<void> _submit() async {
    if (_saving || !_canSubmit) return;
    if (_new.text == _current.text) {
      setState(() => _error = 'Choose a password different from your current one.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ProfileRepository.changePassword(
        email: widget.email,
        currentPassword: _current.text,
        newPassword: _new.text,
      );
      if (mounted) Navigator.pop(context, true);
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
    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) AuthBanner(message: _error!),
          PasswordField(
            controller: _current,
            label: 'Current password',
            autofillHints: const [AutofillHints.password],
            textInputAction: TextInputAction.next,
            onChanged: (_) => setState(() {}),
          ),
          PasswordField(
            controller: _new,
            label: 'New password',
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.next,
            onChanged: (_) => setState(() {}),
          ),
          PasswordStrengthMeter(password: _new.text),
          PasswordField(
            controller: _confirm,
            label: 'Confirm new password',
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.done,
            errorText: _mismatch ? 'Passwords do not match' : null,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: Space.sm),
          AppButton(
            label: 'Update password',
            icon: Icons.lock_reset,
            fullWidth: true,
            loading: _saving,
            onPressed: _canSubmit ? _submit : null,
          ),
        ],
      ),
    );
  }
}
