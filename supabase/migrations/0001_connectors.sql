-- Connectors table — tracks per-integration connection state and OAuth tokens.
-- Already applied to the WorkPal Supabase project (apgcbhysaocinzbncdmt); kept
-- in the repo for record-keeping and for future local/preview environments.

create table if not exists public.connectors (
  id            text primary key,                             -- matches Connector.id: 'gmail', 'slack', ...
  status        text not null default 'disconnected'
                check (status in ('connected', 'disconnected')),
  connected_at  timestamptz,
  metadata      jsonb not null default '{}'::jsonb,           -- { email?: string, ... }
  tokens        jsonb                                         -- OAuth credential bundle; null for mock connectors
);

alter table public.connectors enable row level security;

-- Open policies for the prototype. Tighten later when auth is introduced:
-- the API routes already gate writes behind the MEMORY_PASSWORD header.
create policy "connectors_read_all"   on public.connectors for select using (true);
create policy "connectors_write_all"  on public.connectors for insert with check (true);
create policy "connectors_update_all" on public.connectors for update using (true);
create policy "connectors_delete_all" on public.connectors for delete using (true);
