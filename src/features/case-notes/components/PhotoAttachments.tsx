import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { colors, spacing, radius, typography } from '@/theme';

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  scheduleId: string;
  maxPhotos?: number;
}

export function PhotoAttachments({ urls, onChange, scheduleId, maxPhotos = 5 }: Props) {
  const { profile } = useAuthStore();
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera roll access is needed to attach photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const companyId = profile!.company_id!;
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `${companyId}/${scheduleId}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('case-notes')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('case-notes').getPublicUrl(path);
      onChange([...urls, data.publicUrl]);
    } catch (err) {
      Alert.alert('Upload failed', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const companyId = profile!.company_id!;
      const path = `${companyId}/${scheduleId}/${Date.now()}.jpg`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('case-notes')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('case-notes').getPublicUrl(path);
      onChange([...urls, data.publicUrl]);
    } catch (err) {
      Alert.alert('Upload failed', (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    Alert.alert('Remove photo', 'Remove this photo from the note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(urls.filter(u => u !== url)) },
    ]);
  }

  const canAdd = urls.length < maxPhotos && !uploading;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Photos ({urls.length}/{maxPhotos})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {urls.map((url, idx) => (
          <View key={url} style={styles.thumb}>
            <Image source={{ uri: url }} style={styles.thumbImg} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(url)}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </TouchableOpacity>
            <Text style={styles.thumbNum}>{idx + 1}</Text>
          </View>
        ))}

        {/* Uploading spinner */}
        {uploading && (
          <View style={[styles.thumb, styles.thumbLoading]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </ScrollView>

      {canAdd && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.addBtn} onPress={pickAndUpload}>
            <Ionicons name="images-outline" size={16} color={colors.accent} />
            <Text style={styles.addBtnText}>Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={16} color={colors.accent} />
            <Text style={styles.addBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },

  label: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  scroll: { flexDirection: 'row' },

  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.elevated,
  },
  thumbLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  thumbImg: { width: THUMB_SIZE, height: THUMB_SIZE },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  thumbNum: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    ...typography.xs,
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  actions: { flexDirection: 'row', gap: spacing.sm },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
  },
  addBtnText: {
    ...typography.sm,
    color: colors.accent,
    fontWeight: '600',
  },
});
