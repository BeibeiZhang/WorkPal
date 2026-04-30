# WorkPal

AI workplace assistant desktop app prototype.

## Stack
- React 18 + TypeScript + Vite 6 + Tailwind CSS 3
- lucide-react for icons
- No backend — pure frontend prototype with simulated AI flows

## Design System
**Figma file:** `vpMqEZURIWcE8F40GBQJju`

All design tokens, color variables, typography, spacing, and component-to-code mappings are documented in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). When implementing or modifying UI from Figma designs, always reference this file to ensure 100% alignment with the Figma component library.

The design system is also published as a personal Claude Code Skill at `~/.claude/skills/workpal-design-system/`. The four materialized files (`DESIGN_SYSTEM.md`, `src/index.css`, `tailwind.config.js`, `src/components/shared.tsx`) are **auto-synced** to the Skill via local git hooks (`post-commit`, `post-merge`, `post-rewrite`) — no manual copying needed. To force a sync: `npm run sync:skill`. To verify: `npm run check:skill-drift`. Hook script lives at [`scripts/sync-design-system-skill.sh`](./scripts/sync-design-system-skill.sh).

Key rules:
- Use CSS variables from `src/index.css` for all colors (supports light/dark mode)
- Use Tailwind shortcuts: `text-text-primary`, `bg-bg-hover`, `border-stroke-outline`
- Brand gradient: `#7652B9 → #B46470 → #CA9D8C` (see `.gradient-text`, `.gradient-btn`, `.chip-gradient-hover`)
- Chips use `.chip-gradient-hover` for gradient border on hover
- StatusTag: `bg: rgba(2,137,1,0.1)`, `color: #028901`
- Active nav item: gradient border (brand gradient via `background-clip`) + spinner
- All icons in dark mode use `.icon-theme` class for auto-inversion
- **Shared-first:** Always build reusable UI in `src/components/shared.tsx` first, then import into app pages. This ensures the Design System page monitors all shared components and updates propagate everywhere automatically.

### Violations (NEVER do this)

These bypass the design system and create silent drift. They are **always wrong**, even when no exact token / primitive seems to fit:

- ❌ **Hex / rgba colors in className**: `text-[#B42318]`, `bg-[#7652B9]`, `border-[rgba(...)]`
- ❌ **Inline style colors**: `style={{ color: '#B42318' }}`, `style={{ background: 'rgba(...)' }}`
- ❌ **Tailwind alpha modifiers on color classes**: `text-text-primary/60`, `bg-bg-message/40`, `border-stroke-outline/30`. **Silently fails** — design tokens are stored as `rgba(...)` literals (see `src/index.css`), not RGB triplets, so Tailwind's alpha-modifier syntax finds no rule to apply and the element falls back to inherited / browser-default color (often making secondary text look as dark as primary). The fix is **never** the modifier — pick the closest existing token (`text-text-secondary` is rgba .6, `text-text-tertiary` is rgba .4, already registered). If you need a finer step, add a new token in `src/index.css` (light + dark blocks) and register in `tailwind.config.js`.
- ❌ **Hardcoded font sizes / line heights**: `text-[14px]`, `text-base`, `text-sm`, `leading-[20px]`, `tracking-[0.2px]`, `font-bold`, `font-medium` (per `feedback_typography_tokens` — every text surface uses `.type-*` class)
- ❌ **Component code inline in a page** when the same shape will recur — write it in `shared.tsx` first

### Missing token / primitive? Extend, don't bypass

Design system is **living scaffolding, not a ceiling**. When you can't find what you need:

- **Need a color that's not in tokens** → add a CSS variable to `src/index.css` (light + dark blocks) + register it in `tailwind.config.js` `colors:` map → use the new class everywhere. *Example: error red `#B42318` was hardcoded across 3 files because no `--color-error` token existed; the right move was always to add the token, not to ad-hoc hex.*
- **Need a type scale that's not in `.type-*`** → add a `.type-foo` class in `src/index.css` → use it everywhere.
- **Need a UI primitive that doesn't exist in `shared.tsx`** → build it in `shared.tsx` (with the existing card sectioning patterns), then import. Design System page will pick it up automatically.

A good UI PR often touches `src/index.css` + `tailwind.config.js` + `shared.tsx` *more* than the page being built — that's the design system absorbing what you needed. Never write a one-off hex / px / inline-style to "save time" — the next person hits the same gap, and the system never converges.

## Dev
```bash
npm run dev   # starts on port 5173
```

## Key Files
- `src/App.tsx` — root state, AI flows, chat logic
- `src/data.ts` — pre-seeded demo conversations
- `src/types.ts` — TypeScript types
- `src/components/Sidebar.tsx` — left nav, chat list, user profile
- `src/components/ChatPanel.tsx` — main chat area, welcome state
- `src/components/ChatMessage.tsx` — message bubbles, feedback, chips
- `src/components/ChatInput.tsx` — text input, tool icons, quick chips
- `src/components/MessageCard.tsx` — meeting/research/ticket/schedule cards
