import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, typography, shadow } from '@/theme';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useUpdateBranding, useUploadLogo } from '../hooks/useBranding';
import { ColorPicker } from '../components/ColorPicker';
import { LogoUpload } from '../components/LogoUpload';
import { Button } from '@/components/ui/Button';

export function BrandingScreen() {
  const { company } = useAuthStore();

  const [displayName, setDisplayName]       = useState(company?.company_name_display ?? '');
  const [primaryColor, setPrimaryColor]     = useState<string | null>(company?.primary_color ?? null);
  const [secondaryColor, setSecondaryColor] = useState<string | null>(company?.secondary_color ?? null);
  const [logoUrl, setLogoUrl]               = useState<string | null>(company?.logo_url ?? null);

  // Keep local state in sync if company changes in store
  useEffect(() => {
    if (!company) return;
    setDisplayName(company.company_name_display ?? '');
    setPrimaryColor(company.primary_color ?? null);
    setSecondaryColor(company.secondary_color ?? null);
    setLogoUrl(company.logo_url ?? null);
  }, [company?.id]);

  const updateBranding = useUpdateBranding();
  const uploadLogo     = useUploadLogo();

  async function handleLogoPick(uri: string) {
    try {
      const url = await uploadLogo.mutateAsync(uri);
      if (url) setLogoUrl(url);
    } catch (err: unknown) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleSave() {
    try {
      await updateBranding.mutateAsync({
        primary_color:        primaryColor,
        secondary_color:      secondaryColor,
        logo_url:             logoUrl,
        company_name_display: displayName.trim() || null,
      });
      Alert.alert('Saved', 'Branding updated successfully.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save branding');
    }
  }

  function handleReset() {
    Alert.alert('Reset Branding', 'This will remove all custom colors and logo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setPrimaryColor(null);
          setSecondaryColor(null);
          setLogoUrl(null);
          setDisplayName('');
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Brand Settings</Text>
        <Text style={styles.subtitle}>
          Customize colors and logo for {company?.name ?? 'your company'}.
          Changes are visible immediately to all users.
        </Text>
      </View>

      {/* Preview Card */}
      <View style={styles.previewCard}>
        <Text style={styles.sectionLabel}>PREVIEW</Text>
        <View style={[styles.previewBar, { backgroundColor: primaryColor ?? colors.accent }]} />
        <View style={styles.previewRow}>
          {logoUrl ? (
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            <View style={styles.previewLogoBox}>
              <Text style={styles.previewLogoText}>Logo set</Text>
            </View>
          ) : (
            <View style={[styles.previewLogoBox, { backgroundColor: primaryColor ?? colors.accent }]}>
              <Text style={styles.previewLogoLetter}>
                {(displayName || company?.name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.previewCompanyName}>
              {displayName || company?.name || 'Company Name'}
            </Text>
            <View style={[styles.previewBadge, { backgroundColor: primaryColor ?? colors.accent }]}>
              <Text style={styles.previewBadgeText}>Primary Color</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Display Name */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={company?.name ?? 'Company display name'}
          placeholderTextColor={colors.placeholder}
          maxLength={80}
        />
        <Text style={styles.hint}>
          Override how the company name appears across the app.
        </Text>
      </View>

      {/* Logo */}
      <View style={styles.section}>
        <LogoUpload
          logoUrl={logoUrl}
          uploading={uploadLogo.isPending}
          onPick={handleLogoPick}
        />
      </View>

      {/* Primary Color */}
      <View style={styles.section}>
        <ColorPicker
          label="Primary Color"
          value={primaryColor}
          onChange={setPrimaryColor}
        />
      </View>

      {/* Secondary Color */}
      <View style={styles.section}>
        <ColorPicker
          label="Secondary Color"
          value={secondaryColor}
          onChange={setSecondaryColor}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          onPress={handleSave}
          disabled={updateBranding.isPending || uploadLogo.isPending}
        >
          {updateBranding.isPending ? 'Saving…' : 'Save Branding'}
        </Button>
        <Button
          onPress={handleReset}
          variant="ghost"
        >
          Reset to Default
        </Button>
      </View>

      {updateBranding.isError && (
        <Text style={styles.error}>
          {updateBranding.error instanceof Error
            ? updateBranding.error.message
            : 'Save failed'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xxl,
    paddingBottom: 60,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.xl,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  previewBar: {
    height: 4,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewLogoBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLogoLetter: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  previewLogoText: {
    ...typography.xs,
    color: colors.textSecondary,
  },
  previewCompanyName: {
    ...typography.md,
    color: colors.text,
    fontWeight: '600',
  },
  previewBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  previewBadgeText: {
    ...typography.xs,
    color: '#fff',
    fontWeight: '600',
  },
  sectionLabel: {
    ...typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.base,
  },
  hint: {
    ...typography.xs,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
  error: {
    ...typography.sm,
    color: colors.danger,
    textAlign: 'center',
  },
});
