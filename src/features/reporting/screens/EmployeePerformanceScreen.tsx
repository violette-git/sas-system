import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useEmployeePerformance, type EmployeePerformanceRow } from '../hooks/useReports';
import { buildEmployeePerformanceCSV, shareCSV } from '../utils/exportReports';
import { BarChart } from '../components/BarChart';
import { colors, spacing, radius, typography, shadow } from '@/theme';

function fmtHours(n: number): string {
  return `${n.toFixed(1)} hrs`;
}

function completionColor(rate: number): string {
  if (rate >= 80) return colors.success;
  if (rate >= 60) return colors.warning;
  return colors.danger;
}

function currentMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EmployeeCardProps {
  row: EmployeePerformanceRow;
}

function EmployeeCard({ row }: EmployeeCardProps) {
  const color = completionColor(row.completionRate);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {row.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardNameWrap}>
          <Text style={styles.empName}>{row.full_name}</Text>
          <Text style={styles.empSub}>
            {row.scheduledVisits} visits scheduled
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.badgeText, { color }]}>{row.completionRate}%</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {row.completedVisits}/{row.scheduledVisits}
          </Text>
          <Text style={styles.statLabel}>Visits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{fmtHours(row.totalHours)}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {row.notesApproved}/{row.notesSubmitted}
          </Text>
          <Text style={styles.statLabel}>Notes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: completionColor(row.approvalRate) }]}>
            {row.approvalRate}%
          </Text>
          <Text style={styles.statLabel}>Approval</Text>
        </View>
      </View>
    </View>
  );
}

export function EmployeePerformanceScreen() {
  const [dateFrom, setDateFrom] = useState(currentMonthStart());
  const [dateTo,   setDateTo]   = useState(todayISO());
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching, refetch } = useEmployeePerformance(dateFrom, dateTo);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const topByVisits = [...(data ?? [])]
    .sort((a, b) => b.scheduledVisits - a.scheduledVisits)
    .slice(0, 8);

  const chartData = topByVisits.map(r => ({
    label: r.full_name.split(' ')[0],
    value: r.completionRate,
  }));

  const handleExport = useCallback(async () => {
    if (!data || data.length === 0) {
      Alert.alert('No data', 'There is no data to export for this period.');
      return;
    }
    setExporting(true);
    try {
      const period = `${dateFrom}_${dateTo}`;
      const csv    = buildEmployeePerformanceCSV(data, period);
      await shareCSV(csv, `employee_performance_${period}.csv`);
    } catch (err) {
      Alert.alert('Export failed', String(err));
    } finally {
      setExporting(false);
    }
  }, [data, dateFrom, dateTo]);

  if (isLoading) {
    return <SkeletonList count={5} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={item => item.employee_id}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          {/* Date filters */}
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>From</Text>
              <TextInput
                style={styles.filterInput}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>To</Text>
              <TextInput
                style={styles.filterInput}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </View>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Completion Rate by Employee</Text>
              <Text style={styles.sectionSubtitle}>Top 8 by visits — percentage</Text>
              <BarChart
                data={chartData}
                color={colors.accent}
                height={180}
                formatValue={v => `${v.toFixed(0)}%`}
              />
            </View>
          )}

          {/* Export button */}
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={16} color={colors.text} />
            <Text style={styles.exportBtnText}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>
            All Employees ({(data ?? []).length})
          </Text>
        </View>
      }
      renderItem={({ item }) => <EmployeeCard row={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title="No employee data"
          description="No employees found for the selected date range."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  headerWrap: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  filterField: {
    flex: 1,
    gap: spacing.xs,
  },
  filterLabel: {
    ...typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.sm,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.sm,
  },
  sectionTitle: {
    ...typography.md,
    color: colors.text,
    fontWeight: '700',
  },
  sectionSubtitle: {
    ...typography.xs,
    color: colors.textMuted,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.md,
    color: colors.accent,
    fontWeight: '700',
  },
  cardNameWrap: {
    flex: 1,
    gap: 2,
  },
  empName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  empSub: {
    ...typography.xs,
    color: colors.textMuted,
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.xs,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.xs,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
});
