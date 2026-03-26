import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useDocumentsByClient,
  useDeleteDocument,
} from '@/features/documents/hooks/useDocuments';
import { DocumentUpload } from '@/features/documents/components/DocumentUpload';
import { colors, spacing, radius, typography } from '@/theme';
import type { Document } from '@/lib/supabase';

const CATEGORY_LABELS: Record<string, string> = {
  consent_form:      'Consent Form',
  service_agreement: 'Service Agreement',
  id_document:       'ID Document',
  insurance:         'Insurance',
  care_plan:         'Care Plan',
  other:             'Other',
};

const FILE_ICONS: Record<string, string> = {
  'application/pdf': 'document-outline',
  'image/jpeg': 'image-outline',
  'image/png':  'image-outline',
  'image/webp': 'image-outline',
};

function fileIcon(mimeType: string | null): string {
  if (!mimeType) return 'document-outline';
  return FILE_ICONS[mimeType] ?? 'document-outline';
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  clientId: string;
}

export default function DocumentsScreen({ clientId }: Props) {
  const router = useRouter();
  const { data: documents = [], isLoading, refetch } = useDocumentsByClient(clientId);
  const deleteDoc = useDeleteDocument();

  const [showUpload, setShowUpload] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  function handleOpen(doc: Document) {
    Linking.openURL(doc.file_url).catch(() =>
      Alert.alert('Error', 'Could not open the file.')
    );
  }

  function handleDelete(doc: Document) {
    Alert.alert(
      'Delete Document',
      `Delete "${doc.file_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteDoc.mutate({ id: doc.id, clientId }),
        },
      ]
    );
  }

  function handleSignature(doc: Document) {
    router.push({
      pathname: '/(admin)/client/[id]/signature',
      params: { id: clientId, documentId: doc.id },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={styles.uploadToggleBtn}
              onPress={() => {
                setReplacingId(null);
                setShowUpload(!showUpload);
              }}
            >
              <Ionicons name={showUpload ? 'close' : 'cloud-upload-outline'} size={16} color={colors.accent} />
              <Text style={styles.uploadToggleBtnText}>{showUpload ? 'Cancel' : 'Upload'}</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          !showUpload ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No documents</Text>
              <Text style={styles.emptyDesc}>Upload consent forms, care plans, and other client documents here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item: doc }) => (
          <View style={styles.docCard}>
            <View style={styles.docIcon}>
              <Ionicons
                name={fileIcon(doc.file_type) as any}
                size={22}
                color={colors.accent}
              />
            </View>

            <View style={styles.docInfo}>
              <Text style={styles.docName} numberOfLines={1}>{doc.file_name}</Text>
              <View style={styles.docMeta}>
                {doc.category && (
                  <Text style={styles.docCategory}>
                    {CATEGORY_LABELS[doc.category] ?? doc.category}
                  </Text>
                )}
                {doc.version > 1 && (
                  <Text style={styles.docVersion}>v{doc.version}</Text>
                )}
                <Text style={styles.docDate}>{fmtDate(doc.created_at)}</Text>
                {doc.file_size_bytes && (
                  <Text style={styles.docSize}>{fmtSize(doc.file_size_bytes)}</Text>
                )}
              </View>
              {doc.description && (
                <Text style={styles.docDesc} numberOfLines={1}>{doc.description}</Text>
              )}
              {doc.signature_url && (
                <View style={styles.signedBadge}>
                  <Ionicons name="pencil-outline" size={10} color={colors.success} />
                  <Text style={styles.signedBadgeText}>Signed</Text>
                </View>
              )}
            </View>

            <View style={styles.docActions}>
              <TouchableOpacity onPress={() => handleOpen(doc)} style={styles.iconBtn}>
                <Ionicons name="open-outline" size={18} color={colors.accent} />
              </TouchableOpacity>
              {!doc.signature_url && (
                <TouchableOpacity onPress={() => handleSignature(doc)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(doc)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Upload panel */}
      {showUpload && (
        <View style={styles.uploadPanel}>
          <Text style={styles.uploadPanelTitle}>
            {replacingId ? 'Upload New Version' : 'Upload Document'}
          </Text>
          <DocumentUpload
            clientId={clientId}
            parentDocumentId={replacingId}
            onSuccess={() => {
              setShowUpload(false);
              setReplacingId(null);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 200 },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  uploadToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
  },
  uploadToggleBtnText: { ...typography.sm, color: colors.accent, fontWeight: '600' },

  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: { ...typography.lg, color: colors.text, fontWeight: '700' },
  emptyDesc: {
    ...typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  docCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: { flex: 1, gap: 3 },
  docName: { ...typography.base, color: colors.text, fontWeight: '600' },
  docMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  docCategory: {
    ...typography.xs,
    color: colors.accent,
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
    fontWeight: '600',
  },
  docVersion: {
    ...typography.xs,
    color: colors.warning,
    fontWeight: '700',
  },
  docDate: { ...typography.xs, color: colors.textMuted },
  docSize: { ...typography.xs, color: colors.textMuted },
  docDesc: { ...typography.xs, color: colors.textSecondary },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  signedBadgeText: {
    ...typography.xs,
    color: colors.success,
    fontWeight: '700',
  },

  docActions: { gap: spacing.xs },
  iconBtn: {
    padding: spacing.xs,
  },

  uploadPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  uploadPanelTitle: { ...typography.base, color: colors.text, fontWeight: '700' },
});
