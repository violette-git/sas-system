// Clients + authorizations data access for the admin portal.
// Ported from src/features/clients/hooks/useClients.ts,
// src/features/authorizations/hooks/useAuthorizations.ts and
// src/features/authorizations/hooks/useAuthorizationTracking.ts.

import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formatters.dart';
import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';

/// An authorization plus how much of it has been delivered.
/// Mirrors AuthorizationUsage in useAuthorizationTracking.ts.
class AuthorizationUsage {
  const AuthorizationUsage({
    required this.auth,
    required this.usedUnits,
    this.serviceShortCode,
  });

  final Authorization auth;

  /// Sum of billable units (1 unit = 15 minutes) of time entries on this
  /// client's schedules with the same service type, inside the auth's
  /// date range.
  final int usedUnits;
  final String? serviceShortCode;

  int get authorizedUnits => auth.authorizedUnits;
  int get remainingUnits => math.max(0, authorizedUnits - usedUnits);
  double get percentUsed =>
      authorizedUnits > 0 ? (usedUnits / authorizedUnits) * 100 : 0;

  /// Same thresholds as the Expo hook: near is [80, 100), over is >= 100.
  bool get isNearLimit => percentUsed >= 80 && percentUsed < 100;
  bool get isOverLimit => percentUsed >= 100;
}

class ClientsRepository {
  const ClientsRepository();

  // ── Clients ────────────────────────────────────────────────────────────

  Future<List<Client>> list(String companyId, {bool? active}) async {
    var query = sb.from('clients').select().eq('company_id', companyId);
    if (active != null) query = query.eq('is_active', active);
    final List<Map<String, dynamic>> rows = await query.order('name');
    return rows.map(Client.fromJson).toList();
  }

  Future<Client?> get(String id) async {
    final row = await sb.from('clients').select().eq('id', id).maybeSingle();
    return row == null ? null : Client.fromJson(row);
  }

  /// `data` uses DB column names (name, contact_name, latitude, ...).
  Future<Client> create(String companyId, Map<String, dynamic> data) async {
    final row = await sb
        .from('clients')
        .insert({...data, 'company_id': companyId})
        .select()
        .single();
    return Client.fromJson(row);
  }

  Future<void> update(String id, Map<String, dynamic> data) async {
    await sb.from('clients').update(data).eq('id', id);
  }

  Future<void> setActive(String id, bool isActive) async {
    await sb.from('clients').update({'is_active': isActive}).eq('id', id);
  }

  // ── Authorizations ─────────────────────────────────────────────────────

  /// All authorizations of a client (active and inactive), newest end date
  /// first, each with its usage computed like useAuthorizationUsage.
  Future<List<AuthorizationUsage>> authorizationsWithUsage({
    required String companyId,
    required String clientId,
  }) async {
    final List<Map<String, dynamic>> rows = await sb
        .from('authorizations')
        .select('*, service_types(name, short_code)')
        .eq('company_id', companyId)
        .eq('client_id', clientId)
        .order('end_date', ascending: false);
    if (rows.isEmpty) return const [];

    final auths = rows.map(_parseAuthorization).toList();

    // One query for every time entry on this client's schedules, with the
    // schedule fields the usage rule filters on. The Expo hook ran one
    // schedules query + one time_entries query per authorization; the
    // filtering below applies the exact same rule in Dart.
    final List<Map<String, dynamic>> entries = await sb
        .from('time_entries')
        .select('*, schedules!inner(client_id, service_type_id, start_time)')
        .eq('schedules.client_id', clientId);

    final parsed = <_EntryUnits>[];
    for (final e in entries) {
      final s = e['schedules'];
      if (s is! Map) continue;
      if (s['client_id'] != clientId) continue;
      final start = parseTs(s['start_time']);
      if (start == null) continue;
      parsed.add(_EntryUnits(
        serviceTypeId: s['service_type_id'] as String?,
        scheduleStart: start,
        units: billableUnitsOf(e),
      ));
    }

    return [
      for (var i = 0; i < auths.length; i++)
        AuthorizationUsage(
          auth: auths[i],
          serviceShortCode:
              (rows[i]['service_types'] as Map?)?['short_code'] as String?,
          usedUnits: _usedUnits(auths[i], parsed),
        ),
    ];
  }

  /// Schedules whose start_time is between start_date 00:00:00 and
  /// end_date 23:59:59 (database time zone, UTC on Supabase), same service
  /// type, same client. Matches the .gte/.lte pair in the Expo hook.
  static int _usedUnits(Authorization a, List<_EntryUnits> entries) {
    final from =
        DateTime.utc(a.startDate.year, a.startDate.month, a.startDate.day);
    final to = DateTime.utc(
        a.endDate.year, a.endDate.month, a.endDate.day, 23, 59, 59);
    var sum = 0;
    for (final e in entries) {
      if (e.serviceTypeId != a.serviceTypeId) continue;
      if (e.scheduleStart.isBefore(from) || e.scheduleStart.isAfter(to)) {
        continue;
      }
      sum += e.units;
    }
    return sum;
  }

