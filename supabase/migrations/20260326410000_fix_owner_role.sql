-- Set the platform owner role correctly.
-- The owner is the earliest-created auth user (first to sign up),
-- or any user whose email metadata declares role = 'owner'.
-- Existing 'owner' rows are untouched.

UPDATE public.users
SET role = 'owner'::user_role,
    company_id = null
WHERE id IN (
  SELECT id FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'owner'

  UNION

  SELECT id FROM (
    SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
  ) first_user
)
AND role != 'owner'::user_role;
