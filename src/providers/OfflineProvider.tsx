/**
 * OfflineProvider — tracks network connectivity and exposes it via context.
 *
 * Also bootstraps the SyncQueue drain loop via useOfflineSync so that
 * offline mutations are replayed automatically when connectivity returns.
 *
 * Usage:
 *   // In your root _layout.tsx:
 *   <OfflineProvider>
 *     {children}
 *     <OfflineBanner />   ← place INSIDE the provider
 *   </OfflineProvider>
 *
 * Then anywhere in the app:
 *   const { isOffline, isSyncing, syncStatus } = useOfflineStatus();
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineSync, type SyncStatus } from '@/features/offline/hooks/useOfflineSync';
import {
  queueScheduleCreate,
  queueScheduleUpdate,
  queueScheduleDelete,
  queueCaseNoteDraft,
  queueCaseNoteUpdate,
  queueTimeEntryCreate,
  queueTimeEntryClockOut,
} from '@/features/offline/utils/syncQueue';

// ── Context ──────────────────────────────────────────────────

export interface OfflineContextValue {
  isOffline:  boolean;
  isSyncing:  boolean;
  syncStatus: SyncStatus;
  /** Manually trigger a sync attempt */
  triggerSync: () => Promise<void>;
  /** Offline-aware mutation helpers */
  mutations: {
    createSchedule: (payload: Record<string, unknown>) => Promise<void>;
    updateSchedule: (id: string, patch: Record<string, unknown>) => Promise<void>;
    deleteSchedule: (id: string) => Promise<void>;
    createCaseNote: (payload: Record<string, unknown>) => Promise<void>;
    updateCaseNote: (id: string, patch: Record<string, unknown>) => Promise<void>;
    clockIn:        (payload: Record<string, unknown>) => Promise<void>;
    clockOut:       (id: string, clockedOutAt: string) => Promise<void>;
  };
}

const OfflineContext = createContext<OfflineContextValue>({
  isOffline:   false,
  isSyncing:   false,
  syncStatus:  { isSyncing: false, lastSyncAt: null, failedCount: 0, queueSize: 0 },
  triggerSync: async () => {},
  mutations:   {
    createSchedule: async () => {},
    updateSchedule: async () => {},
    deleteSchedule: async () => {},
    createCaseNote: async () => {},
    updateCaseNote: async () => {},
    clockIn:        async () => {},
    clockOut:       async () => {},
  },
});

export function useOfflineStatus(): OfflineContextValue {
  return useContext(OfflineContext);
}

// ── Provider ─────────────────────────────────────────────────

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef              = useRef(false);
  const queryClient               = useQueryClient();
  const { syncStatus, triggerSync } = useOfflineSync();

  // Subscribe to NetInfo
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const offline = !state.isConnected || state.isInternetReachable === false;
      isOfflineRef.current = offline;
      setIsOffline(offline);
    });

    // Initial check
    NetInfo.fetch().then((state: NetInfoState) => {
      const offline = !state.isConnected || state.isInternetReachable === false;
      isOfflineRef.current = offline;
      setIsOffline(offline);
    });

    return () => { unsubscribe(); };
  }, []);

  // ── Offline-aware mutation helpers ───────────────────────

  /**
   * If offline → queue the mutation for later.
   * If online  → attempt immediately; on failure → queue as fallback.
   */
  const offlineMutation = useCallback(
    async (
      onlineAction: () => Promise<void>,
      offlineAction: () => Promise<unknown>,
    ) => {
      if (isOfflineRef.current) {
        await offlineAction();
        return;
      }
      try {
        await onlineAction();
      } catch {
        // Network failed mid-request → queue for retry
        await offlineAction();
      }
    },
    [],
  );

  // Import supabase lazily to avoid circular deps in tests
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase } = require('@/lib/supabase') as { supabase: import('@supabase/supabase-js').SupabaseClient };

  const mutations: OfflineContextValue['mutations'] = {
    createSchedule: (payload) =>
      offlineMutation(
        async () => {
          const { error } = await supabase.from('schedules').insert(payload);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['schedules'] });
        },
        () => queueScheduleCreate(payload),
      ),

    updateSchedule: (id, patch) =>
      offlineMutation(
        async () => {
          const { error } = await supabase.from('schedules').update(patch).eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['schedules'] });
        },
        () => queueScheduleUpdate(id, patch),
      ),

    deleteSchedule: (id) =>
      offlineMutation(
        async () => {
          const { error } = await supabase.from('schedules').delete().eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['schedules'] });
        },
        () => queueScheduleDelete(id),
      ),

    createCaseNote: (payload) =>
      offlineMutation(
        async () => {
          const { error } = await supabase.from('visit_notes').insert(payload);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['visit_notes'] });
        },
        () => queueCaseNoteDraft(payload),
      ),

    updateCaseNote: (id, patch) =>
      offlineMutation(
        async () => {
          const { error } = await supabase.from('visit_notes').update(patch).eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['visit_notes'] });
        },
        () => queueCaseNoteUpdate(id, patch),
      ),

    clockIn: (payload) =>
      offlineMutation(
        async () => {
          const { error } = await supabase.from('time_entries').insert(payload);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['time_entries'] });
        },
        () => queueTimeEntryCreate(payload),
      ),

    clockOut: (id, clockedOutAt) =>
      offlineMutation(
        async () => {
          const { error } = await supabase
            .from('time_entries')
            .update({ clocked_out_at: clockedOutAt })
            .eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['time_entries'] });
        },
        () => queueTimeEntryClockOut(id, clockedOutAt),
      ),
  };

  const value: OfflineContextValue = {
    isOffline,
    isSyncing: syncStatus.isSyncing,
    syncStatus,
    triggerSync,
    mutations,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}
