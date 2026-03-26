-- =============================================================
-- 11. SERVICE TYPES
--     Lookup table for service categories per company.
-- =============================================================
create table if not exists public.service_types (
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

create index if not exists idx_service_types_company_id on public.service_types(company_id);

alter table public.service_types enable row level security;

do $$ begin
  create policy "owner_all_service_types" on public.service_types
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_service_types" on public.service_types
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_company_service_types" on public.service_types
    for select using (
      public.my_role() = 'employee'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

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
create table if not exists public.authorizations (
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

create index if not exists idx_authorizations_company_id      on public.authorizations(company_id);
create index if not exists idx_authorizations_client_id       on public.authorizations(client_id);
create index if not exists idx_authorizations_service_type_id on public.authorizations(service_type_id);

alter table public.authorizations enable row level security;

do $$ begin
  create policy "owner_all_authorizations" on public.authorizations
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_authorizations" on public.authorizations
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_company_authorizations" on public.authorizations
    for select using (
      public.my_role() = 'employee'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_authorizations_updated_at
    before update on public.authorizations
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 14. DOCUMENTS
--     File attachments per client or schedule.
-- =============================================================
create table if not exists public.documents (
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

create index if not exists idx_documents_company_id  on public.documents(company_id);
create index if not exists idx_documents_client_id   on public.documents(client_id);
create index if not exists idx_documents_schedule_id on public.documents(schedule_id);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);

alter table public.documents enable row level security;

do $$ begin
  create policy "owner_all_documents" on public.documents
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_documents" on public.documents
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_own_documents" on public.documents
    for all using (
      public.my_role() = 'employee'
      and uploaded_by = auth.uid()
    );
exception when duplicate_object then null; end $$;


-- =============================================================
-- 15. PAY RATES
--     Employee compensation configuration.
-- =============================================================
create table if not exists public.pay_rates (
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

create index if not exists idx_pay_rates_company_id      on public.pay_rates(company_id);
create index if not exists idx_pay_rates_employee_id     on public.pay_rates(employee_id);
create index if not exists idx_pay_rates_service_type_id on public.pay_rates(service_type_id);

alter table public.pay_rates enable row level security;

do $$ begin
  create policy "owner_all_pay_rates" on public.pay_rates
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_pay_rates" on public.pay_rates
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_own_pay_rates" on public.pay_rates
    for select using (
      public.my_role() = 'employee'
      and employee_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_pay_rates_updated_at
    before update on public.pay_rates
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 16. INVOICES
--     Generated billing records.
-- =============================================================
do $$ begin
  create type public.invoice_status as enum (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.invoices (
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

create index if not exists idx_invoices_company_id on public.invoices(company_id);
create index if not exists idx_invoices_client_id  on public.invoices(client_id);
create index if not exists idx_invoices_status     on public.invoices(status);

alter table public.invoices enable row level security;

do $$ begin
  create policy "owner_all_invoices" on public.invoices
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_invoices" on public.invoices
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_company_invoices" on public.invoices
    for select using (
      public.my_role() = 'employee'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_invoices_updated_at
    before update on public.invoices
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 17. NOTIFICATIONS
--     In-app notification queue.
-- =============================================================
create table if not exists public.notifications (
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

create index if not exists idx_notifications_company_id on public.notifications(company_id);
create index if not exists idx_notifications_user_id    on public.notifications(user_id);
create index if not exists idx_notifications_is_read    on public.notifications(is_read);

alter table public.notifications enable row level security;

do $$ begin
  create policy "owner_all_notifications" on public.notifications
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_notifications" on public.notifications
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_own_notifications" on public.notifications
    for all using (
      public.my_role() = 'employee'
      and user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;


-- =============================================================
-- 18. AUDIT LOG
--     Change tracking for compliance.
-- =============================================================
create table if not exists public.audit_log (
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

create index if not exists idx_audit_log_company_id  on public.audit_log(company_id);
create index if not exists idx_audit_log_user_id     on public.audit_log(user_id);
create index if not exists idx_audit_log_table_name  on public.audit_log(table_name);
create index if not exists idx_audit_log_record_id   on public.audit_log(record_id);

alter table public.audit_log enable row level security;

do $$ begin
  create policy "owner_all_audit_log" on public.audit_log
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_audit_log" on public.audit_log
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_own_audit_log" on public.audit_log
    for select using (
      public.my_role() = 'employee'
      and user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;


-- =============================================================
-- 19. TEMPLATES
--     Case note / visit note templates.
-- =============================================================
create table if not exists public.templates (
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

create index if not exists idx_templates_company_id      on public.templates(company_id);
create index if not exists idx_templates_service_type_id on public.templates(service_type_id);

alter table public.templates enable row level security;

do $$ begin
  create policy "owner_all_templates" on public.templates
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_templates" on public.templates
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_company_templates" on public.templates
    for select using (
      public.my_role() = 'employee'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_templates_updated_at
    before update on public.templates
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- =============================================================
-- 20. AVAILABILITY
--     Employee working hours and time-off config.
-- =============================================================
create table if not exists public.availability (
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

create index if not exists idx_availability_company_id  on public.availability(company_id);
create index if not exists idx_availability_employee_id on public.availability(employee_id);

alter table public.availability enable row level security;

do $$ begin
  create policy "owner_all_availability" on public.availability
    for all using ( public.my_role() = 'owner' );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_availability" on public.availability
    for all using (
      public.my_role() = 'admin'
      and company_id = public.my_company_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "employee_own_availability" on public.availability
    for all using (
      public.my_role() = 'employee'
      and employee_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_availability_updated_at
    before update on public.availability
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
