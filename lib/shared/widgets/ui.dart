// Shared UI kit, ported from src/components/ui in the Expo app.
// Every screen should build from these so the three portals look like one
// product. Import with:  import '../../shared/widgets/ui.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formatters.dart';
import '../../core/supabase.dart';
import '../../core/theme.dart';
import '../../models/models.dart';

export '../../core/theme.dart';

// ── Buttons ───────────────────────────────────────────────────────────────

enum ButtonVariant { primary, secondary, ghost, danger, success }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = ButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool fullWidth;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (variant) {
      ButtonVariant.primary => (AppColors.accent, Colors.white, null),
      ButtonVariant.secondary =>
        (AppColors.card, AppColors.text, AppColors.border),
      ButtonVariant.ghost => (Colors.transparent, AppColors.accentLight, null),
      ButtonVariant.danger => (AppColors.danger, Colors.white, null),
      ButtonVariant.success => (AppColors.success, Colors.white, null),
    };
    final disabled = onPressed == null || loading;
    final child = loading
        ? SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: compact ? 16 : 18, color: fg),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w600,
                    fontSize: compact ? 13 : 15,
                  ),
                ),
              ),
            ],
          );

    final button = Opacity(
      opacity: disabled && !loading ? 0.45 : 1,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          side: border == null ? BorderSide.none : BorderSide(color: border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: disabled ? null : onPressed,
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 12 : 18,
              vertical: compact ? 8 : 13,
            ),
            child: Center(widthFactor: 1, child: child),
          ),
        ),
      ),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

// ── Cards ─────────────────────────────────────────────────────────────────

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(Space.lg),
    this.accentColor,
    this.color,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  /// Draws a 3px colored stripe on the left edge.
  final Color? accentColor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color ?? AppColors.elevated,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Container(
            decoration: accentColor == null
                ? null
                : BoxDecoration(
                    border:
                        Border(left: BorderSide(color: accentColor!, width: 3)),
                  ),
            padding: padding,
            child: child,
          ),
        ),
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color = AppColors.accent,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(height: Space.md),
          Text(
            value,
            style: TextStyle(
                fontSize: 26, fontWeight: FontWeight.w700, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Lays out StatCards 2-up on phones, 4-up on wide screens.
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final cols = c.maxWidth >= Breakpoints.tablet ? 4 : 2;
      const gap = Space.md;
      final w = (c.maxWidth - gap * (cols - 1)) / cols;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [for (final ch in children) SizedBox(width: w, child: ch)],
      );
    });
  }
}

// ── Badges ────────────────────────────────────────────────────────────────

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.color = AppColors.accent});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
            color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

Color scheduleStatusColor(ScheduleStatus s) => switch (s) {
      ScheduleStatus.scheduled => AppColors.info,
      ScheduleStatus.inProgress => AppColors.warning,
      ScheduleStatus.completed => AppColors.success,
      ScheduleStatus.cancelled => AppColors.textMuted,
    };

class ScheduleStatusPill extends StatelessWidget {
  const ScheduleStatusPill(this.status, {super.key});
  final ScheduleStatus status;
  @override
  Widget build(BuildContext context) =>
      Pill(status.label, color: scheduleStatusColor(status));
}

class RolePill extends StatelessWidget {
  const RolePill(this.role, {super.key});
  final UserRole role;
  @override
  Widget build(BuildContext context) => switch (role) {
        UserRole.owner => const Pill('Owner', color: AppColors.owner),
        UserRole.admin => const Pill('Admin', color: AppColors.admin),
        UserRole.employee => const Pill('Employee', color: AppColors.employee),
      };
}

class AppAvatar extends StatelessWidget {
  const AppAvatar({super.key, required this.name, this.url, this.size = 40});
  final String name;
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: AppColors.accentDim,
      foregroundImage: url != null && url!.isNotEmpty ? NetworkImage(url!) : null,
      child: Text(
        Fmt.initials(name),
        style: TextStyle(
          color: AppColors.accentLight,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.38,
        ),
      ),
    );
  }
}

// ── Layout helpers ────────────────────────────────────────────────────────

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: Space.xl, bottom: Space.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Label + value row for detail screens.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.icon, required this.label, this.value});
  final IconData icon;
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.textMuted),
          const SizedBox(width: Space.md),
          SizedBox(
            width: 96,
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              (value == null || value!.trim().isEmpty) ? '-' : value!,
              style: const TextStyle(fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}

/// Centers content and caps width on tablets / web so forms and lists
/// don't stretch edge to edge.
class ContentWidth extends StatelessWidget {
  const ContentWidth({super.key, required this.child, this.maxWidth = 920});
  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      );
}

