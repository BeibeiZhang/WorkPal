# WorkPal

AI workplace assistant desktop app prototype.

## Stack
- React 18 + TypeScript + Vite 6 + Tailwind CSS 3
- lucide-react for icons
- No backend — pure frontend prototype with simulated AI flows

## Design System
**Figma file:** `vpMqEZURIWcE8F40GBQJju`

All design tokens, color variables, typography, spacing, and component-to-code mappings are documented in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). When implementing or modifying UI from Figma designs, always reference this file to ensure 100% alignment with the Figma component library.

The design system is also published as a personal Claude Code Skill at `~/.claude/skills/workpal-design-system/`. When `DESIGN_SYSTEM.md`, `src/index.css`, `tailwind.config.js`, or `src/components/shared.tsx` change here, copy the updated file into the Skill's `assets/` (or re-copy `DESIGN_SYSTEM.md` at the Skill root) to keep them in sync.

Key rules:
- Use CSS variables from `src/index.css` for all colors (supports light/dark mode)
- Use Tailwind shortcuts: `text-text-primary`, `bg-bg-hover`, `border-stroke-outline`
- Brand gradient: `#7652B9 → #B46470 → #CA9D8C` (see `.gradient-text`, `.gradient-btn`, `.chip-gradient-hover`)
- Chips use `.chip-gradient-hover` for gradient border on hover
- StatusTag: `bg: rgba(2,137,1,0.1)`, `color: #028901`
- Active nav item: gradient border (brand gradient via `background-clip`) + spinner
- All icons in dark mode use `.icon-theme` class for auto-inversion
- **Shared-first:** Always build reusable UI in `src/components/shared.tsx` first, then import into app pages. This ensures the Design System page monitors all shared components and updates propagate everywhere automatically.

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
