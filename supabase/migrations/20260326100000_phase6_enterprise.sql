-- =============================================================
-- Phase 6 — Enterprise & Scale
-- 1. White-Label Branding columns on companies
-- 2. Branding storage bucket
-- =============================================================

-- 1. Add branding columns to companies
alter table public.companies
  add column if not exists primary_color        text,
  add column if not exists secondary_color      text,
  add column if not exists logo_url             text,
  add column if not exists company_name_display text;

-- 2. Create logos storage bucket (private — served via signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  false,
  5242880,  -- 5 MB
  array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
)
on conflict (id) do nothing;

-- RLS: only authenticated users of the same company can upload/read their logo
do $$ begin
  create policy "logos_select" on storage.objects
    for select using (
      bucket_id = 'logos'
      and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "logos_insert" on storage.objects
    for insert with check (
      bucket_id = 'logos'
      and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "logos_update" on storage.objects
    for update using (
      bucket_id = 'logos'
      and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "logos_delete" on storage.objects
    for delete using (
      bucket_id = 'logos'
      and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;
