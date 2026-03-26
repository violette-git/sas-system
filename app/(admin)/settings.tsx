import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  useServiceTypes, useCreateServiceType, useUpdateServiceType, useToggleServiceType,
} from '@/features/service-types/hooks/useServiceTypes';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import type { ServiceType } from '@/lib/supabase';

type ModalMode = 'create' | 'edit';
type Tab = 'profile' | 'services' | 'tools';

export default function AdminSettings() {
  const { profile, company, clear } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { data: serviceTypes = [], isLoading } = useServiceTypes();
  const createMutation  = useCreateServiceType();
  const updateMutation  = useUpdateServiceType();
  const toggleMutation  = useToggleServiceType();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode,    setModalMode]    = useState<ModalMode>('create');
  const [editing,      setEditing]      = useState<ServiceType | null>(null);
  const [name,         setName]         = useState('');
  const [shortCode,    setShortCode]    = useState('');
  const [description,  setDescription]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [nameError,    setNameError]    = useState('');

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setName(''); setShortCode(''); setDescription(''); setNameError('');
    setModalVisible(true);
  }

  function openEdit(st: ServiceType) {
    setModalMode('edit');
    setEditing(st);
    setName(st.name);
    setShortCode(st.short_code ?? '');
    setDescription(st.description ?? '');
    setNameError('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim()) { setNameError('Name is required'); return; }
    setSaving(true);
    try {
      if (modalMode === 'create') {
        await createMutation.mutateAsync({
          name: name.trim(),
          short_code: shortCode.trim() || null,
          description: description.trim() || null,
        });
      } else if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: name.trim(),
          short_code: shortCode.trim() || null,
          description: description.trim() || null,
        });
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save service type');
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(st: ServiceType) {
    const action = st.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${st.is_active ? 'Deactivate' : 'Activate'} Service Type`,
      `${action.charAt(0).toUpperCase() + action.slice(1)} "${st.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: st.is_active ? 'Deactivate' : 'Activate',
          style: st.is_active ? 'destructive' : 'default',
          onPress: () => toggleMutation.mutate({ id: st.id, is_active: !st.is_active }),
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'profile' && styles.tabBtnActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'profile' && styles.tabBtnTextActive]}>
            Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'services' && styles.tabBtnActive]}
          onPress={() => setActiveTab('services')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'services' && styles.tabBtnTextActive]}>
            Service Types
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'tools' && styles.tabBtnActive]}
          onPress={() => setActiveTab('tools')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'tools' && styles.tabBtnTextActive]}>
            Tools
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign out row */}
      {activeTab === 'profile' && (
        <View style={styles.profileTabWrap}>
          <ProfileScreen />
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => { supabase.auth.signOut(); clear(); }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tools section — Review Queue + Templates */}
      {activeTab === 'tools' && (
        <View style={styles.toolsSection}>
          <Text style={styles.toolsSectionTitle}>Case Notes & Documents</Text>
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => router.push('/(admin)/review')}
          >
            <View style={styles.toolIcon}>
              <Ionicons name="checkmark-done-outline" size={20} color="#2563eb" />
            </View>
            <View style={styles.toolBody}>
              <Text style={styles.toolTitle}>Review Queue</Text>
              <Text style={styles.toolSubtitle}>Approve, reject, or request revisions on submitted case notes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => router.push('/(admin)/templates')}
          >
            <View style={styles.toolIcon}>
              <Ionicons name="document-text-outline" size={20} color="#2563eb" />
            </View>
            <View style={styles.toolBody}>
              <Text style={styles.toolTitle}>Templates</Text>
              <Text style={styles.toolSubtitle}>Create structured note templates for employees</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}

      {/* Service Types section */}
      {activeTab === 'services' && <View style={{ flex: 1 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Service Types</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#2563eb" />
      ) : serviceTypes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="construct-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No service types yet</Text>
          <Text style={styles.emptySubtext}>Add Behavioral Aide, Visitation Supervision, Counseling, etc.</Text>
        </View>
      ) : (
        <FlatList
          data={serviceTypes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.is_active && styles.cardInactive]}>
              <TouchableOpacity style={styles.cardContent} onPress={() => openEdit(item)}>
                <View style={styles.cardLeft}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardName, !item.is_active && styles.textMuted]}>
                      {item.name}
                    </Text>
                    {item.short_code ? (
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{item.short_code}</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.description ? (
                    <Text style={styles.cardDescription} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                </View>
                <View style={styles.cardRight}>
                  {!item.is_active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Inactive</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggle(item)}>
                <Ionicons
                  name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={22}
                  color={item.is_active ? '#f59e0b' : '#10b981'}
                />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {modalMode === 'create' ? 'New Service Type' : 'Edit Service Type'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#2563eb" />
                : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(t) => { setName(t); setNameError(''); }}
              placeholder="e.g. Behavioral Aide"
              autoFocus
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

            <Text style={styles.fieldLabel}>Short Code</Text>
            <TextInput
              style={styles.input}
              value={shortCode}
              onChangeText={setShortCode}
              placeholder="e.g. BA"
              autoCapitalize="characters"
              maxLength={10}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </Modal>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f9fafb' },
  tabBar:           { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn:           { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive:     { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabBtnText:       { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  tabBtnTextActive: { color: '#2563eb', fontWeight: '700' },
  profileTabWrap:   { flex: 1 },
  signOutBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ef4444', margin: 16, padding: 14, borderRadius: 10 },
  signOutText:      { color: '#fff', fontWeight: '600', fontSize: 15 },
  profileCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  avatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText:       { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileName:      { fontSize: 16, fontWeight: '600', color: '#111827' },
  profileEmail:     { fontSize: 13, color: '#6b7280', marginTop: 1 },
  roleBadge:        { marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#dbeafe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeText:    { fontSize: 10, fontWeight: '700', color: '#1d4ed8', letterSpacing: 0.5 },
  sectionHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  sectionTitle:     { fontSize: 17, fontWeight: '700', color: '#111827' },
  addButton:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addButtonText:    { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyState:       { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 40 },
  emptyText:        { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  emptySubtext:     { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  card:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardInactive:     { opacity: 0.6 },
  cardContent:      { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  cardLeft:         { flex: 1 },
  cardRight:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName:         { fontSize: 15, fontWeight: '600', color: '#111827' },
  textMuted:        { color: '#6b7280' },
  cardDescription:  { fontSize: 13, color: '#6b7280', marginTop: 2 },
  codeBadge:        { backgroundColor: '#f0fdf4', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  codeBadgeText:    { fontSize: 11, fontWeight: '700', color: '#15803d', letterSpacing: 0.5 },
  inactiveBadge:    { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveBadgeText:{ fontSize: 11, fontWeight: '600', color: '#92400e' },
  toggleBtn:        { padding: 14, borderLeftWidth: 1, borderLeftColor: '#f3f4f6' },
  modalContainer:   { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  modalTitle:       { fontSize: 17, fontWeight: '700', color: '#111827' },
  cancelText:       { fontSize: 16, color: '#6b7280' },
  saveText:         { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  modalBody:        { padding: 20, gap: 4 },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 14, marginBottom: 4 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827' },
  inputError:       { borderColor: '#ef4444' },
  textArea:         { height: 80, textAlignVertical: 'top' },
  errorText:        { fontSize: 12, color: '#ef4444', marginTop: 2 },
  toolsSection:     { padding: 16, gap: 0 },
  toolsSectionTitle:{ fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  toolRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, gap: 12, borderRadius: 0 },
  toolDivider:      { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
  toolIcon:         { width: 36, height: 36, borderRadius: 8, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  toolBody:         { flex: 1 },
  toolTitle:        { fontSize: 15, fontWeight: '600', color: '#111827' },
  toolSubtitle:     { fontSize: 12, color: '#6b7280', marginTop: 1 },
});
