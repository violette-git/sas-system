import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText, G, Circle } from 'react-native-svg';
import { colors, typography, spacing, radius } from '@/theme';

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  innerText?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  // Clamp to just under 360 to avoid degenerate arcs
  const clampedEnd = Math.min(endAngle, startAngle + 359.99);
  const large = clampedEnd - startAngle > 180 ? 1 : 0;

  const s  = polarToCartesian(cx, cy, outerR, startAngle);
  const e  = polarToCartesian(cx, cy, outerR, clampedEnd);
  const si = polarToCartesian(cx, cy, innerR, clampedEnd);
  const ei = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${s.x} ${s.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${si.x} ${si.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ');
}

export function DonutChart({ data, size = 180, innerText }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data || data.length === 0 || total === 0) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const cx      = size / 2;
  const cy      = size / 2;
  const outerR  = size / 2 - 4;
  const innerR  = outerR * 0.62;

  let currentAngle = 0;
  const slices = data.map(d => {
    const sweep = (d.value / total) * 360;
    const start = currentAngle;
    const end   = currentAngle + sweep;
    currentAngle = end;
    return { ...d, start, end, path: arcPath(cx, cy, outerR, innerR, start, end) };
  });

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} />
        ))}
        {innerText ? (
          <G>
            <Circle cx={cx} cy={cy} r={innerR - 2} fill={colors.card} />
            <SvgText
              x={cx}
              y={cy + 6}
              fontSize={18}
              fontWeight="700"
              fill={colors.text}
              textAnchor="middle"
            >
              {innerText}
            </SvgText>
          </G>
        ) : (
          <Circle cx={cx} cy={cy} r={innerR - 2} fill={colors.card} />
        )}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: d.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={styles.legendValue}>
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  emptyText: {
    ...typography.sm,
    color: colors.textMuted,
  },
  legend: {
    width: '100%',
    gap: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...typography.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  legendValue: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '600',
  },
});
