import { View, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@/theme';
import { SkeletonBox } from './SkeletonBox';

interface SkeletonListProps {
  count?: number;
  showAvatar?: boolean;
  /** Override background color (defaults to dark theme bg) */
  bgColor?: string;
}

export function SkeletonList({ count = 6, showAvatar = true, bgColor }: SkeletonListProps) {
  return (
    <ScrollView style={[styles.container, bgColor ? { backgroundColor: bgColor } : null]} contentContainerStyle={styles.content} scrollEnabled={false}>
      {/* Search bar placeholder */}
      <SkeletonBox height={42} borderRadius={radius.md} style={{ marginBottom: spacing.md }} />

      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.item}>
          {showAvatar && (
            <SkeletonBox width={44} height={44} borderRadius={radius.full} />
          )}
          <View style={styles.body}>
            <SkeletonBox width="70%" height={13} style={{ marginBottom: spacing.xs }} />
            <SkeletonBox width="50%" height={11} style={{ marginBottom: spacing.xs }} />
            <SkeletonBox width="35%" height={11} />
          </View>
          <SkeletonBox width={20} height={20} borderRadius={radius.full} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1 },
});
