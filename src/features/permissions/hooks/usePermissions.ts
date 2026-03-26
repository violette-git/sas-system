import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { supabase } from '@/lib/supabase';
import {
  resolvePermission,
  resolveAllPermissions,
  type PermissionKey,
  type PermissionMap,
} from '../utils/permissions';

/**
 * usePermissions — resolves the current user's effective permission set.
 *
 * Returns:
 *   can(key)      → true if permitted
 *   permissions   → full resolved map (all keys)
 */
export function usePermissions() {
  const { profile } = useAuthStore();

  const can = useCallback(
    (key: PermissionKey): boolean => {
      if (!profile) return false;
      const overrides = (profile.permissions ?? {}) as PermissionMap;
      return resolvePermission(profile.role, overrides, key);
    },
    [profile],
  );

  const permissions = profile
    ? resolveAllPermissions(profile.role, (profile.permissions ?? {}) as PermissionMap)
    : null;

  return { can, permissions };
}

// ── Admin mutation: update another user's permission overrides ──

export interface UpdateUserPermissionsInput {
  userId:     string;
  overrides:  PermissionMap;   // only the keys being explicitly set
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, overrides }: UpdateUserPermissionsInput) => {
      const { error } = await supabase
        .from('users')
        .update({ permissions: overrides })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
