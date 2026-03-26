import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, type Notification } from '../hooks/useNotifications';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { colors, spacing, radius, typography } from '@/theme';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}

function typeIcon(type: string | null): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'schedule':    return 'calendar-outline';
    case 'visit':       return 'checkmark-circle-outline';
    case 'auth':        return 'document-text-outline';
    case 'employee':    return 'person-outline';
    default:            return 'notifications-outline';
  }
}

function NotificationItem({ item }: { item: Notification }) {
  const markRead = useMarkNotificationRead();

  function handlePress() {
    if (!item.is_read) markRead.mutate(item.id);
  }

  return (
    <TouchableOpacity
      style={[styles.item, !item.is_read && styles.itemUnread]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, !item.is_read && styles.iconWrapUnread]}>
        <Ionicons name={typeIcon(item.type)} size={18} color={item.is_read ? colors.textMuted : colors.accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={styles.bodyText} numberOfLines={2}>{item.body}</Text>
        ) : null}
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={styles.dot} />}
    </TouchableOpacity>
  );
}

export function NotificationsScreen() {
  const { data: notifications = [], isLoading, isError, refetch, isFetching, unreadCount } = useNotifications();
  const markAll = useMarkAllNotificationsRead();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Failed to load notifications." onRetry={refetch} />;
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.toolbarCount}>{unreadCount} unread</Text>
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationItem item={item} />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            description="You're all caught up! Notifications will appear here."
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg },
  center:        { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolbarCount:  { ...typography.sm, color: colors.textSecondary },
  markAllBtn:    { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  markAllText:   { ...typography.sm, color: colors.accent, fontWeight: '600' },
  listContent:   { paddingVertical: spacing.sm },
  emptyContainer:{ flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  itemUnread:    { backgroundColor: colors.accentDim },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  iconWrapUnread: { backgroundColor: 'rgba(99,102,241,0.2)' },
  body:          { flex: 1 },
  title:         { ...typography.base, color: colors.textSecondary, fontWeight: '500' },
  titleUnread:   { color: colors.text, fontWeight: '600' },
  bodyText:      { ...typography.sm, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  time:          { ...typography.xs, color: colors.textMuted, marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    marginTop: 6,
    flexShrink: 0,
  },
  separator:     { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
