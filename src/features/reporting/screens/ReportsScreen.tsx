import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/authStore';
import { StatCard } from '@/components/ui/StatCard';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useDashboardStats, useWeeklyHours } from '../hooks/useReports';
import { LineChart } from '../components/LineChart';
import { colors, spacing, radius, typography, shadow } from '@/theme';

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtHours(n: number): string {
  return `${n.toFixed(1)} hrs`;
}

interface NavCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  accentColor?: string;
}

function NavCard({ icon, title, subtitle, onPress, accentColor = colors.accent }: NavCardProps) {
  return (
    <TouchableOpacity style={styles.navCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.navIcon, { backgroundColor: `${accentColor}20` }]}>
        <Ionicons name={icon} size={22} color={accentColor} />
      </View>
      <View style={styles.navText}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function ReportsScreen() {
  const router   = useRouter();
  const { profile } = useAuthStore();

  const stats   = useDashboardStats();
  const weekly  = useWeeklyHours();

  const isLoading  = stats.isLoading || weekly.isLoading;
  const isRefreshing = stats.isFetching || weekly.isFetching;

  const onRefresh = useCallback(() => {
    stats.refetch();
    weekly.refetch();
  }, [stats, weekly]);

  const weeklyChartData = (weekly.data ?? []).map(w => ({
    label: w.weekLabel,
    value: w.totalMinutes / 60,
  }));

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonList count={6} />
      </View>
    );
  }

  const s = stats.data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Month-to-date overview</Text>
      </View>

      {/* Overview stat cards */}
      <View style={styles.statGrid}>
        <StatCard
          icon="calendar-outline"
          label="Total Visits"
          value={s?.totalVisitsThisMonth ?? 0}
        />
        <StatCard
          icon="checkmark-circle-outline"
          label="Completion Rate"
          value={`${s?.completionRate ?? 0}%`}
          accentColor={colors.success}
        />
        <StatCard
          icon="time-outline"
          label="Hours This Month"
          value={fmtHours(s?.totalHoursThisMonth ?? 0)}
          accentColor={colors.info}
        />
        <StatCard
          icon="cash-outline"
          label="Revenue This Month"
          value={fmtCurrency(s?.totalInvoicedThisMonth ?? 0)}
          accentColor={colors.warning}
        />
      </View>

      {/* Secondary stat row */}
      <View style={styles.statGrid}>
        <StatCard
          icon="people-outline"
          label="Active Employees"
          value={s?.activeEmployees ?? 0}
          accentColor={colors.accent}
        />
        <StatCard
          icon="business-outline"
          label="Active Clients"
          value={s?.activeClients ?? 0}
          accentColor={colors.accentLight}
        />
        <StatCard
          icon="document-text-outline"
          label="Pending Notes"
          value={s?.pendingNotes ?? 0}
          accentColor={colors.warning}
        />
      </View>

      {/* Weekly Hours chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.sectionTitle}>Hours by Week</Text>
          <Text style={styles.sectionSubtitle}>Last 8 weeks</Text>
        </View>
        <LineChart
          data={weeklyChartData}
          color={colors.accent}
          height={180}
          formatValue={v => `${v.toFixed(1)}h`}
        />
      </View>

      {/* Quick navigation */}
      <Text style={styles.sectionTitle}>Detailed Reports</Text>

      <View style={styles.navList}>
        <NavCard
          icon="bar-chart-outline"
          title="Employee Performance"
          subtitle="Completion rates, hours & notes"
          onPress={() => router.push('/(admin)/employee-performance' as Parameters<typeof router.push>[0])}
          accentColor={colors.accent}
        />
        <NavCard
          icon="briefcase-outline"
          title="Client Reports"
          subtitle="Visits, hours & invoiced amounts"
          onPress={() => router.push('/(admin)/client-reports' as Parameters<typeof router.push>[0])}
          accentColor={colors.info}
        />
        {profile?.role === 'owner' && (
          <NavCard
            icon="globe-outline"
            title="Company Comparison"
            subtitle="Cross-company metrics overview"
            onPress={() => router.push('/(admin)/cross-company' as Parameters<typeof router.push>[0])}
            accentColor={colors.warning}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
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
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  chartHeader: {
    gap: spacing.xs,
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
  navList: {
    gap: spacing.sm,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    flex: 1,
    gap: spacing.xs,
  },
  navTitle: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  navSubtitle: {
    ...typography.xs,
    color: colors.textSecondary,
  },
});
