import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuthStore } from '@/features/auth/store/authStore';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useCrossCompanyMetrics, type CompanyMetrics } from '../hooks/useReports';
import { colors, spacing, radius, typography, shadow } from '@/theme';

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtHours(n: number): string {
  return `${n.toFixed(1)} hrs`;
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface CompanyCardProps {
  row: CompanyMetrics;
  maxRevenue: number;
}

function CompanyCard({ row, maxRevenue }: CompanyCardProps) {
  const barPct = maxRevenue > 0 ? row.revenueThisMonth / maxRevenue : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.companyIcon}>
          <Text style={styles.companyInitial}>
            {row.company_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardNameWrap}>
          <Text style={styles.companyName}>{row.company_name}</Text>
          <Text style={styles.companySub}>
            {row.totalEmployees} employees · {row.totalClients} clients
          </Text>
        </View>
        <View style={styles.revenueWrap}>
          <Text style={styles.revenueAmount}>{fmtCurrency(row.revenueThisMonth)}</Text>
          <Text style={styles.revenueLabel}>revenue</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{row.visitsThisMonth}</Text>
          <Text style={styles.statLabel}>Visits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{fmtHours(row.hoursThisMonth)}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{row.totalEmployees}</Text>
          <Text style={styles.statLabel}>Staff</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{row.totalClients}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
      </View>

      {/* Revenue bar */}
      <View style={styles.revenueBarWrap}>
        <View style={styles.revenueBarBg}>
          <View
            style={[
              styles.revenueBarFill,
              { width: `${Math.round(barPct * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.revenueBarLabel}>
          {Math.round(barPct * 100)}% of top company
        </Text>
      </View>
    </View>
  );
}

export function CrossCompanyScreen() {
  const { profile } = useAuthStore();
  const { data, isLoading, isFetching, refetch } = useCrossCompanyMetrics();

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (profile?.role !== 'owner') {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="lock-closed-outline"
          title="Access Restricted"
          description="Cross-company reports are only available to owners."
        />
      </View>
    );
  }

  if (isLoading) {
    return <SkeletonList count={4} />;
  }

  const companies    = data ?? [];
  const maxRevenue   = Math.max(...companies.map(c => c.revenueThisMonth), 1);
  const totalEmp     = companies.reduce((s, c) => s + c.totalEmployees, 0);
  const totalRevenue = companies.reduce((s, c) => s + c.revenueThisMonth, 0);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={companies}
      keyExtractor={item => item.company_id}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <View style={styles.heading}>
            <Text style={styles.title}>Company Comparison</Text>
            <Text style={styles.subtitle}>
              Cross-company comparison for {currentMonthLabel()}
            </Text>
          </View>

          {/* Summary stat cards */}
          <View style={styles.statGrid}>
            <StatCard
              icon="business-outline"
              label="Total Companies"
              value={companies.length}
              accentColor={colors.accent}
            />
            <StatCard
              icon="people-outline"
              label="Combined Employees"
              value={totalEmp}
              accentColor={colors.info}
            />
            <StatCard
              icon="cash-outline"
              label="Combined Revenue"
              value={fmtCurrency(totalRevenue)}
              accentColor={colors.success}
            />
          </View>

          <Text style={styles.sectionTitle}>
            Companies ({companies.length})
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <CompanyCard row={item} maxRevenue={maxRevenue} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListEmptyComponent={
        <EmptyState
          icon="globe-outline"
          title="No companies found"
          description="No company data is available for this period."
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
  heading: {
    gap: spacing.xs,
  },
  title: {
    ...typography.xxl,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.md,
    color: colors.text,
    fontWeight: '700',
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
  companyIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyInitial: {
    ...typography.lg,
    color: colors.accent,
    fontWeight: '700',
  },
  cardNameWrap: {
    flex: 1,
    gap: 2,
  },
  companyName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  companySub: {
    ...typography.xs,
    color: colors.textMuted,
  },
  revenueWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  revenueAmount: {
    ...typography.sm,
    color: colors.success,
    fontWeight: '700',
  },
  revenueLabel: {
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
  revenueBarWrap: {
    gap: spacing.xs,
  },
  revenueBarBg: {
    height: 6,
    backgroundColor: colors.elevated,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  revenueBarFill: {
    height: 6,
    backgroundColor: colors.success,
    borderRadius: radius.full,
  },
  revenueBarLabel: {
    ...typography.xs,
    color: colors.textMuted,
  },
});
