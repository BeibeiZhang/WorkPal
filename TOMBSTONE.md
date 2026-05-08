# 🪦 MIGRATED — Do not develop here

**WorkPal repo migrated to monorepo on 2026-05-08** (Phase 1.5 of cross-product design system architecture).

## New location

```
~/Code/beibei-apps/apps/workpal/
```

GitHub: https://github.com/BeibeiZhang/beibei-apps (private monorepo)

## Why migrated

WorkPal is now consumer of `@beibei/design-system` workspace package, sharing single SOT design system with Wingman + future products. See:
- Migration architecture: `~/.claude/plans/design-system-cross-product-architecture-clear-river.md`
- §64 Phase 1.5 migration plan: `~/.claude/plans/64-workpal-monorepo-migration-swift-river.md`
- §64 archive entry: `~/Code/beibei-apps/apps/workpal/docs/post-phase-6-archive.md`

## Production URLs (post-cutover)

Both URLs now serve from monorepo `apps/workpal/`:

- `workpal-beibei.vercel.app` (自用, real data) — Vercel project `beibei-apps-workpal`
- `my-workpal.vercel.app` (HR demo, mock data) — Vercel project `beibei-apps-workpal-demo` (env `VITE_WORKPAL_DEMO=true`)

## This CloudDocs repo

**Status**: historical artifact, rollback path only.

**Do NOT develop here** — changes will not propagate to production.

If you accidentally make commits here, they're orphaned. Move work to monorepo `~/Code/beibei-apps/apps/workpal/`.

## Rollback path (emergency only)

If monorepo migration fails catastrophically (unlikely after 4/4 CI green + e2e verified):

1. Vercel dashboard: revert `workpal-beibei.vercel.app` + `my-workpal.vercel.app` Vercel project root back to this repo
2. Re-enable any disabled hooks in `.git/hooks/`
3. Continue development here

This rollback is **last resort** — primary path is fix-forward in monorepo.

## Migration timestamp

- 2026-05-08T03:16:12Z — PR [#1 beibei-apps](https://github.com/BeibeiZhang/beibei-apps/pull/1) merged (commit `93b6330`)
- 2026-05-08 — Vercel cutover both URLs to monorepo build
