import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';

export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureStroke {
  points: SignaturePoint[];
}

interface Props {
  onSave: (strokes: SignatureStroke[]) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
}

/** Renders a simple signature pad using PanResponder.
 *  Strokes are stored as arrays of {x, y} points.
 *  The consumer receives them via onSave and can convert to SVG/PNG elsewhere.
 */
export function SignaturePad({ onSave, onClear, width = 320, height = 180 }: Props) {
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const currentStroke = useRef<SignaturePoint[]>([]);
  const [hasSigned, setHasSigned] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStroke.current = [{ x: locationX, y: locationY }];
        setHasSigned(true);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStroke.current.push({ x: locationX, y: locationY });
        // Trigger re-render for live preview (toggle to force update)
        setHasSigned((v) => v || true);
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 0) {
          const stroke = { points: [...currentStroke.current] };
          setStrokes((prev) => [...prev, stroke]);
          currentStroke.current = [];
        }
      },
    })
  ).current;

  function handleClear() {
    setStrokes([]);
    setHasSigned(false);
    currentStroke.current = [];
    onClear?.();
  }

  function handleSave() {
    onSave(strokes);
  }

  return (
    <View style={styles.wrapper}>
      {/* Drawing surface */}
      <View
        style={[styles.canvas, { width, height }]}
        {...panResponder.panHandlers}
      >
        {!hasSigned && (
          <View style={styles.placeholder}>
            <Ionicons name="create-outline" size={24} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Sign here</Text>
          </View>
        )}

        {/* Dot-based stroke preview — renders filled circles at each point */}
        {strokes.map((stroke, si) =>
          stroke.points.map((pt, pi) => (
            <View
              key={`${si}-${pi}`}
              style={[
                styles.dot,
                { left: pt.x - 2, top: pt.y - 2 },
              ]}
            />
          ))
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, !hasSigned && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!hasSigned}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.text} />
          <Text style={styles.saveBtnText}>Save Signature</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Draw your signature above using your finger or stylus.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md, alignItems: 'center' },

  canvas: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },

  placeholder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeholderText: {
    ...typography.sm,
    color: colors.textMuted,
  },

  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111827',
  },

  controls: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  clearBtnText: {
    ...typography.sm,
    color: colors.danger,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '600',
  },

  hint: {
    ...typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
