import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl
  ?? process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey
  ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Three-way storage adapter:
//   native          → expo-secure-store  (encrypted device keychain)
//   web client      → localStorage       (browser)
//   SSR / Node.js   → no-op              (window doesn't exist; session not needed)
const isNative    = Platform.OS !== 'web';
const isWebClient = Platform.OS === 'web' && typeof window !== 'undefined';

const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isNative)    return SecureStore.getItemAsync(key);
    if (isWebClient) return window.localStorage.getItem(key);
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isNative)    return SecureStore.setItemAsync(key, value);
    if (isWebClient) window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isNative)    return SecureStore.deleteItemAsync(key);
    if (isWebClient) window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, cache: 'no-store' }),
  },
});

// ── Types mirroring the DB schema ────────────────────────────
export type UserRole = 'owner' | 'admin' | 'employee';

export interface UserProfile {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  phone: string | null;
}

export interface Company {
  id: string;
  name: string;
  trade_name: string | null;
  access_code: string;
  is_active: boolean;
  // Phase 6 — White-label branding
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  company_name_display: string | null;
}

export interface AuditLog {
  id: string;
  company_id: string | null;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  // joined
  users?: { full_name: string; email: string } | null;
}

export interface ServiceType {
  id: string;
  company_id: string;
  name: string;
  short_code: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Authorization {
  id: string;
  company_id: string;
  client_id: string;
  service_type_id: string;
  auth_number: string;
  authorized_units: number; // 1 unit = 15 min; hours = authorized_units / 4
  start_date: string;       // YYYY-MM-DD
  end_date: string;
  notes: string | null;
  is_active: boolean;
}

export type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Schedule {
  id: string;
  company_id: string;
  employee_id: string;
  client_id: string;
  authorization_id: string | null;
  service_type_id: string | null;
  title: string | null;
  notes: string | null;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
  created_by: string | null;
}

export interface TimeEntry {
  id: string;
  schedule_id: string;
  employee_id: string;
  company_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  duration_minutes: number | null; // generated — never write
  billable_units: number | null;   // generated — floor(minutes/15), never write
  clocked_in_lat: number | null;
  clocked_in_lon: number | null;
  clocked_out_lat: number | null;
  clocked_out_lon: number | null;
}

export type VisitNoteStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested' | 'rejected';

export interface VisitNote {
  id: string;
  schedule_id: string;
  author_id: string;
  company_id: string;
  body: string;
  goals_addressed: string | null;
  client_response: string | null;
  next_steps: string | null;
  supervisor_notified: boolean;
  is_draft: boolean;
  // Phase 3 review workflow fields (optional — backfilled on existing rows)
  status?: VisitNoteStatus;
  review_comment?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  template_id?: string | null;
  template_data?: Record<string, unknown> | null;
  photo_urls?: string[];
  created_at?: string;
  updated_at?: string;
}

export type TemplateFieldType = 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date';

export interface TemplateField {
  id: string;
  type: TemplateFieldType;
  label: string;
  required: boolean;
  options?: string[];       // for dropdown fields
  placeholder?: string;
}

export interface Template {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  service_type_id: string | null;
  fields: TemplateField[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  company_id: string;
  client_id: string | null;
  schedule_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  category: string | null;
  description: string | null;
  version: number;
  parent_document_id: string | null;
  signature_url: string | null;
  signature_signed_at: string | null;
  signature_requested_from: string | null;
  created_at: string;
  updated_at: string;
}
