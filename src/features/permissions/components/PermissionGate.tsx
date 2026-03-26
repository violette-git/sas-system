/**
 * PermissionGate — conditionally renders children based on the current
 * user's resolved permissions.
 *
 * Usage:
 *   <PermissionGate require="approve_notes">
 *     <ApproveButton />
 *   </PermissionGate>
 *
 *   <PermissionGate require="manage_billing" fallback={<Text>No access</Text>}>
 *     <BillingScreen />
 *   </PermissionGate>
 */

import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { PermissionKey } from '../utils/permissions';

interface PermissionGateProps {
  require:   PermissionKey;
  children:  React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ require: key, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermissions();
  return can(key) ? <>{children}</> : <>{fallback}</>;
}
