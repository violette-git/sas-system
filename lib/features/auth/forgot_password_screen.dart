// Ported from app/(auth)/forgot-password.tsx.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router.dart';
import '../../shared/widgets/ui.dart';
import 'auth_controller.dart';
import 'auth_widgets.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _backToLogin() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.login);
    }
  }

  Future<void> _submit() async {
    if (_loading) return;
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final err = await ref.read(authProvider).sendPasswordReset(_email.text);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _error = err;
      _sent = err == null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final back = Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: _backToLogin,
        icon: const Icon(Icons.arrow_back, size: 18),
        label: const Text('Back to sign in'),
        style: TextButton.styleFrom(foregroundColor: AppColors.textSecondary),
      ),
    );

    if (_sent) {
      return AuthScaffold(
        top: back,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: AppColors.successDim,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.mark_email_read_outlined,
                    size: 36, color: AppColors.success),
              ),
            ),
            const SizedBox(height: Space.lg),
            const Text(
              'Check your email',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: Space.sm),
            Text.rich(
              TextSpan(
                style: const TextStyle(
                    color: AppColors.textSecondary, height: 1.4),
                children: [
                  const TextSpan(
                      text: 'If an account exists for '),
                  TextSpan(
                    text: _email.text.trim(),
                    style: const TextStyle(
                        color: AppColors.text, fontWeight: FontWeight.w600),
                  ),
                  const TextSpan(
                      text:
                          ', you will receive a link to reset your password shortly.'),
                ],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: Space.xxl),
            AppButton(
              label: 'Back to sign in',
              fullWidth: true,
              onPressed: _backToLogin,
            ),
            const SizedBox(height: Space.sm),
            TextButton(
              onPressed: () => setState(() => _sent = false),
              child: const Text('Did not get it? Try again'),
            ),
          ],
        ),
      );
    }

    return AuthScaffold(
      top: back,
      title: 'Forgot password',
      subtitle:
          'Enter the email you sign in with and we will send you a link to reset your password.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) AuthBanner(message: _error!),
            AppField(
              controller: _email,
              label: 'Email',
              hint: 'you@company.com',
              prefixIcon: Icons.mail_outline,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              validator: emailField,
              enabled: !_loading,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: Space.sm),
            AppButton(
              label: 'Send reset link',
              icon: Icons.send_outlined,
              fullWidth: true,
              loading: _loading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
