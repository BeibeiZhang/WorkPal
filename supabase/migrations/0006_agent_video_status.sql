-- Cloud-backed status map for the welcome-state avatar video pool. Until
-- now the toggle in DesignSystemPage's Agent Videos tab wrote only to
-- localStorage (see src/agentVideos.ts top-of-file note). That kept the
-- self-use deployment (workpal-beibei.vercel.app) and the demo deployment
-- (workpal.vercel.app) on independent pools — Beibei pausing a clip on
-- workpal-beibei did nothing to the demo, which still rolled the full
-- 11-clip dice for every visitor.
--
-- Promotion shape: self-use is the single writer, demo is a cross-origin
-- read-only consumer. Pattern mirrors chats/projects from 0003 (RLS open,
-- API layer is the actual gate; dedicated typed columns instead of a
-- generic metadata bag, per the precedent set by 0005).
--
-- Sources are the same /animations/*.mp4 strings the AGENTS array in
-- src/agentVideos.ts hardcodes, so we store the path verbatim as the
-- primary key — no FK to a videos table because there *is* no videos
-- table; the pool is source-defined.

create table if not exists public.agent_video_status (
  src        text primary key,
  status     text not null default 'active'
             check (status in ('active', 'inactive', 'deleted')),
  updated_at timestamptz not null default now()
);

-- Map fits in a single fetch (~11 rows expected, capped by AGENTS in
-- source); no extra index beyond the primary key.

alter table public.agent_video_status enable row level security;
create policy "agent_video_status_read_all"   on public.agent_video_status for select using (true);
create policy "agent_video_status_write_all"  on public.agent_video_status for insert with check (true);
create policy "agent_video_status_update_all" on public.agent_video_status for update using (true);
create policy "agent_video_status_delete_all" on public.agent_video_status for delete using (true);
