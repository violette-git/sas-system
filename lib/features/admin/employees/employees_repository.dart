// Data access for company users (admins + employees).
// Ported from src/features/employees/hooks/useEmployees.ts.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';
import '../../auth/auth_controller.dart';
import '../schedules/schedules_repository.dart';

class EmployeesRepository {
  EmployeesRepository({required this.companyId});

  final String companyId;

  /// Every user in the company, admins and employees, by name.
  Future<List<UserProfile>> companyUsers() async {
    final rows = await sb
        .from('users')
        .select()
        .eq('company_id', companyId)
        .order('full_name');
    return rows.map(UserProfile.fromJson).toList();
  }

  Future<UserProfile?> byId(String id) async {
    final row = await sb
        .from('users')
        .select()
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle();
    return row == null ? null : UserProfile.fromJson(row);
  }

  /// Sends the invite email and creates the profile row (edge function).
  Future<void> invite({
    required String fullName,
    required String email,
    required UserRole role,
  }) async {
    final res = await sb.functions.invoke('invite-user', body: {
      'email': email.trim(),
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

  Future<void> setActive(String id, bool active) async {
    await sb
        .from('users')
        .update({'is_active': active})
        .eq('id', id)
        .eq('company_id', companyId);
  }

  Future<void> setRole(String id, UserRole role) async {
    await sb
        .from('users')
        .update({'role': role == UserRole.admin ? 'admin' : 'employee'})
        .eq('id', id)
        .eq('company_id', companyId);
  }
}

// ── Providers ─────────────────────────────────────────────────────────────

final employeesRepositoryProvider = Provider.autoDispose<EmployeesRepository>(
  (ref) => EmployeesRepository(companyId: ref.watch(companyIdProvider)),
);

/// All company users (admins + employees, active and inactive).
final companyUsersProvider = FutureProvider.autoDispose<List<UserProfile>>(
  (ref) => ref.watch(employeesRepositoryProvider).companyUsers(),
);

/// Active users with the employee role: the people visits are assigned to.
final activeEmployeesProvider = FutureProvider.autoDispose<List<UserProfile>>(
  (ref) async {
    final all = await ref.watch(companyUsersProvider.future);
    return all
        .where((u) => u.isActive && u.role == UserRole.employee)
        .toList();
  },
);

final employeeProvider = FutureProvider.autoDispose.family<UserProfile?, String>(
  (ref, id) => ref.watch(employeesRepositoryProvider).byId(id),
);

/// Call after any user write.
void invalidateEmployeeData(WidgetRef ref) {
  ref.read(adminDataVersionProvider.notifier).state++;
  ref.invalidate(companyUsersProvider);
  ref.invalidate(employeeProvider);
}
