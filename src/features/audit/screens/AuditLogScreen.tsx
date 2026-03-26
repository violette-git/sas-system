import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '@/theme';
import { useAuditLog, useAuditLogUsers, type AuditLogFilters } from '../hooks/useAuditLog';
import type { AuditLog } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/SkeletonList';

// ── Action type groups for the filter chip row ──────────────
const ACTION_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Schedules', value: 'schedule' },
  { label: 'Notes',     value: 'case_note' },
  { label: 'Documents', value: 'document' },
  { label: 'Users',     value: 'user' },
  { label: 'Branding',  value: 'branding' },
];

// ── Color per action prefix ──────────────────────────────────
function actionColor(action: string): string {
  if (action.startsWith('schedule'))  return colors.info;
  if (action.startsWith('case_note')) return colors.success;
  if (action.startsWith('document'))  return colors.warning;
  if (action.startsWith('user'))      return '#D946EF';
  if (action.startsWith('branding'))  return colors.accent;
  return colors.textMuted;
}

function actionLabel(action: string): string {
  return action.replace(/\./g, ' › ').replace(/_/g, ' ');
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

// ── Diff viewer for old_data / new_data ─────────────────────
function DiffViewer({
  oldData,
  newData,
}: {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}) {
  if (!oldData && !newData) return null;

  const keys = Array.from(new Set([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData ?? {}),
  ]));

  return (
    <View style={diffStyles.container}>
      {keys.map((key) => {
        const ov = oldData?.[key];
        const nv = newData?.[key];
        const changed = JSON.stringify(ov) !== JSON.stringify(nv);
        return (
          <View key={key} style={diffStyles.row}>
            <Text style={diffStyles.key}>{key}</Text>
            {oldData && (
              <Text style={[diffStyles.val, changed && diffStyles.removed]} numberOfLines={2}>
                {ov === null || ov === undefined ? '—' : JSON.stringify(ov)}
              </Text>
            )}
            {newData && (
              <Text style={[diffStyles.val, changed && diffStyles.added]} numberOfLines={2}>
                {nv === null || nv === undefined ? '—' : JSON.stringify(nv)}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const diffStyles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: 4,
  },
  row: {
    flexDirection: 'column',
    gap: 2,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  key: {
    ...typography.xs,
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  val: {
    ...typography.xs,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    paddingLeft: spacing.sm,
  },
  removed: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  added: {
    color: colors.success,
  },
});

// ── Single audit log row ─────────────────────────────────────
function AuditLogRow({ item }: { item: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = !!(item.old_data || item.new_data);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => hasDiff && setExpanded((v) => !v)}
      activeOpacity={hasDiff ? 0.7 : 1}
    >
      <View style={styles.rowHeader}>
        {/* Left: action badge + entity */}
        <View style={styles.rowLeft}>
          <View style={[styles.actionBadge, { backgroundColor: actionColor(item.action) + '20' }]}>
            <Text style={[styles.actionText, { color: actionColor(item.action) }]}>
              {actionLabel(item.action)}
            </Text>
          </View>
          <View style={styles.entityRow}>
            <Text style={styles.tableName}>{item.table_name}</Text>
            {item.record_id && (
              <Text style={styles.recordId} numberOfLines={1}>
                #{item.record_id.slice(0, 8)}
              </Text>
            )}
          </View>
        </View>

        {/* Right: user + timestamp */}
        <View style={styles.rowRight}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.users?.full_name ?? 'System'}
          </Text>
          <Text style={styles.timestamp}>{formatTs(item.created_at)}</Text>
          {hasDiff && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors.textMuted}
            />
          )}
        </View>
      </View>

      {expanded && hasDiff && (
        <DiffViewer oldData={item.old_data} newData={item.new_data} />
      )}
    </TouchableOpacity>
  );
}

// ── Date picker modal (simple text inputs for now) ──────────
interface DateRangeModalProps {
  visible: boolean;
  dateFrom: string;
  dateTo: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

function DateRangeModal({ visible, dateFrom, dateTo, onApply, onClose }: DateRangeModalProps) {
  const [from, setFrom] = useState(dateFrom);
  const [to,   setTo]   = useState(dateTo);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Date Range</Text>

          <Text style={modalStyles.label}>From (YYYY-MM-DD)</Text>
          <TextInput
            style={modalStyles.input}
            value={from}
            onChangeText={setFrom}
            placeholder="2026-01-01"
            placeholderTextColor={colors.placeholder}
          />
          <Text style={modalStyles.label}>To (YYYY-MM-DD)</Text>
          <TextInput
            style={modalStyles.input}
            value={to}
            onChangeText={setTo}
            placeholder="2026-12-31"
            placeholderTextColor={colors.placeholder}
          />

          <View style={modalStyles.buttons}>
            <TouchableOpacity style={modalStyles.btnSecondary} onPress={onClose}>
              <Text style={modalStyles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={modalStyles.btnPrimary}
              onPress={() => { onApply(from, to); onClose(); }}
            >
              <Text style={modalStyles.btnPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.md,
    paddingBottom: 40,
  },
  title: {
    ...typography.lg,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.base,
    fontFamily: 'monospace',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnPrimaryText: {
    ...typography.base,
    color: '#fff',
    fontWeight: '600',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    ...typography.base,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

// ── Main screen ──────────────────────────────────────────────
export function AuditLogScreen() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, pageSize: 25 });
  const [search, setSearch]   = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const appliedFilters: AuditLogFilters = {
    ...filters,
    action: actionFilter || undefined,
    search: search.trim() || undefined,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useAuditLog(appliedFilters);
  const { data: users } = useAuditLogUsers();

  const handleNextPage = useCallback(() => {
    if (data && filters.page! < data.totalPages) {
      setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }));
    }
  }, [data, filters.page]);

  const handlePrevPage = useCallback(() => {
    if ((filters.page ?? 1) > 1) {
      setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }));
    }
  }, [filters.page]);

  function handleDateApply(from: string, to: string) {
    setFilters((f) => ({ ...f, dateFrom: from || undefined, dateTo: to || undefined, page: 1 }));
  }

  const hasDateFilter = !!(filters.dateFrom || filters.dateTo);

  // ── Render helpers ──
  function renderHeader() {
    return (
      <View style={styles.headerContainer}>
        <Text style={styles.screenTitle}>Audit Log</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={(t) => { setSearch(t); setFilters((f) => ({ ...f, page: 1 })); }}
            placeholder="Search actions, tables…"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Action filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {ACTION_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, actionFilter === f.value && styles.chipActive]}
              onPress={() => { setActionFilter(f.value); setFilters((prev) => ({ ...prev, page: 1 })); }}
            >
              <Text style={[styles.chipText, actionFilter === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date filter + user filter row */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, hasDateFilter && styles.filterButtonActive]}
            onPress={() => setDateModalVisible(true)}
          >
            <Ionicons name="calendar-outline" size={14} color={hasDateFilter ? colors.accent : colors.textMuted} />
            <Text style={[styles.filterButtonText, hasDateFilter && styles.filterButtonTextActive]}>
              {hasDateFilter
                ? `${filters.dateFrom ?? '…'} → ${filters.dateTo ?? '…'}`
                : 'Date range'}
            </Text>
            {hasDateFilter && (
              <TouchableOpacity
                onPress={() => setFilters((f) => ({ ...f, dateFrom: undefined, dateTo: undefined, page: 1 }))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={12} color={colors.accent} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, !!filters.userId && styles.filterButtonActive]}
            onPress={() => {
              // Cycle through users; tap again to clear
              if (filters.userId) {
                setFilters((f) => ({ ...f, userId: undefined, page: 1 }));
              }
            }}
          >
            <Ionicons name="person-outline" size={14} color={filters.userId ? colors.accent : colors.textMuted} />
            <Text style={[styles.filterButtonText, !!filters.userId && styles.filterButtonTextActive]}>
              {filters.userId
                ? (users?.find((u) => u.id === filters.userId)?.full_name ?? 'User')
                : 'All users'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Count + page info */}
        {data && (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {data.totalCount.toLocaleString()} entries
            </Text>
            {data.totalPages > 1 && (
              <Text style={styles.metaText}>
                Page {data.page} of {data.totalPages}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderFooter() {
    if (!data || data.totalPages <= 1) return null;
    return (
      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[styles.pageBtn, (filters.page ?? 1) <= 1 && styles.pageBtnDisabled]}
          onPress={handlePrevPage}
          disabled={(filters.page ?? 1) <= 1}
        >
          <Ionicons name="chevron-back" size={16} color={(filters.page ?? 1) <= 1 ? colors.textMuted : colors.accent} />
          <Text style={[styles.pageBtnText, (filters.page ?? 1) <= 1 && styles.pageBtnTextDisabled]}>Prev</Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>{data.page} / {data.totalPages}</Text>

        <TouchableOpacity
          style={[styles.pageBtn, data.page >= data.totalPages && styles.pageBtnDisabled]}
          onPress={handleNextPage}
          disabled={data.page >= data.totalPages}
        >
          <Text style={[styles.pageBtnText, data.page >= data.totalPages && styles.pageBtnTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={16} color={data.page >= data.totalPages ? colors.textMuted : colors.accent} />
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <SkeletonList />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load audit logs'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AuditLogRow item={item} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="No audit logs found"
            description="Try adjusting your filters or date range."
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

      <DateRangeModal
        visible={dateModalVisible}
        dateFrom={filters.dateFrom ?? ''}
        dateTo={filters.dateTo ?? ''}
        onApply={handleDateApply}
        onClose={() => setDateModalVisible(false)}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  screenTitle: {
    ...typography.xl,
    color: colors.text,
    fontWeight: '700',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.base,
  },

  // Chips
  chipScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  filterButtonText: {
    flex: 1,
    ...typography.sm,
    color: colors.textMuted,
  },
  filterButtonTextActive: {
    color: colors.accent,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    ...typography.xs,
    color: colors.textMuted,
  },

  // List row
  row: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLeft: {
    flex: 1,
    gap: 4,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  actionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  actionText: {
    ...typography.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tableName: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  recordId: {
    ...typography.xs,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  userName: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '500',
    maxWidth: 120,
  },
  timestamp: {
    ...typography.xs,
    color: colors.textMuted,
  },

  // Pagination
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    ...typography.sm,
    color: colors.accent,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: colors.textMuted,
  },
  pageIndicator: {
    ...typography.sm,
    color: colors.textSecondary,
  },
});
