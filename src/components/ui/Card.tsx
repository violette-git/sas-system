import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** 'default' = standard dark card, 'elevated' = higher elevation, 'glass' = frosted */
  variant?: 'default' | 'elevated' | 'glass';
  /** Renders a colored left border accent stripe */
  accentColor?: string;
  padding?: number | false;
}

export function Card({
  children,
  style,
  variant = 'default',
  accentColor,
  padding = 16,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'glass'    && styles.glass,
        accentColor            && { borderLeftWidth: 3, borderLeftColor: accentColor },
        padding !== false      && { padding },
        shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    ...shadow.md,
  },
  glass: {
    backgroundColor: 'rgba(26,29,39,0.9)',
    borderColor: 'rgba(255,255,255,0.06)',
    ...shadow.lg,
  },
});
