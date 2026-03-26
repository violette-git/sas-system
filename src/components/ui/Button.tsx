import {
  TouchableOpacity, Text, ActivityIndicator,
  ViewStyle, TextStyle, StyleSheet, View,
} from 'react-native';
import { colors, radius, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  textStyle,
  icon,
  iconRight,
  fullWidth,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && styles.disabled,
        fullWidth  && styles.fullWidth,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.72}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'ghost' || variant === 'secondary' ? colors.accent : '#fff'}
          size="small"
        />
      ) : (
        <>
          {icon}
          {children !== undefined && (
            <Text style={[styles.text, textVariant[variant], textSize[size], textStyle]}>
              {children}
            </Text>
          )}
          {iconRight}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
  },
  disabled:  { opacity: 0.45 },
  fullWidth: { width: '100%' },
  text: {
    fontWeight: '600',
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
  success: {
    backgroundColor: colors.success,
  },
};

const sizeStyles: Record<Size, ViewStyle> = {
  xs: { paddingHorizontal: 10, paddingVertical: 5,  gap: 4 },
  sm: { paddingHorizontal: 12, paddingVertical: 7,  gap: 6 },
  md: { paddingHorizontal: 16, paddingVertical: 11, gap: 8 },
  lg: { paddingHorizontal: 24, paddingVertical: 14, gap: 8 },
};

const textVariant: Record<Variant, TextStyle> = {
  primary:   { color: '#fff' },
  secondary: { color: colors.text },
  ghost:     { color: colors.accentLight },
  danger:    { color: '#fff' },
  success:   { color: '#fff' },
};

const textSize: Record<Size, TextStyle> = {
  xs: { fontSize: typography.xs.fontSize },
  sm: { fontSize: typography.sm.fontSize },
  md: { fontSize: typography.base.fontSize },
  lg: { fontSize: typography.lg.fontSize },
};
