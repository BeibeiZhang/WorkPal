-- §58: capture client-side JS errors + unhandled rejections from production
-- (workpal-beibei.vercel.app) and localhost dev. Demo URL (my-workpal) is
-- short-circuited client-side by IS_DEMO; rows here from 'my-workpal' indicate
-- a misconfiguration (same convention as usage_log.source).
--
-- reviewed flag is the v1 dedup mechanism: /api/error-summary returns
-- reviewed=false rows only, so a fix-and-deploy cycle naturally drops the
-- entry from "Needs Your Eyes" once the bug stops firing within the 7-day
-- window. No "mark reviewed" UI yet — defer until the auto-flow proves
-- insufficient.

create table if not exists public.error_log (
  id uuid primary key default gen_random_uuid(),
  msg text not null,
  stack text,
  url text,
  ua text,
  source text,
  ts timestamptz not null default now(),
  reviewed boolean not null default false
);

create index if not exists error_log_ts_idx on public.error_log (ts desc);
create index if not exists error_log_unreviewed_idx
  on public.error_log (reviewed, ts desc) where reviewed = false;

alter table public.error_log enable row level security;
create policy "error_log_read_all" on public.error_log for select using (true);
create policy "error_log_write_all" on public.error_log for insert with check (true);
