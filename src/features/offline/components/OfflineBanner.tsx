/**
 * OfflineBanner — slides in from the top when the device goes offline,
 * slides out when connectivity is restored.
 *
 * Import once in your root layout (inside OfflineProvider) and it will
 * automatically react to connectivity changes.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStatus } from '@/providers/OfflineProvider';
import { colors, spacing, typography } from '@/theme';

const BANNER_HEIGHT = 40;

export function OfflineBanner() {
  const { isOffline, isSyncing } = useOfflineStatus();
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const wasOffline  = useRef(false);

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      // Slide down
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 10,
        tension: 80,
      }).start();
    } else if (wasOffline.current) {
      // Slide back up after a short "back online" message
      const timer = setTimeout(() => {
        Animated.spring(translateY, {
          toValue: -BANNER_HEIGHT,
          useNativeDriver: true,
          friction: 10,
          tension: 80,
        }).start(() => {
          wasOffline.current = false;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOffline, translateY]);

  const bgColor = isOffline ? '#EF4444' : '#10B981';
  const message = isOffline
    ? 'No internet — changes will sync when reconnected'
    : isSyncing
      ? 'Back online — syncing…'
      : 'Back online';

  const iconName: 'wifi-outline' | 'wifi' | 'sync-outline' = isOffline
    ? 'wifi-outline'
    : isSyncing
      ? 'sync-outline'
      : 'wifi';

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: bgColor, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.inner}>
        <Ionicons name={iconName} size={14} color="#fff" />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const TOP_INSET = Platform.OS === 'ios' ? 44 : 0;

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: TOP_INSET,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.sm,
    color: '#fff',
    fontWeight: '600',
  },
});