// ── States ────────────────────────────────────────────────────────────────

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Space.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: AppColors.accentDim,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 34, color: AppColors.accentLight),
            ),
            const SizedBox(height: Space.lg),
            Text(title,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            if (message != null) ...[
              const SizedBox(height: Space.sm),
              Text(message!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary)),
            ],
            if (action != null) ...[
              const SizedBox(height: Space.xl),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.error_outline,
      title: 'Something went wrong',
      message: friendlyError(error),
      action: onRetry == null
          ? null
          : AppButton(
              label: 'Try again',
              icon: Icons.refresh,
              variant: ButtonVariant.secondary,
              onPressed: onRetry,
            ),
    );
  }
}

/// Pulsing placeholder rows shown while a list loads.
class SkeletonList extends StatefulWidget {
  const SkeletonList({super.key, this.count = 6, this.height = 72});
  final int count;
  final double height;

  @override
  State<SkeletonList> createState() => _SkeletonListState();
}

class _SkeletonListState extends State<SkeletonList>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.35, end: 0.8).animate(_c),
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(Space.lg),
        itemCount: widget.count,
        separatorBuilder: (_, __) => const SizedBox(height: Space.md),
        itemBuilder: (_, __) => Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: AppColors.elevated,
            borderRadius: BorderRadius.circular(Radii.lg),
          ),
        ),
      ),
    );
  }
}

/// Renders a Riverpod AsyncValue with consistent loading / error UI.
/// `onRetry` usually does `ref.invalidate(someProvider)`.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
    this.loading,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;
  final Widget? loading;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      data: data,
      loading: () => loading ?? const SkeletonList(),
      error: (e, _) => ErrorState(error: e, onRetry: onRetry),
    );
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────

void showSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Row(
        children: [
          Icon(error ? Icons.error_outline : Icons.check_circle_outline,
              color: error ? AppColors.danger : AppColors.success, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(message)),
        ],
      ),
    ));
}

Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  bool destructive = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message,
          style: const TextStyle(color: AppColors.textSecondary)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        AppButton(
          label: confirmLabel,
          compact: true,
          variant: destructive ? ButtonVariant.danger : ButtonVariant.primary,
          onPressed: () => Navigator.pop(ctx, true),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Opens a scrollable form as a bottom sheet on phones and a centered
/// dialog on wide screens. `builder` gets the sheet's own context so it can
/// call Navigator.pop(context, result).
Future<T?> showFormSheet<T>(
  BuildContext context, {
  required String title,
  required Widget Function(BuildContext context) builder,
}) {
  final wide = MediaQuery.sizeOf(context).width >= Breakpoints.tablet;
  Widget frame(BuildContext ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                Space.xl, Space.sm, Space.sm, Space.sm),
            child: Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(Space.xl, 0, Space.xl,
                  Space.xl + MediaQuery.viewInsetsOf(ctx).bottom),
              child: builder(ctx),
            ),
          ),
        ],
      );

  if (wide) {
    return showDialog<T>(
      context: context,
      builder: (ctx) => Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560, maxHeight: 760),
          child: frame(ctx),
        ),
      ),
    );
  }
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => ConstrainedBox(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(ctx).height * 0.92),
      child: frame(ctx),
    ),
  );
}

/// Labeled text field with the app's spacing. Thin wrapper so forms
/// stay consistent.
class AppField extends StatelessWidget {
  const AppField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.validator,
    this.keyboardType,
    this.obscure = false,
    this.maxLines = 1,
    this.prefixIcon,
    this.suffix,
    this.textCapitalization = TextCapitalization.none,
    this.autofillHints,
    this.onSubmitted,
    this.errorText,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final bool obscure;
  final int maxLines;
  final IconData? prefixIcon;
  final Widget? suffix;
  final TextCapitalization textCapitalization;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final String? errorText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.md),
      child: TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        obscureText: obscure,
        maxLines: obscure ? 1 : maxLines,
        enabled: enabled,
        textCapitalization: textCapitalization,
        autofillHints: autofillHints,
        onFieldSubmitted: onSubmitted,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          errorText: errorText,
          prefixIcon: prefixIcon == null ? null : Icon(prefixIcon, size: 20),
          suffixIcon: suffix,
        ),
      ),
    );
  }
}

String? requiredField(String? v) =>
    (v == null || v.trim().isEmpty) ? 'Required' : null;

String? emailField(String? v) {
  if (v == null || v.trim().isEmpty) return 'Required';
  return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())
      ? null
      : 'Enter a valid email';
}
