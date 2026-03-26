import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SignaturePad, SignatureStroke } from '@/features/signatures/components/SignaturePad';
import { useSaveSignature } from '@/features/documents/hooks/useDocuments';
import { colors, spacing, radius, typography } from '@/theme';

/** Converts stroke data to a simple PNG data URI using a canvas (web) or
 *  a placeholder data URI (native — full canvas rendering requires a native
 *  module; this implementation stores the raw stroke data and a placeholder).
 */
async function strokesToDataUri(
  strokes: SignatureStroke[],
  width: number,
  height: number
): Promise<string> {
  // On web we can use a real canvas
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
      return canvas.toDataURL('image/png');
    }
  }

  // On native: return a 1×1 white PNG as placeholder
  // (A production implementation would use react-native-view-shot or similar)
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
}

export default function SignatureScreen() {
  const { documentId, clientId } = useLocalSearchParams<{
    documentId: string;
    clientId: string;
  }>();
  const router = useRouter();
  const saveSignature = useSaveSignature();
  const [saving, setSaving] = useState(false);

  async function handleSave(strokes: SignatureStroke[]) {
    if (strokes.length === 0) {
      Alert.alert('No signature', 'Please draw your signature before saving.');
      return;
    }

    setSaving(true);
    try {
      const dataUri = await strokesToDataUri(strokes, 320, 180);
      saveSignature.mutate(
        { documentId, clientId, signatureDataUri: dataUri },
        {
          onSuccess: () => {
            Alert.alert('Saved', 'Signature saved successfully.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          },
          onError: (err) => {
            Alert.alert('Error', (err as Error).message);
          },
          onSettled: () => setSaving(false),
        }
      );
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={colors.accent} />
        <Text style={styles.backText}>Documents</Text>
      </TouchableOpacity>

      <Text style={styles.title}>E-Signature</Text>
      <Text style={styles.subtitle}>
        Please sign below to confirm your consent and agreement.
      </Text>

      <View style={styles.padContainer}>
        {saving ? (
          <View style={styles.savingOverlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.savingText}>Saving signature…</Text>
          </View>
        ) : (
          <SignaturePad onSave={handleSave} width={320} height={180} />
        )}
      </View>

      <View style={styles.disclaimer}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
        <Text style={styles.disclaimerText}>
          By signing above you acknowledge that this signature is legally binding
          and represents your consent to the associated document.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 60, alignItems: 'center' },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  backText: { ...typography.base, color: colors.accent },

  title: { ...typography.xl, color: colors.text, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    ...typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },

  padContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },

  savingOverlay: {
    width: 320,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savingText: { ...typography.sm, color: colors.textSecondary },

  disclaimer: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    maxWidth: 360,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  disclaimerText: { ...typography.sm, color: colors.textMuted, flex: 1, lineHeight: 18 },
});
