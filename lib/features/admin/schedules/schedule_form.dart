// Create / edit form for a schedule, shared by the schedules list and the
// schedule detail screen. Ported from the CreateScheduleModal in
// app/(admin)/schedules.tsx, collapsed into a single step.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formatters.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/ui.dart';
import '../employees/employees_repository.dart';
import 'schedules_repository.dart';

/// Opens the schedule form. Resolves to true when a schedule was saved.
Future<bool> openScheduleForm(
  BuildContext context, {
  Schedule? initial,
  DateTime? defaultDate,
}) async {
  final saved = await showFormSheet<bool>(
    context,
    title: initial == null ? 'New schedule' : 'Edit schedule',
    builder: (ctx) => ScheduleForm(initial: initial, defaultDate: defaultDate),
  );
  return saved ?? false;
}

class ScheduleForm extends ConsumerStatefulWidget {
  const ScheduleForm({super.key, this.initial, this.defaultDate});

  final Schedule? initial;
  final DateTime? defaultDate;

  @override
  ConsumerState<ScheduleForm> createState() => _ScheduleFormState();
}

class _ScheduleFormState extends ConsumerState<ScheduleForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title;
  String? _employeeId;
  String? _clientId;
  String? _serviceTypeId;
  late DateTime _date;
  late TimeOfDay _start;
  late TimeOfDay _end;
  bool _saving = false;
  bool _showTimeError = false;

  bool get _isEdit => widget.initial != null;

  @override
  void initState() {
    super.initState();
    final s = widget.initial;
    _title = TextEditingController(text: s?.title ?? '');
    if (s != null) {
      _employeeId = s.employeeId;
      _clientId = s.clientId;
      _serviceTypeId = s.serviceTypeId;
      _date = startOfDay(s.startTime);
      _start = TimeOfDay.fromDateTime(s.startTime);
      _end = TimeOfDay.fromDateTime(s.endTime);
    } else {
      _date = startOfDay(widget.defaultDate ?? DateTime.now());
      _start = const TimeOfDay(hour: 9, minute: 0);
      _end = const TimeOfDay(hour: 10, minute: 0);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  DateTime _combine(TimeOfDay t) =>
      DateTime(_date.year, _date.month, _date.day, t.hour, t.minute);

  bool get _timesValid => _combine(_end).isAfter(_combine(_start));

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _date = startOfDay(picked));
  }

  Future<void> _pickTime({required bool start}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: start ? _start : _end,
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        // Keep the visit length when moving the start time.
        final lengthMins = (_end.hour * 60 + _end.minute) -
            (_start.hour * 60 + _start.minute);
        _start = picked;
        if (!_isEdit && lengthMins > 0) {
          final endMins = picked.hour * 60 + picked.minute + lengthMins;
          if (endMins < 24 * 60) {
            _end = TimeOfDay(hour: endMins ~/ 60, minute: endMins % 60);
          }
        }
      } else {
        _end = picked;
      }
    });
  }

  Future<void> _submit(List<UserProfile> employees) async {
    final formOk = _formKey.currentState?.validate() ?? false;
    setState(() => _showTimeError = !_timesValid);
    if (!formOk || !_timesValid) return;

    final repo = ref.read(schedulesRepositoryProvider);
    final input = ScheduleInput(
      employeeId: _employeeId!,
      clientId: _clientId!,
      serviceTypeId: _serviceTypeId,
      title: _title.text,
      start: _combine(_start),
      end: _combine(_end),
    );

    setState(() => _saving = true);
    try {
      // Roadmap "schedule conflicts": warn on overlapping visits.
      final overlaps = await repo.conflicts(
        employeeId: input.employeeId,
        start: input.start,
        end: input.end,
        excludeId: widget.initial?.id,
      );
      if (!mounted) return;
      if (overlaps.isNotEmpty) {
        var name = widget.initial?.employeeName ?? 'This employee';
        for (final e in employees) {
          if (e.id == input.employeeId) name = e.fullName;
        }
        final lines = overlaps
            .take(3)
            .map((o) =>
                '${Fmt.dateShort(o.startTime)}, ${Fmt.timeRange(o.startTime, o.endTime)} (${o.clientName ?? 'client'})')
            .join('\n');
        final more =
            overlaps.length > 3 ? '\n+${overlaps.length - 3} more' : '';
        final proceed = await confirmDialog(
          context,
          title: 'Schedule conflict',
          message:
              '$name already has ${overlaps.length == 1 ? 'a visit' : '${overlaps.length} visits'} at this time:\n\n$lines$more\n\nSave anyway?',
          confirmLabel: 'Save anyway',
        );
        if (!mounted) return;
        if (!proceed) {
          setState(() => _saving = false);
          return;
        }
      }

      if (_isEdit) {
        await repo.update(widget.initial!.id, input);
      } else {
        await repo.create(input);
      }
      invalidateScheduleData(ref);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showSnack(context, friendlyError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final employeesAsync = ref.watch(activeEmployeesProvider);
    final clientsAsync = ref.watch(schedulePickerClientsProvider);
    final servicesAsync = ref.watch(activeServiceTypesProvider);

    final error = employeesAsync.error ?? clientsAsync.error;
    if (error != null) {
      return ErrorState(
        error: error,
        onRetry: () {
          ref.invalidate(companyUsersProvider);
          ref.invalidate(schedulePickerClientsProvider);
        },
      );
    }
    if (!employeesAsync.hasValue || !clientsAsync.hasValue) {
      return const Padding(
        padding: EdgeInsets.all(Space.xxxl),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final employees = employeesAsync.valueOrNull ?? const <UserProfile>[];
    final clients = clientsAsync.valueOrNull ?? const <Client>[];
    // Service types are optional: a failed load just hides the field.
    final services = servicesAsync.valueOrNull ?? const <ServiceType>[];

    // When editing, keep the current selections visible even if that
    // employee / client / service has since been deactivated.
    final s = widget.initial;
    final employeeItems = <DropdownMenuItem<String>>[
      for (final e in employees)
        DropdownMenuItem(value: e.id, child: Text(e.fullName)),
      if (s != null && !employees.any((e) => e.id == s.employeeId))
        DropdownMenuItem(
          value: s.employeeId,
          child: Text('${s.employeeName ?? 'Current employee'} (inactive)'),
        ),
    ];
    final clientItems = <DropdownMenuItem<String>>[
      for (final c in clients)
        DropdownMenuItem(value: c.id, child: Text(c.name)),
      if (s != null && !clients.any((c) => c.id == s.clientId))
        DropdownMenuItem(
          value: s.clientId,
          child: Text('${s.clientName ?? 'Current client'} (inactive)'),
        ),
    ];
    final keepServiceId = s?.serviceTypeId;
    final serviceItems = <DropdownMenuItem<String?>>[
      const DropdownMenuItem<String?>(value: null, child: Text('None')),
      for (final t in services)
        DropdownMenuItem<String?>(value: t.id, child: Text(t.name)),
      if (keepServiceId != null &&
          !services.any((t) => t.id == keepServiceId))
        DropdownMenuItem<String?>(
          value: keepServiceId,
          child: Text(s?.serviceTypeName ?? 'Current service'),
        ),
    ];

    if (employees.isEmpty && !_isEdit) {
      return const EmptyState(
        icon: Icons.person_off_outlined,
        title: 'No active employees',
        message: 'Invite or activate an employee before scheduling visits.',
      );
    }
    if (clients.isEmpty && !_isEdit) {
      return const EmptyState(
        icon: Icons.home_work_outlined,
        title: 'No active clients',
        message: 'Add a client before scheduling visits.',
      );
    }

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _gap(
            DropdownButtonFormField<String>(
              value: _employeeId,
              isExpanded: true,
              items: employeeItems,
              onChanged: _saving ? null : (v) => setState(() => _employeeId = v),
              validator: (v) => v == null ? 'Choose an employee' : null,
              decoration: const InputDecoration(
                labelText: 'Employee',
                prefixIcon: Icon(Icons.person_outline, size: 20),
              ),
            ),
          ),
          _gap(
            DropdownButtonFormField<String>(
              value: _clientId,
              isExpanded: true,
              items: clientItems,
              onChanged: _saving ? null : (v) => setState(() => _clientId = v),
              validator: (v) => v == null ? 'Choose a client' : null,
              decoration: const InputDecoration(
                labelText: 'Client',
                prefixIcon: Icon(Icons.home_work_outlined, size: 20),
              ),
            ),
          ),
          if (services.isNotEmpty || _serviceTypeId != null)
            _gap(
              DropdownButtonFormField<String?>(
                value: _serviceTypeId,
                isExpanded: true,
                hint: const Text('None'),
                items: serviceItems,
                onChanged:
                    _saving ? null : (v) => setState(() => _serviceTypeId = v),
                decoration: const InputDecoration(
                  labelText: 'Service type (optional)',
                  prefixIcon: Icon(Icons.medical_services_outlined, size: 20),
                ),
              ),
            ),
          AppField(
            controller: _title,
            label: 'Title (optional)',
            hint: 'e.g. Morning care',
            prefixIcon: Icons.short_text,
            textCapitalization: TextCapitalization.sentences,
            enabled: !_saving,
          ),
          _gap(
            _PickerField(
              label: 'Date',
              icon: Icons.calendar_today_outlined,
              value: Fmt.date(_date),
              onTap: _saving ? null : _pickDate,
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _PickerField(
                  label: 'Start',
                  icon: Icons.schedule,
                  value: _start.format(context),
                  onTap: _saving ? null : () => _pickTime(start: true),
                ),
              ),
              const SizedBox(width: Space.md),
              Expanded(
                child: _PickerField(
                  label: 'End',
                  icon: Icons.schedule_outlined,
                  value: _end.format(context),
                  onTap: _saving ? null : () => _pickTime(start: false),
                  errorText: _showTimeError && !_timesValid
                      ? 'Must be after start'
                      : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: Space.sm),
          if (_timesValid)
            Text(
              'Planned: ${Fmt.minutes(_combine(_end).difference(_combine(_start)).inMinutes)}',
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 13),
            ),
          const SizedBox(height: Space.xl),
          AppButton(
            label: _isEdit ? 'Save changes' : 'Create schedule',
            icon: _isEdit ? Icons.check : Icons.add,
            fullWidth: true,
            loading: _saving,
            onPressed: _saving ? null : () => _submit(employees),
          ),
        ],
      ),
    );
  }

  Widget _gap(Widget child) => Padding(
        padding: const EdgeInsets.only(bottom: Space.md),
        child: child,
      );
}

/// Read-only field that opens a picker when tapped.
class _PickerField extends StatelessWidget {
  const _PickerField({
    required this.label,
    required this.icon,
    required this.value,
    this.onTap,
    this.errorText,
  });

  final String label;
  final IconData icon;
  final String value;
  final VoidCallback? onTap;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.md),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20),
          errorText: errorText,
          enabled: onTap != null,
        ),
        child: Text(value, style: const TextStyle(fontSize: 15)),
      ),
    );
  }
}
