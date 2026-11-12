// Ported from app/(auth)/login.tsx + src/features/auth/hooks/useSignIn.ts.
// The sign-in logic itself lives in AuthController.signIn; on success the
// router redirect sends the user to their portal.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/env.dart';
import '../../core/router.dart';
import '../../shared/widgets/ui.dart';
import 'auth_controller.dart';
import 'auth_widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  SignInError? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    // Clear a field's server error as soon as the user edits that field.
    _code.addListener(() => _clearFor(SignInField.accessCode));
    _email.addListener(() => _clearFor(SignInField.email));
    _password.addListener(() => _clearFor(SignInField.password));
  }

  void _clearFor(SignInField field) {
    if (_error != null && _error!.field == field) {
      setState(() => _error = null);
    }
  }

  @override
  void dispose() {
    _code.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  String? _errorFor(SignInField field) =>
      _error != null && _error!.field == field ? _error!.message : null;

  Future<void> _submit() async {
    if (_loading) return;
    FocusScope.of(context).unfocus();
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _loading = true);
    final err = await ref.read(authProvider).signIn(
          accessCode: _code.text,
          email: _email.text,
          password: _password.text,
        );
    if (!mounted) return;
    setState(() {
      _loading = false;
      _error = err;
    });
    // Success: AuthController notifies and the router redirects.
  }

  @override
  Widget build(BuildContext context) {
    final general = _errorFor(SignInField.general);

    return AuthScaffold(
      title: 'Welcome back',
      subtitle: 'Sign in to your account',
      top: Env.isConfigured
          ? null
          : const AuthBanner(
              color: AppColors.warning,
              icon: Icons.warning_amber_rounded,
              message:
                  'This build is not configured. SUPABASE_URL and SUPABASE_ANON_KEY must be provided with --dart-define, so sign in will not work.',
            ),
      child: Form(
        key: _formKey,
        child: AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (general != null) AuthBanner(message: general),
              AppField(
                controller: _code,
                label: 'Company code',
                hint: 'e.g. ACME-A1B2',
                prefixIcon: Icons.business_outlined,
                textCapitalization: TextCapitalization.characters,
                errorText: _errorFor(SignInField.accessCode),
                enabled: !_loading,
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 0, 4, Space.md),
                child: Text(
                  'Platform owners can leave the company code blank.',
                  style:
                      TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ),
              AppField(
                controller: _email,
                label: 'Email',
                hint: 'you@company.com',
                prefixIcon: Icons.mail_outline,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [
                  AutofillHints.email,
                  AutofillHints.username,
                ],
                validator: emailField,
                errorText: _errorFor(SignInField.email),
                enabled: !_loading,
              ),
              PasswordField(
                controller: _password,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Enter your password' : null,
                errorText: _errorFor(SignInField.password),
                onSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _loading
                      ? null
                      : () => context.push(Routes.forgotPassword),
                  child: const Text('Forgot your password?'),
                ),
              ),
              const SizedBox(height: Space.sm),
              AppButton(
                label: 'Sign in',
                icon: Icons.login,
                fullWidth: true,
                loading: _loading,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
