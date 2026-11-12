-- =============================================================
-- Reconcile repo SQL with the live database + profile security
-- =============================================================
-- Safe to run more than once. Everything uses IF NOT EXISTS /
-- CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- 1. Schema drift: the app has always read and written these columns,
--    but no file in supabase/ defined them (they were added by hand in
--    the dashboard). Declaring them here means a fresh project built
--    from this repo actually works.
-- 2. Employees could not update their own profile (only a SELECT
--    policy existed), so "edit name / phone" silently failed.
-- 3. Privilege escalation: admin_company_users is FOR ALL without a
--    WITH CHECK on the role, so an admin could set any user in their
--    company (including themselves) to 'owner', the platform-wide role.
-- =============================================================


-- ── 1. Schema drift ──────────────────────────────────────────

alter table public.schedules
  add column if not exists authorization_id uuid
    references public.authorizations(id) on delete set null,
  add column if not exists notes text;

create index if not exists idx_schedules_authorization_id
  on public.schedules(authorization_id);

alter table public.visit_notes
  add column if not exists is_draft            boolean not null default true,
  add column if not exists goals_addressed     text,
  add column if not exists client_response     text,
  add column if not exists next_steps          text,
  add column if not exists supervisor_notified boolean not null default false;

alter table public.time_entries
  add column if not exists clocked_in_lat  double precision,
  add column if not exists clocked_in_lon  double precision,
  add column if not exists clocked_out_lat double precision,
  add column if not exists clocked_out_lon double precision;

-- billable_units: 1 unit = 15 minutes. A generated column cannot read
-- another generated column (duration_minutes), so compute from the
-- timestamps directly.
alter table public.time_entries
  add column if not exists billable_units int
    generated always as (
      case
        when clocked_out_at is not null
        then (extract(epoch from (clocked_out_at - clocked_in_at))::int / 60) / 15
        else null
      end
    ) stored;


-- Authorizations: SQL declared authorized_hours, but every client (Expo
-- and Flutter) reads and writes authorized_units (1 unit = 15 minutes).
alter table public.authorizations
  add column if not exists authorized_units int;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'authorizations'
      and column_name = 'authorized_hours'
  ) then
    update public.authorizations
      set authorized_units = round(authorized_hours * 4)
      where authorized_units is null and authorized_hours is not null;
    alter table public.authorizations alter column authorized_hours drop not null;
  end if;
end $$;

alter table public.service_types
  add column if not exists short_code text;


-- ── 2. Users may update their own profile ────────────────────

drop policy if exists "self_update_profile" on public.users;
create policy "self_update_profile" on public.users
  for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );


-- ── 3. Guard privileged columns on public.users ──────────────
-- Runs on every insert/update. Service-role calls (edge functions,
-- triggers with no auth.uid()) are trusted and pass through.

create or replace function public.guard_user_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  caller_role text := public.my_role()::text;
begin
  -- Service role / internal: no authenticated caller.
  if auth.uid() is null then
    return new;
  end if;

  -- The platform owner may do anything.
  if caller_role = 'owner' then
    return new;
  end if;

  -- Nobody but the owner may create or grant the owner role.
  if new.role = 'owner' and (tg_op = 'INSERT' or old.role is distinct from 'owner') then
    raise exception 'Only the platform owner can grant the owner role';
  end if;

  if tg_op = 'UPDATE' then
    -- Nobody but the owner may move a user to another company.
    if new.company_id is distinct from old.company_id then
      raise exception 'Cannot change a user''s company';
    end if;

    -- Non-admins editing their own row: only harmless fields.
    if caller_role is distinct from 'admin' then
      if new.role        is distinct from old.role
      or new.is_active   is distinct from old.is_active
      or new.permissions is distinct from old.permissions then
        raise exception 'You can only edit your name, phone and avatar';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_user_privileges on public.users;
create trigger trg_guard_user_privileges
  before insert or update on public.users
  for each row execute function public.guard_user_privileges();


-- ── 4. Never take the owner role from signup metadata ────────
-- handle_new_auth_user copied raw_user_meta_data->>'role' straight into
-- public.users. If public sign-ups are enabled, anyone could register
-- with {"role": "owner"} and get platform-wide access. The owner account
-- is created with public.seed_owner(); everyone else starts as employee
-- (invite-user then upserts the intended company and role).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (
    id, company_id, full_name, email, role,
    is_active, avatar_url, phone, permissions
  )
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'employee'::user_role,
    true,
    null,
    null,
    '{}'::jsonb
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
