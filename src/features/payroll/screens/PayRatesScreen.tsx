import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme/index';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  usePayRates,
  useUpsertPayRate,
  useDeletePayRate,
  type PayRate,
  type PayRateInput,
} from '../hooks/usePayRates';

interface FormState {
  hourly_rate: string;
  overtime_rate: string;
  effective_from: string;
  effective_to: string;
  notes: string;
}

const emptyForm: FormState = {
  hourly_rate: '',
  overtime_rate: '',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: '',
  notes: '',
};

function HistoryRow({ rate }: { rate: PayRate }) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyLeft}>
        <Text style={styles.historyDate}>
          {rate.effective_from}
          {rate.effective_to ? ` → ${rate.effective_to}` : ' (ongoing)'}
        </Text>
        {rate.notes ? (
          <Text style={styles.historyNotes} numberOfLines={1}>{rate.notes}</Text>
        ) : null}
      </View>
      <View style={styles.historyRates}>
        <Text style={styles.historyRate}>${Number(rate.hourly_rate).toFixed(2)}/hr</Text>
        <Text style={styles.historyOT}>OT: ${Number(rate.overtime_rate).toFixed(2)}</Text>
      </View>
    </View>
  );
}

function EmployeeRateCard({
  employeeId,
  fullName,
  email,
  rates,
}: {
  employeeId: string;
  fullName: string;
  email: string;
  rates: PayRate[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const upsert = useUpsertPayRate();
  const deleteRate = useDeletePayRate();

  const activeRate = rates.find(r => !r.effective_to) ?? rates[0] ?? null;
  const history = rates.filter(r => r.id !== activeRate?.id);

  const handleSave = useCallback(async () => {
    const hourlyRate = parseFloat(form.hourly_rate);
    const otRate    = form.overtime_rate
      ? parseFloat(form.overtime_rate)
      : hourlyRate * 1.5;

    if (isNaN(hourlyRate) || hourlyRate <= 0) {
      Alert.alert('Validation', 'Please enter a valid hourly rate.');
      return;
    }
    if (!form.effective_from) {
      Alert.alert('Validation', 'Please enter an effective from date (YYYY-MM-DD).');
      return;
    }

    const input: PayRateInput = {
      employee_id:    employeeId,
      hourly_rate:    hourlyRate,
      overtime_rate:  otRate,
      effective_from: form.effective_from,
      effective_to:   form.effective_to || null,
      notes:          form.notes || null,
    };

    try {
      await upsert.mutateAsync(input);
      setForm(emptyForm);
      setExpanded(false);
      Alert.alert('Saved', 'Pay rate saved successfully.');
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  }, [form, employeeId, upsert]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        'Delete Pay Rate',
        'Are you sure you want to delete this pay rate?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteRate.mutateAsync(id);
              } catch (err) {
                Alert.alert('Error', String(err));
              }
            },
          },
        ],
      );
    },
    [deleteRate],
  );

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        style={styles.cardHeader}
      >
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{fullName}</Text>
          <Text style={styles.cardEmail}>{email}</Text>
        </View>
        <View style={styles.cardRateInfo}>
          {activeRate ? (
            <>
              <Text style={styles.currentRate}>
                ${Number(activeRate.hourly_rate).toFixed(2)}/hr
              </Text>
              <Text style={styles.currentOT}>
                OT: ${Number(activeRate.overtime_rate).toFixed(2)}
              </Text>
            </>
          ) : (
            <Text style={styles.noRate}>No rate set</Text>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {/* Add new rate form */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Add New Pay Rate</Text>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Hourly Rate *</Text>
                <TextInput
                  style={styles.input}
                  value={form.hourly_rate}
                  onChangeText={v => setForm(f => ({ ...f, hourly_rate: v }))}
                  placeholder="e.g. 18.00"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>OT Rate</Text>
                <TextInput
                  style={styles.input}
                  value={form.overtime_rate}
                  onChangeText={v => setForm(f => ({ ...f, overtime_rate: v }))}
                  placeholder="default 1.5×"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Effective From *</Text>
                <TextInput
                  style={styles.input}
                  value={form.effective_from}
                  onChangeText={v => setForm(f => ({ ...f, effective_from: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Effective To</Text>
                <TextInput
                  style={styles.input}
                  value={form.effective_to}
                  onChangeText={v => setForm(f => ({ ...f, effective_to: v }))}
                  placeholder="YYYY-MM-DD (optional)"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.formFieldFull}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={styles.input}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <Button
              variant="primary"
              onPress={handleSave}
              loading={upsert.isPending}
              disabled={upsert.isPending}
            >
              Save Pay Rate
            </Button>
          </View>

          {/* History */}
          {rates.length > 0 && (
            <View style={styles.historySection}>
              <TouchableOpacity
                onPress={() => setShowHistory(h => !h)}
                style={styles.historyToggle}
              >
                <Text style={styles.historyToggleText}>
                  {showHistory ? 'Hide' : 'Show'} History ({rates.length})
                </Text>
                <Ionicons
                  name={showHistory ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {showHistory && (
                <View>
                  {rates.map(rate => (
                    <View key={rate.id} style={styles.historyItem}>
                      <HistoryRow rate={rate} />
                      <TouchableOpacity
                        onPress={() => handleDelete(rate.id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function PayRatesScreen() {
  const { data: rates, isLoading, error } = usePayRates();

  // Group rates by employee
  const employeeMap = new Map<
    string,
    { full_name: string; email: string; rates: PayRate[] }
  >();

  for (const rate of rates ?? []) {
    const eid = rate.employee_id;
    if (!employeeMap.has(eid)) {
      employeeMap.set(eid, {
        full_name: rate.users?.full_name ?? 'Unknown',
        email:     rate.users?.email ?? '',
        rates:     [],
      });
    }
    employeeMap.get(eid)!.rates.push(rate);
  }

  const employees = Array.from(employeeMap.entries()).sort((a, b) =>
    a[1].full_name.localeCompare(b[1].full_name),
  );

  interface EmployeeEntry {
    id: string;
    full_name: string;
    email: string;
    rates: PayRate[];
  }

  const listData: EmployeeEntry[] = employees.map(([id, info]) => ({
    id,
    full_name: info.full_name,
    email: info.email,
    rates: info.rates,
  }));

  const renderItem = useCallback(
    ({ item }: { item: EmployeeEntry }) => (
      <EmployeeRateCard
        key={item.id}
        employeeId={item.id}
        fullName={item.full_name}
        email={item.email}
        rates={item.rates}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: EmployeeEntry) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonList count={6} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load pay rates.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {listData.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <EmptyState
            icon="cash-outline"
            title="No Pay Rates"
            description="No pay rate records found. Add employees first, then configure their pay rates here."
          />
        </ScrollView>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  errorText: {
    ...typography.base,
    color: colors.danger,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  cardEmail: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardRateInfo: {
    alignItems: 'flex-end',
  },
  currentRate: {
    ...typography.base,
    color: colors.success,
    fontWeight: '700',
  },
  currentOT: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noRate: {
    ...typography.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.elevated,
  },
  formSection: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  formTitle: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formField: {
    flex: 1,
  },
  formFieldFull: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.sm,
    color: colors.text,
  },
  historySection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  historyToggleText: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    ...typography.xs,
    color: colors.textSecondary,
  },
  historyNotes: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyRates: {
    alignItems: 'flex-end',
  },
  historyRate: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '600',
  },
  historyOT: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.md,
  },
});
