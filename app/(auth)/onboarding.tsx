import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { colors, spacing, radius } from '@/theme';

// ── Types ─────────────────────────────────────────────────────
interface CompanyData {
  id: string;
  name: string;
  trade_name: string | null;
  access_code: string;
}

interface ServiceTypeEntry {
  name: string;
  short_code: string;
}

type Step = 1 | 2 | 3 | 4;

// ── Step indicators ───────────────────────────────────────────
function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }).map((_, i) => {
        const step = (i + 1) as Step;
        const done    = current > step;
        const active  = current === step;
        return (
          <View key={i} style={si.itemWrap}>
            <View style={[si.dot, active && si.dotActive, done && si.dotDone]}>
              {done
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[si.dotText, active && si.dotTextActive]}>{step}</Text>
              }
            </View>
            {i < total - 1 && (
              <View style={[si.line, (done || active) && si.lineFill]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  itemWrap:      { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.elevated,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  dotDone:       { backgroundColor: colors.accent, borderColor: colors.accent },
  dotText:       { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dotTextActive: { color: colors.accent },
  line:          { width: 36, height: 1.5, backgroundColor: colors.border, marginHorizontal: 4 },
  lineFill:      { backgroundColor: colors.accent },
});

// ── Main screen ───────────────────────────────────────────────
export default function OnboardingScreen() {
  const router  = useRouter();
  const { profile, setCompany } = useAuthStore();

  const [step, setStep]           = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 — Company
  const [companyName,  setCompanyName]  = useState('');
  const [tradeName,    setTradeName]    = useState('');
  const [nameError,    setNameError]    = useState('');
  const [createdCompany, setCreatedCompany] = useState<CompanyData | null>(null);

  // Step 2 — Service types
  const [serviceTypes,   setServiceTypes]   = useState<ServiceTypeEntry[]>([{ name: '', short_code: '' }]);
  const [stError,        setStError]        = useState('');

  // Step 3 — First admin
  const [adminName,   setAdminName]   = useState('');
  const [adminEmail,  setAdminEmail]  = useState('');
  const [adminErrors, setAdminErrors] = useState<Record<string, string>>({});
  const [inviteSkipped, setInviteSkipped] = useState(false);

  // ── Step 1: Create company ─────────────────────────────────
  async function handleCreateCompany() {
    const trimName = companyName.trim();
    if (!trimName) { setNameError('Company name is required.'); return; }

    setIsLoading(true);
    setNameError('');

    try {
      const { data: code, error: codeErr } = await supabase
        .rpc('generate_access_code', { company_name: trimName });
      if (codeErr) throw codeErr;

      const { data, error } = await supabase
        .from('companies')
        .insert({ name: trimName, trade_name: tradeName.trim() || null, access_code: code })
        .select()
        .single();
      if (error) throw error;

      // Link owner profile to this company
      await supabase
        .from('users')
        .update({ company_id: data.id })
        .eq('id', profile!.id);

      setCreatedCompany(data);
      setCompany(data);
      setStep(2);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create company.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: Add service types ──────────────────────────────
  function addServiceTypeRow() {
    setServiceTypes((prev) => [...prev, { name: '', short_code: '' }]);
  }

  function updateServiceType(index: number, field: keyof ServiceTypeEntry, value: string) {
    setServiceTypes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setStError('');
  }

  function removeServiceType(index: number) {
    if (serviceTypes.length === 1) return;
    setServiceTypes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveServiceTypes() {
    const valid = serviceTypes.filter((st) => st.name.trim());
    if (valid.length === 0) { setStError('Add at least one service type.'); return; }
    if (!createdCompany) return;

    setIsLoading(true);
    setStError('');

    try {
      const rows = valid.map((st) => ({
        company_id: createdCompany.id,
        name: st.name.trim(),
        short_code: st.short_code.trim() || null,
      }));

      const { error } = await supabase.from('service_types').insert(rows);
      if (error) throw error;

      setStep(3);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save service types.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Invite first admin ─────────────────────────────
  async function handleInviteAdmin() {
    const errors: Record<string, string> = {};
    if (!adminName.trim())  errors.name  = 'Name is required.';
    if (!adminEmail.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()))
      errors.email = 'Enter a valid email.';

    if (Object.keys(errors).length) { setAdminErrors(errors); return; }
    if (!createdCompany) return;

    setIsLoading(true);
    setAdminErrors({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            full_name:  adminName.trim(),
            email:      adminEmail.trim().toLowerCase(),
            role:       'admin',
            company_id: createdCompany.id,
            redirect_to: `${process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:8081'}/(auth)/set-password`,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send invite.');

      setStep(4);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to invite admin.');
    } finally {
      setIsLoading(false);
    }
  }

  function skipInvite() {
    setInviteSkipped(true);
    setStep(4);
  }

  // ── Finish ─────────────────────────────────────────────────
  function handleFinish() {
    router.replace('/(owner)');
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <StepIndicator current={step} total={4} />

        {/* ── STEP 1: Company ────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.card}>
            <View style={styles.stepIcon}>
              <Ionicons name="business-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.stepTitle}>Create Your Company</Text>
            <Text style={styles.stepSubtitle}>
              Set up your organization on the platform.
            </Text>

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>Legal Name *</Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  placeholder="e.g. Acme Health Services LLC"
                  placeholderTextColor={colors.placeholder}
                  value={companyName}
                  onChangeText={(t) => { setCompanyName(t); setNameError(''); }}
                  autoFocus
                />
                {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Trade / DBA Name</Text>
                <Text style={styles.labelHint}>Optional — displayed to staff</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Acme Care"
                  placeholderTextColor={colors.placeholder}
                  value={tradeName}
                  onChangeText={setTradeName}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleCreateCompany}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.buttonText}>Create Company</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Service Types ───────────────────────────── */}
        {step === 2 && (
          <View style={styles.card}>
            <View style={styles.stepIcon}>
              <Ionicons name="construct-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.stepTitle}>Service Types</Text>
            <Text style={styles.stepSubtitle}>
              Add the types of services your company provides.
            </Text>

            {serviceTypes.map((st, i) => (
              <View key={i} style={styles.stRow}>
                <View style={styles.stInputs}>
                  <TextInput
                    style={styles.input}
                    placeholder="Service name (e.g. Behavioral Aide)"
                    placeholderTextColor={colors.placeholder}
                    value={st.name}
                    onChangeText={(t) => updateServiceType(i, 'name', t)}
                  />
                  <TextInput
                    style={[styles.input, styles.inputShort]}
                    placeholder="Code (e.g. BA)"
                    placeholderTextColor={colors.placeholder}
                    value={st.short_code}
                    onChangeText={(t) => updateServiceType(i, 'short_code', t)}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>
                {serviceTypes.length > 1 && (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeServiceType(i)}>
                    <Ionicons name="close-circle" size={22} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {stError ? <Text style={styles.errorText}>{stError}</Text> : null}

            <TouchableOpacity style={styles.addRowBtn} onPress={addServiceTypeRow}>
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={styles.addRowText}>Add another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSaveServiceTypes}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.buttonText}>Save &amp; Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Invite Admin ─────────────────────────────── */}
        {step === 3 && (
          <View style={styles.card}>
            <View style={styles.stepIcon}>
              <Ionicons name="person-add-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.stepTitle}>Invite First Admin</Text>
            <Text style={styles.stepSubtitle}>
              Invite someone to manage schedules and staff. They'll get an email to set up their account.
            </Text>

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={[styles.input, adminErrors.name ? styles.inputError : null]}
                  placeholder="e.g. Jane Smith"
                  placeholderTextColor={colors.placeholder}
                  value={adminName}
                  onChangeText={(t) => { setAdminName(t); setAdminErrors((e) => ({ ...e, name: '' })); }}
                  autoFocus
                />
                {adminErrors.name ? <Text style={styles.errorText}>{adminErrors.name}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={[styles.input, adminErrors.email ? styles.inputError : null]}
                  placeholder="admin@yourcompany.com"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={adminEmail}
                  onChangeText={(t) => { setAdminEmail(t); setAdminErrors((e) => ({ ...e, email: '' })); }}
                />
                {adminErrors.email ? <Text style={styles.errorText}>{adminErrors.email}</Text> : null}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleInviteAdmin}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.buttonText}>Send Invite</Text>
                    <Ionicons name="send-outline" size={16} color="#fff" />
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={skipInvite} disabled={isLoading}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 4: Success ──────────────────────────────────── */}
        {step === 4 && createdCompany && (
          <View style={[styles.card, styles.successCard]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>You're all set!</Text>
            <Text style={styles.successBody}>
              Your company <Text style={styles.highlight}>{createdCompany.trade_name ?? createdCompany.name}</Text> has been created.
            </Text>

            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Company Access Code</Text>
              <Text style={styles.codeValue}>{createdCompany.access_code}</Text>
              <Text style={styles.codeHint}>Share this code with staff when they sign in.</Text>
            </View>

            {!inviteSkipped && (
              <View style={styles.invitedNote}>
                <Ionicons name="mail-outline" size={16} color={colors.success} />
                <Text style={styles.invitedNoteText}>
                  Invite sent to <Text style={{ fontWeight: '600' }}>{adminEmail}</Text>
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleFinish}>
              <Text style={styles.buttonText}>Go to Dashboard</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.xxl, paddingTop: spacing.xl },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },

  stepIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stepTitle:    { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  stepSubtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },

  fields:   { gap: spacing.md, marginBottom: spacing.lg },
  field:    { gap: spacing.xs },
  label:    { fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  labelHint:{ fontSize: 11, color: colors.textMuted, marginTop: -2 },
  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.xs,
  },
  inputShort:   { marginTop: spacing.xs },
  inputError:   { borderColor: colors.danger },
  errorText:    { fontSize: 12, color: colors.danger, marginTop: 2 },

  // Service type rows
  stRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stInputs: { flex: 1, gap: spacing.xs },
  removeBtn: { paddingTop: spacing.md },

  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  addRowText: { fontSize: 14, color: colors.accent, fontWeight: '600' },

  button: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '600' },

  skipBtn:  { alignItems: 'center', marginTop: spacing.lg },
  skipText: { fontSize: 14, color: colors.textMuted },

  // Success
  successCard:    { alignItems: 'center', gap: spacing.md },
  successIcon:    { marginBottom: spacing.sm },
  successTitle:   { fontSize: 24, fontWeight: '700', color: colors.text },
  successBody:    { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  highlight:      { color: colors.text, fontWeight: '600' },

  codeCard: {
    backgroundColor: colors.elevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    marginVertical: spacing.sm,
  },
  codeLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  codeValue: { fontSize: 28, fontWeight: '700', color: colors.accent, letterSpacing: 2, marginBottom: spacing.xs },
  codeHint:  { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  invitedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successDim,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  invitedNoteText: { fontSize: 13, color: colors.success, flex: 1 },
});
