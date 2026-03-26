-- Phase 4: Payroll & Billing
-- Add billing_rate to service_types
alter table public.service_types
  add column if not exists billing_rate numeric default 25;

-- Invoice line items for detail tracking
create table if not exists public.invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  description text not null,
  quantity    numeric not null default 1,
  unit_price  numeric not null,
  total       numeric generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now()
);
create index if not exists idx_invoice_line_items_invoice on public.invoice_line_items(invoice_id);
alter table public.invoice_line_items enable row level security;

do $$ begin
  create policy "owner_all_invoice_line_items" on public.invoice_line_items
    for all using (public.my_role() = 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_company_invoice_line_items" on public.invoice_line_items
    for all using (public.my_role() = 'admin' and company_id = public.my_company_id());
exception when duplicate_object then null; end $$;
