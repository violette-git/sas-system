import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTemplates, useDeactivateTemplate } from '@/features/templates/hooks/useTemplates';
import { colors, spacing, radius, typography } from '@/theme';
import type { Template } from '@/lib/supabase';

export default function TemplateListScreen() {
  const router = useRouter();
  const { data: templates = [], isLoading, refetch } = useTemplates();
  const deactivate = useDeactivateTemplate();

  function handleDelete(template: Template) {
    Alert.alert(
      'Deactivate Template',
      `"${template.name}" will no longer be available to employees. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => deactivate.mutate(template.id),
        },
      ]
    );
  }

  function navToEditor(id?: string) {
    router.push({
      pathname: '/(admin)/template/[id]',
      params: { id: id ?? 'new' },
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
        data={templates}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.pageTitle}>Templates</Text>
              <Text style={styles.pageSubtitle}>
                {templates.length} active template{templates.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => navToEditor()}>
              <Ionicons name="add" size={20} color={colors.text} />
              <Text style={styles.addBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptyDesc}>
              Create templates to give employees structured forms for visit notes.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navToEditor()}>
              <Text style={styles.emptyBtnText}>Create First Template</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: t }) => (
          <View style={styles.templateCard}>
            <TouchableOpacity style={styles.templateBody} onPress={() => navToEditor(t.id)}>
              <View style={styles.templateIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{t.name}</Text>
                {t.description && (
                  <Text style={styles.templateDesc} numberOfLines={1}>{t.description}</Text>
                )}
                <Text style={styles.templateMeta}>
                  {t.fields.length} field{t.fields.length !== 1 ? 's' : ''}
                  {t.service_type_id ? ' · Service-specific' : ''}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.templateActions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navToEditor(t.id)}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(t)}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pageTitle: { ...typography.xl, color: colors.text, fontWeight: '700' },
  pageSubtitle: { ...typography.sm, color: colors.textSecondary },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtnText: { ...typography.sm, color: colors.text, fontWeight: '600' },

  emptyState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyTitle: { ...typography.lg, color: colors.text, fontWeight: '700' },
  emptyDesc: { ...typography.sm, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  emptyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyBtnText: { ...typography.base, color: colors.text, fontWeight: '600' },

  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  templateBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: { flex: 1, gap: 2 },
  templateName: { ...typography.base, color: colors.text, fontWeight: '600' },
  templateDesc: { ...typography.sm, color: colors.textSecondary },
  templateMeta: { ...typography.xs, color: colors.textMuted },

  templateActions: { flexDirection: 'row', gap: spacing.sm },
  editBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accentDim,
  },
  deleteBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerDim,
  },
});
