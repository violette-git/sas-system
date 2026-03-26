import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme/index';
import { Badge } from '@/components/ui/Badge';
import type { AuthorizationUsage } from '../hooks/useAuthorizationTracking';

interface Props {
  usage: AuthorizationUsage;
}

function getBarColor(pct: number): string {
  if (pct >= 80) return colors.danger;
  if (pct >= 60) return colors.warning;
  return colors.success;
}

function formatHours(units: number): string {
  return (units / 4).toFixed(1);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AuthorizationUsageCard({ usage }: Props) {
  const barColor  = getBarColor(usage.percentUsed);
  const barWidth  = `${Math.min(100, usage.percentUsed)}%` as `${number}%`;
  const usedHours = formatHours(usage.usedUnits);
  const authHours = formatHours(usage.authorized_units);
  const remHours  = formatHours(usage.remainingUnits);

  let badgeVariant: 'success' | 'warning' | 'danger' = 'success';
  let badgeLabel = 'Active';
  if (usage.isOverLimit) {
    badgeVariant = 'danger';
    badgeLabel   = 'Over Limit';
  } else if (usage.isNearLimit) {
    badgeVariant = 'warning';
    badgeLabel   = 'Near Limit';
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.serviceTypeName}>
            {usage.service_type_name ?? 'Service'}
          </Text>
          <Text style={styles.authNumber}>Auth #{usage.auth_number}</Text>
        </View>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: barWidth, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.progressPct}>{usage.percentUsed.toFixed(0)}% used</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{usedHours} hrs</Text>
          <Text style={styles.statLabel}>Used</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{authHours} hrs</Text>
          <Text style={styles.statLabel}>Authorized</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: usage.isOverLimit ? colors.danger : colors.success }]}>
            {remHours} hrs
          </Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
      </View>

      {/* Units detail */}
      <Text style={styles.unitsDetail}>
        {usage.usedUnits} of {usage.authorized_units} units used
      </Text>

      {/* Expiry */}
      <View style={styles.expiryRow}>
        <Text style={styles.expiryLabel}>Expires:</Text>
        <Text style={styles.expiryDate}>{formatDate(usage.end_date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  serviceTypeName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  authNumber: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.elevated,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  progressPct: {
    ...typography.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.base,
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  unitsDetail: {
    ...typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expiryLabel: {
    ...typography.xs,
    color: colors.textMuted,
  },
  expiryDate: {
    ...typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
