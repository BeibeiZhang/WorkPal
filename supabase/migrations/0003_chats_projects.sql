-- Cross-device persistence for the user's actual workspace state — chats
-- and projects. Until now both lived in localStorage only, which meant the
-- self-use deployment (workpal-beibei.vercel.app) saw a different history
-- on every browser. This is step 1 of the cross-device story; the C-plan
-- local agent is still independent.
--
-- Pattern matches memories / connectors / artifacts:
--   - RLS open, API layer is the actual gate (MEMORY_PASSWORD on both reads
--     and writes for chats — chat content is more sensitive than memory
--     metadata, so unlike memories we gate GET too).
--   - Per-row CRUD; no big blob columns.
--   - No FKs to projects.id even though chats.project_id points there —
--     project ids are code-side strings ('proj-1' style or UUID), and a
--     missing project shouldn't break the chat list.
--
-- Demo deployment (`workpal` Vercel project) has no SUPABASE_URL /
-- MEMORY_PASSWORD env, so even if the client tried it would 503; in
-- practice IS_DEMO short-circuits before any fetch.

create table if not exists public.chats (
  id                  text primary key,                          -- 'chat-...' (legacy) or randomUUID()
  title               text not null,
  last_message        text not null default '',
  project_id          text,                                       -- nullable; no FK
  is_draft            boolean not null default false,
  has_inspector       boolean,
  session_folder      text,
  folder_materialized boolean,
  session_completed   boolean,
  draft_prompt        text,
  messages            jsonb not null default '[]'::jsonb,         -- Message[] inline; attachments inline as data URLs
  timestamp           timestamptz not null,                       -- last-active time, drives sidebar order
  updated_at          timestamptz not null default now()
);

-- Sidebar lists chats newest-first; metadata endpoint returns this order.
create index if not exists chats_updated_idx
  on public.chats (updated_at desc);

-- ProjectPage filters chats by project; partial index so it only covers
-- the rows where it matters.
create index if not exists chats_project_idx
  on public.chats (project_id)
  where project_id is not null;

alter table public.chats enable row level security;
create policy "chats_read_all"   on public.chats for select using (true);
create policy "chats_write_all"  on public.chats for insert with check (true);
create policy "chats_update_all" on public.chats for update using (true);
create policy "chats_delete_all" on public.chats for delete using (true);


create table if not exists public.projects (
  id          text primary key,                                   -- 'proj-1' (seed) or randomUUID()
  name        text not null,
  description text,
  files       jsonb not null default '[]'::jsonb,                 -- Attachment[] — base64 data URLs
  outputs     jsonb not null default '[]'::jsonb,                 -- OutputItem[]
  updated_at  timestamptz not null default now()
);

create index if not exists projects_updated_idx
  on public.projects (updated_at desc);

alter table public.projects enable row level security;
create policy "projects_read_all"   on public.projects for select using (true);
create policy "projects_write_all"  on public.projects for insert with check (true);
create policy "projects_update_all" on public.projects for update using (true);
create policy "projects_delete_all" on public.projects for delete using (true);
