-- =============================================================
-- Auto-create public.users row when a new auth user signs up.
-- This ensures every auth account has a matching profile.
-- Role defaults to 'employee'; the owner account must be
-- inserted manually (or updated) with role = 'owner'.
-- =============================================================

-- ── 1. Trigger function ───────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only create a profile if one does not already exist
  insert into public.users (
    id,
    company_id,
    full_name,
    email,
    role,
    is_active,
    avatar_url,
    phone,
    permissions
  )
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee'::user_role),
    true,
    null,
    null,
    '{}'::jsonb
  )
  on conflict (id) do nothing;  -- safe to re-run; won't overwrite existing profiles

  return new;
end;
$$;

-- ── 2. Attach trigger to auth.users ──────────────────────────
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ── 3. Backfill any existing auth users without a profile ────
-- Uses auth.users email to create a minimal profile.
-- Existing rows are left untouched (on conflict do nothing).
insert into public.users (
  id, company_id, full_name, email, role,
  is_active, avatar_url, phone, permissions
)
select
  au.id,
  null,
  coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.email,
  coalesce((au.raw_user_meta_data->>'role')::user_role, 'employee'::user_role),
  true,
  null,
  null,
  '{}'::jsonb
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);
