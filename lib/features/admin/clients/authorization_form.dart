// Create / edit a client authorization, ported from the modal in
// app/(admin)/client/[id]/authorizations.tsx. Hours are entered here and
// stored as units (1 unit = 15 minutes, units = hours * 4).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formatters.dart';
import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/ui.dart';
import '../settings/service_types_repository.dart';
import 'clients_repository.dart';

/// Opens the authorization form. Returns true when saved.
Future<bool> showAuthorizationForm(
  BuildContext context,
  WidgetRef ref, {
  required String clientId,
  Authorization? authorization,
}) async {
  final saved = await showFormSheet<bool>(
    context,
    title: authorization == null ? 'New authorization' : 'Edit authorization',
    builder: (ctx) =>
        AuthorizationForm(clientId: clientId, authorization: authorization),
  );
  if (saved == true) {
    ref.invalidate(clientAuthorizationsProvider(clientId));
    if (context.mounted) {
      showSnack(context,
          authorization == null ? 'Authorization added' : 'Authorization updated');
    }
    return true;
  }
  return false;
}

class AuthorizationForm extends ConsumerStatefulWidget {
  const AuthorizationForm({
    super.key,
    required this.clientId,
    this.authorization,
  });

  final String clientId;
  final Authorization? authorization;

  @override
  ConsumerState<AuthorizationForm> createState() => _AuthorizationFormState();
}

class _AuthorizationFormState extends ConsumerState<AuthorizationForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _authNumber;
  late final TextEditingController _hours;
  late final TextEditingController _notes;
  String? _serviceTypeId;
  DateTime? _start;
  DateTime? _end;
  late bool _active;
  bool _saving = false;
  String? _startError;
  String? _endError;

  @override
  void initState() {
    super.initState();
    final a = widget.authorization;
    _authNumber = TextEditingController(text: a?.authNumber ?? '');
    _hours = TextEditingController(text: a == null ? '' : _fmtHours(a.authorizedHours));
    _notes = TextEditingController(text: a?.notes ?? '');
    _serviceTypeId =
        (a == null || a.serviceTypeId.isEmpty) ? null : a.serviceTypeId;
    _start = a?.startDate;
    _end = a?.endDate;
    _active = a?.isActive ?? true;
    _hours.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _authNumber.dispose();
    _hours.dispose();
    _notes.dispose();
    super.dispose();
  }

  static String _fmtHours(double h) =>
      h == h.roundToDouble() ? h.toStringAsFixed(0) : h.toString();

  double? get _parsedHours => double.tryParse(_hours.text.trim());

  String? _hoursValidator(String? v) {
    final h = double.tryParse((v ?? '').trim());
    if (h == null || h <= 0) return 'Enter a positive number of hours';
    return null;
  }

  Future<void> _pickDate({required bool start}) async {
    final now = DateTime.now();
    final initial = (start ? _start : _end) ??
        (start ? now : (_start ?? now).add(const Duration(days: 90)));
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 10),
      lastDate: DateTime(now.year + 10),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _start = picked;
        _startError = null;
      } else {
        _end = picked;
        _endError = null;
      }
    });
  }

  bool _validateDates() {
    String? se;
    String? ee;
    if (_start == null) se = 'Required';
    if (_end == null) ee = 'Required';
    if (_start != null && _end != null && _end!.isBefore(_start!)) {
      ee = 'End must be after start';
    }
    setState(() {
      _startError = se;
      _endError = ee;
    });
    return se == null && ee == null;
  }

  Future<void> _save() async {
    final formOk = _formKey.currentState!.validate();
    final datesOk = _validateDates();
    if (!formOk || !datesOk) return;
    setState(() => _saving = true);
    final data = <String, dynamic>{
      'service_type_id': _serviceTypeId,
      'auth_number': _authNumber.text.trim(),
      'authorized_units': (_parsedHours! * 4).round(),
      'start_date': Fmt.isoDate(_start!),
      'end_date': Fmt.isoDate(_end!),
      'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      'is_active': _active,
    };
    try {
      final repo = ref.read(clientsRepositoryProvider);
      final existing = widget.authorization;
      if (existing == null) {
        await repo.createAuthorization(
          companyId: ref.read(companyIdProvider),
          clientId: widget.clientId,
          data: data,
        );
      } else {
        await repo.updateAuthorization(existing.id, data);
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
    final typesAsync = ref.watch(serviceTypesProvider);
    final hours = _parsedHours;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          typesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.only(bottom: Space.md),
              child: LinearProgressIndicator(),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.only(bottom: Space.md),
              child: Text('Could not load service types: ${friendlyError(e)}',
                  style: const TextStyle(color: AppColors.danger)),
            ),
            data: (types) => _serviceTypeDropdown(types),
          ),
          AppField(
            controller: _authNumber,
            label: 'Authorization number *',
            hint: 'e.g. DHS-2024-001234',
            validator: requiredField,
            prefixIcon: Icons.tag,
          ),
          AppField(
            controller: _hours,
            label: 'Authorized hours *',
            hint: 'e.g. 120',
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            validator: _hoursValidator,
            prefixIcon: Icons.schedule,
          ),
          if (hours != null && hours > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: Space.md, left: 4),
              child: Text(
                '= ${(hours * 4).round()} units (1 unit = 15 min)',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _DateField(
                  label: 'Start date *',
                  value: _start,
                  errorText: _startError,
                  onTap: () => _pickDate(start: true),
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: _DateField(
                  label: 'End date *',
                  value: _end,
                  errorText: _endError,
                  onTap: () => _pickDate(start: false),
                ),
              ),
            ],
          ),
          AppField(
            controller: _notes,
            label: 'Notes',
            hint: 'Optional notes about this authorization...',
            maxLines: 3,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _active,
            onChanged: (v) => setState(() => _active = v),
            title: const Text('Active'),
          ),
          const SizedBox(height: Space.md),
          AppButton(
            label: widget.authorization == null
                ? 'Add authorization'
                : 'Save changes',
            loading: _saving,
            fullWidth: true,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }

  Widget _serviceTypeDropdown(List<ServiceType> all) {
    // Active types, plus the current one if it has since been deactivated.
    final options = all
        .where((t) => t.isActive || t.id == _serviceTypeId)
        .toList();
    final selected =
        options.any((t) => t.id == _serviceTypeId) ? _serviceTypeId : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.md),
      child: DropdownButtonFormField<String>(
        value: selected,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: 'Service type *',
          helperText: options.isEmpty
              ? 'Add service types in Settings first.'
              : null,
        ),
        items: [
          for (final t in options)
            DropdownMenuItem<String>(
              value: t.id,
              child: Text(
                t.shortCode == null || t.shortCode!.isEmpty
                    ? t.name
                    : '${t.name} (${t.shortCode})',
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
        onChanged: (v) => setState(() => _serviceTypeId = v),
        validator: (v) => v == null ? 'Required' : null,
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onTap,
    this.errorText,
  });

  final String label;
  final DateTime? value;
  final VoidCallback onTap;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.md),
        onTap: onTap,
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            errorText: errorText,
            prefixIcon: const Icon(Icons.event, size: 20),
          ),
          isEmpty: value == null,
          child: Text(value == null ? '' : Fmt.date(value!)),
        ),
      ),
    );
  }
}
