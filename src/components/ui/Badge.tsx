import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, typography } from '@/theme';

type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue'
  | 'active'
  | 'inactive';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; dot?: string }> = {
  primary:     { bg: colors.accentDim,    text: colors.accentLight },
  success:     { bg: colors.successDim,   text: colors.success },
  warning:     { bg: colors.warningDim,   text: colors.warning },
  danger:      { bg: colors.dangerDim,    text: colors.danger },
  info:        { bg: 'rgba(59,130,246,0.15)', text: colors.info },
  neutral:     { bg: colors.card,         text: colors.textSecondary },
  // Schedule statuses
  scheduled:   { bg: 'rgba(99,102,241,0.14)',  text: '#818CF8', dot: '#6366F1' },
  in_progress: { bg: 'rgba(245,158,11,0.14)',  text: '#FCD34D', dot: '#F59E0B' },
  completed:   { bg: 'rgba(16,185,129,0.14)',  text: '#34D399', dot: '#10B981' },
  cancelled:   { bg: 'rgba(100,116,139,0.14)', text: '#94A3B8', dot: '#64748B' },
  overdue:     { bg: 'rgba(239,68,68,0.14)',   text: '#F87171', dot: '#EF4444' },
  active:      { bg: 'rgba(16,185,129,0.14)',  text: '#34D399', dot: '#10B981' },
  inactive:    { bg: 'rgba(239,68,68,0.14)',   text: '#F87171', dot: '#EF4444' },
};

export function Badge({ children, variant = 'neutral', dot = false, style }: BadgeProps) {
  const vs = VARIANT_STYLES[variant];

  return (
    <View style={[styles.base, { backgroundColor: vs.bg }, style]}>
      {dot && (
        <View style={[styles.dot, { backgroundColor: vs.dot ?? vs.text }]} />
      )}
      <Text style={[styles.text, { color: vs.text }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: typography.xs.fontSize,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
