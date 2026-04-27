-- Per-project external reference directories. Lets the Claude Agent SDK
-- read external knowledge sources (e.g. ~/Documents/我的设计资料/) during
-- chats scoped to this project, in addition to the project's own worktree.
-- Wire-side: paths flow into the SDK's `additionalDirectories` option at
-- claudeChat call time. Path safety (absolute / exists / not a system dir /
-- not inside another project worktree) is enforced server-side in
-- server/src/lib/referenceDirs.ts on save AND re-validated on use.
--
-- Default empty array — every existing project keeps current behavior
-- unchanged. The column is dedicated rather than a generic metadata bag so
-- it stays typed end-to-end (string[] in ProjectRecord, no Record<string,
-- unknown> drift).

alter table public.projects
  add column if not exists reference_directories jsonb not null default '[]'::jsonb;
