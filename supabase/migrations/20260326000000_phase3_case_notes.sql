-- =============================================================
-- PHASE 3 — Case Notes & Documentation
-- Adds: review workflow to visit_notes, versioning + signatures
--       to documents, storage buckets for uploads.
-- =============================================================

-- ── 1. VISIT_NOTES — review/approval workflow ──────────────────
alter table public.visit_notes
  add column if not exists status            text        not null default 'draft'
    check (status in ('draft','submitted','approved','revision_requested','rejected')),
  add column if not exists review_comment    text,
  add column if not exists reviewed_by       uuid        references public.users(id) on delete set null,
  add column if not exists reviewed_at       timestamptz,
  add column if not exists template_id       uuid        references public.templates(id) on delete set null,
  add column if not exists template_data     jsonb,
  add column if not exists photo_urls        jsonb       not null default '[]'::jsonb;

-- Back-fill status from is_draft so existing rows stay consistent:
--   is_draft=true  → status='draft'
--   is_draft=false → status='submitted'
update public.visit_notes
  set status = case when is_draft then 'draft' else 'submitted' end
  where status = 'draft' and not is_draft;

create index if not exists idx_visit_notes_status      on public.visit_notes(status);
create index if not exists idx_visit_notes_template_id on public.visit_notes(template_id);

-- ── 2. DOCUMENTS — versioning + e-signature fields ─────────────
alter table public.documents
  add column if not exists version                    int         not null default 1,
  add column if not exists parent_document_id         uuid        references public.documents(id) on delete set null,
  add column if not exists description                text,
  add column if not exists signature_url              text,
  add column if not exists signature_signed_at        timestamptz,
  add column if not exists signature_requested_from   uuid        references public.users(id) on delete set null,
  add column if not exists updated_at                 timestamptz not null default now();

create index if not exists idx_documents_parent_id on public.documents(parent_document_id);

-- auto-update updated_at
do $$ begin
  create trigger trg_documents_updated_at
    before update on public.documents
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ── 3. STORAGE BUCKETS ─────────────────────────────────────────
-- case-notes bucket: stores photo attachments for visit notes (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-notes',
  'case-notes',
  true,
  10485760,   -- 10 MB
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

-- documents bucket: stores uploaded documents (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,   -- 50 MB
  array['application/pdf','image/jpeg','image/png','image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- signatures bucket: stores captured signature images (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signatures',
  'signatures',
  false,
  5242880,    -- 5 MB
  array['image/png','image/jpeg','image/svg+xml']
)
on conflict (id) do nothing;

-- ── 4. STORAGE RLS POLICIES ────────────────────────────────────

-- case-notes: authenticated users in the same company can upload/read
do $$ begin
  create policy "auth_read_case_notes_bucket" on storage.objects
    for select using (
      bucket_id = 'case-notes' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_insert_case_notes_bucket" on storage.objects
    for insert with check (
      bucket_id = 'case-notes' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_delete_case_notes_bucket" on storage.objects
    for delete using (
      bucket_id = 'case-notes' and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

-- documents: authenticated users can upload; only same user or admin can read
do $$ begin
  create policy "auth_read_documents_bucket" on storage.objects
    for select using (
      bucket_id = 'documents' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_insert_documents_bucket" on storage.objects
    for insert with check (
      bucket_id = 'documents' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

-- signatures: authenticated users
do $$ begin
  create policy "auth_read_signatures_bucket" on storage.objects
    for select using (
      bucket_id = 'signatures' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_insert_signatures_bucket" on storage.objects
    for insert with check (
      bucket_id = 'signatures' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;
