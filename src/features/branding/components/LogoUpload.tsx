import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';

interface LogoUploadProps {
  logoUrl: string | null;
  uploading: boolean;
  onPick: (uri: string) => void;
}

export function LogoUpload({ logoUrl, uploading, onPick }: LogoUploadProps) {
  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onPick(result.assets[0].uri);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>COMPANY LOGO</Text>

      <TouchableOpacity
        style={styles.uploadArea}
        onPress={pickImage}
        disabled={uploading}
        accessibilityLabel="Upload company logo"
      >
        {uploading ? (
          <ActivityIndicator color={colors.accent} />
        ) : logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={32} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Tap to upload logo</Text>
            <Text style={styles.placeholderSub}>PNG, JPG, WebP · max 5 MB</Text>
          </View>
        )}
      </TouchableOpacity>

      {logoUrl && !uploading && (
        <TouchableOpacity style={styles.changeButton} onPress={pickImage}>
          <Ionicons name="camera-outline" size={14} color={colors.accent} />
          <Text style={styles.changeText}>Change logo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  uploadArea: {
    height: 120,
    backgroundColor: colors.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  placeholderText: {
    ...typography.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  placeholderSub: {
    ...typography.xs,
    color: colors.placeholder,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  changeText: {
    ...typography.sm,
    color: colors.accent,
  },
});
