import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useUpdateUserPermissions } from '../hooks/usePermissions';
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  resolveAllPermissions,
  type PermissionKey,
  type PermissionMap,
} from '../utils/permissions';
import type { UserRole } from '@/lib/supabase';
import { colors, spacing, radius, typography, shadow } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

// ── Employee with permission data ────────────────────────────
interface EmployeeRow {
  id:          string;
  full_name:   string;
  email:       string;
  role:        UserRole;
  permissions: PermissionMap;
  is_active:   boolean;
}

function useEmployeesWithPermissions() {
  const { profile } = useAuthStore();

  return useQuery<EmployeeRow[]>({
    queryKey: ['employees_permissions', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, permissions, is_active')
        .eq('company_id', profile!.company_id!)
        .neq('role', 'owner')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as EmployeeRow[];
    },
  });
}

// ── Permission row toggle ────────────────────────────────────
function PermissionRow({
  permKey,
  currentValue,
  roleDefault,
  onToggle,
}: {
  permKey:      PermissionKey;
  currentValue: boolean;
  roleDefault:  boolean;
  onToggle:     (key: PermissionKey, value: boolean) => void;
}) {
  const meta = PERMISSION_LABELS[permKey];
  const isOverridden = currentValue !== roleDefault;

  return (
    <View style={permStyles.row}>
      <View style={permStyles.rowLeft}>
        <Text style={permStyles.permLabel}>{meta.label}</Text>
        <Text style={permStyles.permDesc} numberOfLines={1}>{meta.description}</Text>
        {isOverridden && (
          <Text style={permStyles.overrideTag}>
            {currentValue ? '▲ Elevated' : '▼ Restricted'}
          </Text>
        )}
      </View>
      <Switch
        value={currentValue}
        onValueChange={(v) => onToggle(permKey, v)}
        trackColor={{ false: colors.border, true: colors.accent + '80' }}
        thumbColor={currentValue ? colors.accent : colors.textMuted}
        ios_backgroundColor={colors.elevated}
      />
    </View>
  );
}

const permStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  permLabel: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '600',
  },
  permDesc: {
    ...typography.xs,
    color: colors.textMuted,
  },
  overrideTag: {
    ...typography.xs,
    color: colors.warning,
    fontWeight: '700',
  },
});

// ── Employee card with expandable permissions ─────────────────
function EmployeePermissionCard({
  employee,
  onSave,
}: {
  employee: EmployeeRow;
  onSave:   (userId: string, overrides: PermissionMap) => void;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [overrides, setOverrides]     = useState<PermissionMap>(employee.permissions ?? {});
  const [hasChanges, setHasChanges]   = useState(false);

  const resolved = resolveAllPermissions(employee.role, overrides);
  const roleDefaults = resolveAllPermissions(employee.role, {});

  function handleToggle(key: PermissionKey, value: boolean) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  function handleSave() {
    onSave(employee.id, overrides);
    setHasChanges(false);
  }

  function handleReset() {
    setOverrides({});
    setHasChanges(true);
  }

  const roleBadgeVariant = employee.role === 'admin' ? 'success' : 'neutral';
  const overrideCount = Object.keys(overrides).filter(
    (k) => overrides[k as PermissionKey] !== undefined,
  ).length;

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity
        style={cardStyles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Avatar name={employee.full_name} size="sm" />

        <View style={cardStyles.info}>
          <Text style={cardStyles.name}>{employee.full_name}</Text>
          <Text style={cardStyles.email} numberOfLines={1}>{employee.email}</Text>
        </View>

        <View style={cardStyles.headerRight}>
          <Badge variant={roleBadgeVariant}>{employee.role}</Badge>
          {overrideCount > 0 && (
            <View style={cardStyles.overridePill}>
              <Text style={cardStyles.overrideCount}>{overrideCount} override{overrideCount > 1 ? 's' : ''}</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={cardStyles.body}>
          {PERMISSION_KEYS.map((key) => (
            <PermissionRow
              key={key}
              permKey={key}
              currentValue={resolved[key]}
              roleDefault={roleDefaults[key]}
              onToggle={handleToggle}
            />
          ))}

          <View style={cardStyles.actions}>
            <TouchableOpacity style={cardStyles.resetBtn} onPress={handleReset}>
              <Text style={cardStyles.resetText}>Reset to Role Defaults</Text>
            </TouchableOpacity>
            {hasChanges && (
              <TouchableOpacity style={cardStyles.saveBtn} onPress={handleSave}>
                <Text style={cardStyles.saveText}>Save Changes</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  email: {
    ...typography.xs,
    color: colors.textMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overridePill: {
    backgroundColor: colors.warning + '20',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  overrideCount: {
    ...typography.xs,
    color: colors.warning,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  resetText: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  saveText: {
    ...typography.sm,
    color: '#fff',
    fontWeight: '700',
  },
});

// ── Main screen ──────────────────────────────────────────────
export function PermissionsScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useEmployeesWithPermissions();
  const updatePermissions = useUpdateUserPermissions();

  const handleSave = useCallback(
    (userId: string, overrides: PermissionMap) => {
      updatePermissions.mutate(
        { userId, overrides },
        {
          onSuccess: () => Alert.alert('Saved', 'Permissions updated.'),
          onError:   (e) => Alert.alert('Error', e.message),
        },
      );
    },
    [updatePermissions],
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerPad}>
          <Text style={styles.title}>Role Permissions</Text>
          <Text style={styles.subtitle}>Override individual permissions per staff member.</Text>
        </View>
        <SkeletonList />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load employees'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={data ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <EmployeePermissionCard employee={item} onSave={handleSave} />
      )}
      ListHeaderComponent={
        <View style={styles.headerPad}>
          <Text style={styles.title}>Role Permissions</Text>
          <Text style={styles.subtitle}>
            Tap any staff member to view and override their default permissions.
            Green toggles are enabled; role defaults are shown as-is.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="shield-checkmark-outline"
          title="No staff members found"
          description="Invite employees to manage their permissions."
        />
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={() => refetch()}
          tintColor={colors.accent}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerPad: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.xl,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 40,
  },
});
