/**
 * useOfflineSync — drains the SyncQueue when the device comes back online.
 *
 * Call this once from OfflineProvider.  It listens to NetInfo and,
 * whenever connectivity is restored, processes all queued mutations
 * in FIFO order with the configured conflict-resolution strategy.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  getQueue,
  dequeue,
  incrementRetry,
  type QueuedMutation,
  type ConflictStrategy,
} from '../utils/syncQueue';

const MAX_RETRIES = 3;

// ── Conflict resolution ──────────────────────────────────────

async function applyMutation(
  item: QueuedMutation,
): Promise<{ success: boolean; error?: string }> {
  const { tableName, operation, payload, conflict, queued_at } = item;

  try {
    if (operation === 'INSERT') {
      // Remove any local-only temp fields
      const { id: _localId, ...insertPayload } = payload as Record<string, unknown> & { id?: string };
      void _localId;
      const { error } = await supabase.from(tableName).insert(insertPayload);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    if (operation === 'DELETE') {
      const { id } = payload as { id: string };
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    if (operation === 'UPDATE') {
      const { id, ...patch } = payload as { id: string } & Record<string, unknown>;

      // ── server_wins: skip if server row was updated more recently ──
      if (conflict === 'server_wins' as ConflictStrategy) {
        const { data: serverRow } = await supabase
          .from(tableName)
          .select('updated_at')
          .eq('id', id)
          .maybeSingle();

        if (serverRow?.updated_at && serverRow.updated_at > queued_at) {
          // Server is newer — discard this mutation silently
          return { success: true };
        }
      }

      // ── merge: fetch server body and combine with client patch ────
      if (conflict === 'merge' as ConflictStrategy && tableName === 'visit_notes') {
        const { data: serverRow } = await supabase
          .from(tableName)
          .select('body, template_data')
          .eq('id', id)
          .maybeSingle();

        if (serverRow) {
          // Append client additions to server body
          const serverBody = serverRow.body ?? '';
          const clientBody = (patch.body as string | undefined) ?? '';
          if (clientBody && !serverBody.includes(clientBody)) {
            patch.body = `${serverBody}\n\n[Offline edit]\n${clientBody}`.trim();
          }
          // Shallow-merge template_data
          if (patch.template_data && serverRow.template_data) {
            patch.template_data = {
              ...(serverRow.template_data as Record<string, unknown>),
              ...(patch.template_data as Record<string, unknown>),
            };
          }
        }
      }

      const { error } = await supabase.from(tableName).update(patch).eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    return { success: false, error: `Unknown operation: ${operation}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ── Tables whose React Query keys should be invalidated post-sync ──
const INVALIDATION_MAP: Record<string, string[]> = {
  schedules:    ['schedules'],
  visit_notes:  ['visit_notes'],
  time_entries: ['time_entries'],
};

// ── Hook ─────────────────────────────────────────────────────

export interface SyncStatus {
  isSyncing:   boolean;
  lastSyncAt:  string | null;
  failedCount: number;
  queueSize:   number;
}

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const syncingRef  = useRef(false);
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing:  false,
    lastSyncAt: null,
    failedCount: 0,
    queueSize:  0,
  });

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const queue = await getQueue();
    if (queue.length === 0) {
      syncingRef.current = false;
      return;
    }

    setStatus((s) => ({ ...s, isSyncing: true, queueSize: queue.length }));

    const invalidatedTables = new Set<string>();
    let failedCount = 0;

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        // Give up on this item after too many retries
        await dequeue(item.id);
        failedCount += 1;
        continue;
      }

      const result = await applyMutation(item);

      if (result.success) {
        await dequeue(item.id);
        invalidatedTables.add(item.tableName);
      } else {
        await incrementRetry(item.id);
        if (__DEV__) console.warn('[SyncQueue] mutation failed:', item.id, result.error);
        failedCount += 1;
      }
    }

    // Invalidate affected query keys so UI reflects synced state
    for (const table of invalidatedTables) {
      const keys = INVALIDATION_MAP[table];
      if (keys) {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    }

    syncingRef.current = false;
    setStatus({
      isSyncing:   false,
      lastSyncAt:  new Date().toISOString(),
      failedCount,
      queueSize:   (await getQueue()).length,
    });
  }, [queryClient]);

  useEffect(() => {
    // Unsubscribe function returned by NetInfo
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      if (online) {
        // Slight delay so the connection is stable before we attempt sync
        const timer = setTimeout(sync, 1500);
        return () => clearTimeout(timer);
      }
      return undefined;
    });

    // Also run sync immediately in case we're already online at mount time
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      if (online) sync();
    });

    return () => { unsubscribe(); };
  }, [sync]);

  return { syncStatus: status, triggerSync: sync };
}
