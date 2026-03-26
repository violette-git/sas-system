/**
 * GeofenceWarning — modal shown when the employee is outside the
 * configured geofence radius on clock-in.
 *
 * The employee can choose to proceed (override) or cancel.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import type { GeofenceResult } from '../hooks/useGeofence';

interface GeofenceWarningProps {
  visible:   boolean;
  result:    GeofenceResult | null;
  onProceed: () => void;
  onCancel:  () => void;
}

export function GeofenceWarning({
  visible,
  result,
  onProceed,
  onCancel,
}: GeofenceWarningProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Icon */}
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="location-outline" size={32} color={colors.warning} />
            </View>
          </View>

          <Text style={styles.title}>Outside Service Area</Text>

          <Text style={styles.body}>
            You appear to be outside the expected service location for this visit.
          </Text>

          {result?.formattedDist && (
            <View style={styles.distancePill}>
              <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
              <Text style={styles.distanceText}>
                {result.formattedDist} from client address
              </Text>
            </View>
          )}

          <Text style={styles.hint}>
            You can still proceed — your GPS coordinates will be recorded for review.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.proceedBtn} onPress={onProceed}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.proceedText}>Proceed Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    width: '100%',
    maxWidth: 400,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.lg,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    ...typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.elevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'center',
  },
  distanceText: {
    ...typography.sm,
    color: colors.textMuted,
  },
  hint: {
    ...typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.base,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  proceedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warning,
  },
  proceedText: {
    ...typography.base,
    color: '#fff',
    fontWeight: '700',
  },
});
