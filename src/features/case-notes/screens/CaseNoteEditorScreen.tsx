import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchedule } from '@/features/schedules/hooks/useSchedules';
import { useTemplates } from '@/features/templates/hooks/useTemplates';
import {
  useCaseNotesBySchedule,
  useCreateCaseNote,
  useUpdateCaseNote,
} from '@/features/case-notes/hooks/useCaseNotes';
import { RichTextEditor } from '@/features/case-notes/components/RichTextEditor';
import { TemplateFieldRenderer } from '@/features/case-notes/components/TemplateFieldRenderer';
import { PhotoAttachments } from '@/features/case-notes/components/PhotoAttachments';
import { colors, spacing, radius, typography } from '@/theme';
import type { Template, VisitNoteStatus } from '@/lib/supabase';

export default function CaseNoteEditorScreen() {
  const { scheduleId, noteId } = useLocalSearchParams<{
    scheduleId: string;
    noteId?: string;
  }>();
  const router = useRouter();

  const { data: schedule, isLoading: scheduleLoading } = useSchedule(scheduleId);
  const { data: templates = [] } = useTemplates();
  const { data: notes = [] } = useCaseNotesBySchedule(scheduleId);

  const createNote = useCreateCaseNote();
  const updateNote = useUpdateCaseNote();

  // Find existing note if editing
  const existingNote = noteId ? notes.find((n) => n.id === noteId) : undefined;

  const [body, setBody] = useState(existingNote?.body ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(existingNote?.photo_urls ?? []);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateData, setTemplateData] = useState<Record<string, unknown>>(
    (existingNote?.template_data as Record<string, unknown>) ?? {}
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Resolve template from existing note
  useEffect(() => {
    if (existingNote?.template_id && templates.length > 0) {
      const tmpl = templates.find((t) => t.id === existingNote.template_id);
      if (tmpl) setSelectedTemplate(tmpl);
    }
  }, [existingNote, templates]);

  function setTemplateField(fieldId: string, value: unknown) {
    setTemplateData((prev) => ({ ...prev, [fieldId]: value }));
  }

  function buildPayload(status: VisitNoteStatus) {
    return {
      schedule_id: scheduleId,
      body: body.trim(),
      photo_urls: photoUrls,
      template_id: selectedTemplate?.id ?? null,
      template_data: selectedTemplate ? templateData : null,
      status,
    };
  }

  function validateRequiredFields(): string | null {
    if (!body.trim()) return 'Please write a note before submitting.';
    if (selectedTemplate) {
      for (const field of selectedTemplate.fields) {
        if (field.required) {
          const val = templateData[field.id];
          const empty =
            val === undefined ||
            val === null ||
            val === '' ||
            (field.type === 'checkbox' && val === false);
          if (empty) return `"${field.label}" is required.`;
        }
      }
    }
    return null;
  }

  function handleSaveDraft() {
    const payload = buildPayload('draft');
    if (existingNote) {
      updateNote.mutate(
        { id: existingNote.id, ...payload },
        { onSuccess: () => router.back() }
      );
    } else {
      createNote.mutate(payload, { onSuccess: () => router.back() });
    }
  }

  function handleSubmit() {
    const err = validateRequiredFields();
    if (err) {
      Alert.alert('Validation', err);
      return;
    }
    const payload = buildPayload('submitted');
    if (existingNote) {
      updateNote.mutate(
        { id: existingNote.id, ...payload },
        { onSuccess: () => router.back() }
      );
    } else {
      createNote.mutate(payload, { onSuccess: () => router.back() });
    }
  }

  const isBusy = createNote.isPending || updateNote.isPending;

  if (scheduleLoading) {
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
        <Text style={styles.backText}>Visit</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {existingNote ? 'Edit Note' : 'New Case Note'}
        </Text>
        {schedule && (
          <Text style={styles.subtitle}>
            {schedule.clients?.name ?? '—'} ·{' '}
            {new Date(schedule.start_time).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Review feedback (if revision requested) */}
      {existingNote?.status === 'revision_requested' && existingNote.review_comment && (
        <View style={styles.revisionBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
          <View style={styles.revisionText}>
            <Text style={styles.revisionTitle}>Revision Requested</Text>
            <Text style={styles.revisionComment}>{existingNote.review_comment}</Text>
          </View>
        </View>
      )}

      {/* Template selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Template (optional)</Text>
        <TouchableOpacity
          style={styles.templateSelector}
          onPress={() => setShowTemplatePicker(!showTemplatePicker)}
        >
          <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.templateSelectorText}>
            {selectedTemplate?.name ?? 'No template — freeform note'}
          </Text>
          <Ionicons
            name={showTemplatePicker ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {showTemplatePicker && (
          <View style={styles.templateList}>
            <TouchableOpacity
              style={[styles.templateOption, !selectedTemplate && styles.templateOptionSelected]}
              onPress={() => { setSelectedTemplate(null); setShowTemplatePicker(false); }}
            >
              <Text style={styles.templateOptionText}>No template</Text>
              {!selectedTemplate && <Ionicons name="checkmark" size={14} color={colors.accent} />}
            </TouchableOpacity>
            {templates.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.templateOption,
                  selectedTemplate?.id === t.id && styles.templateOptionSelected,
                ]}
                onPress={() => {
                  setSelectedTemplate(t);
                  setShowTemplatePicker(false);
                  setTemplateData({});
                }}
              >
                <View style={styles.templateOptionBody}>
                  <Text style={styles.templateOptionText}>{t.name}</Text>
                  {t.description && (
                    <Text style={styles.templateOptionDesc}>{t.description}</Text>
                  )}
                </View>
                {selectedTemplate?.id === t.id && (
                  <Ionicons name="checkmark" size={14} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Template fields */}
      {selectedTemplate && selectedTemplate.fields.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{selectedTemplate.name} Fields</Text>
          <TemplateFieldRenderer
            fields={selectedTemplate.fields}
            values={templateData}
            onChange={setTemplateField}
          />
        </View>
      )}

      {/* Rich text body */}
      <View style={styles.section}>
        <RichTextEditor
          label="Notes / Summary"
          required
          value={body}
          onChangeText={setBody}
          placeholder="Describe what happened during this visit…"
          minHeight={160}
        />
      </View>

      {/* Photo attachments */}
      <View style={styles.section}>
        <PhotoAttachments
          urls={photoUrls}
          onChange={setPhotoUrls}
          scheduleId={scheduleId}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.draftBtn, isBusy && styles.btnDisabled]}
          onPress={handleSaveDraft}
          disabled={isBusy}
        >
          <Text style={styles.draftBtnText}>Save Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, isBusy && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={isBusy}
        >
          {isBusy
            ? <ActivityIndicator color={colors.text} size="small" />
            : <Text style={styles.submitBtnText}>Submit Note</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { ...typography.base, color: colors.accent },

  header: { gap: spacing.xs },
  title: { ...typography.xl, color: colors.text, fontWeight: '700' },
  subtitle: { ...typography.sm, color: colors.textSecondary },

  revisionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningDim,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  revisionText: { flex: 1, gap: spacing.xs },
  revisionTitle: { ...typography.sm, color: colors.warning, fontWeight: '700' },
  revisionComment: { ...typography.sm, color: colors.textSecondary },

  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },

  templateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateSelectorText: { ...typography.sm, color: colors.text, flex: 1 },

  templateList: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  templateOptionSelected: { backgroundColor: colors.accentDim },
  templateOptionBody: { flex: 1, gap: 2 },
  templateOptionText: { ...typography.sm, color: colors.text },
  templateOptionDesc: { ...typography.xs, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.md },
  draftBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  draftBtnText: { ...typography.base, color: colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  submitBtnText: { ...typography.base, color: colors.text, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
});
