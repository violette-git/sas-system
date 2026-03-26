import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, typography, spacing } from '@/theme';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  /** Delta string like '+12%' or '-3%' */
  delta?: string;
  deltaPositive?: boolean;
  accentColor?: string;
  style?: ViewStyle;
}

export function StatCard({
  icon,
  label,
  value,
  delta,
  deltaPositive,
  accentColor = colors.accent,
  style,
}: StatCardProps) {
  return (
    <View style={[styles.card, style, shadow.sm]}>
      {/* Icon badge */}
      <View style={[styles.iconBadge, { backgroundColor: `${accentColor}20` }]}>
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>

      {/* Value */}
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>

      {/* Label + delta row */}
      <View style={styles.bottomRow}>
        <Text style={styles.label} numberOfLines={2}>{label}</Text>
        {delta && (
          <View style={[
            styles.deltaBadge,
            { backgroundColor: deltaPositive ? colors.successDim : colors.dangerDim },
          ]}>
            <Ionicons
              name={deltaPositive ? 'trending-up' : 'trending-down'}
              size={10}
              color={deltaPositive ? colors.success : colors.danger}
            />
            <Text style={[
              styles.deltaText,
              { color: deltaPositive ? colors.success : colors.danger },
            ]}>
              {delta}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: colors.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  label: {
    fontSize: typography.xs.fontSize,
    color: colors.textSecondary,
    flex: 1,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
