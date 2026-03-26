import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme/index';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useClients } from '@/features/clients/hooks/useClients';
import type { Client } from '@/features/clients/hooks/useClients';
import {
  useInvoices,
  useUpdateInvoiceStatus,
  useGenerateInvoice,
  type Invoice,
} from '../hooks/useInvoices';

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';
type InvoiceStatus = Invoice['status'];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'draft',   label: 'Draft' },
  { key: 'sent',    label: 'Sent' },
  { key: 'paid',    label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

function statusBadgeVariant(
  status: InvoiceStatus,
): 'neutral' | 'info' | 'success' | 'danger' | 'warning' {
  switch (status) {
    case 'draft':   return 'neutral';
    case 'sent':    return 'info';
    case 'paid':    return 'success';
    case 'overdue': return 'danger';
    default:        return 'neutral';
  }
}

function formatAmount(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function InvoiceCard({
  invoice,
  onStatusChange,
}: {
  invoice: Invoice;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
}) {
  const handleLongPress = useCallback(() => {
    const options: { text: string; status?: InvoiceStatus; style?: 'cancel' | 'destructive' }[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    if (invoice.status !== 'sent')    options.push({ text: 'Mark as Sent',    status: 'sent' });
    if (invoice.status !== 'paid')    options.push({ text: 'Mark as Paid',    status: 'paid' });
    if (invoice.status !== 'overdue') options.push({ text: 'Mark as Overdue', status: 'overdue', style: 'destructive' });

    const buttons = options.map(opt =>
      opt.status
        ? {
            text: opt.text,
            style: opt.style as 'cancel' | 'destructive' | 'default' | undefined,
            onPress: () => onStatusChange(invoice.id, opt.status!),
          }
        : { text: opt.text, style: 'cancel' as const },
    );

    Alert.alert('Update Invoice Status', invoice.clients?.name ?? 'Invoice', buttons);
  }, [invoice, onStatusChange]);

  return (
    <TouchableOpacity
      style={styles.invoiceCard}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.invoiceCardTop}>
        <View style={styles.invoiceClientInfo}>
          <Text style={styles.invoiceClientName} numberOfLines={1}>
            {invoice.clients?.name ?? 'Unknown Client'}
          </Text>
          <Text style={styles.invoiceCreated}>
            Created {formatDate(invoice.created_at)}
          </Text>
        </View>
        <View style={styles.invoiceAmountCol}>
          <Text style={styles.invoiceAmount}>{formatAmount(Number(invoice.total_amount))}</Text>
          <Badge variant={statusBadgeVariant(invoice.status)}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </Badge>
        </View>
      </View>
      {invoice.due_date && (
        <View style={styles.invoiceDueRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.invoiceDue}>Due {formatDate(invoice.due_date)}</Text>
        </View>
      )}
      {invoice.notes && (
        <Text style={styles.invoiceNotes} numberOfLines={2}>
          {invoice.notes}
        </Text>
      )}
      <Text style={styles.longPressHint}>Long-press to update status</Text>
    </TouchableOpacity>
  );
}

interface GenerateModalState {
  clientId: string | null;
  clientName: string;
  dateFrom: string;
  dateTo: string;
}

export function InvoicesScreen() {
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [modalState, setModalState] = useState<GenerateModalState>({
    clientId: null,
    clientName: '',
    dateFrom: '',
    dateTo: new Date().toISOString().slice(0, 10),
  });
  const [clientSearch, setClientSearch] = useState('');

  const filters = activeTab !== 'all' ? { status: activeTab } : undefined;
  const { data: invoices, isLoading } = useInvoices(filters);
  const { data: clients, isLoading: clientsLoading } = useClients();
  const updateStatus = useUpdateInvoiceStatus();
  const generateInvoice = useGenerateInvoice();

  const handleStatusChange = useCallback(
    async (id: string, status: InvoiceStatus) => {
      try {
        await updateStatus.mutateAsync({ id, status });
      } catch (err) {
        Alert.alert('Error', String(err));
      }
    },
    [updateStatus],
  );

  const handleGenerate = useCallback(async () => {
    if (!modalState.clientId) {
      Alert.alert('Validation', 'Please select a client.');
      return;
    }
    if (!modalState.dateFrom || !modalState.dateTo) {
      Alert.alert('Validation', 'Please enter both date from and date to.');
      return;
    }

    try {
      const invoice = await generateInvoice.mutateAsync({
        clientId: modalState.clientId,
        dateFrom: modalState.dateFrom,
        dateTo:   modalState.dateTo,
      });
      setShowModal(false);
      setModalState({ clientId: null, clientName: '', dateFrom: '', dateTo: new Date().toISOString().slice(0, 10) });
      setClientSearch('');
      Alert.alert(
        'Invoice Generated',
        `Invoice created for ${invoice.clients?.name ?? 'client'}: ${formatAmount(Number(invoice.total_amount))}`,
      );
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  }, [modalState, generateInvoice]);

  const filteredClients = (clients ?? []).filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  const renderItem = useCallback(
    ({ item }: { item: Invoice }) => (
      <InvoiceCard invoice={item} onStatusChange={handleStatusChange} />
    ),
    [handleStatusChange],
  );

  const keyExtractor = useCallback((item: Invoice) => item.id, []);

  const renderClientItem = useCallback(
    ({ item }: { item: Client }) => (
      <TouchableOpacity
        style={[
          styles.clientPickerItem,
          modalState.clientId === item.id && styles.clientPickerItemActive,
        ]}
        onPress={() =>
          setModalState(s => ({
            ...s,
            clientId:   item.id,
            clientName: item.name,
          }))
        }
      >
        <Text
          style={[
            styles.clientPickerItemText,
            modalState.clientId === item.id && styles.clientPickerItemTextActive,
          ]}
        >
          {item.name}
        </Text>
        {modalState.clientId === item.id && (
          <Ionicons name="checkmark" size={16} color={colors.accent} />
        )}
      </TouchableOpacity>
    ),
    [modalState.clientId],
  );

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Invoice List */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : (invoices ?? []).length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No Invoices"
          description={
            activeTab === 'all'
              ? 'No invoices yet. Tap "+ Generate Invoice" to create one.'
              : `No ${activeTab} invoices found.`
          }
        />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color={colors.text} />
        <Text style={styles.fabText}>Generate Invoice</Text>
      </TouchableOpacity>

      {/* Generate Invoice Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Invoice</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              {/* Client Picker */}
              <Text style={styles.modalLabel}>Select Client *</Text>
              {modalState.clientId ? (
                <TouchableOpacity
                  style={styles.selectedClient}
                  onPress={() => setModalState(s => ({ ...s, clientId: null, clientName: '' }))}
                >
                  <Text style={styles.selectedClientText}>{modalState.clientName}</Text>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    placeholder="Search clients..."
                    placeholderTextColor={colors.placeholder}
                  />
                  {clientsLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
                  ) : (
                    <FlatList
                      data={filteredClients}
                      keyExtractor={c => c.id}
                      renderItem={renderClientItem}
                      style={styles.clientPickerList}
                      scrollEnabled={false}
                      ListEmptyComponent={
                        <Text style={styles.noClientsText}>No clients found</Text>
                      }
                    />
                  )}
                </>
              )}

              {/* Date Range */}
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.modalLabel}>Date From *</Text>
                  <TextInput
                    style={styles.input}
                    value={modalState.dateFrom}
                    onChangeText={v => setModalState(s => ({ ...s, dateFrom: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.modalLabel}>Date To *</Text>
                  <TextInput
                    style={styles.input}
                    value={modalState.dateTo}
                    onChangeText={v => setModalState(s => ({ ...s, dateTo: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  variant="ghost"
                  onPress={() => setShowModal(false)}
                  disabled={generateInvoice.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={handleGenerate}
                  loading={generateInvoice.isPending}
                  disabled={generateInvoice.isPending || !modalState.clientId}
                >
                  Generate
                </Button>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100, // room for FAB
    gap: spacing.sm,
  },
  invoiceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  invoiceCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  invoiceClientInfo: {
    flex: 1,
  },
  invoiceClientName: {
    ...typography.base,
    color: colors.text,
    fontWeight: '600',
  },
  invoiceCreated: {
    ...typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  invoiceAmountCol: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  invoiceAmount: {
    ...typography.md,
    color: colors.success,
    fontWeight: '700',
  },
  invoiceDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  invoiceDue: {
    ...typography.xs,
    color: colors.textSecondary,
  },
  invoiceNotes: {
    ...typography.xs,
    color: colors.textMuted,
  },
  longPressHint: {
    ...typography.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    ...typography.sm,
    color: colors.text,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.lg,
    color: colors.text,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalLabel: {
    ...typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  selectedClient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectedClientText: {
    ...typography.base,
    color: colors.accent,
    fontWeight: '600',
  },
  clientPickerList: {
    maxHeight: 200,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  clientPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientPickerItemActive: {
    backgroundColor: colors.accentDim,
  },
  clientPickerItemText: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  clientPickerItemTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  noClientsText: {
    ...typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
