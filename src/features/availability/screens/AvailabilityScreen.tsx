import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';
import { WeeklyAvailabilityGrid } from '@/features/availability/components/WeeklyAvailabilityGrid';
import { TimeOffRequest } from '@/features/availability/components/TimeOffRequest';
import { useAvailability } from '@/features/availability/hooks/useAvailability';
import { useAuthStore } from '@/features/auth/store/authStore';

interface Props {
  /** If provided, shows a read-only view of another employee's availability (admin use) */
  employeeId?: string;
  employeeName?: string;
}

export function AvailabilityScreen({ employeeId, employeeName }: Props) {
  const { profile } = useAuthStore();
  const { refetch, isLoading } = useAvailability(employeeId);

  const isOwnProfile = !employeeId || employeeId === profile?.id;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} colors={[colors.accent]} />
      }
    >
      {employeeName && (
        <View style={styles.employeeBanner}>
          <Text style={styles.employeeName}>{employeeName}</Text>
          <Text style={styles.employeeLabel}>Availability</Text>
        </View>
      )}

      {/* Weekly schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Schedule</Text>
        <Text style={styles.sectionDesc}>
          {isOwnProfile
            ? 'Set the days and hours you are available to work each week.'
            : `${employeeName ?? 'Employee'}'s regular working hours.`}
        </Text>
        <WeeklyAvailabilityGrid employeeId={employeeId} />
      </View>

      {/* Time-off (only own profile or admin viewing) */}
      {isOwnProfile && (
        <View style={styles.section}>
          <TimeOffRequest />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg, gap: spacing.xl, paddingBottom: 60 },

  employeeBanner: { alignItems: 'center', paddingVertical: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, marginBottom: spacing.sm },
  employeeName:   { ...typography.xl, color: colors.text, fontWeight: '700' },
  employeeLabel:  { ...typography.sm, color: colors.textSecondary },

  section:     { gap: spacing.md },
  sectionTitle:{ ...typography.lg, color: colors.text, fontWeight: '700' },
  sectionDesc: { ...typography.sm, color: colors.textSecondary },
});
