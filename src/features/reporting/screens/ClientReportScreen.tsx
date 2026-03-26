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
import { useClientReport, type ClientReportRow } from '../hooks/useReports';
import { buildClientReportCSV, shareCSV } from '../utils/exportReports';
import { colors, spacing, radius, typography, shadow } from '@/theme';

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

interface ClientCardProps {
  row: ClientReportRow;
}

function ClientCard({ row }: ClientCardProps) {
  const completionRate = row.scheduledVisits > 0
    ? Math.round((row.completedVisits / row.scheduledVisits) * 100)
    : 0;
  const rateColor = completionColor(completionRate);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.clientIcon}>
          <Ionicons name="business-outline" size={18} color={colors.info} />
        </View>
        <View style={styles.cardNameWrap}>
          <Text style={styles.clientName}>{row.client_name}</Text>
          <Text style={styles.clientSub}>{row.scheduledVisits} visits scheduled</Text>
        </View>
        <View style={styles.invoiceWrap}>
          <Text style={styles.invoiceAmount}>{fmtCurrency(row.totalInvoiced)}</Text>
          <Text style={styles.invoiceLabel}>invoiced</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: rateColor }]}>
            {completionRate}%
          </Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{fmtHours(row.totalHours)}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{row.billableUnits}</Text>
          <Text style={styles.statLabel}>Units</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {row.completedVisits}/{row.scheduledVisits}
          </Text>
          <Text style={styles.statLabel}>Visits</Text>
        </View>
      </View>
    </View>
  );
}

export function ClientReportScreen() {
  const [dateFrom,   setDateFrom]   = useState(currentMonthStart());
  const [dateTo,     setDateTo]     = useState(todayISO());
  const [exporting,  setExporting]  = useState(false);

  const { data, isLoading, isFetching, refetch } = useClientReport(dateFrom, dateTo);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  // Sort by total hours descending
  const sorted = [...(data ?? [])].sort((a, b) => b.totalHours - a.totalHours);

  const handleExport = useCallback(async () => {
    if (!data || data.length === 0) {
      Alert.alert('No data', 'There is no data to export for this period.');
      return;
    }
    setExporting(true);
    try {
      const period = `${dateFrom}_${dateTo}`;
      const csv    = buildClientReportCSV(data, period);
      await shareCSV(csv, `client_report_${period}.csv`);
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
      data={sorted}
      keyExtractor={item => item.client_id}
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
            Clients ({sorted.length}) — sorted by hours
          </Text>
        </View>
      }
      renderItem={({ item }) => <ClientCard row={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListEmptyComponent={
        <EmptyState
          icon="briefcase-outline"
          title="No client data"
          description="No clients found with activity in the selected date range."
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
  sectionTitle: {
    ...typography.md,
    color: colors.text,
    fontWeight: '700',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.info,
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
  clientIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.info}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNameWrap: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  clientSub: {
    ...typography.xs,
    color: colors.textMuted,
  },
  invoiceWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  invoiceAmount: {
    ...typography.sm,
    color: colors.success,
    fontWeight: '700',
  },
  invoiceLabel: {
    ...typography.xs,
    color: colors.textMuted,
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
