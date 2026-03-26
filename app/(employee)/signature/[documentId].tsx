import { useLocalSearchParams } from 'expo-router';
import SignatureScreen from '@/features/signatures/screens/SignatureScreen';

// The employee signature screen re-uses the same SignatureScreen component.
// Params: documentId (from URL) + clientId (passed as query param)
export default SignatureScreen;
