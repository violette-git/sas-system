import { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';
import { useWeeklyAvailability, useUpsertAvailability } from '@/features/availability/hooks/useAvailability';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Common time presets
const TIME_PRESETS = ['06:00', '07:00', '08:00', '09:00', '10:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

interface DayRowProps {
  day: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  onToggle: (day: number, available: boolean) => void;
  onTimeChange: (day: number, field: 'start' | 'end', value: string) => void;
  saving: boolean;
}

function DayRow({ day, isAvailable, startTime, endTime, onToggle, onTimeChange, saving }: DayRowProps) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  return (
    <View style={styles.dayRow}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
        <View style={styles.switchRow}>
          {saving && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: spacing.sm }} />}
          <Switch
            value={isAvailable}
            onValueChange={v => onToggle(day, v)}
            trackColor={{ false: colors.border, true: colors.accentDim }}
            thumbColor={isAvailable ? colors.accent : colors.textMuted}
          />
        </View>
      </View>

      {isAvailable && (
        <View style={styles.timeRow}>
          {/* Start time */}
          <View style={styles.timePicker}>
            <Text style={styles.timePickerLabel}>From</Text>
            <TouchableOpacity
              style={styles.timeBtn}
              onPress={() => { setShowStartPicker(v => !v); setShowEndPicker(false); }}
            >
              <Text style={styles.timeBtnText}>{startTime?.slice(0,5) ?? '—'}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <View style={styles.presetList}>
                {TIME_PRESETS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.presetItem, startTime?.startsWith(t) && styles.presetItemActive]}
                    onPress={() => { onTimeChange(day, 'start', t + ':00'); setShowStartPicker(false); }}
                  >
                    <Text style={[styles.presetText, startTime?.startsWith(t) && styles.presetTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* End time */}
          <View style={styles.timePicker}>
            <Text style={styles.timePickerLabel}>To</Text>
            <TouchableOpacity
              style={styles.timeBtn}
              onPress={() => { setShowEndPicker(v => !v); setShowStartPicker(false); }}
            >
              <Text style={styles.timeBtnText}>{endTime?.slice(0,5) ?? '—'}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <View style={styles.presetList}>
                {TIME_PRESETS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.presetItem, endTime?.startsWith(t) && styles.presetItemActive]}
                    onPress={() => { onTimeChange(day, 'end', t + ':00'); setShowEndPicker(false); }}
                  >
                    <Text style={[styles.presetText, endTime?.startsWith(t) && styles.presetTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

interface Props {
  employeeId?: string;
}

export function WeeklyAvailabilityGrid({ employeeId }: Props) {
  const { data: records = [], isLoading } = useWeeklyAvailability(employeeId);
  const upsert = useUpsertAvailability();
  const [savingDay, setSavingDay] = useState<number | null>(null);

  function getRecord(day: number) {
    return records.find(r => r.day_of_week === day);
  }

  function handleToggle(day: number, available: boolean) {
    const rec = getRecord(day);
    setSavingDay(day);
    upsert.mutate({
      day_of_week:  day,
      is_available: available,
      start_time:   available ? (rec?.start_time ?? '09:00:00') : null,
      end_time:     available ? (rec?.end_time ?? '17:00:00') : null,
    }, { onSettled: () => setSavingDay(null) });
  }

  function handleTimeChange(day: number, field: 'start' | 'end', value: string) {
    const rec = getRecord(day);
    setSavingDay(day);
    upsert.mutate({
      day_of_week:  day,
      is_available: true,
      start_time:   field === 'start' ? value : (rec?.start_time ?? '09:00:00'),
      end_time:     field === 'end'   ? value : (rec?.end_time ?? '17:00:00'),
    }, { onSettled: () => setSavingDay(null) });
  }

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Array.from({ length: 7 }, (_, day) => {
        const rec = getRecord(day);
        return (
          <DayRow
            key={day}
            day={day}
            isAvailable={rec?.is_available ?? false}
            startTime={rec?.start_time ?? null}
            endTime={rec?.end_time ?? null}
            onToggle={handleToggle}
            onTimeChange={handleTimeChange}
            saving={savingDay === day}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  loader:    { padding: spacing.xl, alignItems: 'center' },

  dayRow:    { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel:  { ...typography.base, color: colors.text, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },

  timeRow:         { flexDirection: 'row', gap: spacing.md },
  timePicker:      { flex: 1, gap: spacing.xs },
  timePickerLabel: { ...typography.xs, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  timeBtn:         { backgroundColor: colors.elevated, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  timeBtnText:     { ...typography.sm, color: colors.accentLight, fontWeight: '600' },

  presetList:     { backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, maxHeight: 160, overflow: 'scroll' as any },
  presetItem:     { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  presetItemActive:{ backgroundColor: colors.accentDim },
  presetText:     { ...typography.sm, color: colors.textSecondary },
  presetTextActive:{ color: colors.accent, fontWeight: '700' },
});
