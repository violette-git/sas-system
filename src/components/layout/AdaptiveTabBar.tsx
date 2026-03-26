import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase';
import {
  colors, typography, spacing, radius, shadow,
  SIDEBAR_WIDTH, BOTTOM_TAB_HEIGHT, Breakpoints,
} from '@/theme';
import { Avatar } from '@/components/ui';

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

// ── Sidebar (desktop / tablet) ────────────────────────────────────────────────

function Sidebar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { profile, company, clear } = useAuthStore();

  // Only show top-level routes (no [id] or nested paths)
  const visibleRoutes = state.routes.filter(
    (r: any) => !r.name.includes('[') && !r.name.includes('/')
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    clear();
  }

  return (
    <View
      style={[
        styles.sidebar,
        { paddingTop: insets.top + spacing.lg },
      ]}
    >
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <Ionicons name="pulse" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName} numberOfLines={1}>
            {company?.trade_name ?? company?.name ?? 'SAS System'}
          </Text>
          <Text style={styles.brandRole}>{profile?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Nav items */}
      <View style={styles.navList}>
        {visibleRoutes.map((route: any) => {
          const isFocused = state.index === state.routes.indexOf(route);
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const color = isFocused ? colors.accentLight : colors.textMuted;

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.navRow, isFocused && styles.navRowActive]}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              activeOpacity={0.75}
            >
              {isFocused && <View style={styles.navActiveBar} />}
              <View style={styles.navIconWrap}>
                {options.tabBarIcon?.({ color, size: 18, focused: isFocused })}
              </View>
              <Text style={[styles.navLabel, isFocused && styles.navLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.divider} />

      {/* User block */}
      <TouchableOpacity
        style={styles.userBlock}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Avatar name={profile?.full_name} size="sm" />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {profile?.full_name ?? 'User'}
          </Text>
          <Text style={styles.userAction}>Tap to sign out</Text>
        </View>
        <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={{ height: Math.max(insets.bottom, spacing.md) }} />
    </View>
  );
}

// ── Bottom Tab Bar (mobile) ───────────────────────────────────────────────────

function BottomBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter(
    (r: any) => !r.name.includes('[') && !r.name.includes('/')
  );

  return (
    <View
      style={[
        styles.bottomBar,
        {
          paddingBottom: insets.bottom,
          height: BOTTOM_TAB_HEIGHT + insets.bottom,
        },
      ]}
    >
      {visibleRoutes.map((route: any) => {
        const isFocused = state.index === state.routes.indexOf(route);
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const color = isFocused ? colors.accentLight : colors.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.bottomTab}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.bottomTabIcon, isFocused && styles.bottomTabIconActive]}>
              {options.tabBarIcon?.({ color, size: 20, focused: isFocused })}
            </View>
            <Text style={[styles.bottomTabLabel, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Adaptive export ───────────────────────────────────────────────────────────

export function AdaptiveTabBar(props: TabBarProps) {
  const { width } = useWindowDimensions();
  if (width >= Breakpoints.tablet) {
    return <Sidebar {...props} />;
  }
  return <BottomBar {...props} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Sidebar
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.bg,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    zIndex: 1000,
    paddingHorizontal: spacing.md,
    ...shadow.lg,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandName: {
    fontSize: typography.base.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  brandRole: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.accentLight,
    letterSpacing: 2,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    marginHorizontal: spacing.xs,
  },

  navList: { gap: 2 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  navRowActive: {
    backgroundColor: colors.accentDim,
  },
  navActiveBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  navIconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: typography.sm.fontSize,
    fontWeight: '500',
    color: colors.textMuted,
  },
  navLabelActive: {
    color: colors.accentLight,
    fontWeight: '600',
  },

  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: typography.sm.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  userAction: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },

  // ── Bottom bar
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    gap: 3,
  },
  bottomTabIcon: {
    width: 36,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  bottomTabIconActive: {
    backgroundColor: colors.accentDim,
  },
  bottomTabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
