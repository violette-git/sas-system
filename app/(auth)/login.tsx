import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useSignIn } from '@/features/auth/hooks/useSignIn';

export default function LoginScreen() {
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const { signIn, isLoading, error } = useSignIn();

  function fieldError(field: string) {
    return error?.field === field ? error.message : undefined;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>

          {/* Company Code — optional for platform owner */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Company Code</Text>
              <Text style={styles.labelHint}>Leave blank if you are the platform owner</Text>
            </View>
            <TextInput
              style={[styles.input, fieldError('accessCode') && styles.inputError]}
              placeholder="e.g. ACME-A1B2"
              autoCapitalize="characters"
              autoCorrect={false}
              value={accessCode}
              onChangeText={setAccessCode}
            />
            {fieldError('accessCode') && (
              <Text style={styles.errorText}>{fieldError('accessCode')}</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, fieldError('email') && styles.inputError]}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            {fieldError('email') && (
              <Text style={styles.errorText}>{fieldError('email')}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, fieldError('password') && styles.inputError]}
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {fieldError('password') && (
              <Text style={styles.errorText}>{fieldError('password')}</Text>
            )}
          </View>

          {/* General error */}
          {error?.field === 'general' && (
            <Text style={[styles.errorText, styles.errorGeneral]}>{error.message}</Text>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={() => signIn({ accessCode, email, password })}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Sign In</Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  header:   { marginBottom: 36, alignItems: 'center' },
  title:    { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6b7280', marginTop: 4 },

  form:  { gap: 16 },
  field: { gap: 4 },

  labelRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  label:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  labelHint: { fontSize: 11, color: '#9ca3af', flexShrink: 1 },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputError:   { borderColor: '#ef4444' },
  errorText:    { fontSize: 12, color: '#ef4444' },
  errorGeneral: { textAlign: 'center', fontSize: 14 },

  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
});
