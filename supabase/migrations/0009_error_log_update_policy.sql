-- §59: PATCH /api/errors needs UPDATE on error_log to mark a msg-group
-- reviewed. Migration 0008 enabled RLS with SELECT + INSERT policies only,
-- so the v1 "no Mark reviewed UI yet" comment held — but §59 ships that
-- UI, and without a permissive UPDATE policy the PATCH would silently
-- affect 0 rows (Supabase RLS denies by default). Permissive shape mirrors
-- error_log_write_all from 0008; the password gate in /api/errors is the
-- real authorization (anon key never leaves the Vercel function).

create policy "error_log_update_all" on public.error_log
  for update using (true) with check (true);
