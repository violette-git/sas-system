import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme/index';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import {
  useTimesheetSummary,
  usePayPeriods,
  type TimesheetRow,
  type TimeEntryRow,
  type PayPeriod,
} from '../hooks/useTimesheets';
import { usePayRates } from '../hooks/usePayRates';
import { buildPayrollCSV, sharePayrollCSV } from '../utils/exportPayroll';

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EntryRow({ entry }: { entry: TimeEntryRow }) {
  const date = new Date(entry.clocked_in_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const mins = entry.duration_minutes ?? 0;
  const hours = (mins / 60).toFixed(1);
  return (
    <View style={styles.entryRow}>
      <Text style={styles.entryDate}>{date}</Text>
      <Text style={styles.entryDuration}>{hours}h</Text>
      <Text style={styles.entryClient} numberOfLines={1}>
        {entry.client_name ?? '—'}
      </Text>
      <Text style={styles.entryUnits}>
        {entry.billable_units ?? 0} units
      </Text>
    </View>
  );
}

function EmployeeCard({ row }: { row: TimesheetRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.employeeCard}>
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        style={styles.employeeCardHeader}
      >
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{row.full_name}</Text>
          <Text style={styles.employeeEmail}>{row.email}</Text>
        </View>
        <View style={styles.employeeStats}>
          <Text style={styles.hoursText}>
            {row.regularHours.toFixed(1)}h reg
          </Text>
          {row.overtimeHours > 0 && (
            <Badge variant="warning">
              {row.overtimeHours.toFixed(1)}h OT
            </Badge>
          )}
          <Text style={styles.unitsText}>{row.billableUnits} units</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entriesContainer}>
          {row.entries.length === 0 ? (
            <Text style={styles.noEntriesText}>No time entries</Text>
          ) : (
            <>
              <View style={styles.entryHeader}>
                <Text style={styles.entryHeaderText}>Date</Text>
                <Text style={styles.entryHeaderText}>Hours</Text>
                <Text style={styles.entryHeaderText}>Client</Text>
                <Text style={styles.entryHeaderText}>Units</Text>
              </View>
              {row.entries.map(entry => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function TimesheetScreen() {
  const router = useRouter();
  const periods = usePayPeriods();
  const [periodIndex, setPeriodIndex] = useState(0);
  const currentPeriod: PayPeriod = periods[periodIndex];

  const { data: rows, isLoading } = useTimesheetSummary({
    weekStart: currentPeriod.weekStart,
    weekEnd:   currentPeriod.weekEnd,
  });

  const { data: payRates } = usePayRates();

  const totalHours = (rows ?? []).reduce((s, r) => s + r.totalHours, 0);
  const totalOT    = (rows ?? []).reduce((s, r) => s + r.overtimeHours, 0);
  const totalUnits = (rows ?? []).reduce((s, r) => s + r.billableUnits, 0);
  const empCount   = (rows ?? []).length;

  const handleExport = useCallback(async () => {
    if (!rows || rows.length === 0) {
      Alert.alert('No Data', 'No timesheet data to export for this period.');
      return;
    }
    const payRateMap = new Map(
      (payRates ?? []).map(r => [r.employee_id, r]),
    );
    const csv = buildPayrollCSV(
      rows,
      payRateMap,
      currentPeriod.weekStart,
      currentPeriod.weekEnd,
    );
    try {
      await sharePayrollCSV(csv, currentPeriod.weekStart);
    } catch (err) {
      Alert.alert('Export Error', String(err));
    }
  }, [rows, payRates, currentPeriod]);

  const renderItem = useCallback(
    ({ item }: { item: TimesheetRow }) => <EmployeeCard row={item} />,
    [],
  );

  const keyExtractor = useCallback((item: TimesheetRow) => item.employee_id, []);

  return (
    <View style={styles.container}>
      {/* Header actions */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/(admin)/pay-rates' as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="cash-outline" size={16} color={colors.accent} />
          <Text style={styles.headerBtnText}>Pay Rates</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/(admin)/invoices' as Parameters<typeof router.push>[0])}
        >
          <Ionicons name="document-text-outline" size={16} color={colors.accent} />
          <Text style={styles.headerBtnText}>Invoices</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={16} color={colors.text} />
          <Text style={styles.exportBtnText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Week Picker */}
      <View style={styles.weekPicker}>
        <TouchableOpacity
          onPress={() => setPeriodIndex(i => Math.min(i + 1, periods.length - 1))}
          disabled={periodIndex >= periods.length - 1}
          style={styles.weekNavBtn}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={periodIndex >= periods.length - 1 ? colors.textMuted : colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{currentPeriod.label}</Text>
        <TouchableOpacity
          onPress={() => setPeriodIndex(i => Math.max(i - 1, 0))}
          disabled={periodIndex <= 0}
          style={styles.weekNavBtn}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={periodIndex <= 0 ? colors.textMuted : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Stat Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        <StatCard label="Total Hours" value={totalHours.toFixed(1)} color={colors.info} />
        <StatCard label="OT Hours" value={totalOT.toFixed(1)} color={totalOT > 0 ? colors.warning : colors.textSecondary} />
        <StatCard label="Employees" value={String(empCount)} />
        <StatCard label="Billable Units" value={String(totalUnits)} color={colors.success} />
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : (rows ?? []).length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No Timesheets"
          description="No time entries found for this pay period."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBtnText: {
    ...typography.sm,
    color: colors.accent,
    fontWeight: '600',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: 'auto',
  },
  exportBtnText: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '600',
  },
  weekPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekNavBtn: {
    padding: spacing.sm,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  statsRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minWidth: 90,
  },
  statValue: {
    ...typography.xl,
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  employeeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  employeeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  employeeEmail: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  employeeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hoursText: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  unitsText: {
    ...typography.sm,
    color: colors.info,
    fontWeight: '600',
  },
  entriesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.elevated,
    paddingBottom: spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryHeaderText: {
    flex: 1,
    ...typography.xs,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  entryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryDate: {
    flex: 1,
    ...typography.sm,
    color: colors.textSecondary,
  },
  entryDuration: {
    flex: 1,
    ...typography.sm,
    color: colors.text,
    fontWeight: '600',
  },
  entryClient: {
    flex: 2,
    ...typography.sm,
    color: colors.textSecondary,
  },
  entryUnits: {
    flex: 1,
    ...typography.sm,
    color: colors.info,
    textAlign: 'right',
  },
  noEntriesText: {
    ...typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
});
