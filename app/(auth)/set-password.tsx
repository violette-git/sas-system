import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { checkPassword, RULE_LABELS } from '@/lib/passwordValidation';
import type { PasswordRules } from '@/lib/passwordValidation';

export default function SetPasswordScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const strength = checkPassword(password);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = strength.isValid && confirm === password && confirm.length > 0;

  async function handleSetPassword() {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    // Redirect based on role now that setup is complete
    if (profile?.role === 'admin')    { router.replace('/(admin)');    return; }
    if (profile?.role === 'employee') { router.replace('/(employee)'); return; }
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.title}>Set Your Password</Text>
          <Text style={styles.subtitle}>
            {profile?.full_name ? `Welcome, ${profile.full_name}!` : 'Welcome!'} Choose a secure password to get started.
          </Text>
        </View>

        <View style={styles.form}>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Create a password"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Strength bar */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSegment,
                        { backgroundColor: i <= strength.score ? strength.color : '#e5e7eb' },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}

            {/* Rule checklist */}
            {password.length > 0 && (
              <View style={styles.rules}>
                {(Object.keys(RULE_LABELS) as (keyof PasswordRules)[]).map((key) => (
                  <View key={key} style={styles.ruleRow}>
                    <Ionicons
                      name={strength.rules[key] ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={strength.rules[key] ? '#22c55e' : '#9ca3af'}
                    />
                    <Text style={[styles.ruleText, strength.rules[key] && styles.ruleTextPassed]}>
                      {RULE_LABELS[key]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Confirm password */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, confirmMismatch && styles.inputError]}
                placeholder="Re-enter your password"
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {confirmMismatch && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {error && <Text style={[styles.errorText, { textAlign: 'center' }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSetPassword}
            disabled={!canSubmit || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Set Password & Continue</Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#f8f9fa' },
  scroll:   { flexGrow: 1, justifyContent: 'center', padding: 24 },

  header:   { marginBottom: 32, alignItems: 'center' },
  title:    { fontSize: 26, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center' },

  form:  { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },

  inputRow:  { flexDirection: 'row', alignItems: 'center' },
  inputFlex: { flex: 1 },
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
  inputError: { borderColor: '#ef4444' },
  eyeBtn:     { position: 'absolute', right: 12 },

  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  strengthBar:       { flex: 1, flexDirection: 'row', gap: 3 },
  strengthSegment:   { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel:     { fontSize: 12, fontWeight: '600', width: 72, textAlign: 'right' },

  rules:          { gap: 4, marginTop: 6 },
  ruleRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText:       { fontSize: 12, color: '#9ca3af' },
  ruleTextPassed: { color: '#22c55e' },

  errorText: { fontSize: 12, color: '#ef4444' },

  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
});
