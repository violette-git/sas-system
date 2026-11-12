// Data access for the shared profile screen. Ported from
// src/features/profile/screens/ProfileScreen.tsx.

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase.dart';

class ProfileRepository {
  ProfileRepository._();

  /// Updates the signed-in user's name and phone. Throws if RLS silently
  /// filtered the update (no row came back).
  static Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
  }) async {
    final p = (phone ?? '').trim();
    final List<Map<String, dynamic>> rows = await sb
        .from('users')
        .update({
          'full_name': fullName.trim(),
          'phone': p.isEmpty ? null : p,
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', userId)
        .select('id');
    if (rows.isEmpty) {
      throw Exception(
          'Your profile could not be updated. Ask an administrator to make this change.');
    }
  }

  /// Verifies the current password (by signing in again, as the Expo app
  /// did) and then sets the new one.
  static Future<void> changePassword({
    required String email,
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await sb.auth
          .signInWithPassword(email: email, password: currentPassword);
    } on AuthException {
      throw Exception('Current password is incorrect.');
    }
    await sb.auth.updateUser(UserAttributes(password: newPassword));
  }
}
