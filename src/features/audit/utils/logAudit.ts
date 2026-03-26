/**
 * logAudit — fire-and-forget helper for inserting audit log entries.
 *
 * Call this after any important mutation so the audit_log table
 * captures who did what and what changed.
 *
 * Usage:
 *   await logAudit({
 *     action: 'schedule.created',
 *     tableName: 'schedules',
 *     recordId: schedule.id,
 *     newData: schedule,
 *     companyId: profile.company_id,
 *     userId: profile.id,
 *   });
 */

import { supabase } from '@/lib/supabase';

export interface LogAuditOptions {
  action: string;               // e.g. 'schedule.created', 'user.role_changed'
  tableName: string;            // e.g. 'schedules', 'users'
  recordId?: string | null;     // PK of the affected row
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  companyId?: string | null;
  userId?: string | null;
}

/**
 * Inserts a row into audit_log.
 * Silently swallows errors so audit failures never break the main flow.
 */
export async function logAudit(opts: LogAuditOptions): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      action:     opts.action,
      table_name: opts.tableName,
      record_id:  opts.recordId  ?? null,
      old_data:   opts.oldData   ?? null,
      new_data:   opts.newData   ?? null,
      company_id: opts.companyId ?? null,
      user_id:    opts.userId    ?? null,
    });

    if (error) {
      // Log to console in dev; never throw
      if (__DEV__) console.warn('[logAudit] insert failed:', error.message);
    }
  } catch (err) {
    if (__DEV__) console.warn('[logAudit] unexpected error:', err);
  }
}

// ── Convenience wrappers for common actions ──────────────────

export type AuditContext = Pick<LogAuditOptions, 'companyId' | 'userId'>;

export function auditScheduleCreated(
  ctx: AuditContext,
  scheduleId: string,
  data: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'schedule.created', tableName: 'schedules', recordId: scheduleId, newData: data });
}

export function auditScheduleUpdated(
  ctx: AuditContext,
  scheduleId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'schedule.updated', tableName: 'schedules', recordId: scheduleId, oldData, newData });
}

export function auditScheduleDeleted(
  ctx: AuditContext,
  scheduleId: string,
  oldData: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'schedule.deleted', tableName: 'schedules', recordId: scheduleId, oldData });
}

export function auditCaseNoteSubmitted(
  ctx: AuditContext,
  noteId: string,
  data: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'case_note.submitted', tableName: 'visit_notes', recordId: noteId, newData: data });
}

export function auditCaseNoteApproved(
  ctx: AuditContext,
  noteId: string,
) {
  return logAudit({ ...ctx, action: 'case_note.approved', tableName: 'visit_notes', recordId: noteId });
}

export function auditCaseNoteRejected(
  ctx: AuditContext,
  noteId: string,
  reason: string,
) {
  return logAudit({ ...ctx, action: 'case_note.rejected', tableName: 'visit_notes', recordId: noteId, newData: { reason } });
}

export function auditDocumentUploaded(
  ctx: AuditContext,
  documentId: string,
  data: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'document.uploaded', tableName: 'documents', recordId: documentId, newData: data });
}

export function auditUserInvited(
  ctx: AuditContext,
  userId: string,
  data: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'user.invited', tableName: 'users', recordId: userId, newData: data });
}

export function auditUserRoleChanged(
  ctx: AuditContext,
  userId: string,
  oldRole: string,
  newRole: string,
) {
  return logAudit({
    ...ctx,
    action: 'user.role_changed',
    tableName: 'users',
    recordId: userId,
    oldData: { role: oldRole },
    newData: { role: newRole },
  });
}

export function auditBrandingUpdated(
  ctx: AuditContext,
  companyId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
) {
  return logAudit({ ...ctx, action: 'branding.updated', tableName: 'companies', recordId: companyId, oldData, newData });
}
