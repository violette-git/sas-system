import 'package:supabase_flutter/supabase_flutter.dart';

/// Shorthand for the initialized Supabase client.
SupabaseClient get sb => Supabase.instance.client;

/// Turns any thrown error into a short, human-readable message.
String friendlyError(Object error) {
  if (error is PostgrestException) return error.message;
  if (error is AuthException) return error.message;
  if (error is FunctionException) {
    final details = error.details;
    if (details is Map && details['error'] != null) {
      return details['error'].toString();
    }
    return 'Request failed (${error.status}).';
  }
  final text = error.toString();
  return text.startsWith('Exception: ') ? text.substring(11) : text;
}
