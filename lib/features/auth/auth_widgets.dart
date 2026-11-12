// Building blocks shared by the auth screens (login, forgot password,
// set password) and reused by the profile screen's change password sheet.

import 'package:flutter/material.dart';

import '../../core/password_validation.dart';
import '../../shared/widgets/ui.dart';

/// Full-screen frame for auth pages: dark gradient backdrop, brand hero,
/// and a centered card capped at 440px wide so it looks right on phones,
/// tablets and the web.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.top,
  });

  /// Card contents.
  final Widget child;

  /// Optional heading inside the card.
  final String? title;
  final String? subtitle;

  /// Optional widget shown above the brand (back link, banner).
  final Widget? top;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF141533), AppColors.bg],
            stops: [0.0, 0.55],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              keyboardDismissBehavior:
                  ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.symmetric(
                  horizontal: Space.xl, vertical: Space.xxxl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (top != null) ...[
                      top!,
                      const SizedBox(height: Space.lg),
                    ],
                    const AuthBrand(),
                    const SizedBox(height: Space.xxl),
                    Container(
                      padding: const EdgeInsets.all(Space.xxl),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(Radii.xl),
                        border: Border.all(color: AppColors.border),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x55000000),
                            blurRadius: 32,
                            offset: Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (title != null)
                            Text(
                              title!,
                              style: const TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w700),
                            ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              subtitle!,
                              style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 14,
                                  height: 1.4),
                            ),
                          ],
                          if (title != null || subtitle != null)
                            const SizedBox(height: Space.xxl),
                          child,
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// App mark, product name and tagline.
class AuthBrand extends StatelessWidget {
  const AuthBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.accent, Color(0xFF8B5CF6)],
            ),
            borderRadius: BorderRadius.circular(Radii.xl),
            boxShadow: [
              BoxShadow(
                color: AppColors.accent.withValues(alpha: 0.4),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.hub_outlined, color: Colors.white, size: 32),
        ),
        const SizedBox(height: Space.lg),
        const Text(
          'SAS System',
          style: TextStyle(
              fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5),
        ),
        const SizedBox(height: 4),
        const Text(
          'Scheduling, visits and time tracking for care teams',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
      ],
    );
  }
}

/// Password field with a show / hide toggle.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.label = 'Password',
    this.hint,
    this.validator,
    this.autofillHints,
    this.onSubmitted,
    this.errorText,
    this.textInputAction,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final String? errorText;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.md),
      child: TextFormField(
        controller: widget.controller,
        validator: widget.validator,
        obscureText: _obscure,
        autocorrect: false,
        enableSuggestions: false,
        autofillHints: widget.autofillHints,
        textInputAction: widget.textInputAction,
        onFieldSubmitted: widget.onSubmitted,
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          labelText: widget.label,
          hintText: widget.hint,
          errorText: widget.errorText,
          prefixIcon: const Icon(Icons.lock_outline, size: 20),
          suffixIcon: IconButton(
            tooltip: _obscure ? 'Show password' : 'Hide password',
            icon: Icon(
              _obscure
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              size: 20,
              color: AppColors.textMuted,
            ),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      ),
    );
  }
}

/// Five-segment strength bar plus the rule checklist from PasswordCheck.
class PasswordStrengthMeter extends StatelessWidget {
  const PasswordStrengthMeter({super.key, required this.password});
  final String password;

  @override
  Widget build(BuildContext context) {
    final check = PasswordCheck(password);
    final empty = password.isEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 1; i <= 5; i++) ...[
                Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: 5,
                    decoration: BoxDecoration(
                      color: !empty && i <= check.score
                          ? check.color
                          : AppColors.border,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                if (i < 5) const SizedBox(width: 4),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Text(
            empty ? 'Password strength' : check.label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: empty ? AppColors.textMuted : check.color,
            ),
          ),
          const SizedBox(height: Space.sm),
          for (final (label, ok) in check.rules)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Icon(
                    ok ? Icons.check_circle : Icons.radio_button_unchecked,
                    size: 15,
                    color: ok ? AppColors.success : AppColors.textMuted,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: ok ? AppColors.text : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Inline error / info banner used inside auth cards and forms.
class AuthBanner extends StatelessWidget {
  const AuthBanner({
    super.key,
    required this.message,
    this.color = AppColors.danger,
    this.icon = Icons.error_outline,
  });

  final String message;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: Space.lg),
      padding: const EdgeInsets.all(Space.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 13, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
