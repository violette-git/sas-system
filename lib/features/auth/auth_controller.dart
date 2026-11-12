import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/env.dart';
import '../../core/supabase.dart';
import '../../models/models.dart';

/// Which field a sign-in error belongs to, so the form can highlight it.
enum SignInField { accessCode, email, password, general }

class SignInError {
  final SignInField field;
  final String message;
  const SignInError(this.field, this.message);
}

/// Single source of truth for who is signed in.
///
/// Ported from the Expo app's zustand authStore + useSession + useSignIn.
/// It is a ChangeNotifier so go_router can use it as refreshListenable and
/// re-run its redirect whenever auth state changes.
class AuthController extends ChangeNotifier {
  AuthController() {
    _init();
  }

  Session? session;
  UserProfile? profile;
  Company? company;

  /// Message to show on the login screen after a forced sign-out
  /// (deactivated account, inactive company). Cleared on next sign-in.
  String? notice;

  /// True until the first auth event has resolved (splash screen).
  bool loading = true;

  /// Set when the user arrived from an invite or recovery link and must
  /// choose a password before entering a portal.
  bool needsPasswordSetup = false;

  /// While signIn() is validating the company code we must not let the
  /// auth listener route the user into a portal.
  bool _signingIn = false;

  StreamSubscription<AuthState>? _sub;

  bool get isSignedIn => session != null && profile != null;
  UserRole? get role => profile?.role;

  void _init() {
    if (!Env.isConfigured) {
      loading = false;
      return;
    }

    // Web: invite / recovery links land with type=invite|recovery in the
    // URL. Detect before supabase consumes and clears it.
    final uri = Uri.base.toString();
    if (uri.contains('type=invite') || uri.contains('type=recovery')) {
      needsPasswordSetup = true;
    }

    _sub = sb.auth.onAuthStateChange.listen((data) async {
      final event = data.event;
      if (event == AuthChangeEvent.passwordRecovery) {
        needsPasswordSetup = true;
      }
      if (event == AuthChangeEvent.signedOut) {
        _clear();
        return;
      }
      final s = data.session;
      if (s == null) {
        loading = false;
        notifyListeners();
        return;
      }
      session = s;
      if (_signingIn) return; // signIn() finishes the job itself.
      if (profile == null || profile!.id != s.user.id) {
        await _loadProfile(s.user.id);
      }
      // A saved session must not outlive a deactivation.
      final denied = await _accessDenied();
      if (denied != null) {
        notice = denied;
        await sb.auth.signOut().catchError((_) {});
        _clear();
        return;
      }
      loading = false;
      notifyListeners();
    });

    // Fallback in case no initial event arrives (offline start, etc).
    Future.delayed(const Duration(seconds: 4), () {
      if (loading) {
        loading = false;
        notifyListeners();
      }
    });
  }

  Future<void> _loadProfile(String userId) async {
    try {
      final row =
          await sb.from('users').select().eq('id', userId).maybeSingle();
      if (row == null) return;
      profile = UserProfile.fromJson(row);
      // Owner has no company_id; RLS would deny the read anyway.
      if (profile!.companyId != null) {
        final c = await sb
            .from('companies')
            .select()
            .eq('id', profile!.companyId!)
            .maybeSingle();
        company = c == null ? null : Company.fromJson(c);
      } else {
        company = null;
      }
    } catch (e) {
      debugPrint('[auth] loadProfile failed: $e');
    }
  }

  /// Asks the server whether this account may use the app. Returns a
  /// user-facing reason when access is refused, null when allowed or when
  /// the check could not run (offline: RLS still protects the data).
  Future<String?> _accessDenied() async {
    try {
      final status = await sb.rpc('my_access_status');
      return switch (status) {
        'user_inactive' =>
          'This account is deactivated. Contact your administrator.',
        'company_inactive' => 'This company account is inactive.',
        'no_profile' => 'User profile not found. Contact your administrator.',
        _ => null,
      };
    } catch (_) {
      // Older database without my_access_status(): fall back to the profile.
      if (profile != null && !profile!.isActive) {
        return 'This account is deactivated. Contact your administrator.';
      }
      if (company != null && !company!.isActive) {
        return 'This company account is inactive.';
      }
      return null;
    }
  }

  Future<void> refreshProfile() async {
    final id = session?.user.id;
    if (id == null) return;
    await _loadProfile(id);
    notifyListeners();
  }

