-- API spend tracking — every OpenAI / Anthropic / Tavily call lands one
-- row here. Feeds the Overview page's "API Spend" card and the Subscription
-- Health Check comparator. Until now the log lived in a local JSONL file on
-- the Express server, which meant the production Vercel deployment had
-- nothing to show — this table is what makes workpal-beibei.vercel.app
-- actually surface real numbers instead of "Free".
--
-- Append-only by design — no updates, no deletes from the app. Every row is
-- one completed API call. RLS stays open like the other tables; the anon
-- key is the only gate. Cost numbers aren't secret, but they're not worth
-- exposing to anyone other than Beibei either — the table is behind
-- workpal-beibei.vercel.app which is private-by-obscurity.

create table if not exists public.usage_log (
  id                 uuid primary key default gen_random_uuid(),
  ts                 timestamptz not null default now(),
  provider           text not null,     -- 'openai' | 'anthropic' | 'tavily'
  model              text not null,
  -- What the user was actually trying to do. Drives the Subscription Health
  -- Check: each capability maps to a different quota (chat ↔ Plus/Pro msg
  -- count, voice ↔ Plus's ~30h/mo, etc). 'other' keeps Tavily tool calls
  -- from double-counting against the triggering OpenAI turn's 'web_query'.
  capability         text,              -- 'chat' | 'voice' | 'web_query' | 'agent' | 'other'
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_read_tokens  integer,
  cache_write_tokens integer,
  images_count       integer,
  cost_usd           double precision not null default 0
);

-- Summarize queries always filter by `ts >= cutoff` for the 1/7/30-day
-- window, then aggregate. A descending index on ts makes that scan cheap
-- even once the log grows large.
create index if not exists usage_log_ts_idx
  on public.usage_log (ts desc);

alter table public.usage_log enable row level security;
create policy "usage_log_read_all"  on public.usage_log for select using (true);
create policy "usage_log_write_all" on public.usage_log for insert with check (true);
