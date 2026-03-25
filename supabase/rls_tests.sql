-- =============================================================
-- RLS SMOKE TESTS — run these in Supabase SQL Editor
-- to verify tenant isolation before writing any frontend code.
-- =============================================================

-- Impersonate a specific user by auth.uid() override (Supabase Studio only)
-- Replace with a real employee UUID from your auth.users table.

-- ── Test 1: Company code resolution (unauthenticated) ────────
-- Should return 1 row for valid code, 0 rows for junk.
select * from public.resolve_company_code('ACME-A1B2');   -- expects 1 row
select * from public.resolve_company_code('NOPE-0000');   -- expects 0 rows
select * from public.resolve_company_code('acme-a1b2');   -- case-insensitive, expects 1 row

-- ── Test 2: my_company_id() returns correct tenant ──────────
-- Set role to authenticated + uid to a known user, then:
select public.my_company_id();   -- must match that user's company_id

-- ── Test 3: Employee cannot see other employees' schedules ──
-- Log in as employee Bob, then:
select * from public.schedules;   -- should only return rows where employee_id = Bob's id

-- ── Test 4: Admin sees ALL schedules within their company ───
-- Log in as Admin Alice, then:
select * from public.schedules;   -- should return all Acme schedules, not Bright Services rows

-- ── Test 5: Cross-tenant isolation ──────────────────────────
-- Log in as any Acme user, then:
select * from public.clients;     -- must NOT return Bright Services clients
select * from public.users;       -- must NOT return Bright Services users
