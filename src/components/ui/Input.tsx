import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography, spacing } from '@/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  onIconRightPress?: () => void;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export function Input({
  label,
  hint,
  error,
  icon,
  iconRight,
  onIconRightPress,
  containerStyle,
  required,
  ...textInputProps
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      )}

      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          !!error && styles.inputWrapperError,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={focused ? colors.accentLight : colors.textMuted}
            style={styles.iconLeft}
          />
        )}

        <TextInput
          style={[styles.input, icon && styles.inputWithIcon]}
          placeholderTextColor={colors.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...textInputProps}
        />

        {iconRight && (
          <TouchableOpacity
            onPress={onIconRightPress}
            style={styles.iconRight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={iconRight} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  label: {
    fontSize: typography.sm.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  required: { color: colors.danger },
  hint: {
    fontSize: typography.xs.fontSize,
    color: colors.textMuted,
    flexShrink: 1,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
  },
  inputWrapperFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.elevated,
  },
  inputWrapperError: {
    borderColor: colors.danger,
  },

  iconLeft: {
    marginLeft: spacing.md,
  },
  iconRight: {
    padding: spacing.md,
  },

  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.base.fontSize,
    color: colors.text,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },

  error: {
    fontSize: typography.xs.fontSize,
    color: colors.danger,
  },
});
