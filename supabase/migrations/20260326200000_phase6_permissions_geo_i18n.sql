-- =============================================================
-- Phase 6 — Part 2: Permissions, Geofencing, i18n
-- =============================================================

-- 1. Per-user granular permissions (JSONB flag map)
alter table public.users
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- 2. Company-level settings for geofence + default language
alter table public.companies
  add column if not exists geofence_radius_meters  integer not null default 500,
  add column if not exists default_language        text    not null default 'en';

-- 3. Client geocoordinates for geofence center point
alter table public.clients
  add column if not exists latitude   double precision,
  add column if not exists longitude  double precision;

-- Index for fast permission lookups
create index if not exists idx_users_permissions on public.users using gin (permissions);
