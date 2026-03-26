import React, { useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  minHeight?: number;
}

type FormatAction = 'bold' | 'italic' | 'h2' | 'ul' | 'ol';

function wrapSelection(
  text: string,
  selection: { start: number; end: number },
  wrapper: string
): string {
  const before = text.slice(0, selection.start);
  const selected = text.slice(selection.start, selection.end);
  const after = text.slice(selection.end);
  return `${before}${wrapper}${selected}${wrapper}${after}`;
}

function prependLine(
  text: string,
  selection: { start: number; end: number },
  prefix: string
): string {
  // Find the start of the current line
  const lineStart = text.lastIndexOf('\n', selection.start - 1) + 1;
  return (
    text.slice(0, lineStart) +
    prefix +
    text.slice(lineStart)
  );
}

export function RichTextEditor({
  value,
  onChangeText,
  placeholder = 'Write your note here…',
  label,
  required = false,
  minHeight = 120,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  // Track selection locally (TextInput onSelectionChange gives us this)
  const selectionRef = useRef({ start: 0, end: 0 });

  function applyFormat(action: FormatAction) {
    const sel = selectionRef.current;
    let next = value;

    switch (action) {
      case 'bold':
        next = wrapSelection(value, sel, '**');
        break;
      case 'italic':
        next = wrapSelection(value, sel, '_');
        break;
      case 'h2':
        next = prependLine(value, sel, '## ');
        break;
      case 'ul':
        next = prependLine(value, sel, '- ');
        break;
      case 'ol':
        next = prependLine(value, sel, '1. ');
        break;
    }

    onChangeText(next);
    // Re-focus after format
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <ToolbarBtn icon="text" label="B" bold onPress={() => applyFormat('bold')} />
        <ToolbarBtn icon="text" label="I" italic onPress={() => applyFormat('italic')} />
        <ToolbarBtn icon="text" label="H2" onPress={() => applyFormat('h2')} />
        <View style={styles.sep} />
        <ToolbarIconBtn ionicon="list-outline" onPress={() => applyFormat('ul')} />
        <ToolbarIconBtn ionicon="list-circle-outline" onPress={() => applyFormat('ol')} />
      </View>

      {/* Text area */}
      <TextInput
        ref={inputRef}
        style={[styles.input, { minHeight }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        textAlignVertical="top"
        onSelectionChange={({ nativeEvent: { selection } }) => {
          selectionRef.current = selection;
        }}
      />

      {/* Markdown hint */}
      <Text style={styles.hint}>
        Supports markdown: **bold**, _italic_, ## heading, - list
      </Text>
    </View>
  );
}

function ToolbarBtn({
  label,
  bold,
  italic,
  onPress,
}: {
  icon?: string;
  label: string;
  bold?: boolean;
  italic?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.toolbarBtn} onPress={onPress}>
      <Text
        style={[
          styles.toolbarBtnText,
          bold && { fontWeight: '800' },
          italic && { fontStyle: 'italic' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ToolbarIconBtn({ ionicon, onPress }: { ionicon: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.toolbarBtn} onPress={onPress}>
      <Ionicons name={ionicon as any} size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },

  label: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  required: { color: colors.danger },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  toolbarBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  toolbarBtnText: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  sep: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },

  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.base,
    color: colors.text,
    paddingTop: spacing.md,
  },

  hint: {
    ...typography.xs,
    color: colors.textMuted,
  },
});
