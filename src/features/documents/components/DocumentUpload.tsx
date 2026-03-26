import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useUploadDocument } from '@/features/documents/hooks/useDocuments';
import { colors, spacing, radius, typography } from '@/theme';

const CATEGORIES = [
  { key: 'consent_form',       label: 'Consent Form' },
  { key: 'service_agreement',  label: 'Service Agreement' },
  { key: 'id_document',        label: 'ID Document' },
  { key: 'insurance',          label: 'Insurance' },
  { key: 'care_plan',          label: 'Care Plan' },
  { key: 'other',              label: 'Other' },
];

interface Props {
  clientId: string;
  scheduleId?: string | null;
  parentDocumentId?: string | null;
  onSuccess?: () => void;
}

export function DocumentUpload({ clientId, scheduleId, parentDocumentId, onSuccess }: Props) {
  const upload = useUploadDocument();
  const [category, setCategory] = useState<string>('other');
  const [description, setDescription] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'image/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    upload.mutate(
      {
        clientId,
        scheduleId: scheduleId ?? null,
        fileUri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        fileSizeBytes: asset.size,
        category,
        description: description || undefined,
        parentDocumentId: parentDocumentId ?? null,
      },
      {
        onSuccess: () => {
          setDescription('');
          onSuccess?.();
        },
        onError: (err) => {
          Alert.alert('Upload failed', (err as Error).message);
        },
      }
    );
  }

  const selectedCategory = CATEGORIES.find(c => c.key === category)?.label ?? 'Other';

  return (
    <View style={styles.wrapper}>
      {/* Category selector */}
      <TouchableOpacity
        style={styles.categoryRow}
        onPress={() => setShowCategoryPicker(!showCategoryPicker)}
      >
        <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.categoryText}>{selectedCategory}</Text>
        <Ionicons
          name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {showCategoryPicker && (
        <View style={styles.categoryList}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.categoryOption, category === c.key && styles.categoryOptionSelected]}
              onPress={() => {
                setCategory(c.key);
                setShowCategoryPicker(false);
              }}
            >
              <Text
                style={[
                  styles.categoryOptionText,
                  category === c.key && styles.categoryOptionTextSelected,
                ]}
              >
                {c.label}
              </Text>
              {category === c.key && (
                <Ionicons name="checkmark" size={14} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Upload button */}
      <TouchableOpacity
        style={[styles.uploadBtn, upload.isPending && styles.uploadBtnDisabled]}
        onPress={pickDocument}
        disabled={upload.isPending}
      >
        {upload.isPending ? (
          <>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.uploadBtnText}>Uploading…</Text>
          </>
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
            <Text style={styles.uploadBtnText}>
              {parentDocumentId ? 'Upload New Version' : 'Upload Document'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>PDF, images, Word documents — max 50 MB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },

  categoryRow: {
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
  categoryText: {
    ...typography.sm,
    color: colors.text,
    flex: 1,
  },

  categoryList: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryOptionSelected: { backgroundColor: colors.accentDim },
  categoryOptionText: { ...typography.sm, color: colors.textSecondary },
  categoryOptionTextSelected: { color: colors.accent, fontWeight: '600' },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: {
    ...typography.base,
    color: colors.accent,
    fontWeight: '600',
  },

  hint: {
    ...typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