  /// billable_units is a generated column (floor(minutes / 15)) in the live
  /// database but is not in the checked-in SQL, so fall back to computing it
  /// from duration_minutes. Open entries count as 0, like the Expo code.
  static int billableUnitsOf(Map<String, dynamic> entry) {
    final bu = entry['billable_units'];
    if (bu is num) return bu.toInt();
    final mins = entry['duration_minutes'];
    if (mins is num) return mins.toInt() ~/ 15;
    return 0;
  }

  /// Defensive parse: tolerates `authorized_hours` (checked-in SQL) as well
  /// as `authorized_units` (what the app writes) and null dates.
  static Authorization _parseAuthorization(Map<String, dynamic> j) {
    final unitsRaw = j['authorized_units'];
    final hoursRaw = j['authorized_hours'];
    final int units = unitsRaw is num
        ? unitsRaw.toInt()
        : (hoursRaw is num ? (hoursRaw * 4).round() : 0);
    DateTime date(dynamic v) {
      if (v is String && v.isNotEmpty) {
        final d = DateTime.parse(v);
        return DateTime(d.year, d.month, d.day);
      }
      final now = DateTime.now();
      return DateTime(now.year, now.month, now.day);
    }

    return Authorization(
      id: j['id'] as String,
      companyId: j['company_id'] as String,
      clientId: j['client_id'] as String,
      serviceTypeId: (j['service_type_id'] as String?) ?? '',
      authNumber: (j['auth_number'] as String?) ?? '',
      authorizedUnits: units,
      startDate: date(j['start_date']),
      endDate: date(j['end_date']),
      notes: j['notes'] as String?,
      isActive: (j['is_active'] as bool?) ?? true,
      serviceTypeName: (j['service_types'] as Map?)?['name'] as String?,
    );
  }

  Future<void> createAuthorization({
    required String companyId,
    required String clientId,
    required Map<String, dynamic> data,
  }) async {
    await sb.from('authorizations').insert({
      ...data,
      'company_id': companyId,
      'client_id': clientId,
    });
  }

  Future<void> updateAuthorization(
      String id, Map<String, dynamic> data) async {
    await sb.from('authorizations').update(data).eq('id', id);
  }

  // ── Visits ─────────────────────────────────────────────────────────────

  Future<List<Schedule>> recentSchedules(String clientId,
      {int limit = 10}) async {
    final List<Map<String, dynamic>> rows = await sb
        .from('schedules')
        .select(Schedule.select)
        .eq('client_id', clientId)
        .order('start_time', ascending: false)
        .limit(limit);
    return rows.map(Schedule.fromJson).toList();
  }
}

class _EntryUnits {
  const _EntryUnits({
    required this.serviceTypeId,
    required this.scheduleStart,
    required this.units,
  });
  final String? serviceTypeId;
  final DateTime scheduleStart;
  final int units;
}

// ── Providers ───────────────────────────────────────────────────────────

final clientsRepositoryProvider =
    Provider<ClientsRepository>((ref) => const ClientsRepository());

/// Every client of the company (active and inactive), by name.
final clientsProvider = FutureProvider.autoDispose<List<Client>>((ref) async {
  final companyId = ref.watch(companyIdProvider);
  return ref.watch(clientsRepositoryProvider).list(companyId);
});

/// Active clients only, by name (schedule pickers etc).
final activeClientsProvider =
    FutureProvider.autoDispose<List<Client>>((ref) async {
  final companyId = ref.watch(companyIdProvider);
  return ref.watch(clientsRepositoryProvider).list(companyId, active: true);
});

final clientProvider =
    FutureProvider.autoDispose.family<Client?, String>((ref, id) async {
  return ref.watch(clientsRepositoryProvider).get(id);
});

final clientAuthorizationsProvider = FutureProvider.autoDispose
    .family<List<AuthorizationUsage>, String>((ref, clientId) async {
  final companyId = ref.watch(companyIdProvider);
  return ref
      .watch(clientsRepositoryProvider)
      .authorizationsWithUsage(companyId: companyId, clientId: clientId);
});

final clientRecentVisitsProvider =
    FutureProvider.autoDispose.family<List<Schedule>, String>(
        (ref, clientId) async {
  return ref.watch(clientsRepositoryProvider).recentSchedules(clientId);
});

/// Refreshes every list that shows clients after a create / update.
void invalidateClients(WidgetRef ref, [String? clientId]) {
  ref.invalidate(clientsProvider);
  ref.invalidate(activeClientsProvider);
  if (clientId != null) ref.invalidate(clientProvider(clientId));
}
