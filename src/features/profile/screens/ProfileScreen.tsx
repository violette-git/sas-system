import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Switch, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { colors, spacing, radius, typography } from '@/theme';

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ── Row in a section card ─────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Toggle row ────────────────────────────────────────────────
function ToggleRow({ label, subtitle, value, onValueChange }: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {subtitle && <Text style={styles.toggleSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.elevated, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function ProfileScreen() {
  const { profile, setProfile } = useAuthStore();

  // Profile fields
  const [fullName,    setFullName]    = useState(profile?.full_name ?? '');
  const [phone,       setPhone]       = useState(profile?.phone ?? '');
  const [avatarUrl,   setAvatarUrl]   = useState(profile?.avatar_url ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError,  setProfileError]  = useState('');

  // Password fields
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [pwSaving,    setPwSaving]    = useState(false);
  const [pwError,     setPwError]     = useState('');

  // Notification prefs (UI-only toggles; persisted to users.preferences if column exists)
  const [pushEnabled,  setPushEnabled]  = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled,   setSmsEnabled]   = useState(false);

  // ── Save profile ────────────────────────────────────────────
  async function handleSaveProfile() {
    const trimName = fullName.trim();
    if (!trimName) { setProfileError('Name is required.'); return; }

    setProfileSaving(true);
    setProfileError('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name:  trimName,
          phone:      phone.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', profile!.id);

      if (error) throw error;

      setProfile({
        ...profile!,
        full_name:  trimName,
        phone:      phone.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });

      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (e: any) {
      setProfileError(e.message ?? 'Failed to save profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Change password ─────────────────────────────────────────
  async function handleChangePassword() {
    if (!currentPw) { setPwError('Enter your current password.'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }

    setPwSaving(true);
    setPwError('');

    try {
      // Re-authenticate to verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile!.email,
        password: currentPw,
      });
      if (signInErr) { setPwError('Current password is incorrect.'); return; }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw updateErr;

      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      Alert.alert('Done', 'Password changed successfully.');
    } catch (e: any) {
      setPwError(e.message ?? 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  const initials = (profile?.full_name ?? '?').charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Avatar / header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          {profile?.avatar_url
            ? null /* would render Image here */
            : <Text style={styles.avatarText}>{initials}</Text>
          }
        </View>
        <Text style={styles.headerName}>{profile?.full_name}</Text>
        <Text style={styles.headerEmail}>{profile?.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>{profile?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Personal Info ──────────────────────────────────── */}
      <Section title="Personal Information">
        <FieldRow label="Full Name">
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={(t) => { setFullName(t); setProfileError(''); }}
            placeholder="Your name"
            placeholderTextColor={colors.placeholder}
          />
        </FieldRow>
        <View style={styles.divider} />
        <FieldRow label="Phone">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
          />
        </FieldRow>
        <View style={styles.divider} />
        <FieldRow label="Avatar URL">
          <TextInput
            style={styles.input}
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://..."
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </FieldRow>

        {profileError ? (
          <Text style={styles.errorText}>{profileError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, profileSaving && styles.btnDisabled]}
          onPress={handleSaveProfile}
          disabled={profileSaving}
        >
          {profileSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </Section>

      {/* ── Change Password ─────────────────────────────────── */}
      <Section title="Change Password">
        <FieldRow label="Current">
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, styles.pwInput]}
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry={!showCurrent}
              placeholder="••••••••"
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent((v) => !v)}>
              <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FieldRow>
        <View style={styles.divider} />
        <FieldRow label="New">
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, styles.pwInput]}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry={!showNew}
              placeholder="Min 8 characters"
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew((v) => !v)}>
              <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FieldRow>
        <View style={styles.divider} />
        <FieldRow label="Confirm">
          <TextInput
            style={styles.input}
            value={confirmPw}
            onChangeText={setConfirmPw}
            secureTextEntry
            placeholder="Repeat new password"
            placeholderTextColor={colors.placeholder}
          />
        </FieldRow>

        {pwError ? <Text style={styles.errorText}>{pwError}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, pwSaving && styles.btnDisabled]}
          onPress={handleChangePassword}
          disabled={pwSaving}
        >
          {pwSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Update Password</Text>
          }
        </TouchableOpacity>
      </Section>

      {/* ── Notification Preferences ────────────────────────── */}
      <Section title="Notification Preferences">
        <ToggleRow
          label="Push Notifications"
          subtitle="Alerts on this device"
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Email Notifications"
          subtitle="Summaries and alerts via email"
          value={emailEnabled}
          onValueChange={setEmailEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="SMS Notifications"
          subtitle="Text messages for urgent alerts"
          value={smsEnabled}
          onValueChange={setSmsEnabled}
        />
      </Section>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg, paddingBottom: 80 },

  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText:  { fontSize: 28, fontWeight: '700', color: '#fff' },
  headerName:  { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  headerEmail: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
  rolePill: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  rolePillText: { fontSize: 11, fontWeight: '700', color: colors.accent, letterSpacing: 0.8 },

  section:      { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.6, marginBottom: spacing.sm, paddingHorizontal: 4 },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  fieldRow:  { paddingVertical: spacing.md },
  fieldLabel:{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  divider: { height: 1, backgroundColor: colors.border },

  pwWrap:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pwInput: { flex: 1 },
  eyeBtn:  { padding: spacing.sm },

  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.sm },

  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  toggleText:     { flex: 1 },
  toggleLabel:    { fontSize: 15, color: colors.text, fontWeight: '500' },
  toggleSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
