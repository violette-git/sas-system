import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies, useCreateCompany, useToggleCompany } from '@/features/companies/hooks/useCompanies';
import type { Company } from '@/lib/supabase';

export default function OwnerCompanies() {
  const { data: companies, isLoading } = useCompanies();
  const createCompany  = useCreateCompany();
  const toggleCompany  = useToggleCompany();

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName]           = useState('');
  const [tradeName, setTradeName] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    createCompany.mutate(
      { name: name.trim(), trade_name: tradeName.trim() || undefined },
      {
        onSuccess: () => {
          setModalVisible(false);
          setName('');
          setTradeName('');
        },
      }
    );
  }

  function handleToggle(company: Company) {
    const action = company.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Company`,
      `Are you sure you want to ${action} "${company.trade_name ?? company.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => toggleCompany.mutate({ id: company.id, is_active: !company.is_active }) },
      ]
    );
  }

  function renderCompany({ item }: { item: Company }) {
    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{item.trade_name ?? item.name}</Text>
          {item.trade_name && <Text style={styles.cardLegal}>{item.name}</Text>}
          <View style={styles.codeRow}>
            <Ionicons name="key-outline" size={13} color="#6b7280" />
            <Text style={styles.codeText}>{item.access_code}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.badge, item.is_active ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, item.is_active ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleToggle(item)} style={styles.toggleBtn}>
            <Ionicons
              name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
              size={22}
              color={item.is_active ? '#ef4444' : '#10b981'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Companies</Text>
          <Text style={styles.pageSubtitle}>{companies?.length ?? 0} registered</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading
        ? <ActivityIndicator style={styles.loader} color="#7c3aed" />
        : (
          <FlatList
            data={companies}
            keyExtractor={(c) => c.id}
            renderItem={renderCompany}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="business-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No companies yet</Text>
                <Text style={styles.emptyHint}>Tap "New" to add your first client company</Text>
              </View>
            }
          />
        )
      }

      {/* Create Company Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Company</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.field}>
              <Text style={styles.label}>Legal / Registered Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Foster Friends LLC"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Brand / Trade Name <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Foster Friends"
                value={tradeName}
                onChangeText={setTradeName}
              />
              <Text style={styles.fieldHint}>Shown to employees in the app</Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
              <Text style={styles.infoText}>
                An access code will be automatically generated for this company.
              </Text>
            </View>

            {createCompany.isError && (
              <Text style={styles.errorText}>
                {(createCompany.error as any)?.message ?? 'Failed to create company.'}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (!name.trim() || createCompany.isPending) && styles.saveBtnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim() || createCompany.isPending}
            >
              {createCompany.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Create Company</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8f9fa' },
  loader:      { marginTop: 48 },

  pageHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  pageSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7c3aed', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  list: { padding: 16, gap: 12 },

  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } as any,
  cardInactive: { opacity: 0.55 },
  cardBody:     { flex: 1, gap: 3 },
  cardName:     { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardLegal:    { fontSize: 12, color: '#6b7280' },
  codeRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  codeText:     { fontSize: 12, color: '#6b7280', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  cardRight:  { alignItems: 'center', gap: 8 },
  toggleBtn:  { padding: 4 },

  badge:             { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  badgeActive:       { backgroundColor: '#d1fae5' },
  badgeInactive:     { backgroundColor: '#fee2e2' },
  badgeText:         { fontSize: 11, fontWeight: '600' },
  badgeTextActive:   { color: '#065f46' },
  badgeTextInactive: { color: '#991b1b' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText:  { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  emptyHint:  { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  // Modal
  modal:       { flex: 1, backgroundColor: '#f8f9fa' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody:   { padding: 20, gap: 16 },

  field:      { gap: 4 },
  label:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  required:   { color: '#ef4444' },
  optional:   { fontWeight: '400', color: '#9ca3af' },
  fieldHint:  { fontSize: 11, color: '#9ca3af' },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },

  infoBox:   { flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, alignItems: 'flex-start' },
  infoText:  { fontSize: 13, color: '#1d4ed8', flex: 1 },
  errorText: { fontSize: 13, color: '#ef4444', textAlign: 'center' },

  saveBtn:         { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
});

// Need Platform for monospace font fallback
import { Platform } from 'react-native';
