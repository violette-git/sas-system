import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEmployees, useInviteEmployee, useToggleEmployee } from '@/features/employees/hooks/useEmployees';
import { useAuthStore } from '@/features/auth/store/authStore';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { UserProfile, UserRole } from '@/lib/supabase';

type InviteRole = Extract<UserRole, 'admin' | 'employee'>;

export default function AdminEmployees() {
  const { profile: me } = useAuthStore();
  const { data: employees, isLoading, isFetching, refetch } = useEmployees();
  const inviteEmployee = useInviteEmployee();
  const toggleEmployee = useToggleEmployee();

  const [modalVisible, setModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [role, setRole]         = useState<InviteRole>('employee');
  const [success, setSuccess]   = useState(false);

  function resetModal() {
    setFullName(''); setEmail(''); setRole('employee'); setSuccess(false);
  }

  function handleInvite() {
    if (!fullName.trim() || !email.trim()) return;
    inviteEmployee.mutate(
      { full_name: fullName.trim(), email: email.trim(), role },
      {
        onSuccess: () => setSuccess(true),
        onError: (err: any) => Alert.alert('Error', err.message),
      }
    );
  }

  function handleToggle(emp: UserProfile) {
    const action = emp.is_active ? 'deactivate' : 'activate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Employee`,
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${emp.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => toggleEmployee.mutate({ id: emp.id, is_active: !emp.is_active }) },
      ]
    );
  }

  function renderEmployee({ item }: { item: UserProfile }) {
    const isMe = item.id === me?.id;
    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.full_name}{isMe ? ' (you)' : ''}</Text>
            <View style={[styles.roleBadge, item.role === 'admin' && styles.roleBadgeAdmin]}>
              <Text style={[styles.roleText, item.role === 'admin' && styles.roleTextAdmin]}>
                {item.role}
              </Text>
            </View>
          </View>
          <Text style={styles.email}>{item.email}</Text>
          <View style={[styles.statusDot, item.is_active ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
        {!isMe && (
          <TouchableOpacity onPress={() => handleToggle(item)} style={styles.toggleBtn}>
            <Ionicons
              name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
              size={24}
              color={item.is_active ? '#ef4444' : '#10b981'}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Employees</Text>
          <Text style={styles.pageSubtitle}>{employees?.length ?? 0} members</Text>
        </View>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => { resetModal(); setModalVisible(true); }}>
          <Ionicons name="mail-outline" size={16} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {isLoading
        ? <SkeletonList count={5} />
        : (
          <FlatList
            data={employees}
            keyExtractor={(e) => e.id}
            renderItem={renderEmployee}
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
                icon="people-outline"
                title="No employees yet"
                description="Invite team members to get started."
                action={{ label: 'Invite Employee', onPress: () => { resetModal(); setModalVisible(true); } }}
              />
            }
          />
        )
      }

      {/* Invite Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Employee</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
              <Text style={styles.successTitle}>Invite Sent!</Text>
              <Text style={styles.successText}>
                An email has been sent to {email}.{'\n'}
                They'll set their password when they accept.
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                <TextInput style={styles.input} placeholder="Jane Smith" value={fullName} onChangeText={setFullName} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="jane@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleToggle}>
                  {(['employee', 'admin'] as InviteRole[]).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleOption, role === r && styles.roleOptionActive]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.roleOptionText, role === r && styles.roleOptionTextActive]}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldHint}>
                  {role === 'admin'
                    ? 'Admins can manage employees, clients, and schedules'
                    : 'Employees can view their schedule and clock in/out'}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
                <Text style={styles.infoText}>
                  They'll receive an email to set their own password. No temporary password needed.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.sendBtn, (!fullName.trim() || !email.trim() || inviteEmployee.isPending) && styles.sendBtnDisabled]}
                onPress={handleInvite}
                disabled={!fullName.trim() || !email.trim() || inviteEmployee.isPending}
              >
                {inviteEmployee.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.sendBtnText}>Send Invite</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f8f9fa' },
  loader:     { marginTop: 48 },

  pageHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  pageSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  inviteBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  inviteBtnText:{ color: '#fff', fontWeight: '600', fontSize: 14 },

  list: { padding: 16, gap: 10 },

  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInactive: { opacity: 0.55 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  cardBody:     { flex: 1, gap: 2 },

  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:         { fontSize: 15, fontWeight: '600', color: '#111827' },
  email:        { fontSize: 12, color: '#6b7280' },

  roleBadge:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: '#f3f4f6' },
  roleBadgeAdmin:    { backgroundColor: '#fef3c7' },
  roleText:          { fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' },
  roleTextAdmin:     { color: '#92400e' },

  statusDot:      { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusActive:   {},
  statusInactive: {},
  statusText:     { fontSize: 11, color: '#6b7280' },

  toggleBtn: { padding: 4 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText:  { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  emptyHint:  { fontSize: 13, color: '#9ca3af' },

  // Modal
  modal:       { flex: 1, backgroundColor: '#f8f9fa' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody:   { padding: 20, gap: 16 },

  field:     { gap: 4 },
  label:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  required:  { color: '#ef4444' },
  fieldHint: { fontSize: 11, color: '#9ca3af' },
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

  roleToggle:           { flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  roleOption:           { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  roleOptionActive:     { backgroundColor: '#2563eb' },
  roleOptionText:       { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  roleOptionTextActive: { color: '#fff' },

  infoBox:  { flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, alignItems: 'flex-start' },
  infoText: { fontSize: 13, color: '#1d4ed8', flex: 1 },

  sendBtn:         { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Success state
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  successTitle:     { fontSize: 22, fontWeight: '700', color: '#111827' },
  successText:      { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  doneBtn:          { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneBtnText:      { color: '#fff', fontSize: 16, fontWeight: '600' },
});
