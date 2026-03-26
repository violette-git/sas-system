import { useLocalSearchParams } from 'expo-router';
import DocumentsScreen from '@/features/documents/screens/DocumentsScreen';

export default function ClientDocuments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DocumentsScreen clientId={id} />;
}
