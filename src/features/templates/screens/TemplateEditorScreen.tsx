import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
} from '@/features/templates/hooks/useTemplates';
import { useServiceTypes } from '@/features/service-types/hooks/useServiceTypes';
import { colors, spacing, radius, typography } from '@/theme';
import type { TemplateField, TemplateFieldType } from '@/lib/supabase';

const FIELD_TYPES: { type: TemplateFieldType; label: string; icon: string }[] = [
  { type: 'text',     label: 'Short text',   icon: 'text-outline' },
  { type: 'textarea', label: 'Long text',    icon: 'document-text-outline' },
  { type: 'dropdown', label: 'Dropdown',     icon: 'chevron-down-circle-outline' },
  { type: 'checkbox', label: 'Checkbox',     icon: 'checkbox-outline' },
  { type: 'date',     label: 'Date',         icon: 'calendar-outline' },
];

function makeField(type: TemplateFieldType): TemplateField {
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: '',
    required: false,
    options: type === 'dropdown' ? ['Option 1'] : undefined,
  };
}

export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const { data: existing, isLoading } = useTemplate(id);
  const { data: serviceTypes = [] } = useServiceTypes();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? '');
      setServiceTypeId(existing.service_type_id ?? null);
      setFields(existing.fields ?? []);
    }
  }, [existing]);

  function addField(type: TemplateFieldType) {
    setFields((prev) => [...prev, makeField(type)]);
    setShowTypePicker(false);
  }

  function updateField(idx: number, patch: Partial<TemplateField>) {
    setFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveField(idx: number, dir: 'up' | 'down') {
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= fields.length) return;
    const next = [...fields];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    setFields(next);
  }

  function addOption(fieldIdx: number) {
    updateField(fieldIdx, {
      options: [...(fields[fieldIdx].options ?? []), `Option ${(fields[fieldIdx].options?.length ?? 0) + 1}`],
    });
  }

  function updateOption(fieldIdx: number, optIdx: number, value: string) {
    const opts = [...(fields[fieldIdx].options ?? [])];
    opts[optIdx] = value;
    updateField(fieldIdx, { options: opts });
  }

  function removeOption(fieldIdx: number, optIdx: number) {
    const opts = (fields[fieldIdx].options ?? []).filter((_, i) => i !== optIdx);
    updateField(fieldIdx, { options: opts });
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please give this template a name.');
      return;
    }
    for (const [i, f] of fields.entries()) {
      if (!f.label.trim()) {
        Alert.alert('Field label required', `Field ${i + 1} needs a label.`);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      service_type_id: serviceTypeId,
      fields,
    };

    if (isNew) {
      createTemplate.mutate(payload, { onSuccess: () => router.back() });
    } else {
      updateTemplate.mutate({ id, ...payload }, { onSuccess: () => router.back() });
    }
  }

  const isBusy = createTemplate.isPending || updateTemplate.isPending;

  if (!isNew && isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={colors.accent} />
        <Text style={styles.backText}>Templates</Text>
      </TouchableOpacity>

      <Text style={styles.pageTitle}>{isNew ? 'New Template' : 'Edit Template'}</Text>

      {/* Basic info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Template Info</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Daily Progress Note"
            placeholderTextColor={colors.placeholder}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Briefly describe when to use this template…"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Service Type (optional)</Text>
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, !serviceTypeId && styles.chipSelected]}
              onPress={() => setServiceTypeId(null)}
            >
              <Text style={[styles.chipText, !serviceTypeId && styles.chipTextSelected]}>
                Any service
              </Text>
            </TouchableOpacity>
            {serviceTypes.map((st) => (
              <TouchableOpacity
                key={st.id}
                style={[styles.chip, serviceTypeId === st.id && styles.chipSelected]}
                onPress={() => setServiceTypeId(st.id)}
              >
                <Text style={[styles.chipText, serviceTypeId === st.id && styles.chipTextSelected]}>
                  {st.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Fields */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Fields ({fields.length})</Text>
          <TouchableOpacity
            style={styles.addFieldBtn}
            onPress={() => setShowTypePicker(!showTypePicker)}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addFieldBtnText}>Add Field</Text>
          </TouchableOpacity>
        </View>

        {/* Field type picker */}
        {showTypePicker && (
          <View style={styles.typePicker}>
            {FIELD_TYPES.map((ft) => (
              <TouchableOpacity
                key={ft.type}
                style={styles.typeOption}
                onPress={() => addField(ft.type)}
              >
                <Ionicons name={ft.icon as any} size={18} color={colors.accent} />
                <Text style={styles.typeOptionText}>{ft.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {fields.length === 0 && (
          <View style={styles.noFields}>
            <Text style={styles.noFieldsText}>No fields yet — add fields to create a structured form.</Text>
          </View>
        )}

        {fields.map((field, idx) => (
          <View key={field.id} style={styles.fieldCard}>
            {/* Field header */}
            <View style={styles.fieldCardHeader}>
              <View style={styles.fieldTypeTag}>
                <Ionicons
                  name={(FIELD_TYPES.find(t => t.type === field.type)?.icon ?? 'text-outline') as any}
                  size={12}
                  color={colors.accent}
                />
                <Text style={styles.fieldTypeText}>{field.type}</Text>
              </View>
              <View style={styles.fieldCardActions}>
                <TouchableOpacity onPress={() => moveField(idx, 'up')} disabled={idx === 0}>
                  <Ionicons name="chevron-up" size={16} color={idx === 0 ? colors.textMuted : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveField(idx, 'down')} disabled={idx === fields.length - 1}>
                  <Ionicons name="chevron-down" size={16} color={idx === fields.length - 1 ? colors.textMuted : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeField(idx)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Label */}
            <TextInput
              style={styles.input}
              value={field.label}
              onChangeText={(v) => updateField(idx, { label: v })}
              placeholder="Field label…"
              placeholderTextColor={colors.placeholder}
            />

            {/* Placeholder for text/textarea */}
            {(field.type === 'text' || field.type === 'textarea') && (
              <TextInput
                style={[styles.input, styles.inputSm]}
                value={field.placeholder ?? ''}
                onChangeText={(v) => updateField(idx, { placeholder: v })}
                placeholder="Placeholder text (optional)…"
                placeholderTextColor={colors.placeholder}
              />
            )}

            {/* Dropdown options */}
            {field.type === 'dropdown' && (
              <View style={styles.optionsList}>
                {(field.options ?? []).map((opt, oi) => (
                  <View key={oi} style={styles.optionRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={opt}
                      onChangeText={(v) => updateOption(idx, oi, v)}
                      placeholder={`Option ${oi + 1}`}
                      placeholderTextColor={colors.placeholder}
                    />
                    <TouchableOpacity onPress={() => removeOption(idx, oi)}>
                      <Ionicons name="close-circle" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addOptionBtn} onPress={() => addOption(idx)}>
                  <Ionicons name="add" size={14} color={colors.accent} />
                  <Text style={styles.addOptionBtnText}>Add option</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Required toggle */}
            <TouchableOpacity
              style={styles.requiredRow}
              onPress={() => updateField(idx, { required: !field.required })}
            >
              <View style={[styles.checkbox, field.required && styles.checkboxChecked]}>
                {field.required && <Ionicons name="checkmark" size={12} color={colors.text} />}
              </View>
              <Text style={styles.requiredLabel}>Required field</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, isBusy && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={isBusy}
      >
        {isBusy
          ? <ActivityIndicator color={colors.text} />
          : <Text style={styles.saveBtnText}>{isNew ? 'Create Template' : 'Save Changes'}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { ...typography.base, color: colors.accent },

  pageTitle: { ...typography.xl, color: colors.text, fontWeight: '700' },

  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },

  field: { gap: spacing.xs },
  fieldLabel: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  req: { color: colors.danger },

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
  inputSm: { ...typography.sm },
  textarea: { minHeight: 80, paddingTop: spacing.sm },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  chipText: { ...typography.sm, color: colors.textSecondary },
  chipTextSelected: { color: colors.accent, fontWeight: '600' },

  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
  },
  addFieldBtnText: { ...typography.sm, color: colors.accent, fontWeight: '600' },

  typePicker: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  typeOptionText: { ...typography.sm, color: colors.text },

  noFields: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noFieldsText: { ...typography.sm, color: colors.textMuted, textAlign: 'center' },

  fieldCard: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fieldTypeText: { ...typography.xs, color: colors.accent, fontWeight: '700' },
  fieldCardActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },

  optionsList: { gap: spacing.sm },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  addOptionBtnText: { ...typography.sm, color: colors.accent },

  requiredRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  requiredLabel: { ...typography.sm, color: colors.textSecondary },

  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { ...typography.base, color: colors.text, fontWeight: '700' },
});
