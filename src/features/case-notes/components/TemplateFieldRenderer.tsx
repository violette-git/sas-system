import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import type { TemplateField } from '@/lib/supabase';

interface Props {
  fields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
}

export function TemplateFieldRenderer({ fields, values, onChange }: Props) {
  if (fields.length === 0) return null;

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(val) => onChange(field.id, val)}
        />
      ))}
    </View>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {field.label}
        {field.required && <Text style={styles.required}> *</Text>}
      </Text>

      {field.type === 'text' && (
        <TextInput
          style={styles.input}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}…`}
          placeholderTextColor={colors.placeholder}
        />
      )}

      {field.type === 'textarea' && (
        <TextInput
          style={[styles.input, styles.textarea]}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}…`}
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      )}

      {field.type === 'dropdown' && (
        <DropdownField
          options={field.options ?? []}
          value={value as string | undefined}
          onChange={onChange}
        />
      )}

      {field.type === 'checkbox' && (
        <View style={styles.switchRow}>
          <Switch
            value={Boolean(value)}
            onValueChange={onChange}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.text}
          />
          <Text style={styles.switchLabel}>{value ? 'Yes' : 'No'}</Text>
        </View>
      )}

      {field.type === 'date' && (
        <TextInput
          style={styles.input}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholder}
          keyboardType="numbers-and-punctuation"
        />
      )}
    </View>
  );
}

function DropdownField({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | undefined;
  onChange: (val: unknown) => void;
}) {
  return (
    <View style={styles.dropdownContainer}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
            onPress={() => onChange(opt)}
          >
            <Text
              style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextSelected]}
            >
              {opt}
            </Text>
            {selected && (
              <Ionicons name="checkmark" size={14} color={colors.accent} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },

  fieldWrapper: { gap: spacing.sm },

  label: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  required: { color: colors.danger },

  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.base,
    color: colors.text,
  },
  textarea: {
    minHeight: 80,
    paddingTop: spacing.sm,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchLabel: {
    ...typography.sm,
    color: colors.textSecondary,
  },

  dropdownContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  dropdownOptionText: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  dropdownOptionTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
});
