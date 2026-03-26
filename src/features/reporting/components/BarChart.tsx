import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { colors, typography, spacing } from '@/theme';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

const PADDING_LEFT  = 36;
const PADDING_RIGHT = 8;
const PADDING_TOP   = 24;
const PADDING_BOT   = 32;

export function BarChart({ data, color = colors.accent, height = 200, formatValue }: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const maxVal  = Math.max(...data.map(d => d.value), 1);
  const fmt     = formatValue ?? ((v: number) => v.toFixed(0));

  // We'll compute layout inside render so we can use dynamic width
  return (
    <View style={{ height: height + PADDING_BOT }}>
      <Svg width="100%" height={height + PADDING_BOT} viewBox={`0 0 ${320} ${height + PADDING_BOT}`}>
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = PADDING_TOP + (1 - ratio) * (height - PADDING_TOP - PADDING_BOT);
          const val = maxVal * ratio;
          return (
            <G key={idx}>
              <Line
                x1={PADDING_LEFT}
                y1={y}
                x2={320 - PADDING_RIGHT}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
              <SvgText
                x={PADDING_LEFT - 4}
                y={y + 4}
                fontSize={8}
                fill={colors.textMuted}
                textAnchor="end"
              >
                {fmt(val)}
              </SvgText>
            </G>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const chartWidth = 320 - PADDING_LEFT - PADDING_RIGHT;
          const barSlot    = chartWidth / data.length;
          const barWidth   = Math.max(barSlot * 0.6, 4);
          const x          = PADDING_LEFT + i * barSlot + (barSlot - barWidth) / 2;
          const chartH     = height - PADDING_TOP - PADDING_BOT;
          const barH       = Math.max((d.value / maxVal) * chartH, 2);
          const y          = PADDING_TOP + chartH - barH;

          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={3}
                fill={color}
                opacity={0.85}
              />
              {/* Value label on top */}
              <SvgText
                x={x + barWidth / 2}
                y={y - 4}
                fontSize={8}
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {fmt(d.value)}
              </SvgText>
              {/* X-axis label */}
              <SvgText
                x={x + barWidth / 2}
                y={height + PADDING_BOT - 4}
                fontSize={8}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {d.label.length > 7 ? d.label.slice(0, 6) + '…' : d.label}
              </SvgText>
            </G>
          );
        })}

        {/* X axis baseline */}
        <Line
          x1={PADDING_LEFT}
          y1={PADDING_TOP + (height - PADDING_TOP - PADDING_BOT)}
          x2={320 - PADDING_RIGHT}
          y2={PADDING_TOP + (height - PADDING_TOP - PADDING_BOT)}
          stroke={colors.border}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  emptyText: {
    ...typography.sm,
    color: colors.textMuted,
  },
});
