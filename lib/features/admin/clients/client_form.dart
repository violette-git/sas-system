// Create / edit client form, ported from the modal in app/(admin)/clients.tsx.
// Adds the active toggle and the geofence coordinates (clients.latitude /
// clients.longitude, used by clock-in geofencing).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/ui.dart';
import 'clients_repository.dart';

/// Opens the client form. Returns the saved client (null if dismissed).
/// Shows a success snack and refreshes client lists on save.
Future<Client?> showClientForm(
  BuildContext context,
  WidgetRef ref, {
  Client? client,
}) async {
  final saved = await showFormSheet<Client>(
    context,
    title: client == null ? 'New client' : 'Edit client',
    builder: (ctx) => ClientForm(client: client),
  );
  if (saved != null) {
    invalidateClients(ref, saved.id);
    if (context.mounted) {
      showSnack(context, client == null ? 'Client created' : 'Client updated');
    }
  }
  return saved;
}

class ClientForm extends ConsumerStatefulWidget {
  const ClientForm({super.key, this.client});
  final Client? client;

  @override
  ConsumerState<ClientForm> createState() => _ClientFormState();
}

class _ClientFormState extends ConsumerState<ClientForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _contactName;
  late final TextEditingController _contactEmail;
  late final TextEditingController _contactPhone;
  late final TextEditingController _address1;
  late final TextEditingController _address2;
  late final TextEditingController _city;
  late final TextEditingController _state;
  late final TextEditingController _zip;
  late final TextEditingController _notes;
  late final TextEditingController _lat;
  late final TextEditingController _lng;
  late bool _active;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final c = widget.client;
    _name = TextEditingController(text: c?.name ?? '');
    _contactName = TextEditingController(text: c?.contactName ?? '');
    _contactEmail = TextEditingController(text: c?.contactEmail ?? '');
    _contactPhone = TextEditingController(text: c?.contactPhone ?? '');
    _address1 = TextEditingController(text: c?.addressLine1 ?? '');
    _address2 = TextEditingController(text: c?.addressLine2 ?? '');
    _city = TextEditingController(text: c?.city ?? '');
    _state = TextEditingController(text: c?.state ?? '');
    _zip = TextEditingController(text: c?.zip ?? '');
    _notes = TextEditingController(text: c?.notes ?? '');
    _lat = TextEditingController(text: c?.latitude?.toString() ?? '');
    _lng = TextEditingController(text: c?.longitude?.toString() ?? '');
    _active = c?.isActive ?? true;
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _contactName,
      _contactEmail,
      _contactPhone,
      _address1,
      _address2,
      _city,
      _state,
      _zip,
      _notes,
      _lat,
      _lng,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _orNull(TextEditingController c) {
    final v = c.text.trim();
    return v.isEmpty ? null : v;
  }

  String? _optionalEmail(String? v) {
    if (v == null || v.trim().isEmpty) return null;
    return emailField(v);
  }

  String? Function(String?) _coord(int limit) => (String? v) {
        if (v == null || v.trim().isEmpty) return null;
        final d = double.tryParse(v.trim());
        if (d == null) return 'Enter a number';
        if (d < -limit || d > limit) return 'Must be between -$limit and $limit';
        return null;
      };

  String? _pairCheck(String? _) {
    final hasLat = _lat.text.trim().isNotEmpty;
    final hasLng = _lng.text.trim().isNotEmpty;
    if (hasLat != hasLng) return 'Enter both latitude and longitude';
    return null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final data = <String, dynamic>{
      'name': _name.text.trim(),
      'contact_name': _orNull(_contactName),
      'contact_email': _orNull(_contactEmail),
      'contact_phone': _orNull(_contactPhone),
      'address_line1': _orNull(_address1),
      'address_line2': _orNull(_address2),
      'city': _orNull(_city),
      'state': _orNull(_state)?.toUpperCase(),
      'zip': _orNull(_zip),
      'notes': _orNull(_notes),
      'is_active': _active,
      'latitude': double.tryParse(_lat.text.trim()),
      'longitude': double.tryParse(_lng.text.trim()),
    };
    try {
      final repo = ref.read(clientsRepositoryProvider);
      final Client saved;
      final existing = widget.client;
      if (existing == null) {
        saved = await repo.create(ref.read(companyIdProvider), data);
      } else {
        await repo.update(existing.id, data);
        saved = (await repo.get(existing.id)) ?? existing;
      }
      if (mounted) Navigator.pop(context, saved);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showSnack(context, friendlyError(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasCoords =
        widget.client?.latitude != null || widget.client?.longitude != null;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _FormLabel('Basic info'),
          AppField(
            controller: _name,
            label: 'Client / jobsite name *',
            hint: 'e.g. Main Street Office',
            validator: requiredField,
            textCapitalization: TextCapitalization.words,
          ),
          AppField(
            controller: _contactName,
            label: 'Contact name',
            hint: 'e.g. John Doe',
            textCapitalization: TextCapitalization.words,
            prefixIcon: Icons.person_outline,
          ),
          AppField(
            controller: _contactEmail,
            label: 'Contact email',
            hint: 'john@client.com',
            keyboardType: TextInputType.emailAddress,
            validator: _optionalEmail,
            prefixIcon: Icons.mail_outline,
          ),
          AppField(
            controller: _contactPhone,
            label: 'Contact phone',
            hint: '(555) 000-0000',
            keyboardType: TextInputType.phone,
            prefixIcon: Icons.call_outlined,
          ),
          const _FormLabel('Address'),
          AppField(
            controller: _address1,
            label: 'Street address',
            hint: '123 Main St',
          ),
          AppField(
            controller: _address2,
            label: 'Address line 2',
            hint: 'Suite 100',
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 2,
                child: AppField(
                  controller: _city,
                  label: 'City',
                  textCapitalization: TextCapitalization.words,
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: AppField(
                  controller: _state,
                  label: 'State',
                  hint: 'AL',
                  textCapitalization: TextCapitalization.characters,
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: AppField(
                  controller: _zip,
                  label: 'ZIP',
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const _FormLabel('Notes'),
          AppField(
            controller: _notes,
            label: 'Notes',
            hint: 'Access instructions, parking info, special requirements...',
            maxLines: 3,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _active,
            onChanged: (v) => setState(() => _active = v),
            title: const Text('Active'),
            subtitle: const Text(
              'Inactive clients are hidden from scheduling.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ),
          Theme(
            data: Theme.of(context)
                .copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: EdgeInsets.zero,
              initiallyExpanded: hasCoords,
              maintainState: true,
              leading: const Icon(Icons.my_location, size: 20),
              title: const Text('Advanced: geofence location',
                  style: TextStyle(fontSize: 14)),
              subtitle: const Text(
                'Clock-in checks distance from these coordinates.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: AppField(
                        controller: _lat,
                        label: 'Latitude',
                        hint: '33.5186',
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true, signed: true),
                        validator: (v) => _coord(90)(v) ?? _pairCheck(v),
                      ),
                    ),
                    const SizedBox(width: Space.sm),
                    Expanded(
                      child: AppField(
                        controller: _lng,
                        label: 'Longitude',
                        hint: '-86.8104',
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true, signed: true),
                        validator: (v) => _coord(180)(v) ?? _pairCheck(v),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: Space.lg),
          AppButton(
            label: widget.client == null ? 'Create client' : 'Save changes',
            loading: _saving,
            fullWidth: true,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

class _FormLabel extends StatelessWidget {
  const _FormLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: Space.sm, bottom: Space.sm),
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: FontWeight.w700,
            color: AppColors.textMuted,
          ),
        ),
      );
}
