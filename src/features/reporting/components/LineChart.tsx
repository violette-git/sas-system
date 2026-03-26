import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText, G, Line, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { colors, typography } from '@/theme';

interface LineChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

const SVG_WIDTH    = 320;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 8;
const PADDING_TOP  = 20;
const PADDING_BOT  = 36;

export function LineChart({ data, color = colors.accent, height = 200, formatValue }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const fmt     = formatValue ?? ((v: number) => v.toFixed(1));
  const maxVal  = Math.max(...data.map(d => d.value), 1);
  const chartH  = height - PADDING_TOP - PADDING_BOT;
  const chartW  = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;

  const points = data.map((d, i) => {
    const x = PADDING_LEFT + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = PADDING_TOP + (1 - d.value / maxVal) * chartH;
    return { x, y, ...d };
  });

  const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');

  // Build fill path: follow the polyline then close along the bottom
  const fillPath = points.length > 0
    ? `M ${points[0].x},${PADDING_TOP + chartH} ` +
      points.map(p => `L ${p.x},${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x},${PADDING_TOP + chartH} Z`
    : '';

  // Y-axis grid lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View style={{ height: height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${SVG_WIDTH} ${height}`}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Y-axis grid lines */}
        {yTicks.map((ratio, idx) => {
          const y = PADDING_TOP + (1 - ratio) * chartH;
          const val = maxVal * ratio;
          return (
            <G key={idx}>
              <Line
                x1={PADDING_LEFT}
                y1={y}
                x2={SVG_WIDTH - PADDING_RIGHT}
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

        {/* Gradient fill under line */}
        {fillPath ? (
          <Path d={fillPath} fill="url(#lineGrad)" />
        ) : null}

        {/* Line */}
        <Polyline
          points={polylineStr}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots & X labels */}
        {points.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={3} fill={color} />
            <Circle cx={p.x} cy={p.y} r={5} fill={color} opacity={0.2} />
            <SvgText
              x={p.x}
              y={height - 4}
              fontSize={8}
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {p.label.length > 6 ? p.label.slice(0, 5) + '…' : p.label}
            </SvgText>
          </G>
        ))}

        {/* X axis baseline */}
        <Line
          x1={PADDING_LEFT}
          y1={PADDING_TOP + chartH}
          x2={SVG_WIDTH - PADDING_RIGHT}
          y2={PADDING_TOP + chartH}
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
