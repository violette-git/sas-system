import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';

const PRESET_COLORS = [
  { label: 'Indigo',    value: '#6366F1' },
  { label: 'Blue',      value: '#3B82F6' },
  { label: 'Violet',    value: '#8B5CF6' },
  { label: 'Emerald',   value: '#10B981' },
  { label: 'Teal',      value: '#14B8A6' },
  { label: 'Rose',      value: '#F43F5E' },
  { label: 'Orange',    value: '#F97316' },
  { label: 'Amber',     value: '#F59E0B' },
  { label: 'Sky',       value: '#0EA5E9' },
  { label: 'Fuchsia',   value: '#D946EF' },
  { label: 'Slate',     value: '#64748B' },
  { label: 'Stone',     value: '#78716C' },
];

interface ColorPickerProps {
  label: string;
  value: string | null;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.swatches}>
        {PRESET_COLORS.map((c) => (
          <TouchableOpacity
            key={c.value}
            onPress={() => onChange(c.value)}
            style={[
              styles.swatch,
              { backgroundColor: c.value },
              value === c.value && styles.swatchSelected,
            ]}
            accessibilityLabel={c.label}
          >
            {value === c.value && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {value && (
        <View style={styles.preview}>
          <View style={[styles.previewDot, { backgroundColor: value }]} />
          <Text style={styles.previewText}>{value}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewDot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
  },
  previewText: {
    ...typography.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
});
