/**
 * Granular permission system — layered on top of the three base roles.
 *
 * How it works:
 *   1. Every role has a default permission set (defined below).
 *   2. Admins can override individual permissions per user via the
 *      `users.permissions` JSONB column.
 *   3. A missing key means "use role default"; an explicit true/false overrides.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   if (can('approve_notes')) { ... }
 */

import type { UserRole } from '@/lib/supabase';

// ── All available permission keys ──────────────────────────
export const PERMISSION_KEYS = [
  'manage_schedules',    // create / edit / delete schedules
  'manage_clients',      // create / edit clients and authorizations
  'manage_employees',    // invite / deactivate / edit staff
  'approve_notes',       // review and approve case notes
  'view_reports',        // see dashboard analytics
  'manage_billing',      // view and generate invoices
  'view_timesheets',     // see employee timesheets
  'export_data',         // export CSV / PDF
  'manage_templates',    // create / edit note templates
  'manage_branding',     // change company branding
  'view_audit_log',      // read the audit trail
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

// ── Role defaults ───────────────────────────────────────────
const ROLE_DEFAULTS: Record<UserRole, Record<PermissionKey, boolean>> = {
  owner: {
    manage_schedules:  true,
    manage_clients:    true,
    manage_employees:  true,
    approve_notes:     true,
    view_reports:      true,
    manage_billing:    true,
    view_timesheets:   true,
    export_data:       true,
    manage_templates:  true,
    manage_branding:   true,
    view_audit_log:    true,
  },
  admin: {
    manage_schedules:  true,
    manage_clients:    true,
    manage_employees:  true,
    approve_notes:     true,
    view_reports:      true,
    manage_billing:    true,
    view_timesheets:   true,
    export_data:       true,
    manage_templates:  true,
    manage_branding:   false,
    view_audit_log:    true,
  },
  employee: {
    manage_schedules:  false,
    manage_clients:    false,
    manage_employees:  false,
    approve_notes:     false,
    view_reports:      false,
    manage_billing:    false,
    view_timesheets:   false,
    export_data:       false,
    manage_templates:  false,
    manage_branding:   false,
    view_audit_log:    false,
  },
};

/**
 * Resolves a user's effective permission, merging role defaults
 * with any explicit overrides stored in `users.permissions`.
 */
export function resolvePermission(
  role: UserRole,
  permissionOverrides: PermissionMap,
  key: PermissionKey,
): boolean {
  if (key in permissionOverrides && permissionOverrides[key] !== undefined) {
    return permissionOverrides[key]!;
  }
  return ROLE_DEFAULTS[role][key] ?? false;
}

/**
 * Builds a complete resolved permission map for a user.
 */
export function resolveAllPermissions(
  role: UserRole,
  permissionOverrides: PermissionMap,
): Record<PermissionKey, boolean> {
  const result = {} as Record<PermissionKey, boolean>;
  for (const key of PERMISSION_KEYS) {
    result[key] = resolvePermission(role, permissionOverrides, key);
  }
  return result;
}

// ── Human-readable labels ───────────────────────────────────
export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  manage_schedules:  { label: 'Manage Schedules',   description: 'Create, edit, and delete appointments' },
  manage_clients:    { label: 'Manage Clients',     description: 'Add and edit clients and authorizations' },
  manage_employees:  { label: 'Manage Employees',   description: 'Invite, deactivate, and edit staff' },
  approve_notes:     { label: 'Approve Notes',      description: 'Review and approve case note submissions' },
  view_reports:      { label: 'View Reports',       description: 'Access dashboard analytics and KPIs' },
  manage_billing:    { label: 'Manage Billing',     description: 'View and generate invoices' },
  view_timesheets:   { label: 'View Timesheets',    description: 'See employee timesheet summaries' },
  export_data:       { label: 'Export Data',        description: 'Download CSV and PDF exports' },
  manage_templates:  { label: 'Manage Templates',   description: 'Create and edit case note templates' },
  manage_branding:   { label: 'Manage Branding',    description: 'Change company logo and colors' },
  view_audit_log:    { label: 'View Audit Log',     description: 'Read the compliance audit trail' },
};
