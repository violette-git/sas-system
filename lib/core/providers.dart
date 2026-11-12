import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/auth_controller.dart';
import '../models/models.dart';

/// The signed-in user's profile. Screens inside a portal can assume it is
/// non-null (the router only lets signed-in users in).
final profileProvider = Provider<UserProfile?>(
  (ref) => ref.watch(authProvider).profile,
);

/// The signed-in user's company (null for the platform owner).
final companyProvider = Provider<Company?>(
  (ref) => ref.watch(authProvider).company,
);

/// Company id for tenant-scoped queries. Throws if missing so a bug shows
/// up as an error state rather than an unscoped query.
final companyIdProvider = Provider<String>((ref) {
  final id = ref.watch(authProvider).profile?.companyId;
  if (id == null) throw StateError('No company for the current user.');
  return id;
});

final userIdProvider = Provider<String>((ref) {
  final id = ref.watch(authProvider).profile?.id;
  if (id == null) throw StateError('Not signed in.');
  return id;
});
