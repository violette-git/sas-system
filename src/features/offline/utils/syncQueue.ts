/**
 * SyncQueue — persistent MMKV/AsyncStorage-backed queue for offline mutations.
 *
 * When the device is offline, mutations are serialised here instead of
 * being sent to Supabase.  When connectivity is restored, the queue is
 * drained in FIFO order with conflict-resolution semantics:
 *
 *   schedules  → server wins  (skip if server record was updated after queued_at)
 *   visit_notes → merge      (append body; preserve server status)
 *   time_entries → apply     (clock-in/out are append-only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncOperationType = 'INSERT' | 'UPDATE' | 'DELETE';
export type ConflictStrategy  = 'server_wins' | 'client_wins' | 'merge';

export interface QueuedMutation {
  id:           string;          // uuid-like: `${Date.now()}-${Math.random()}`
  tableName:    string;
  operation:    SyncOperationType;
  payload:      Record<string, unknown>;
  queued_at:    string;          // ISO timestamp
  retries:      number;
  conflict:     ConflictStrategy;
  localId?:     string;          // temp ID before server assigns a real UUID
}

const QUEUE_KEY = '@sas_sync_queue_v1';

// ── In-memory cache (avoids redundant AsyncStorage reads) ───
let _cache: QueuedMutation[] | null = null;

async function readQueue(): Promise<QueuedMutation[]> {
  if (_cache !== null) return _cache;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    _cache = raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  _cache = queue;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Public API ───────────────────────────────────────────────

/** Returns a snapshot of the current queue (does NOT pop items). */
export async function getQueue(): Promise<QueuedMutation[]> {
  return readQueue();
}

/** Adds a mutation to the end of the queue. */
export async function enqueue(
  tableName: string,
  operation: SyncOperationType,
  payload: Record<string, unknown>,
  conflict: ConflictStrategy = 'server_wins',
): Promise<QueuedMutation> {
  const queue = await readQueue();
  const item: QueuedMutation = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tableName,
    operation,
    payload,
    queued_at: new Date().toISOString(),
    retries:   0,
    conflict,
  };
  queue.push(item);
  await writeQueue(queue);
  return item;
}

/** Removes a processed item from the queue by id. */
export async function dequeue(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
}

/** Increments the retry counter for an item. */
export async function incrementRetry(id: string): Promise<void> {
  const queue = await readQueue();
  const item  = queue.find((q) => q.id === id);
  if (item) {
    item.retries += 1;
    await writeQueue(queue);
  }
}

/** Clears the entire queue (used after successful full sync). */
export async function clearQueue(): Promise<void> {
  _cache = [];
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Returns count of items currently queued. */
export async function queueLength(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

// ── Convenience helpers for key domain actions ───────────────

export function queueScheduleCreate(payload: Record<string, unknown>) {
  return enqueue('schedules', 'INSERT', payload, 'server_wins');
}

export function queueScheduleUpdate(
  id: string,
  patch: Record<string, unknown>,
) {
  return enqueue('schedules', 'UPDATE', { id, ...patch }, 'server_wins');
}

export function queueScheduleDelete(id: string) {
  return enqueue('schedules', 'DELETE', { id }, 'server_wins');
}

export function queueCaseNoteDraft(payload: Record<string, unknown>) {
  return enqueue('visit_notes', 'INSERT', payload, 'merge');
}

export function queueCaseNoteUpdate(
  id: string,
  patch: Record<string, unknown>,
) {
  return enqueue('visit_notes', 'UPDATE', { id, ...patch }, 'merge');
}

export function queueTimeEntryCreate(payload: Record<string, unknown>) {
  return enqueue('time_entries', 'INSERT', payload, 'client_wins');
}

export function queueTimeEntryClockOut(
  id: string,
  clockedOutAt: string,
) {
  return enqueue('time_entries', 'UPDATE', { id, clocked_out_at: clockedOutAt }, 'client_wins');
}
