-- =============================================================
-- Phase 2: Add recurrence_rule column to schedules
-- Stores the recurrence config as JSONB (RecurrenceRule type)
-- =============================================================
alter table public.schedules
  add column if not exists recurrence_rule jsonb;

-- Optional: add a recurring_series_id to group instances of the same series
alter table public.schedules
  add column if not exists recurring_series_id uuid;

create index if not exists idx_schedules_recurring_series_id
  on public.schedules(recurring_series_id);
