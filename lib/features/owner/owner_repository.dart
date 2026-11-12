// Data access for the owner portal. Ported from
// src/features/companies/hooks/useCompanies.ts and the company / invite
// steps of app/(auth)/onboarding.tsx. Owner RLS ("owner_all_companies",
// "owner_all_users") lets these queries see every tenant.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase.dart';
import '../../models/models.dart';
import '../auth/auth_controller.dart';

/// A company plus how many user profiles belong to it (null if the count
/// could not be fetched).
class OwnerCompany {
  const OwnerCompany(this.company, this.userCount);
  final Company company;
  final int? userCount;
}

int? _embeddedCount(dynamic v) {
  if (v is List && v.isNotEmpty && v.first is Map) {
    return ((v.first as Map)['count'] as num?)?.toInt();
  }
  return null;
}

/// All companies, alphabetical, with user counts.
final ownerCompaniesProvider =
    FutureProvider.autoDispose<List<OwnerCompany>>((ref) async {
  List<Map<String, dynamic>> rows;
  try {
    rows = await sb
        .from('companies')
        .select('*, users!users_company_id_fkey(count)')
        .order('name');
  } on PostgrestException {
    // Count embedding is a nicety; fall back to plain rows.
    rows = await sb.from('companies').select().order('name');
  }
  return [
    for (final r in rows)
      OwnerCompany(Company.fromJson(r), _embeddedCount(r['users'])),
  ];
});

/// One company by id.
final ownerCompanyProvider =
    FutureProvider.autoDispose.family<Company, String>((ref, id) async {
  final row = await sb.from('companies').select().eq('id', id).maybeSingle();
  if (row == null) throw Exception('Company not found.');
  return Company.fromJson(row);
});

/// Users that belong to a company, admins first then by name.
final ownerCompanyUsersProvider = FutureProvider.autoDispose
    .family<List<UserProfile>, String>((ref, companyId) async {
  final List<Map<String, dynamic>> rows = await sb
      .from('users')
      .select()
      .eq('company_id', companyId)
      .order('full_name');
  final users = rows.map(UserProfile.fromJson).toList();
  int rank(UserRole r) => switch (r) {
        UserRole.owner => 0,
        UserRole.admin => 1,
        UserRole.employee => 2,
      };
  users.sort((a, b) {
    final byRole = rank(a.role).compareTo(rank(b.role));
    if (byRole != 0) return byRole;
    return a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase());
  });
  return users;
});

class OwnerRepository {
  OwnerRepository._();

  /// Asks the database for a fresh unique code like "ACM-1F3A".
  static Future<String> generateAccessCode(String companyName) async {
    final res = await sb.rpc('generate_access_code',
        params: {'company_name': companyName});
    final code = res?.toString() ?? '';
    if (code.isEmpty) throw Exception('Could not generate an access code.');
    return code;
  }

  /// Inserts a company. If [accessCode] is blank one is generated.
  static Future<Company> createCompany({
    required String name,
    String? tradeName,
    String? accessCode,
  }) async {
    final cleanName = name.trim();
    var code = (accessCode ?? '').trim().toUpperCase();
    if (code.isEmpty) code = await generateAccessCode(cleanName);
    final trade = (tradeName ?? '').trim();
    final row = await sb
        .from('companies')
        .insert({
          'name': cleanName,
          'trade_name': trade.isEmpty ? null : trade,
          'access_code': code,
        })
        .select()
        .single();
    return Company.fromJson(row);
  }

  static Future<void> updateCompany(
    String id, {
    required String name,
    String? tradeName,
  }) async {
    final trade = (tradeName ?? '').trim();
    await sb.from('companies').update({
      'name': name.trim(),
      'trade_name': trade.isEmpty ? null : trade,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', id);
  }

  static Future<void> setActive(String id, bool active) async {
    await sb.from('companies').update({
      'is_active': active,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', id);
  }

  /// Replaces the company's access code with a newly generated one and
  /// returns it. Anyone signing in with the old code will be rejected.
  static Future<String> regenerateAccessCode(Company company) async {
    final code = await generateAccessCode(company.name);
    await sb.from('companies').update({
      'access_code': code,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', company.id);
    return code;
  }

  /// Calls the invite-user edge function, which emails an invite and
  /// creates the users row. The invitee lands on the set-password screen.
  static Future<void> inviteUser({
    required String companyId,
    required String fullName,
    required String email,
    required UserRole role,
  }) async {
    final res = await sb.functions.invoke('invite-user', body: {
      'email': email.trim().toLowerCase(),
      'full_name': fullName.trim(),
      'role': role == UserRole.admin ? 'admin' : 'employee',
      'company_id': companyId,
      'redirect_to': authRedirectUrl('set-password'),
    });
    final data = res.data;
    if (data is Map && data['error'] != null) {
      throw Exception(data['error'].toString());
    }
  }
}
