import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Document } from '@/lib/supabase';

const KEYS = {
  byClient: (clientId: string) => ['documents', 'client', clientId] as const,
  bySchedule: (scheduleId: string) => ['documents', 'schedule', scheduleId] as const,
};

export function useDocumentsByClient(clientId: string) {
  return useQuery({
    queryKey: KEYS.byClient(clientId),
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientId)
        .is('parent_document_id', null)   // top-level documents only
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Document[];
    },
  });
}

export function useDocumentVersions(parentId: string) {
  return useQuery({
    queryKey: ['documents', 'versions', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('parent_document_id', parentId)
        .order('version', { ascending: false });
      if (error) throw error;
      return data as Document[];
    },
  });
}

// ── Upload helpers ─────────────────────────────────────────────

async function uploadToStorage(
  bucket: string,
  path: string,
  fileUri: string,
  mimeType: string
): Promise<string> {
  // Fetch the file as a blob (works on both native via expo FileSystem and web)
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export type DocumentUploadInput = {
  clientId: string;
  scheduleId?: string | null;
  fileUri: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  category?: string;
  description?: string;
  parentDocumentId?: string | null;
};

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: DocumentUploadInput) => {
      const companyId = profile!.company_id!;
      const userId = profile!.id;

      // Determine version number if replacing an existing doc
      let version = 1;
      if (input.parentDocumentId) {
        const { data: versions } = await supabase
          .from('documents')
          .select('version')
          .eq('parent_document_id', input.parentDocumentId)
          .order('version', { ascending: false })
          .limit(1);
        if (versions && versions.length > 0) {
          version = (versions[0].version as number) + 1;
        }
      }

      const ext = input.fileName.split('.').pop() ?? 'bin';
      const storagePath = `${companyId}/${input.clientId}/${Date.now()}_v${version}.${ext}`;

      const fileUrl = await uploadToStorage(
        'documents',
        storagePath,
        input.fileUri,
        input.mimeType
      );

      const { data, error } = await supabase
        .from('documents')
        .insert({
          company_id: companyId,
          client_id: input.clientId,
          schedule_id: input.scheduleId ?? null,
          uploaded_by: userId,
          file_name: input.fileName,
          file_url: fileUrl,
          file_type: input.mimeType,
          file_size_bytes: input.fileSizeBytes ?? null,
          category: input.category ?? null,
          description: input.description ?? null,
          version,
          parent_document_id: input.parentDocumentId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Document;
    },
    onSuccess: (data) => {
      if (data.client_id) {
        queryClient.invalidateQueries({ queryKey: KEYS.byClient(data.client_id) });
      }
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.byClient(clientId) });
    },
  });
}

/** Save a signature image (base64 data URI) to Supabase Storage and link it to a document. */
export function useSaveSignature() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      documentId,
      clientId,
      signatureDataUri,
    }: {
      documentId: string;
      clientId: string;
      signatureDataUri: string;
    }) => {
      const companyId = profile!.company_id!;
      const path = `${companyId}/${documentId}/signature_${Date.now()}.png`;

      const signatureUrl = await uploadToStorage(
        'signatures',
        path,
        signatureDataUri,
        'image/png'
      );

      const { error } = await supabase
        .from('documents')
        .update({
          signature_url: signatureUrl,
          signature_signed_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) throw error;
      return { documentId, clientId, signatureUrl };
    },
    onSuccess: ({ clientId }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.byClient(clientId) });
    },
  });
}
