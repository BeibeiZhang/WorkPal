-- Track which deployment recorded a usage row, so the Overview page can
-- distinguish your own use from anyone hitting workpal-beibei.vercel.app.
-- Set by the frontend from window.location.hostname:
--   'localhost'        — your local `npm run dev`
--   'workpal-beibei'   — your self-use Vercel deployment (public URL)
--   'my-workpal'       — the demo deployment (writes are gated by IS_DEMO,
--                         so this should rarely appear; treat any rows here
--                         as a misconfiguration signal)
--   'unknown'          — fallback when hostname doesn't match any of the
--                         above (Vercel preview URLs, custom domains, etc.)
--
-- Nullable so existing rows (pre-migration) survive without backfill — they
-- show up as "unknown source" in the by_source breakdown.

alter table public.usage_log
  add column if not exists source text;
