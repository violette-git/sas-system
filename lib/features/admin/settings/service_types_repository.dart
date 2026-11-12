// Service types data access, ported from
// src/features/service-types/hooks/useServiceTypes.ts.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/supabase.dart';
import '../../../models/models.dart';

class ServiceTypesRepository {
  const ServiceTypesRepository();

  /// All service types for the company (active and inactive), by name.
  Future<List<ServiceType>> list(String companyId) async {
    final List<Map<String, dynamic>> rows = await sb
        .from('service_types')
        .select()
        .eq('company_id', companyId)
        .order('name');
    return rows.map(ServiceType.fromJson).toList();
  }

  Future<ServiceType> create({
    required String companyId,
    required String name,
    String? shortCode,
    String? description,
    bool isActive = true,
  }) async {
    final row = await sb
        .from('service_types')
        .insert({
          'company_id': companyId,
          'name': name,
          'short_code': shortCode,
          'description': description,
          'is_active': isActive,
        })
        .select()
        .single();
    return ServiceType.fromJson(row);
  }

  Future<void> update(
    String id, {
    required String name,
    String? shortCode,
    String? description,
    required bool isActive,
  }) async {
    await sb.from('service_types').update({
      'name': name,
      'short_code': shortCode,
      'description': description,
      'is_active': isActive,
    }).eq('id', id);
  }

  Future<void> setActive(String id, bool isActive) async {
    await sb.from('service_types').update({'is_active': isActive}).eq('id', id);
  }
}

final serviceTypesRepositoryProvider =
    Provider<ServiceTypesRepository>((ref) => const ServiceTypesRepository());

/// Every service type of the signed-in admin's company (including inactive
/// ones), ordered by name. Filter on `isActive` for pickers, or use
/// [activeServiceTypesProvider].
final serviceTypesProvider =
    FutureProvider.autoDispose<List<ServiceType>>((ref) async {
  final companyId = ref.watch(companyIdProvider);
  return ref.watch(serviceTypesRepositoryProvider).list(companyId);
});

/// Only active service types, for dropdowns.
final activeServiceTypesProvider =
    FutureProvider.autoDispose<List<ServiceType>>((ref) async {
  final all = await ref.watch(serviceTypesProvider.future);
  return all.where((s) => s.isActive).toList();
});
