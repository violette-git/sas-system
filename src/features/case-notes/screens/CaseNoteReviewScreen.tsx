import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  useCaseNoteReviewQueue,
  useApproveNote,
  useRejectNote,
  useRequestRevision,
} from '@/features/case-notes/hooks/useCaseNotes';
import { colors, spacing, radius, typography } from '@/theme';
import type { VisitNote, VisitNoteStatus } from '@/lib/supabase';

const STATUS_CONFIG: Record<VisitNoteStatus, { color: string; label: string }> = {
  draft:              { color: colors.textMuted,   label: 'Draft' },
  submitted:          { color: colors.warning,     label: 'Needs Review' },
  approved:           { color: colors.success,     label: 'Approved' },
  revision_requested: { color: colors.warning,     label: 'Revision Requested' },
  rejected:           { color: colors.danger,      label: 'Rejected' },
};

type NoteWithRelations = VisitNote & {
  schedules: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    clients: { id: string; name: string } | null;
    users: { id: string; full_name: string } | null;
  } | null;
};

export default function CaseNoteReviewScreen() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id ?? '';

  const { data: notes = [], isLoading, refetch } = useCaseNoteReviewQueue();
  const approveNote = useApproveNote();
  const rejectNote = useRejectNote();
  const requestRevision = useRequestRevision();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});

  function getComment(id: string) { return commentMap[id] ?? ''; }
  function setComment(id: string, text: string) {
    setCommentMap((p) => ({ ...p, [id]: text }));
  }

  function handleApprove(note: NoteWithRelations) {
    Alert.alert('Approve Note', 'Mark this note as approved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: () =>
          approveNote.mutate({ id: note.id, companyId }),
      },
    ]);
  }

  function handleReject(note: NoteWithRelations) {
    const comment = getComment(note.id);
    if (!comment.trim()) {
      Alert.alert('Comment required', 'Please add a comment explaining why the note is rejected.');
      return;
    }
    Alert.alert('Reject Note', 'This will mark the note as rejected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => rejectNote.mutate({ id: note.id, companyId, comment }),
      },
    ]);
  }

  function handleRequestRevision(note: NoteWithRelations) {
    const comment = getComment(note.id);
    if (!comment.trim()) {
      Alert.alert('Comment required', 'Please explain what needs to be revised.');
      return;
    }
    requestRevision.mutate({ id: note.id, companyId, comment });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
    >
      <Text style={styles.pageTitle}>Case Note Review</Text>
      <Text style={styles.pageSubtitle}>
        {notes.length} note{notes.length !== 1 ? 's' : ''} awaiting review
      </Text>

      {notes.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.success} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyDesc}>No case notes are currently awaiting review.</Text>
        </View>
      )}

      {notes.map((note) => {
        const statusCfg = STATUS_CONFIG[note.status ?? 'submitted'] ?? STATUS_CONFIG.submitted;
        const isExpanded = expandedId === note.id;
        const isBusy =
          approveNote.isPending || rejectNote.isPending || requestRevision.isPending;

        return (
          <View key={note.id} style={styles.noteCard}>
            {/* Summary row */}
            <TouchableOpacity
              style={styles.noteHeader}
              onPress={() => setExpandedId(isExpanded ? null : note.id)}
            >
              <View style={styles.noteHeaderLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                <View style={styles.noteHeaderText}>
                  <Text style={styles.clientName}>
                    {note.schedules?.clients?.name ?? 'Unknown client'}
                  </Text>
                  <Text style={styles.noteMeta}>
                    {note.schedules?.users?.full_name ?? 'Unknown employee'} ·{' '}
                    {note.schedules ? fmtDate(note.schedules.start_time) : '—'}
                  </Text>
                  <Text style={[styles.statusBadge, { color: statusCfg.color }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {/* Expanded detail */}
            {isExpanded && (
              <View style={styles.noteDetail}>
                {/* Visit info */}
                {note.schedules && (
                  <View style={styles.visitInfo}>
                    <Text style={styles.visitInfoText}>
                      {fmtTime(note.schedules.start_time)} — {fmtTime(note.schedules.end_time)}
                    </Text>
                  </View>
                )}

                {/* Note body */}
                <View style={styles.noteSection}>
                  <Text style={styles.noteSectionLabel}>Note</Text>
                  <Text style={styles.noteBody}>{note.body}</Text>
                </View>

                {note.goals_addressed && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteSectionLabel}>Goals Addressed</Text>
                    <Text style={styles.noteBody}>{note.goals_addressed}</Text>
                  </View>
                )}

                {note.client_response && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteSectionLabel}>Client Response</Text>
                    <Text style={styles.noteBody}>{note.client_response}</Text>
                  </View>
                )}

                {note.next_steps && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteSectionLabel}>Next Steps</Text>
                    <Text style={styles.noteBody}>{note.next_steps}</Text>
                  </View>
                )}

                {/* Template data */}
                {note.template_data && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteSectionLabel}>Template Fields</Text>
                    {Object.entries(note.template_data as Record<string, unknown>).map(([k, v]) => (
                      <View key={k} style={styles.templateFieldRow}>
                        <Text style={styles.templateFieldKey}>{k}:</Text>
                        <Text style={styles.templateFieldVal}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Photo count */}
                {note.photo_urls && note.photo_urls.length > 0 && (
                  <View style={styles.photoCount}>
                    <Ionicons name="images-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.photoCountText}>
                      {note.photo_urls.length} photo{note.photo_urls.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}

                {/* Comment input */}
                <View style={styles.commentSection}>
                  <Text style={styles.noteSectionLabel}>Review Comment</Text>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add feedback for employee (required for reject/revision)…"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={3}
                    value={getComment(note.id)}
                    onChangeText={(t) => setComment(note.id, t)}
                    textAlignVertical="top"
                  />
                </View>

                {/* Action buttons */}
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger, isBusy && styles.btnDisabled]}
                    onPress={() => handleReject(note)}
                    disabled={isBusy}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnWarning, isBusy && styles.btnDisabled]}
                    onPress={() => handleRequestRevision(note)}
                    disabled={isBusy}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.warning} />
                    <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                      Revision
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSuccess, isBusy && styles.btnDisabled]}
                    onPress={() => handleApprove(note)}
                    disabled={isBusy}
                  >
                    {isBusy
                      ? <ActivityIndicator size="small" color={colors.success} />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                          <Text style={[styles.actionBtnText, { color: colors.success }]}>Approve</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  pageTitle: { ...typography.xl, color: colors.text, fontWeight: '700' },
  pageSubtitle: { ...typography.sm, color: colors.textSecondary },

  emptyState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyTitle: { ...typography.lg, color: colors.text, fontWeight: '700' },
  emptyDesc: { ...typography.sm, color: colors.textSecondary, textAlign: 'center' },

  noteCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },

  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  noteHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  noteHeaderText: { flex: 1, gap: 3 },
  clientName: { ...typography.base, color: colors.text, fontWeight: '600' },
  noteMeta: { ...typography.sm, color: colors.textSecondary },
  statusBadge: { ...typography.xs, fontWeight: '700' },

  noteDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },

  visitInfo: {
    backgroundColor: colors.elevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  visitInfoText: { ...typography.sm, color: colors.textSecondary },

  noteSection: { gap: spacing.xs },
  noteSectionLabel: {
    ...typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  noteBody: { ...typography.base, color: colors.text, lineHeight: 22 },

  templateFieldRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  templateFieldKey: { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  templateFieldVal: { ...typography.sm, color: colors.text },

  photoCount: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  photoCountText: { ...typography.sm, color: colors.textSecondary },

  commentSection: { gap: spacing.sm },
  commentInput: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.sm,
    color: colors.text,
    minHeight: 80,
  },

  reviewActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnDanger: { borderColor: colors.danger, backgroundColor: colors.dangerDim },
  actionBtnWarning: { borderColor: colors.warning, backgroundColor: colors.warningDim },
  actionBtnSuccess: { borderColor: colors.success, backgroundColor: colors.successDim },
  actionBtnText: { ...typography.sm, fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },
});
