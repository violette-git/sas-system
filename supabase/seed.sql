-- =============================================================
-- SEED DATA — for local development / Supabase Studio testing
-- Run AFTER schema.sql
-- =============================================================

-- 1. Create two demo companies
insert into public.companies (id, name, trade_name, access_code) values
  ('11111111-0000-0000-0000-000000000001', 'Acme Cleaning Co.',   'Acme Cleaning',   'ACME-A1B2'),
  ('22222222-0000-0000-0000-000000000002', 'Bright Services LLC', 'Bright Services', 'BRGT-C3D4');

-- 2. Manually insert user profiles AFTER creating auth accounts in Supabase
--    (Replace UUIDs with real auth.users IDs from the Supabase Auth dashboard)
--
-- insert into public.users (id, company_id, full_name, email, role) values
--   ('aaaaaaaa-...', null,                                   'Platform Owner', 'owner@yourdomain.com', 'owner'),
--   ('bbbbbbbb-...', '11111111-0000-0000-0000-000000000001', 'Alice Admin',    'alice@acme.com',       'admin'),
--   ('cccccccc-...', '11111111-0000-0000-0000-000000000001', 'Bob Employee',   'bob@acme.com',         'employee');

-- 3. Demo clients for Acme
insert into public.clients (id, company_id, name, address_line1, city, state, zip) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Main Street Office',  '123 Main St',  'Springfield', 'IL', '62701'),
  ('c1000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'Riverside Plaza',     '456 River Rd', 'Springfield', 'IL', '62702');
