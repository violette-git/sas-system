import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { useLanguage } from '../hooks/useLanguage';

interface LanguagePickerProps {
  label?: string;
}

export function LanguagePicker({ label = 'Language' }: LanguagePickerProps) {
  const { currentLanguage, setLanguage, isPending } = useLanguage();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.options}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = currentLanguage === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => !active && setLanguage(lang.code as SupportedLanguage)}
              disabled={isPending}
            >
              <Text style={styles.flag}>
                {lang.code === 'en' ? '🇺🇸' : '🇪🇸'}
              </Text>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                  {lang.nativeLabel}
                </Text>
                <Text style={styles.optionSub}>{lang.label}</Text>
              </View>
              {active && (
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  flag: {
    fontSize: 22,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  optionLabelActive: {
    color: colors.accent,
  },
  optionSub: {
    ...typography.xs,
    color: colors.textMuted,
  },
});