  /// Company code + email + password sign-in.
  /// Returns null on success, or the error to show.
  Future<SignInError?> signIn({
    required String accessCode,
    required String email,
    required String password,
  }) async {
    if (!Env.isConfigured) {
      return const SignInError(SignInField.general,
          'App is not configured: SUPABASE_URL / SUPABASE_ANON_KEY missing.');
    }
    _signingIn = true;
    needsPasswordSetup = false; // a stale invite/recovery flag must not stick
    notice = null;
    final code = accessCode.trim();
    try {
      // 1. Authenticate.
      final AuthResponse res;
      try {
        res = await sb.auth
            .signInWithPassword(email: email.trim(), password: password);
      } on AuthException {
        return const SignInError(
            SignInField.general, 'Invalid email or password.');
      }
      final user = res.user!;

      // 2. Load profile.
      final row =
          await sb.from('users').select().eq('id', user.id).maybeSingle();
      if (row == null) {
        await sb.auth.signOut();
        return const SignInError(SignInField.general,
            'User profile not found. Contact your administrator.');
      }
      final p = UserProfile.fromJson(row);

      if (!p.isActive) {
        await sb.auth.signOut();
        return const SignInError(SignInField.general,
            'This account is deactivated. Contact your administrator.');
      }

      // 3. Owner: no company code needed.
      if (p.role != UserRole.owner) {
        // 4. Everyone else must present a matching, active company code.
        if (code.isEmpty) {
          await sb.auth.signOut();
          return const SignInError(
              SignInField.accessCode, 'Enter your company code to sign in.');
        }
        final rows = await sb
            .rpc('resolve_company_code', params: {'p_code': code}) as List;
        if (rows.isEmpty) {
          await sb.auth.signOut();
          return const SignInError(
              SignInField.accessCode, 'Company code not found.');
        }
        final resolved = rows.first as Map<String, dynamic>;
        if (resolved['is_active'] != true) {
          await sb.auth.signOut();
          return const SignInError(
              SignInField.accessCode, 'This company account is inactive.');
        }
        if (resolved['company_id'] != p.companyId) {
          await sb.auth.signOut();
          return const SignInError(SignInField.accessCode,
              'This account does not belong to that company.');
        }
      }

      session = res.session;
      await _loadProfile(user.id);
      loading = false;
      notifyListeners();
      return null;
    } catch (e) {
      // Never leave a half-validated session behind: it would skip the
      // company-code check on the next token refresh or app launch.
      if (sb.auth.currentSession != null) {
        await sb.auth.signOut().catchError((_) {});
      }
      session = null;
      profile = null;
      company = null;
      return SignInError(SignInField.general, friendlyError(e));
    } finally {
      _signingIn = false;
    }
  }

  /// Sends a password reset email. Returns an error message or null.
  Future<String?> sendPasswordReset(String email) async {
    try {
      await sb.auth.resetPasswordForEmail(
        email.trim(),
        redirectTo: authRedirectUrl('set-password'),
      );
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  }

  /// Sets the password for an invited / recovering user.
  Future<String?> setPassword(String password) async {
    try {
      await sb.auth.updateUser(UserAttributes(password: password));
      needsPasswordSetup = false;
      final id = sb.auth.currentUser?.id;
      session = sb.auth.currentSession;
      if (id != null) await _loadProfile(id);
      notifyListeners();
      return null;
    } catch (e) {
      return friendlyError(e);
    }
  }

  Future<void> signOut() async {
    try {
      await sb.auth.signOut();
    } finally {
      _clear();
    }
  }

  void _clear() {
    session = null;
    profile = null;
    company = null;
    needsPasswordSetup = false;
    loading = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

/// Where invite emails send the invitee. Always the web app: the invitee
/// may not have the mobile app installed, and an admin inviting from a
/// phone must not produce a phone-only deep link.
String inviteRedirectUrl() {
  if (Env.webAppUrl.isNotEmpty) {
    final base = Env.webAppUrl.endsWith('/') ? Env.webAppUrl : '${Env.webAppUrl}/';
    return '${base}set-password';
  }
  return authRedirectUrl('set-password');
}

/// Where auth emails should send the user back to.
String authRedirectUrl(String path) {
  if (kIsWeb) {
    // CI sets APP_URL to the deployed site root (including any base path).
    final base =
        Env.webAppUrl.isNotEmpty ? Env.webAppUrl : Uri.base.origin;
    final trimmed = base.endsWith('/') ? base : '$base/';
    return '$trimmed$path';
  }
  return Env.nativeRedirect;
}

final authProvider = ChangeNotifierProvider<AuthController>(
  (ref) => AuthController(),
);
