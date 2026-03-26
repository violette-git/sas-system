import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';
import { useCreateTimeOff, useTimeOffRequests, useDeleteAvailability } from '@/features/availability/hooks/useAvailability';

function formatDateRange(from: string, to: string): string {
  const f = new Date(from + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
  const t = new Date(to + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${f} – ${t}`;
}

export function TimeOffRequest() {
  const { data: requests = [], isLoading } = useTimeOffRequests();
  const createTimeOff = useCreateTimeOff();
  const deleteAvail   = useDeleteAvailability();

  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  function handleSubmit() {
    if (!startDate || !endDate) {
      Alert.alert('Missing Fields', 'Please enter both start and end dates.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Invalid Range', 'End date must be on or after start date.');
      return;
    }
    createTimeOff.mutate(
      { effective_from: startDate, effective_to: endDate, note: reason || null },
      {
        onSuccess: () => {
          setShowForm(false);
          setStartDate('');
          setEndDate('');
          setReason('');
        },
      },
    );
  }

  function handleDelete(id: string) {
    Alert.alert('Remove Request', 'Remove this time-off request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteAvail.mutate(id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Time-Off Requests</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(v => !v)}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Request'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-04-01"
              placeholderTextColor={colors.placeholder}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-04-05"
              placeholderTextColor={colors.placeholder}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Vacation, medical, personal..."
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
              value={reason}
              onChangeText={setReason}
            />
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, createTimeOff.isPending && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={createTimeOff.isPending}
          >
            {createTimeOff.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Submit Request</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Existing requests */}
      {isLoading
        ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />
        : requests.length === 0
          ? <Text style={styles.emptyText}>No time-off requests</Text>
          : requests.map(r => (
            <View key={r.id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestDates}>
                  {r.effective_from && r.effective_to
                    ? formatDateRange(r.effective_from, r.effective_to)
                    : '—'}
                </Text>
                {r.note && <Text style={styles.requestNote}>{r.note}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(r.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { ...typography.md, color: colors.text, fontWeight: '700' },
  addBtn:        { backgroundColor: colors.accentDim, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  addBtnText:    { ...typography.sm, color: colors.accentLight, fontWeight: '600' },

  form:     { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  field:    { gap: spacing.xs },
  label:    { ...typography.sm, color: colors.textSecondary, fontWeight: '600' },
  input:    { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text },
  textArea: { height: 72, textAlignVertical: 'top', paddingTop: spacing.sm },

  submitBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  submitBtnText: { ...typography.base, color: '#fff', fontWeight: '600' },
  btnDisabled:   { opacity: 0.5 },

  emptyText:   { ...typography.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  requestCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  requestInfo: { flex: 1, gap: 2 },
  requestDates:{ ...typography.base, color: colors.text, fontWeight: '600' },
  requestNote: { ...typography.sm, color: colors.textSecondary },
  deleteBtn:   { padding: spacing.sm },
  deleteBtnText:{ ...typography.base, color: colors.danger },
});
