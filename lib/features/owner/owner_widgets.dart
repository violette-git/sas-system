// Small widgets and forms shared by the owner portal screens.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/supabase.dart';
import '../../models/models.dart';
import '../../shared/widgets/ui.dart';
import 'owner_repository.dart';

const monoStyle = TextStyle(
  fontFamily: 'monospace',
  fontFamilyFallback: ['Courier New', 'Courier', 'Menlo'],
  letterSpacing: 1.2,
);

Future<void> copyAccessCode(BuildContext context, String code) async {
  await Clipboard.setData(ClipboardData(text: code));
  if (context.mounted) showSnack(context, 'Access code $code copied');
}

class ActivePill extends StatelessWidget {
  const ActivePill(this.active, {super.key});
  final bool active;
  @override
  Widget build(BuildContext context) => active
      ? const Pill('Active', color: AppColors.success)
      : const Pill('Inactive', color: AppColors.danger);
}

/// Access code in a monospace chip with a copy button.
class AccessCodeChip extends StatelessWidget {
  const AccessCodeChip({super.key, required this.code});
  final String code;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.sm),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.sm),
        onTap: () => copyAccessCode(context, code),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.key_outlined,
                  size: 13, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                code,
                style: monoStyle.copyWith(
                    fontSize: 12.5, color: AppColors.textSecondary),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.copy_rounded,
                  size: 13, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Create / edit company form ─────────────────────────────────────────

/// Form body for showFormSheet. Pops with the saved [Company] on create,
/// or `true` on edit.
class CompanyForm extends StatefulWidget {
  const CompanyForm({super.key, this.existing});

  /// Null to create a new company.
  final Company? existing;

  @override
  State<CompanyForm> createState() => _CompanyFormState();
}

class _CompanyFormState extends State<CompanyForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _trade =
      TextEditingController(text: widget.existing?.tradeName ?? '');
  final _code = TextEditingController();
  bool _saving = false;
  bool _generating = false;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    _trade.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      showSnack(context, 'Enter the company name first.', error: true);
      return;
    }
    setState(() => _generating = true);
    try {
      final code = await OwnerRepository.generateAccessCode(name);
      if (!mounted) return;
      _code.text = code;
    } catch (e) {
      if (mounted) showSnack(context, friendlyError(e), error: true);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  String? _validateCode(String? v) {
    final s = (v ?? '').trim();
    if (s.isEmpty) return null; // generated on save
    if (!RegExp(r'^[A-Za-z0-9-]{3,24}$').hasMatch(s)) {
      return 'Use 3 to 24 letters, numbers or dashes';
    }
    return null;
  }

  Future<void> _submit() async {
    if (_saving) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      if (_isEdit) {
        await OwnerRepository.updateCompany(
          widget.existing!.id,
          name: _name.text,
          tradeName: _trade.text,
        );
        if (mounted) Navigator.pop(context, true);
      } else {
        final company = await OwnerRepository.createCompany(
          name: _name.text,
          tradeName: _trade.text,
          accessCode: _code.text,
        );
        if (mounted) Navigator.pop(context, company);
      }
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
            label: 'Legal / registered name *',
            hint: 'e.g. Foster Friends LLC',
            prefixIcon: Icons.business_outlined,
            textCapitalization: TextCapitalization.words,
            validator: requiredField,
            enabled: !_saving,
          ),
          AppField(
            controller: _trade,
            label: 'Brand / trade name (optional)',
            hint: 'e.g. Foster Friends',
            prefixIcon: Icons.storefront_outlined,
            textCapitalization: TextCapitalization.words,
            enabled: !_saving,
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 0, 4, Space.md),
            child: Text(
              'The trade name is what staff see in the app.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ),
          if (!_isEdit) ...[
            AppField(
              controller: _code,
              label: 'Access code',
              hint: 'Leave blank to auto-generate',
              prefixIcon: Icons.key_outlined,
              textCapitalization: TextCapitalization.characters,
              validator: _validateCode,
              enabled: !_saving,
              suffix: _generating
                  ? const Padding(
                      padding: EdgeInsets.all(14),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : IconButton(
                      tooltip: 'Generate code',
                      icon: const Icon(Icons.autorenew, size: 20),
                      onPressed: _saving ? null : _generate,
                    ),
            ),
            Container(
              margin: const EdgeInsets.only(bottom: Space.lg),
              padding: const EdgeInsets.all(Space.md),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(Radii.md),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 16, color: AppColors.info),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Staff type this code when they sign in. Tap the refresh icon to preview a generated code, or type your own.',
                      style: TextStyle(fontSize: 12.5, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
          ],
          AppButton(
            label: _isEdit ? 'Save changes' : 'Create company',
            icon: _isEdit ? Icons.check : Icons.add_business_outlined,
            fullWidth: true,
            loading: _saving,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

// ── Invite user form ───────────────────────────────────────────────────

/// Form body for showFormSheet. Pops with the invited email on success.
class InviteUserForm extends StatefulWidget {
  const InviteUserForm({
    super.key,
    required this.companyId,
    this.initialRole = UserRole.admin,
  });

  final String companyId;
  final UserRole initialRole;

  @override
  State<InviteUserForm> createState() => _InviteUserFormState();
}

class _InviteUserFormState extends State<InviteUserForm> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  late UserRole _role = widget.initialRole;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      await OwnerRepository.inviteUser(
        companyId: widget.companyId,
        fullName: _name.text,
        email: _email.text,
        role: _role,
      );
      if (mounted) Navigator.pop(context, _email.text.trim().toLowerCase());
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
          const Text(
            'They will get an email with a link to set their password.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: Space.lg),
          SegmentedButton<UserRole>(
            segments: const [
              ButtonSegment(
                value: UserRole.admin,
                label: Text('Admin'),
                icon: Icon(Icons.admin_panel_settings_outlined),
              ),
              ButtonSegment(
                value: UserRole.employee,
                label: Text('Employee'),
                icon: Icon(Icons.badge_outlined),
              ),
            ],
            selected: {_role},
            onSelectionChanged: _saving
                ? null
                : (s) => setState(() => _role = s.first),
          ),
          const SizedBox(height: Space.sm),
          Text(
            _role == UserRole.admin
                ? 'Admins manage schedules, clients and staff for this company.'
                : 'Employees see their own visits and clock in and out.',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: Space.lg),
          AppField(
            controller: _name,
            label: 'Full name *',
            hint: 'e.g. Jane Smith',
            prefixIcon: Icons.person_outline,
            textCapitalization: TextCapitalization.words,
            validator: requiredField,
            enabled: !_saving,
          ),
          AppField(
            controller: _email,
            label: 'Email *',
            hint: 'name@company.com',
            prefixIcon: Icons.mail_outline,
            keyboardType: TextInputType.emailAddress,
            validator: emailField,
            enabled: !_saving,
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: Space.sm),
          AppButton(
            label: 'Send invite',
            icon: Icons.send_outlined,
            fullWidth: true,
            loading: _saving,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}
