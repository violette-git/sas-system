import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useClients, useCreateClient, useUpdateClient, useDeleteClient,
} from '@/features/clients/hooks/useClients';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { Client, ClientInput } from '@/features/clients/hooks/useClients';

const EMPTY_FORM: ClientInput = {
  name: '', contact_name: null, contact_email: null, contact_phone: null,
  address_line1: null, address_line2: null, city: null, state: null, zip: null, notes: null,
};

export default function AdminClients() {
  const router = useRouter();
  const { data: clients, isLoading, isFetching, refetch } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing]           = useState<Client | null>(null);
  const [form, setForm]                 = useState<ClientInput>(EMPTY_FORM);

  function set(field: keyof ClientInput, value: string) {
    setForm((f) => ({ ...f, [field]: value || null }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    const { id, company_id, is_active, ...rest } = client;
    setForm(rest);
    setModalVisible(true);
  }

  function handleSave() {
    if (!form.name?.trim()) return;
    if (editing) {
      updateClient.mutate(
        { id: editing.id, ...form },
        { onSuccess: () => setModalVisible(false) }
      );
    } else {
      createClient.mutate(form, { onSuccess: () => setModalVisible(false) });
    }
  }

  function handleDelete(client: Client) {
    Alert.alert(
      'Delete Client',
      `Permanently delete "${client.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => deleteClient.mutate(client.id),
        },
      ]
    );
  }

  function renderClient({ item }: { item: Client }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/(admin)/client/[id]', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        <View style={styles.cardBody}>
          <Text style={styles.clientName}>{item.name}</Text>
          {item.contact_name && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={12} color="#6b7280" />
              <Text style={styles.infoText}>{item.contact_name}</Text>
            </View>
          )}
          {(item.city || item.state) && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={12} color="#6b7280" />
              <Text style={styles.infoText}>
                {[item.address_line1, item.city, item.state, item.zip].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          {item.contact_phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={12} color="#6b7280" />
              <Text style={styles.infoText}>{item.contact_phone}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 2 }} />
        </View>
      </TouchableOpacity>
    );
  }

  const isSaving = createClient.isPending || updateClient.isPending;

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Clients</Text>
          <Text style={styles.pageSubtitle}>{clients?.length ?? 0} jobsites</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {isLoading
        ? <SkeletonList count={5} showAvatar={false} />
        : (
          <FlatList
            data={clients}
            keyExtractor={(c) => c.id}
            renderItem={renderClient}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor="#2563eb"
                colors={['#2563eb']}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="business-outline"
                title="No clients yet"
                description={'Tap "New" to add your first jobsite or client.'}
                action={{ label: 'Add Client', onPress: openCreate }}
              />
            }
          />
        )
      }

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Client' : 'New Client'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Client / Jobsite Name <Text style={styles.required}>*</Text></Text>
                <TextInput style={styles.input} placeholder="e.g. Main Street Office" value={form.name ?? ''} onChangeText={(v) => set('name', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Contact Name</Text>
                <TextInput style={styles.input} placeholder="e.g. John Doe" value={form.contact_name ?? ''} onChangeText={(v) => set('contact_name', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Contact Email</Text>
                <TextInput style={styles.input} placeholder="john@client.com" keyboardType="email-address" autoCapitalize="none" value={form.contact_email ?? ''} onChangeText={(v) => set('contact_email', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Contact Phone</Text>
                <TextInput style={styles.input} placeholder="(555) 000-0000" keyboardType="phone-pad" value={form.contact_phone ?? ''} onChangeText={(v) => set('contact_phone', v)} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Street Address</Text>
                <TextInput style={styles.input} placeholder="123 Main St" value={form.address_line1 ?? ''} onChangeText={(v) => set('address_line1', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Address Line 2</Text>
                <TextInput style={styles.input} placeholder="Suite 100" value={form.address_line2 ?? ''} onChangeText={(v) => set('address_line2', v)} />
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 2 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput style={styles.input} placeholder="Springfield" value={form.city ?? ''} onChangeText={(v) => set('city', v)} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>State</Text>
                  <TextInput style={styles.input} placeholder="IL" autoCapitalize="characters" value={form.state ?? ''} onChangeText={(v) => set('state', v)} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>ZIP</Text>
                  <TextInput style={styles.input} placeholder="62701" keyboardType="numeric" value={form.zip ?? ''} onChangeText={(v) => set('zip', v)} />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Access instructions, parking info, special requirements..."
                multiline
                numberOfLines={3}
                value={form.notes ?? ''}
                onChangeText={(v) => set('notes', v)}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, (!form.name?.trim() || isSaving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!form.name?.trim() || isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Create Client'}</Text>
              }
            </TouchableOpacity>

          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f8f9fa' },
  loader:     { marginTop: 48 }, // kept for reference

  pageHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  pageSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addBtnText:   { color: '#fff', fontWeight: '600', fontSize: 14 },

  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start' },
  cardBody:    { flex: 1, gap: 4 },
  clientName:  { fontSize: 15, fontWeight: '600', color: '#111827' },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:    { fontSize: 12, color: '#6b7280', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { padding: 6 },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  emptyHint: { fontSize: 13, color: '#9ca3af' },

  modal:       { flex: 1, backgroundColor: '#f8f9fa' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody:   { padding: 20, gap: 16 },

  section:      { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  row:          { flexDirection: 'row', gap: 8 },
  field:        { gap: 4 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151' },
  required:     { color: '#ef4444' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 11 },

  saveBtn:         { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
});
