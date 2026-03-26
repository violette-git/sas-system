import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, typography } from '@/theme';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: AvatarSize;
  style?: ViewStyle;
  color?: string;
}

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const FONT_SIZES: Record<AvatarSize, number> = {
  xs: 9,
  sm: 12,
  md: 14,
  lg: 17,
  xl: 22,
};

// Deterministic color from name
const COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F59E0B', '#10B981', '#3B82F6', '#EF4444',
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, uri, size = 'md', style, color }: AvatarProps) {
  const dim = SIZES[size];
  const fontSize = FONT_SIZES[size];
  const bg = color ?? (name ? colorFromName(name) : colors.border);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: dim, height: dim, borderRadius: dim / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>
        {name ? initials(name) : '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
  },
});
