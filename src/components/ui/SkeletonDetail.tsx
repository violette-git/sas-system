import { View, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@/theme';
import { SkeletonBox } from './SkeletonBox';

export function SkeletonDetail() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} scrollEnabled={false}>
      {/* Hero / header card */}
      <View style={styles.heroCard}>
        <SkeletonBox width={64} height={64} borderRadius={radius.full} style={{ marginBottom: spacing.md }} />
        <SkeletonBox width="55%" height={18} style={{ marginBottom: spacing.sm }} />
        <SkeletonBox width="40%" height={13} style={{ marginBottom: spacing.sm }} />
        <SkeletonBox width={80} height={22} borderRadius={radius.sm} />
      </View>

      {/* Fields */}
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.field}>
          <SkeletonBox width="30%" height={11} style={{ marginBottom: spacing.xs }} />
          <SkeletonBox width="75%" height={15} />
        </View>
      ))}

      {/* Wide block */}
      <View style={[styles.field, { height: 100 }]}>
        <SkeletonBox width="30%" height={11} style={{ marginBottom: spacing.xs }} />
        <SkeletonBox height={70} borderRadius={radius.md} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg, gap: spacing.sm },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
