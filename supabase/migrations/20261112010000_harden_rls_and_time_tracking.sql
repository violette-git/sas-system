-- =============================================================
-- Harden RLS and time tracking (found in the Flutter port review)
-- =============================================================
-- Safe to re-run. Admin and owner behavior is unchanged; this only
-- narrows what employees and deactivated accounts can do.
--
-- 1. Deactivated users and users of inactive companies lost nothing
--    server side: my_role()/my_company_id() ignored is_active.
-- 2. Employees could write any column of their own time entries
--    (e.g. move clocked_in_at back 3 hours to inflate payroll),
--    approve their own visit notes, and update or delete any client.
-- 3. Clock times came from the phone's clock.
-- 4. Two devices could clock the same employee in at once.
-- 5. Employees could edit any column of their own schedules
--    (times, client, reassign), not just the status.
-- =============================================================


-- ── 1. Inactive users / companies resolve to no role ─────────

create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select u.company_id
  from public.users u
  left join public.companies c on c.id = u.company_id
  where u.id = auth.uid()
    and u.is_active
    and (u.company_id is null or c.is_active);
$$;

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select u.role
  from public.users u
  left join public.companies c on c.id = u.company_id
  where u.id = auth.uid()
    and u.is_active
    and (u.company_id is null or c.is_active);
$$;

-- The app reads this after sign-in to explain why access was refused.
create or replace function public.my_access_status()
returns text language sql stable security definer set search_path = public as $$
  select case
    when u.id is null then 'no_profile'
    when not u.is_active then 'user_inactive'
    when u.company_id is not null and not coalesce(c.is_active, false) then 'company_inactive'
    else 'ok'
  end
  from (select auth.uid() as uid) me
  left join public.users u on u.id = me.uid
  left join public.companies c on c.id = u.company_id;
$$;
grant execute on function public.my_access_status() to authenticated;


-- ── 2a. Clients: employees read, admins write ────────────────

drop policy if exists "company_clients" on public.clients;
drop policy if exists "company_clients_read" on public.clients;
drop policy if exists "admin_company_clients" on public.clients;

create policy "company_clients_read" on public.clients
  for select using ( company_id = public.my_company_id() );

create policy "admin_company_clients" on public.clients
  for all using (
    public.my_role() = 'admin' and company_id = public.my_company_id()
  ) with check (
    public.my_role() = 'admin' and company_id = public.my_company_id()
  );


-- ── 2b. Time entries: employees read, clock in, clock out ────

drop policy if exists "employee_own_time" on public.time_entries;
drop policy if exists "employee_read_own_time" on public.time_entries;
drop policy if exists "employee_clock_in" on public.time_entries;
drop policy if exists "employee_clock_out" on public.time_entries;

create policy "employee_read_own_time" on public.time_entries
  for select using (
    public.my_role() = 'employee' and employee_id = auth.uid()
  );

create policy "employee_clock_in" on public.time_entries
  for insert with check (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
    and company_id = public.my_company_id()
    and clocked_out_at is null
    and exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and s.employee_id = auth.uid()
        and s.status in ('scheduled', 'in_progress')
    )
  );

-- Only an open entry can be closed; the trigger below limits the columns.
create policy "employee_clock_out" on public.time_entries
  for update using (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
    and clocked_out_at is null
  ) with check (
    employee_id = auth.uid()
  );


-- ── 3. Server clock for clock in / out (non-admins) ──────────

create or replace function public.time_entry_server_clock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  caller_role text := public.my_role()::text;
begin
  -- Admins and the owner may correct times; service role passes through.
  if auth.uid() is null or caller_role in ('admin', 'owner') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.clocked_in_at := now();
    new.clocked_out_at := null;
    return new;
  end if;

  -- UPDATE by an employee: closing the entry is the only allowed change.
  if new.schedule_id   is distinct from old.schedule_id
  or new.employee_id   is distinct from old.employee_id
  or new.company_id    is distinct from old.company_id
  or new.clocked_in_at is distinct from old.clocked_in_at then
    raise exception 'Time entries can only be clocked out';
  end if;

  if new.clocked_out_at is not null then
    new.clocked_out_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_time_entry_server_clock on public.time_entries;
create trigger trg_time_entry_server_clock
  before insert or update on public.time_entries
  for each row execute function public.time_entry_server_clock();


-- ── 4. One open clock-in per employee ────────────────────────

do $$ begin
  create unique index if not exists uq_time_entries_one_open_per_employee
    on public.time_entries(employee_id)
    where clocked_out_at is null;
exception when unique_violation then
  raise notice 'Skipped uq_time_entries_one_open_per_employee: an employee already has more than one open entry. Close the duplicates and re-run.';
end $$;


-- ── 5. Employees may only move their own schedule's status ───

create or replace function public.guard_employee_schedule_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.my_role()::text in ('admin', 'owner') then
    return new;
  end if;

  if new.employee_id     is distinct from old.employee_id
  or new.client_id       is distinct from old.client_id
  or new.company_id      is distinct from old.company_id
  or new.start_time      is distinct from old.start_time
  or new.end_time        is distinct from old.end_time
  or new.service_type_id is distinct from old.service_type_id
  or new.title           is distinct from old.title then
    raise exception 'Employees can only update the visit status';
  end if;

  if old.status = 'cancelled' and new.status is distinct from old.status then
    raise exception 'This visit was cancelled';
  end if;

  if new.status not in ('in_progress', 'completed') and new.status is distinct from old.status then
    raise exception 'Employees can only start or complete a visit';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_employee_schedule_update on public.schedules;
create trigger trg_guard_employee_schedule_update
  before update on public.schedules
  for each row execute function public.guard_employee_schedule_update();


-- ── 6. Employees cannot approve or reject their own notes ────

create or replace function public.guard_visit_note_review()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.my_role()::text in ('admin', 'owner') then
    return new;
  end if;

  if new.status not in ('draft', 'submitted') then
    raise exception 'Only an admin can review case notes';
  end if;

  if tg_op = 'UPDATE' then
    if old.status in ('approved', 'rejected') then
      raise exception 'This note has already been reviewed';
    end if;
    if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.review_comment is distinct from old.review_comment then
      raise exception 'Only an admin can review case notes';
    end if;
  else
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_comment := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_visit_note_review on public.visit_notes;
create trigger trg_guard_visit_note_review
  before insert or update on public.visit_notes
  for each row execute function public.guard_visit_note_review();
