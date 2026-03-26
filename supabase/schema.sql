-- =============================================================
-- Multi-Tenant SaaS Scheduling System — Supabase Schema
-- =============================================================
-- Run this in the Supabase SQL Editor (in order, top to bottom).
-- Enables: pgcrypto for code generation, RLS for tenant isolation.
-- =============================================================

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_bytes, crypt
create extension if not exists "uuid-ossp";  -- uuid_generate_v4 (fallback)


-- =============================================================
-- 1. COMPANIES
--    Root of every tenant. The access_code is how employees
--    identify which company they belong to at sign-in.
-- =============================================================
create table public.companies (
  id            uuid          primary key default gen_random_uuid(),
  name          text          not null,
  trade_name    text,                            -- DBA / brand name shown to employees
  access_code   text          not null unique,   -- e.g. "ACME-2024"
  is_active     boolean       not null default true,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

comment on column public.companies.access_code is
  'Short, human-readable code employees type at login to identify their tenant.';

-- Auto-generate an access code if one is not supplied (optional helper).
-- Pattern: 3-letter prefix of company name + 4 random hex chars, upper-cased.
create or replace function public.generate_access_code(company_name text)
returns text language plpgsql as $$
declare
  prefix text;
  suffix text;
  candidate text;
begin
  prefix  := upper(left(regexp_replace(company_name, '[^a-zA-Z]', '', 'g'), 3));
  suffix  := upper(encode(gen_random_bytes(2), 'hex'));
  candidate := prefix || '-' || suffix;
  -- Retry if collision (extremely rare)
  while exists (select 1 from public.companies where access_code = candidate) loop
    suffix    := upper(encode(gen_random_bytes(2), 'hex'));
    candidate := prefix || '-' || suffix;
  end loop;
  return candidate;
end;
$$;


-- =============================================================
-- 2. USERS  (extends Supabase auth.users)
--    One profile row per authenticated user.
--    role: 'owner' | 'admin' | 'employee'
-- =============================================================
create type public.user_role as enum ('owner', 'admin', 'employee');

create table public.users (
  id            uuid          primary key references auth.users(id) on delete cascade,
  company_id    uuid          references public.companies(id) on delete cascade,
                              -- NULL only for the platform owner account
  full_name     text          not null,
  email         text          not null,
  role          public.user_role not null default 'employee',
  is_active     boolean       not null default true,
  avatar_url    text,
  phone         text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

comment on column public.users.company_id is
  'NULL = platform owner; otherwise the tenant this user belongs to.';

-- Index for fast "give me all users in company X" queries
create index idx_users_company_id on public.users(company_id);
create index idx_users_role        on public.users(role);


-- =============================================================
-- 3. CLIENTS  (Jobsites / Service Locations)
--    Each company manages its own client list.
-- =============================================================
create table public.clients (
  id            uuid          primary key default gen_random_uuid(),
  company_id    uuid          not null references public.companies(id) on delete cascade,
  name          text          not null,
  contact_name  text,
  contact_email text,
  contact_phone text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  zip           text,
  country       text          default 'US',
  notes         text,
  is_active     boolean       not null default true,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index idx_clients_company_id on public.clients(company_id);


-- =============================================================
-- 4. SCHEDULES  (Appointments / Work Orders)
--    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
-- =============================================================
create type public.schedule_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create table public.schedules (
  id            uuid                    primary key default gen_random_uuid(),
  company_id    uuid                    not null references public.companies(id) on delete cascade,
  employee_id   uuid                    not null references public.users(id) on delete restrict,
  client_id     uuid                    not null references public.clients(id) on delete restrict,
  title         text,                   -- Optional short label for the appointment
  start_time    timestamptz             not null,
  end_time      timestamptz             not null,
  status        public.schedule_status  not null default 'scheduled',
  created_by    uuid                    references public.users(id),
  created_at    timestamptz             not null default now(),
  updated_at    timestamptz             not null default now(),

  constraint chk_end_after_start check (end_time > start_time)
);

create index idx_schedules_company_id   on public.schedules(company_id);
create index idx_schedules_employee_id  on public.schedules(employee_id);
create index idx_schedules_client_id    on public.schedules(client_id);
create index idx_schedules_start_time   on public.schedules(start_time);
create index idx_schedules_status       on public.schedules(status);


-- =============================================================
-- 5. TIME TRACKING  (Clock In / Clock Out)
--    Linked to a specific schedule appointment.
-- =============================================================
create table public.time_entries (
  id            uuid          primary key default gen_random_uuid(),
  schedule_id   uuid          not null references public.schedules(id) on delete cascade,
  employee_id   uuid          not null references public.users(id) on delete cascade,
  company_id    uuid          not null references public.companies(id) on delete cascade,
  clocked_in_at  timestamptz  not null default now(),
  clocked_out_at timestamptz,          -- NULL = currently clocked in
  duration_minutes int                 -- computed on clock-out (see trigger below)
                generated always as (
                  case
                    when clocked_out_at is not null
                    then extract(epoch from (clocked_out_at - clocked_in_at))::int / 60
                    else null
                  end
                ) stored,
  created_at    timestamptz   not null default now()
);

create index idx_time_entries_schedule_id  on public.time_entries(schedule_id);
create index idx_time_entries_employee_id  on public.time_entries(employee_id);
create index idx_time_entries_company_id   on public.time_entries(company_id);


-- =============================================================
-- 6. VISIT NOTES  (Attached to a schedule appointment)
-- =============================================================
create table public.visit_notes (
  id            uuid          primary key default gen_random_uuid(),
  schedule_id   uuid          not null references public.schedules(id) on delete cascade,
  author_id     uuid          not null references public.users(id) on delete set null,
  company_id    uuid          not null references public.companies(id) on delete cascade,
  body          text          not null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index idx_visit_notes_schedule_id on public.visit_notes(schedule_id);


-- =============================================================
-- 7. UTILITY: updated_at auto-refresh trigger
-- =============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Apply to every table that has updated_at
do $$ begin
  create trigger trg_companies_updated_at
    before update on public.companies
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_users_updated_at
    before update on public.users
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_clients_updated_at
    before update on public.clients
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_schedules_updated_at
    before update on public.schedules
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_visit_notes_updated_at
    before update on public.visit_notes
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 8. "COMPANY CODE" LOOKUP FUNCTION
--    Called BEFORE sign-in. Front-end passes the code the user
--    typed; this returns the matching company row (or null).
--    Security: marked SECURITY DEFINER so unauthenticated callers
--    can resolve a code without reading the full companies table.
-- =============================================================
create or replace function public.resolve_company_code(p_code text)
returns table (
  company_id   uuid,
  company_name text,
  is_active    boolean
)
language sql security definer stable as $$
  select id, name, is_active
  from   public.companies
  where  upper(trim(access_code)) = upper(trim(p_code))
  limit  1;
$$;

-- Revoke direct table access from anonymous/public; expose only the function
revoke select on public.companies from anon;
grant  execute on function public.resolve_company_code(text) to anon;


-- =============================================================
-- 9. ROW LEVEL SECURITY (RLS)
--    Every table is locked down to the calling user's company.
-- =============================================================

-- Helper: returns the company_id of the currently authenticated user
create or replace function public.my_company_id()
returns uuid language sql stable security definer as $$
  select company_id from public.users where id = auth.uid();
$$;

-- Helper: returns the role of the currently authenticated user
create or replace function public.my_role()
returns public.user_role language sql stable security definer as $$
  select role from public.users where id = auth.uid();
$$;


-- ── companies ────────────────────────────────
alter table public.companies enable row level security;

-- Only the owner role (platform-level) can see all companies
create policy "owner_all_companies" on public.companies
  for all using ( public.my_role() = 'owner' );

-- Admins/employees can see only their own company
create policy "tenant_own_company" on public.companies
  for select using ( id = public.my_company_id() );


-- ── users ────────────────────────────────────
alter table public.users enable row level security;

create policy "owner_all_users" on public.users
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_users" on public.users
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_profile" on public.users
  for select using ( id = auth.uid() );


-- ── clients ──────────────────────────────────
alter table public.clients enable row level security;

create policy "owner_all_clients" on public.clients
  for all using ( public.my_role() = 'owner' );

create policy "company_clients" on public.clients
  for all using ( company_id = public.my_company_id() );


-- ── schedules ────────────────────────────────
alter table public.schedules enable row level security;

create policy "owner_all_schedules" on public.schedules
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_schedules" on public.schedules
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

-- Employees see only their own assigned schedules
create policy "employee_own_schedules" on public.schedules
  for select using (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
  );

-- Employees can update status on their own schedules
create policy "employee_update_own_schedule_status" on public.schedules
  for update using (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
  );


-- ── time_entries ─────────────────────────────
alter table public.time_entries enable row level security;

create policy "owner_all_time" on public.time_entries
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_time" on public.time_entries
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_time" on public.time_entries
  for all using (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
  );


-- ── visit_notes ──────────────────────────────
alter table public.visit_notes enable row level security;

create policy "owner_all_notes" on public.visit_notes
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_notes" on public.visit_notes
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_notes" on public.visit_notes
  for all using (
    public.my_role() = 'employee'
    and author_id = auth.uid()
  );


-- =============================================================
-- 10. SEED — Platform Owner account helper
--     After creating your personal Supabase auth account, run:
--       select public.seed_owner('<your-auth-uuid>', 'Your Name', 'you@email.com');
-- =============================================================
create or replace function public.seed_owner(
  p_auth_id   uuid,
  p_name      text,
  p_email     text
) returns void language plpgsql security definer as $$
begin
  insert into public.users (id, company_id, full_name, email, role)
  values (p_auth_id, null, p_name, p_email, 'owner')
  on conflict (id) do nothing;
end;
$$;

-- =============================================================
-- 11. SERVICE TYPES
--     Lookup table for service categories per company.
-- =============================================================
create table public.service_types (
  id                       uuid          primary key default gen_random_uuid(),
  company_id               uuid          not null references public.companies(id) on delete cascade,
  name                     text          not null,
  description              text,
  default_duration_minutes int,
  billing_rate             numeric,
  is_active                boolean       not null default true,
  created_at               timestamptz   not null default now(),
  updated_at               timestamptz   not null default now()
);

create index idx_service_types_company_id on public.service_types(company_id);

alter table public.service_types enable row level security;

create policy "owner_all_service_types" on public.service_types
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_service_types" on public.service_types
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_company_service_types" on public.service_types
  for select using (
    public.my_role() = 'employee'
    and company_id = public.my_company_id()
  );

do $$ begin
  create trigger trg_service_types_updated_at
    before update on public.service_types
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 12. ALTER SCHEDULES — add service_type_id
-- =============================================================
alter table public.schedules
  add column if not exists service_type_id uuid
    references public.service_types(id) on delete set null;

create index if not exists idx_schedules_service_type_id on public.schedules(service_type_id);


-- =============================================================
-- 13. AUTHORIZATIONS
--     Approved hours per client from a funding source.
-- =============================================================
create table public.authorizations (
  id               uuid          primary key default gen_random_uuid(),
  company_id       uuid          not null references public.companies(id) on delete cascade,
  client_id        uuid          not null references public.clients(id) on delete cascade,
  service_type_id  uuid          references public.service_types(id) on delete set null,
  auth_number      text,
  authorized_hours numeric       not null,
  used_hours       numeric       not null default 0,
  start_date       date,
  end_date         date,
  funding_source   text,
  notes            text,
  is_active        boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index idx_authorizations_company_id      on public.authorizations(company_id);
create index idx_authorizations_client_id       on public.authorizations(client_id);
create index idx_authorizations_service_type_id on public.authorizations(service_type_id);

alter table public.authorizations enable row level security;

create policy "owner_all_authorizations" on public.authorizations
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_authorizations" on public.authorizations
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_company_authorizations" on public.authorizations
  for select using (
    public.my_role() = 'employee'
    and company_id = public.my_company_id()
  );

do $$ begin
  create trigger trg_authorizations_updated_at
    before update on public.authorizations
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 14. DOCUMENTS
--     File attachments per client or schedule.
-- =============================================================
create table public.documents (
  id               uuid          primary key default gen_random_uuid(),
  company_id       uuid          not null references public.companies(id) on delete cascade,
  client_id        uuid          references public.clients(id) on delete cascade,
  schedule_id      uuid          references public.schedules(id) on delete cascade,
  uploaded_by      uuid          not null references public.users(id) on delete restrict,
  file_name        text          not null,
  file_url         text          not null,
  file_type        text,
  file_size_bytes  bigint,
  category         text,
  created_at       timestamptz   not null default now()
);

create index idx_documents_company_id  on public.documents(company_id);
create index idx_documents_client_id   on public.documents(client_id);
create index idx_documents_schedule_id on public.documents(schedule_id);
create index idx_documents_uploaded_by on public.documents(uploaded_by);

alter table public.documents enable row level security;

create policy "owner_all_documents" on public.documents
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_documents" on public.documents
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_documents" on public.documents
  for all using (
    public.my_role() = 'employee'
    and uploaded_by = auth.uid()
  );


-- =============================================================
-- 15. PAY RATES
--     Employee compensation configuration.
-- =============================================================
create table public.pay_rates (
  id               uuid          primary key default gen_random_uuid(),
  company_id       uuid          not null references public.companies(id) on delete cascade,
  employee_id      uuid          not null references public.users(id) on delete cascade,
  service_type_id  uuid          references public.service_types(id) on delete set null,
  hourly_rate      numeric       not null,
  overtime_rate    numeric,
  holiday_rate     numeric,
  effective_from   date          not null,
  effective_to     date,
  is_active        boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index idx_pay_rates_company_id      on public.pay_rates(company_id);
create index idx_pay_rates_employee_id     on public.pay_rates(employee_id);
create index idx_pay_rates_service_type_id on public.pay_rates(service_type_id);

alter table public.pay_rates enable row level security;

create policy "owner_all_pay_rates" on public.pay_rates
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_pay_rates" on public.pay_rates
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_pay_rates" on public.pay_rates
  for select using (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
  );

do $$ begin
  create trigger trg_pay_rates_updated_at
    before update on public.pay_rates
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 16. INVOICES
--     Generated billing records.
-- =============================================================
create type public.invoice_status as enum (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

create table public.invoices (
  id               uuid                      primary key default gen_random_uuid(),
  company_id       uuid                      not null references public.companies(id) on delete cascade,
  client_id        uuid                      not null references public.clients(id) on delete restrict,
  invoice_number   text                      not null unique,
  period_start     date,
  period_end       date,
  total_hours      numeric,
  total_amount     numeric,
  status           public.invoice_status     not null default 'draft',
  due_date         date,
  paid_date        date,
  notes            text,
  created_by       uuid                      references public.users(id) on delete set null,
  created_at       timestamptz               not null default now(),
  updated_at       timestamptz               not null default now()
);

create index idx_invoices_company_id on public.invoices(company_id);
create index idx_invoices_client_id  on public.invoices(client_id);
create index idx_invoices_status     on public.invoices(status);

alter table public.invoices enable row level security;

create policy "owner_all_invoices" on public.invoices
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_invoices" on public.invoices
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_company_invoices" on public.invoices
  for select using (
    public.my_role() = 'employee'
    and company_id = public.my_company_id()
  );

do $$ begin
  create trigger trg_invoices_updated_at
    before update on public.invoices
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 17. NOTIFICATIONS
--     In-app notification queue.
-- =============================================================
create table public.notifications (
  id               uuid          primary key default gen_random_uuid(),
  company_id       uuid          not null references public.companies(id) on delete cascade,
  user_id          uuid          not null references public.users(id) on delete cascade,
  title            text          not null,
  body             text,
  type             text,
  reference_type   text,
  reference_id     uuid,
  is_read          boolean       not null default false,
  read_at          timestamptz,
  created_at       timestamptz   not null default now()
);

create index idx_notifications_company_id on public.notifications(company_id);
create index idx_notifications_user_id    on public.notifications(user_id);
create index idx_notifications_is_read    on public.notifications(is_read);

alter table public.notifications enable row level security;

create policy "owner_all_notifications" on public.notifications
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_notifications" on public.notifications
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_notifications" on public.notifications
  for all using (
    public.my_role() = 'employee'
    and user_id = auth.uid()
  );


-- =============================================================
-- 18. AUDIT LOG
--     Change tracking for compliance.
-- =============================================================
create table public.audit_log (
  id           uuid          primary key default gen_random_uuid(),
  company_id   uuid          references public.companies(id) on delete set null,
  user_id      uuid          references public.users(id) on delete set null,
  action       text          not null,
  table_name   text          not null,
  record_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_address   text,
  created_at   timestamptz   not null default now()
);

create index idx_audit_log_company_id  on public.audit_log(company_id);
create index idx_audit_log_user_id     on public.audit_log(user_id);
create index idx_audit_log_table_name  on public.audit_log(table_name);
create index idx_audit_log_record_id   on public.audit_log(record_id);

alter table public.audit_log enable row level security;

create policy "owner_all_audit_log" on public.audit_log
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_audit_log" on public.audit_log
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_audit_log" on public.audit_log
  for select using (
    public.my_role() = 'employee'
    and user_id = auth.uid()
  );


-- =============================================================
-- 19. TEMPLATES
--     Case note / visit note templates.
-- =============================================================
create table public.templates (
  id               uuid          primary key default gen_random_uuid(),
  company_id       uuid          not null references public.companies(id) on delete cascade,
  name             text          not null,
  description      text,
  service_type_id  uuid          references public.service_types(id) on delete set null,
  fields           jsonb         not null default '[]',
  is_active        boolean       not null default true,
  created_by       uuid          references public.users(id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index idx_templates_company_id      on public.templates(company_id);
create index idx_templates_service_type_id on public.templates(service_type_id);

alter table public.templates enable row level security;

create policy "owner_all_templates" on public.templates
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_templates" on public.templates
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_company_templates" on public.templates
  for select using (
    public.my_role() = 'employee'
    and company_id = public.my_company_id()
  );

do $$ begin
  create trigger trg_templates_updated_at
    before update on public.templates
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 20. AVAILABILITY
--     Employee working hours and time-off config.
-- =============================================================
create table public.availability (
  id             uuid          primary key default gen_random_uuid(),
  company_id     uuid          not null references public.companies(id) on delete cascade,
  employee_id    uuid          not null references public.users(id) on delete cascade,
  day_of_week    int           check (day_of_week between 0 and 6),
  start_time     time,
  end_time       time,
  is_available   boolean       not null default true,
  effective_from date,
  effective_to   date,
  note           text,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

create index idx_availability_company_id  on public.availability(company_id);
create index idx_availability_employee_id on public.availability(employee_id);

alter table public.availability enable row level security;

create policy "owner_all_availability" on public.availability
  for all using ( public.my_role() = 'owner' );

create policy "admin_company_availability" on public.availability
  for all using (
    public.my_role() = 'admin'
    and company_id = public.my_company_id()
  );

create policy "employee_own_availability" on public.availability
  for all using (
    public.my_role() = 'employee'
    and employee_id = auth.uid()
  );

do $$ begin
  create trigger trg_availability_updated_at
    before update on public.availability
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
