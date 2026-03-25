import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClients } from '@/features/clients/hooks/useClients';
import { useServiceTypes } from '@/features/service-types/hooks/useServiceTypes';
import {
  useAuthorizations, useCreateAuthorization, useUpdateAuthorization, useToggleAuthorization,
} from '@/features/authorizations/hooks/useAuthorizations';
import type { AuthorizationWithRelations } from '@/features/authorizations/hooks/useAuthorizations';

type ModalMode = 'create' | 'edit';

const EMPTY_FORM = {
  service_type_id: '',
  auth_number: '',
  authorized_units: '',
  start_date: '',
  end_date: '',
  notes: '',
};

function unitsToHours(units: number) {
  return (units / 4).toFixed(2);
}

function statusColor(auth: AuthorizationWithRelations) {
  if (!auth.is_active) return { bg: '#f3f4f6', text: '#6b7280', label: 'Inactive' };
  const today = new Date().toISOString().slice(0, 10);
  if (auth.end_date < today) return { bg: '#fee2e2', text: '#991b1b', label: 'Expired' };
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (auth.end_date <= thirtyDays) return { bg: '#fef3c7', text: '#92400e', label: 'Expiring Soon' };
  return { bg: '#d1fae5', text: '#065f46', label: 'Active' };
}

export default function ClientAuthorizations() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: clients }      = useClients();
  const { data: serviceTypes = [] } = useServiceTypes();
  const { data: auths = [], isLoading } = useAuthorizations(clientId);
  const createAuth  = useCreateAuthorization();
  const updateAuth  = useUpdateAuthorization();
  const toggleAuth  = useToggleAuthorization();

  const client = clients?.find((c) => c.id === clientId);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode,    setModalMode]    = useState<ModalMode>('create');
  const [editing,      setEditing]      = useState<AuthorizationWithRelations | null>(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalVisible(true);
  }

  function openEdit(auth: AuthorizationWithRelations) {
    setModalMode('edit');
    setEditing(auth);
    setForm({
      service_type_id: auth.service_type_id,
      auth_number:     auth.auth_number,
      authorized_units: String(auth.authorized_units),
      start_date:      auth.start_date,
      end_date:        auth.end_date,
      notes:           auth.notes ?? '',
    });
    setErrors({});
    setModalVisible(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.service_type_id)  e.service_type_id  = 'Required';
    if (!form.auth_number.trim()) e.auth_number     = 'Required';
    const units = parseInt(form.authorized_units, 10);
    if (isNaN(units) || units <= 0) e.authorized_units = 'Enter a positive number of units';
    if (!form.start_date) e.start_date = 'Required';
    if (!form.end_date)   e.end_date   = 'Required';
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      e.end_date = 'End must be after start';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        client_id:        clientId!,
        service_type_id:  form.service_type_id,
        auth_number:      form.auth_number.trim(),
        authorized_units: parseInt(form.authorized_units, 10),
        start_date:       form.start_date,
        end_date:         form.end_date,
        notes:            form.notes.trim() || null,
      };
      if (modalMode === 'create') {
        await createAuth.mutateAsync(payload);
      } else if (editing) {
        await updateAuth.mutateAsync({ id: editing.id, ...payload });
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(auth: AuthorizationWithRelations) {
    const action = auth.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${auth.is_active ? 'Deactivate' : 'Activate'} Authorization`,
      `${auth.is_active ? 'Deactivate' : 'Activate'} auth #${auth.auth_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: auth.is_active ? 'Deactivate' : 'Activate',
          style: auth.is_active ? 'destructive' : 'default',
          onPress: () => toggleAuth.mutate({ id: auth.id, is_active: !auth.is_active }),
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Back + header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color="#2563eb" />
          <Text style={styles.backText}>{client?.name ?? 'Client'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>New Auth</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.pageTitle}>Authorizations</Text>
      <Text style={styles.pageSubtitle}>{auths.length} authorization{auths.length !== 1 ? 's' : ''}</Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : auths.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No authorizations yet</Text>
          <Text style={styles.emptyHint}>Tap "New Auth" to add a DHS authorization</Text>
        </View>
      ) : (
        <FlatList
          data={auths}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const status = statusColor(item);
            return (
              <View style={styles.card}>
                <TouchableOpacity style={styles.cardMain} onPress={() => openEdit(item)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.authNumber}>#{item.auth_number}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={styles.serviceRow}>
                    {item.service_types?.short_code && (
                      <View style={styles.shortCodeBadge}>
                        <Text style={styles.shortCodeText}>{item.service_types.short_code}</Text>
                      </View>
                    )}
                    <Text style={styles.serviceName}>{item.service_types?.name ?? '—'}</Text>
                  </View>
                  <View style={styles.unitsRow}>
                    <Text style={styles.unitsLabel}>Authorized:</Text>
                    <Text style={styles.unitsValue}>
                      {item.authorized_units} units ({unitsToHours(item.authorized_units)} hrs)
                    </Text>
                  </View>
                  <Text style={styles.dateRange}>
                    {item.start_date} → {item.end_date}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggle(item)}>
                  <Ionicons
                    name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                    size={24}
                    color={item.is_active ? '#f59e0b' : '#10b981'}
                  />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {modalMode === 'create' ? 'New Authorization' : 'Edit Authorization'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#2563eb" />
                : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

            <Text style={styles.fieldLabel}>Service Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.chipRow}>
                {serviceTypes.filter(st => st.is_active).map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.chip, form.service_type_id === st.id && styles.chipActive]}
                    onPress={() => setField('service_type_id', st.id)}
                  >
                    <Text style={[styles.chipText, form.service_type_id === st.id && styles.chipTextActive]}>
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {errors.service_type_id ? <Text style={styles.errorText}>{errors.service_type_id}</Text> : null}

            <Text style={styles.fieldLabel}>Authorization Number *</Text>
            <TextInput
              style={[styles.input, errors.auth_number ? styles.inputError : null]}
              value={form.auth_number}
              onChangeText={(t) => setField('auth_number', t)}
              placeholder="e.g. DHS-2024-001234"
              autoCapitalize="characters"
            />
            {errors.auth_number ? <Text style={styles.errorText}>{errors.auth_number}</Text> : null}

            <Text style={styles.fieldLabel}>Authorized Units * (1 unit = 15 min)</Text>
            <TextInput
              style={[styles.input, errors.authorized_units ? styles.inputError : null]}
              value={form.authorized_units}
              onChangeText={(t) => setField('authorized_units', t)}
              placeholder="e.g. 480 = 120 hrs"
              keyboardType="numeric"
            />
            {form.authorized_units && !isNaN(parseInt(form.authorized_units, 10)) && (
              <Text style={styles.hintText}>
                = {unitsToHours(parseInt(form.authorized_units, 10))} hours
              </Text>
            )}
            {errors.authorized_units ? <Text style={styles.errorText}>{errors.authorized_units}</Text> : null}

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start Date *</Text>
                <TextInput
                  style={[styles.input, errors.start_date ? styles.inputError : null]}
                  value={form.start_date}
                  onChangeText={(t) => setField('start_date', t)}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
                {errors.start_date ? <Text style={styles.errorText}>{errors.start_date}</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End Date *</Text>
                <TextInput
                  style={[styles.input, errors.end_date ? styles.inputError : null]}
                  value={form.end_date}
                  onChangeText={(t) => setField('end_date', t)}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
                {errors.end_date ? <Text style={styles.errorText}>{errors.end_date}</Text> : null}
              </View>
            </View>

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.notes}
              onChangeText={(t) => setField('notes', t)}
              placeholder="Optional notes about this authorization..."
              multiline
              numberOfLines={3}
            />

          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f9fafb' },
  pageHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  backRow:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText:       { color: '#2563eb', fontSize: 15 },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  pageTitle:      { fontSize: 20, fontWeight: '700', color: '#111827', paddingHorizontal: 16, marginTop: 8 },
  pageSubtitle:   { fontSize: 13, color: '#6b7280', paddingHorizontal: 16, marginBottom: 12 },
  list:           { padding: 16, gap: 10 },
  empty:          { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText:      { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  emptyHint:      { fontSize: 13, color: '#9ca3af' },
  card:           { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardMain:       { flex: 1, padding: 14, gap: 6 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authNumber:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  serviceRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shortCodeBadge: { backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  shortCodeText:  { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  serviceName:    { fontSize: 13, color: '#374151' },
  unitsRow:       { flexDirection: 'row', gap: 6, alignItems: 'center' },
  unitsLabel:     { fontSize: 12, color: '#6b7280' },
  unitsValue:     { fontSize: 12, fontWeight: '600', color: '#111827' },
  dateRange:      { fontSize: 12, color: '#6b7280' },
  toggleBtn:      { padding: 14, justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#f3f4f6' },
  modal:          { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  modalTitle:     { fontSize: 17, fontWeight: '700', color: '#111827' },
  cancelText:     { fontSize: 16, color: '#6b7280' },
  saveText:       { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  modalBody:      { padding: 20, gap: 4 },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 14, marginBottom: 4 },
  chipRow:        { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip:           { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive:     { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText:       { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input:          { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827' },
  inputError:     { borderColor: '#ef4444' },
  textArea:       { height: 80, textAlignVertical: 'top' },
  errorText:      { fontSize: 12, color: '#ef4444', marginTop: 2 },
  hintText:       { fontSize: 12, color: '#2563eb', marginTop: 2 },
  dateRow:        { flexDirection: 'row', gap: 12 },
});
