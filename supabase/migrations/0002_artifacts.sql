-- Artifacts primitive — generic "shareable webpage generated from a template".
-- Candidate #3 from docs/post-phase-6-candidates.md. First shipped template is
-- bay-area-weekend (cron-generated on Thursday 8pm PT). Future kinds are just
-- new rows in a code-side template registry — the schema stays generic.
--
-- RLS follows the connectors + memories pattern: open policies, API layer
-- (server/src/routes/artifacts.ts) is the actual gate. All client reads go
-- through our own /api/artifacts/* routes; no browser-direct Supabase calls.

create table if not exists public.artifacts (
  id                uuid primary key default gen_random_uuid(),
  template_id       text not null,                            -- 'bay-area-weekend' | future templates
  slug              text not null unique,                     -- public URL segment, e.g. 'bay-area-weekend-2026-W16'
  kind              text not null
                    check (kind in (
                      'report', 'presentation', 'image', 'video',
                      'document', 'spreadsheet', 'note', 'webpage'
                    )),
  week_key          text,                                     -- ISO '2026-W16' for recurring; NULL for ad-hoc
  topic             text,                                     -- user-supplied topic for ad-hoc, e.g. 'SF 美食'
  lang_primary      text not null default 'en'
                    check (lang_primary in ('en', 'zh')),
  status            text not null default 'generating'
                    check (status in ('generating', 'ready', 'failed')),
  content_en        jsonb,                                    -- { title, summary, categories: [...] }
  content_zh        jsonb,                                    -- same shape, Chinese copy
  cover_image_url   text,
  project_id        text,                                     -- nullable; 'proj-1' style; no FK, projects are code-side
  chat_id           text,                                     -- nullable; source chat for chat-initiated artifacts
  error             text,                                     -- populated when status='failed'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Recurring idempotency: one row per (template, week). Chat-initiated rows
-- have week_key=NULL and are always new — partial index enforces uniqueness
-- only where it matters.
create unique index if not exists artifacts_template_week_unique
  on public.artifacts (template_id, week_key)
  where week_key is not null;

-- Latest-for-template lookup (OverviewPage unread card, Project Output).
create index if not exists artifacts_template_created_idx
  on public.artifacts (template_id, created_at desc);

-- ProjectPage Output filter.
create index if not exists artifacts_project_idx
  on public.artifacts (project_id)
  where project_id is not null;

-- LibraryPage + Overview read only ready rows; index narrows the scan.
create index if not exists artifacts_status_created_idx
  on public.artifacts (status, created_at desc);

alter table public.artifacts enable row level security;
create policy "artifacts_read_all"   on public.artifacts for select using (true);
create policy "artifacts_write_all"  on public.artifacts for insert with check (true);
create policy "artifacts_update_all" on public.artifacts for update using (true);
create policy "artifacts_delete_all" on public.artifacts for delete using (true);


create table if not exists public.artifact_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  template_id     text not null,                              -- matches code-side template registry
  schedule_cron   text not null,                              -- POSIX cron, e.g. '0 20 * * 4'
  tz              text not null default 'America/Los_Angeles',
  enabled         boolean not null default true,
  last_run_at     timestamptz,
  last_week_key   text,                                       -- dedupe guard so a cron retry in the same week is a no-op
  created_at      timestamptz not null default now()
);

create index if not exists artifact_subscriptions_enabled_idx
  on public.artifact_subscriptions (enabled)
  where enabled = true;

alter table public.artifact_subscriptions enable row level security;
create policy "artifact_subs_read_all"   on public.artifact_subscriptions for select using (true);
create policy "artifact_subs_write_all"  on public.artifact_subscriptions for insert with check (true);
create policy "artifact_subs_update_all" on public.artifact_subscriptions for update using (true);
create policy "artifact_subs_delete_all" on public.artifact_subscriptions for delete using (true);


-- Seed the one shipped recurring subscription. ON CONFLICT-safe by (template_id)
-- so re-running the migration doesn't duplicate.
insert into public.artifact_subscriptions (template_id, schedule_cron, tz, enabled)
select 'bay-area-weekend', '0 20 * * 4', 'America/Los_Angeles', true
where not exists (
  select 1 from public.artifact_subscriptions where template_id = 'bay-area-weekend'
);
