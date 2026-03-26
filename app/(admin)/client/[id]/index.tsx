import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClients } from '@/features/clients/hooks/useClients';

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { data: clients } = useClients();
  const client = clients?.find((c) => c.id === id);

  if (!client) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Client not found</Text>
      </View>
    );
  }

  const address = [client.address_line1, client.address_line2, client.city, client.state, client.zip]
    .filter(Boolean).join(', ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color="#2563eb" />
        <Text style={styles.backText}>Clients</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="business" size={26} color="#2563eb" />
        </View>
        <Text style={styles.clientName}>{client.name}</Text>
        {!client.is_active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        )}
      </View>

      {/* Info cards */}
      {(client.contact_name || client.contact_email || client.contact_phone) && (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Contact</Text>
          {client.contact_name  && <InfoRow icon="person-outline"   label={client.contact_name} />}
          {client.contact_email && <InfoRow icon="mail-outline"     label={client.contact_email} />}
          {client.contact_phone && <InfoRow icon="call-outline"     label={client.contact_phone} />}
        </View>
      )}

      {address ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Address</Text>
          <InfoRow icon="location-outline" label={address} />
        </View>
      ) : null}

      {client.notes ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text style={styles.notesText}>{client.notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push({ pathname: '/(admin)/client/[id]/authorizations', params: { id } })}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="document-text-outline" size={20} color="#2563eb" />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Authorizations</Text>
            <Text style={styles.actionSubtitle}>Manage DHS service authorizations</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color="#6b7280" />
      <Text style={styles.infoText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f9fafb' },
  content:          { padding: 16, gap: 12 },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound:         { color: '#6b7280', fontSize: 16 },
  backRow:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backText:         { color: '#2563eb', fontSize: 15 },
  header:           { alignItems: 'center', gap: 8, paddingVertical: 12 },
  iconCircle:       { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  clientName:       { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  inactiveBadge:    { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  inactiveBadgeText:{ fontSize: 12, fontWeight: '600', color: '#92400e' },
  infoCard:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:         { fontSize: 14, color: '#374151', flex: 1 },
  notesText:        { fontSize: 14, color: '#374151', lineHeight: 20 },
  actionsCard:      { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  actionRow:        { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  actionIcon:       { width: 36, height: 36, borderRadius: 8, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  actionBody:       { flex: 1 },
  actionTitle:      { fontSize: 15, fontWeight: '600', color: '#111827' },
  actionSubtitle:   { fontSize: 12, color: '#6b7280', marginTop: 1 },
});
