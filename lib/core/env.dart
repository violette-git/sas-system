/// Build-time configuration, injected with --dart-define.
///
///   flutter run --dart-define=SUPABASE_URL=https://xyz.supabase.co \
///               --dart-define=SUPABASE_ANON_KEY=eyJ...
///
/// CI passes these from GitHub repository secrets.
class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Where invite and password-reset emails send people back to.
  /// Web: the deployed site URL. Native: the custom scheme deep link.
  static const webAppUrl = String.fromEnvironment('APP_URL');
  static const nativeRedirect = 'com.sassystem.app://login-callback';

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
