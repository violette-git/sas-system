import { View, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@/theme';
import { SkeletonBox } from './SkeletonBox';

export function SkeletonDashboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} scrollEnabled={false}>
      {/* Stat cards row */}
      <View style={styles.statsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.statCard}>
            <SkeletonBox width="60%" height={12} style={{ marginBottom: spacing.sm }} />
            <SkeletonBox width="40%" height={28} />
          </View>
        ))}
      </View>

      {/* Section header */}
      <SkeletonBox width={120} height={14} style={styles.sectionLabel} />

      {/* List items */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.listCard}>
          <SkeletonBox width={40} height={40} borderRadius={radius.full} />
          <View style={styles.listCardBody}>
            <SkeletonBox width="65%" height={13} style={{ marginBottom: spacing.xs }} />
            <SkeletonBox width="45%" height={11} />
          </View>
          <SkeletonBox width={52} height={22} borderRadius={radius.sm} />
        </View>
      ))}

      {/* Section header */}
      <SkeletonBox width={160} height={14} style={styles.sectionLabel} />

      {/* More list items */}
      {[0, 1].map((i) => (
        <View key={i} style={styles.listCard}>
          <SkeletonBox width={40} height={40} borderRadius={radius.full} />
          <View style={styles.listCardBody}>
            <SkeletonBox width="70%" height={13} style={{ marginBottom: spacing.xs }} />
            <SkeletonBox width="50%" height={11} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg, gap: spacing.sm },
  statsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard:  {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: { marginTop: spacing.md, marginBottom: spacing.sm },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  listCardBody: { flex: 1 },
});
