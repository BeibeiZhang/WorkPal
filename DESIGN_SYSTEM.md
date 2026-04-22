# WorkPal Design System

> Single source of truth for AI agents and engineers. Concise by design — live examples and interactive specs live in the in-app **Design System** page (`src/components/DesignSystemPage.tsx`). This file exists so agents can parse the system without reading React.
>
> **Golden rule:** the in-app Design System page is the canonical reference. Always check it before building. If you need a component, use the one from `src/components/shared.tsx`. If nothing fits, build a new one and register it in the **Review Queue** tab.

---

## 0. Architecture (must-read)

```
App Shell (src/App.tsx) = three panels, every surface plugs in as a slot
├── NavPanel          → src/components/Sidebar.tsx  (Sidebar · MiniSidebar)
├── ConversationPanel → ChatPanel · or any page via PageLayout
└── InspectorPanel    → DetailPanel · TaskContextPanel · SplitView side
```

**Source tree**
- `src/index.css` — CSS variables, utility classes, animations. **Edit tokens here.**
- `tailwind.config.js` — maps CSS vars → Tailwind utilities (`text-text-primary` etc).
- `src/components/shared.tsx` — all reusable primitives (36 exports).
- `src/components/*` — feature components (one panel/surface each).
- `src/components/DesignSystemPage.tsx` — live showcase, the canonical reference.

**Propagation rule:** every color, size, spacing, and radius is a token. Change `--color-*` or `--font-*` in `index.css` once → every component/page picks it up. Never hardcode hex values, px font sizes, or arbitrary spacing.

---

## 1. Foundations

### 1.0 Token index (materialized — one-shot lookup)

Every CSS variable with its resolved light / dark value. If you need a token, find it here first. Defined in `src/index.css` (:root + .dark).

```
# Surface & text
--color-text-primary          #142740              / #FFFFFF
--color-text-secondary        rgba(20,39,64,0.7)   / rgba(226,243,255,0.8)
--color-text-tertiary         rgba(20,39,64,0.4)   / rgba(226,243,255,0.4)
--color-bg-page               #F7F7F8              / #001424
--color-bg-message            rgba(20,39,64,0.05)  / rgba(226,243,255,0.1)
--color-bg-hover              rgba(20,39,64,0.05)  / rgba(226,243,255,0.1)
--color-card-panel-bg         #FFFFFF              / rgba(0,0,0,0.3)
--color-input-bg              var(--color-bg-page) / rgba(0,0,0,0.3)
--color-icon-primary          #142740              / #FFFFFF
--color-sidebar-bg            #F7F7F8              / #001424
--color-outer-bg              #F5F5F7              / #001424
--color-outer-border          #F5F5F7              / #001424
--color-stroke-outline        #E8E8E8              / rgba(115,178,255,0.2)
--color-stroke-toggle         #E6E8EA              / rgba(115,178,255,0.2)
--color-selected-bg           rgba(49,113,255,0.1) / #3171FF
--color-selected-text         #3171FF              / #FFFFFF
--color-progress-bar          —                    / #3171FF

# Semantic accents (mode-invariant)
--color-accent-blue           #3171FF
--color-accent-green          #028901
--color-accent-green-bg       rgba(2,137,1,0.1)
--color-accent-red            #C93838
--color-accent-amber          #A87725
--color-accent-orange         #B8541A
--color-accent-violet         #6B54E6
--color-accent-neutral        #6B7280

# Brand gradient stops
--brand-grad-start            #7652B9
--brand-grad-mid              #B46470
--brand-grad-end              #CA9D8C

# Typography
--font-display-size/lh/weight/tracking     40px / 48px / 700 / -0.5px
--font-h1-size/lh/weight/tracking          22px / normal / 700 / 0px
--font-body-size/lh/weight/tracking        16px / 32px / 400 (emph 700) / 0px
--font-h2-size/lh/weight/tracking          16px / 22px / 400 (emph 700) / 0px
--font-detail-size/lh/weight/tracking      14px / 22px / 400 (emph 700) / 0
--font-caption-size/lh/weight/tracking     12px / 16px / 400 / 0
--font-footnote-size/lh/weight/tracking    11px / 1   / 400 / 0

# Spacing (Tailwind-aligned)
--space-1..10                 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 px

# Radius
--radius-sm / md / lg / pill / shell       8 · 12 · 16 · 9999 · 40 px

# Component sizing (toolbar / composer)
--toolbar-btn-h               39px (<768) / 26px (≥768)   ToolbarPill, ToolbarIconButton, ToolbarSegmented height
--mode-btn-unselected-w       54px (<768) / 26px (≥768)   Width of unselected (icon-only) segment in ToolbarSegmented
--toolbar-icon-size           24px (<768) / 16px (≥768)   Icon size inside toolbar buttons
--input-btn-size              36px (<768) / 24px (≥768)   ChatInput send/tool button
```

**Rule:** never hardcode these values. If a value is missing, add a new var here first.

### 1.1 Color tokens (CSS variables, mode-aware)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-text-primary` | `#142740` | `#FFFFFF` | Headings, body, primary icons |
| `--color-text-secondary` | `rgba(20,39,64,0.7)` | `rgba(226,243,255,0.8)` | Descriptions, helper text |
| `--color-text-tertiary` | `rgba(20,39,64,0.4)` | `rgba(226,243,255,0.4)` | Disabled, muted metadata |
| `--color-bg-page` | `#F7F7F8` | `#001424` | Main surfaces |
| `--color-bg-message` / `--color-bg-hover` | `rgba(20,39,64,0.05)` | `rgba(226,243,255,0.1)` | Message bubbles, hover, input fields |
| `--color-card-panel-bg` | `#FFFFFF` | `rgba(0,0,0,0.3)` | CardShell background, DarkToggle pill, VoiceMode panel |
| `--color-input-bg` | `var(--color-bg-page)` | `rgba(0,0,0,0.3)` | ChatInput inner fill |
| `--color-sidebar-bg` | `#F7F7F8` | `#001424` | NavPanel surface |
| `--color-stroke-outline` | `#E8E8E8` | `rgba(115,178,255,0.2)` | Borders, dividers |
| `--color-stroke-toggle` | `#E6E8EA` | `rgba(115,178,255,0.2)` | Inputs, toggles |
| `--color-selected-bg` | `rgba(49,113,255,0.1)` | `#3171FF` | Active chip/filter |
| `--color-selected-text` | `#3171FF` | `#FFFFFF` | Active chip/filter label |
| `--color-accent-blue` | `#3171FF` | — | Links, @mentions, progress, focus |
| `--color-accent-green` / `-green-bg` | `#028901` / `rgba(2,137,1,0.1)` | — | StatusTag success only |
| `--color-accent-red` | `#C93838` | — | StatusTag failed, danger |
| `--color-accent-amber` | `#A87725` | — | StatusTag in-review |
| `--color-accent-orange` | `#B8541A` | — | StatusTag pending |
| `--color-accent-violet` | `#6B54E6` | — | StatusTag submitted, Maya's insight |
| `--color-accent-neutral` | `#6B7280` | — | StatusTag expired |

**Tailwind shortcuts:** `text-text-primary`, `text-text-secondary`, `bg-bg-page`, `bg-bg-hover`, `border-stroke-outline`.

### 1.2 Brand gradient (scarce — 1–2% page budget)

```
#7652B9 → #B46470 → #CA9D8C
CSS vars: --brand-grad-start, --brand-grad-mid, --brand-grad-end
```

| Class | Purpose |
|---|---|
| `.gradient-btn` | Primary CTA fill (`PrimaryButton`) |
| `.gradient-text` | Hero/welcome title text only |
| `.chip-gradient-hover` | Gradient border on chip hover (unselected) |
| `.input-gradient-hover` | Gradient border on input hover/focus |
| `.loading-dot` | Animated dots in 3-color sequence |

**Never** use brand gradient for body text, icons, data viz, progress bars, or >1 button per view.

### 1.3 Typography (11 styles, no more)

| Class | Size / LH / Weight / Tracking | Use |
|---|---|---|
| `.type-display` | 40 / 48 / 700 / −0.5 | Page H1 (only one per page) |
| `.type-h1` | 22 / normal / 500 / 0 | Brand wordmark, hero greetings (display-weight regular H1) |
| `.type-h1--emphasized` | 22 / normal / 700 / 0 | Section headers — top-level regions inside a page |
| `.type-body-emphasized` | 16 / 32 / 700 / 0 | Long-form section headings where loose 32px leading reads better (ArtifactPage category headers, DesignSystemPage checklists) |
| `.type-body` | 16 / 32 / 400 / 0 | Long-form paragraph copy (loose leading for multi-line reading) |
| `.type-h2-emphasized` | 16 / 22 / 700 / 0 | Default bold 16px title — card titles, SidePanel/SideCard titles, sidebar & page section headers, profile name |
| `.type-h2` | 16 / 22 / 400 / 0 | Chat messages (user + assistant), dialog inputs + textareas, onboarding prompts, drop-zone headers, side-panel file/change rows — the default 16px copy style |
| `.type-detail-emphasized` | 14 / 22 / 700 / 0 | Form labels, emphasized metadata, button labels |
| `.type-detail` | 14 / 22 / 400 / 0 | Helper text, captions, chip labels |
| `.type-caption` | 12 / 16 / 400 / 0 | Chart legends, mono code / command blocks (pair with `font-mono`), file path chips, diff stats |
| `.type-footnote` | 11 / 1 / 400 / 0 | Compact citation chips, micro pill labels (line-height collapses to 1) |

**Responsive rule:** detail scales up to **16px** on mobile (`<768px`, line-height stays 22px) so the smallest tier never drops below 16px on phones. Defined via a `@media (min-width: 768px)` override of `--font-detail-size` in `src/index.css`. No other token scales across breakpoints.

Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro', 'Inter', sans-serif`.

**Forbidden sizes:** 9, 10, 13, 17, 18, 24, 28, 32 px for running text. 11/12 are valid only via `.type-caption` / `.type-footnote`. Large display numbers inside cards (e.g. MetricCard's "+2h") are allowed; set inline.

### 1.4 Spacing (Tailwind scale only)

`p-1`=4 · `p-2`=8 · `p-3`=12 · `p-4`=16 · `p-5`=20 · `p-6`=24 · `p-8`=32 · `p-10`=40. Never arbitrary values like `gap-[9px]`.

### 1.5 Radius

| Token | Value | Use |
|---|---|---|
| `rounded-[4px]` | 4 | Gradient CTA button |
| `rounded-lg` | 8 | Cards, inputs |
| `rounded-xl` | 12 | Cards, side panels |
| `rounded-2xl` | 16 | Large cards |
| `rounded-full` | pill | Chips, StatusTag, nav items |
| `rounded-[40px]` | 40 | App outer shell only |

### 1.5a Elevation — one hover shadow, canonical

Every clickable card uses `.card-hover-shadow` (defined in `src/index.css`). Do **not** inline per-card `hover:shadow-[...]` values.

| Token | Value | Use |
|---|---|---|
| `--shadow-card-hover` | `0px 5px 8px 0px rgba(3,65,133,0.17)` light / `rgba(116,188,255,0.2)` dark | Every interactive card (ArtifactCard, ResearchCard, Artifact grid item, etc.) |

Spec: Figma nodes `6518:26127` (light) / `6521:26530` (dark). Source of truth: `.card-hover-shadow` class — apply it with `transition-shadow` built-in.

### 1.6 Icons — `lucide-react` only

- Import from `lucide-react`. No other icon libraries, no inline SVG.
- **Never** render an abbreviation or letter placeholder where an icon belongs.
- Sizes: `16` default · `20` sidebar/list · `24` toolbar/header. Snap to ramp.
- `strokeWidth` default `2`.
- Color via `currentColor` (inherits parent `text-*` class) or inline `style={{ color: 'var(--color-accent-X)' }}`.
- Monochrome PNG assets (not SVG) use `.icon-theme` for dark-mode auto-inversion.

---

## 2. Component Library (from `src/components/shared.tsx`)

Always try to satisfy a design need with one of these first.

### 2.0 Quick-table (one row per export)

Scan this first. Subsections §2.1–§2.7 have the deeper reference.

| Component | Category | Use when… | Key props |
|---|---|---|---|
| `HeaderBar` | Layout | Slim header for pages without PageLayout | `sidebarOpen`, `onToggleSidebar`, `headerRight?` |
| `PageLayout` | Layout | Canonical page shell: toggle bar → H1 → filters → body → footer | `title`, `filters?`, `footer?`, `maxWidth` |
| `SplitView` | Layout | Main + collapsible side column (auto-overlays on narrow) | `side`, `sideOpen`, `sideWidth`, `mainMinWidth` |
| `SidePanelHeader` | Layout | 64px header for any side panel | `title`, `onClose`, `closeIcon` |
| `SideCard` | Layout | Collapsible section inside side panels | `title`, `icon?`, `hasAdd?`, `defaultOpen?` |
| `SearchBox` | Input | Responsive search pill | `value`, `onChange`, `placeholder?` |
| `PrimaryButton` | Button | Single gradient CTA per view | `onClick`, `icon?`, `children` |
| `SecondaryButton` | Button | Inverted solid fill | `onClick`, `icon?`, `children` |
| `TertiaryButton` | Button | Bordered transparent | `onClick`, `icon?`, `children` |
| `ToolbarPill` | Toolbar | Labeled pill in a toolbar row, snaps to `--toolbar-btn-h` | `leading`, `children`, `trailing?`, `as?` |
| `ToolbarIconButton` | Toolbar | Icon-only square control, height = `--toolbar-btn-h` | `onClick`, `ariaLabel`, `children` |
| `ToolbarSegmented` | Toolbar | Connected-segment pill (e.g. Chat/Tasks/Code) | `value`, `onChange`, `segments[]` |
| `Switch` | Toolbar | Binary segmented toggle (h-8, Review Queue) | `value`, `onChange`, `segments[]` |
| `Tooltip` | Overlay | Dark hover tooltip for icon-only triggers | `label`, `children` |
| `FilterChip` | Chip | Toggle-able filter pill | `active`, `icon?`, `count?`, `onClick` |
| `StatusTag` | Tag | Semantic pill (8 variants) | `variant`, `size?`, `icon?`, `children` |
| `Tag` | Tag | Neutral pill | `children`, `size?` |
| `TimePill` | Tag | Neutral + User icon + time string | `time` |
| `DemoBadge` | Tag | "Demo" pill that opens an About-this-demo modal | — (gated by `VITE_WORKPAL_DEMO`) |
| `SectionTitle` | Row | Emoji + title + optional count | `emoji`, `title`, `count?` |
| `SolutionRow` | Row | Emoji + title + desc + right tag | `emoji`, `title`, `desc`, `tag?` |
| `SummaryFooter` | Row | Clock + summary text (section footer) | `children` |
| `HealthDimensionRow` | Row | Icon + label + desc + auto-colored StatusTag | `icon`, `label`, `desc`, `value`, `target` |
| `ReviewItemCard` | Row | Review row: auto-icon + metadata + action | `title`, `meta`, `action` |
| `ConnectorCard` | Row | Connector/integration row: logo + name + Connect/Connected | `name`, `logo`, `connected?`, `onConnect?`, `onDisconnect?` |
| `MetricCard` | Card | Centered label + big number + subtitle | `label`, `value`, `subtitle?` |
| `InsightCard` | Card | "Maya's insight" card with actions | `title`, `body`, `actions?` |
| `TaskProgressCard` | Card | Collapsible progress card with step list | `title`, `steps`, `defaultOpen?` |
| `ArtifactCard` | Card | Compact file/artifact card; icon auto-derived from type | `artifact`, `onClick?` |
| `EmptyState` | Card | Centered icon + title + optional description for empty sections | `icon`, `title`, `description?` |
| `ProgressBar` | Data viz | Horizontal bar 0–100 | `value`, `label?` |
| `CategoryBreakdown` | Data viz | Stacked % bar + color-dot legend | `categories: {label,pct,color}[]` |
| `StepIndicator` | Data viz | done / in-progress / pending step glyph | `status` |
| `AreaChart` | Data viz | Smooth single-series area chart (ResizeObserver width) | `data`, `color?`, `height?` |

**Decision shortcut:** button → `PrimaryButton`/`SecondaryButton`/`TertiaryButton`. Pill → `StatusTag` (semantic) / `FilterChip` (toggle) / `Tag` (neutral). Layout → `PageLayout` (full page) / `SplitView` (+ side panel) / `HeaderBar` (bare header only). Toolbar row → `ToolbarPill`/`ToolbarIconButton`/`ToolbarSegmented` (all snap to `--toolbar-btn-h`).

### 2.1 Layout primitives

| Component | Purpose | Key props |
|---|---|---|
| `PageLayout` | Canonical page shell: 48px toggle bar → H1 → filters → scroll body → footer | `title`, `filters?`, `footer?`, `maxWidth: 'full'\|'reading'` |
| `HeaderBar` | Slim header for pages without PageLayout (ChatPanel) | `sidebarOpen`, `onToggleSidebar`, `headerRight?` |
| `SplitView` | Main + collapsible side column. Auto-overlays on narrow viewports | `side`, `sideOpen`, `sideWidth`, `mainMinWidth` |
| `SidePanelHeader` | Shared 64px header for any side panel | `title`, `onClose`, `closeIcon: 'x'\|'panel-right'` |
| `SideCard` | Collapsible section card inside side panels | `title`, `icon?`, `hasAdd?`, `defaultOpen?` |

### 2.2 Buttons (three-tier — one Primary per view, max)

| Component | Tier | Style |
|---|---|---|
| `PrimaryButton` | Gradient CTA | `.gradient-btn`, `rounded-[4px]` — only ONE per view |
| `SecondaryButton` | Inverted solid | Black bg light / white bg dark |
| `TertiaryButton` | Bordered transparent | `.chip-gradient-hover` on hover |

### 2.2a Toolbar primitives (ChatInput composer + similar)

All snap to `--toolbar-btn-h` so they line up vertically in one row.

| Component | Use |
|---|---|
| `ToolbarPill` | Labeled pill with leading icon, optional trailing node. Renders as `<button>` or `<label>` (wrap a checkbox so clicking the pill toggles it). |
| `ToolbarIconButton` | Icon-only square control; width = height = `--toolbar-btn-h`. Pair with `Tooltip` so the label stays discoverable. |
| `ToolbarSegmented<T>` | Connected-segment pill. Selected segment expands to show icon + label; unselected collapse to icon-only (`--mode-btn-unselected-w`). Generic over segment-value type. |
| `Switch<T>` | Binary segmented toggle (h-8) — always shows both labels. Smaller cousin of ToolbarSegmented, for rows of metadata. Lives in the Review Queue until promoted. |
| `Tooltip` | Dark-bg hover tooltip for icon-only triggers (black bg, white text, shows above). |

### 2.3 Tags, chips, pills

| Component | Use |
|---|---|
| `StatusTag` | Semantic pill, 8 variants: `pending · in-progress · submitted · in-review · success · failed · expired · neutral`. Two sizes: `sm` / `md`. Optional `icon`. |
| `Tag` | Neutral pill alias of StatusTag (no variant) |
| `TimePill` | Neutral + User icon + time string |
| `FilterChip` | Active/inactive toggle pill with optional `icon` + `count` |
| `DemoBadge` | "Demo" pill + info modal. Only rendered in demo builds (`VITE_WORKPAL_DEMO`). |

### 2.4 Progress / data

| Component | Purpose |
|---|---|
| `ProgressBar` | Horizontal bar 0–100 · optional label |
| `CategoryBreakdown` | Stacked % bar + color-dot legend (stress / workload breakdowns) |
| `StepIndicator` | `done` / `in-progress` / `pending` step glyph |
| `AreaChart` | Smooth single-series area chart, fills container width |
| `MetricCard` | Centered label + big number + subtitle |

### 2.5 Rows & cards

| Component | Purpose |
|---|---|
| `SectionTitle` | Emoji + title + optional count |
| `InsightCard` | "Maya's insight" card with actions |
| `TaskProgressCard` | Collapsible progress card with step list |
| `ReviewItemCard` | Review row: auto-icon + metadata + action |
| `HealthDimensionRow` | Icon + label + desc + auto-colored StatusTag (colored by value/target ratio) |
| `SolutionRow` | Emoji + title + desc + right tag |
| `SummaryFooter` | Clock + summary text (section footer) |
| `ConnectorCard` | Logo + name + Connect/Connected pill (with optional disconnect menu). Used in ConnectorsPage grids. |
| `ArtifactCard` | Compact artifact/file card; icon auto-derived from `artifact.fileType` via `outputIconFor()`. |
| `EmptyState` | Centered icon-in-pill + title + optional description for empty sections (new-project Output, Recents, etc). |

### 2.6 Inputs

| Component | Purpose |
|---|---|
| `SearchBox` | Responsive search — expanded pill (desktop) / icon-expands (mobile) |

### 2.7 Feature components (`src/components/*`, live via live-preview in DS page)

| Component | Panel | Purpose |
|---|---|---|
| `Sidebar` / `MiniSidebar` | NavPanel | Full / collapsed nav |
| `ChatPanel` | ConversationPanel | Chat surface — welcome state + messages + input |
| `ChatMessage` | ConversationPanel | Single bubble (user or assistant) |
| `ChatInput` | ConversationPanel | Composer with Chat/Tasks/Code modes |
| `MessageCard` | ConversationPanel | 5 variants: `meeting · research · ticket · schedule · agent` |
| `DetailPanel` | InspectorPanel | Document viewer with AI transform actions |
| `TaskContextPanel` | InspectorPanel | Progress + folder + context + tools (4 SideCards) |
| `NewProjectDialog` | Modal | Create project flow |
| `OverviewPage` / `LibraryPage` / `ConnectorsPage` / `ProjectPage` / `Onboarding` / `ComingSoonPage` | ConversationPanel (full page) | Top-level pages using PageLayout |

---

## 3. Design Principles

1. **Shared-first.** Build in `shared.tsx`, import into pages. Never copy component code inline.
2. **Tokens-first.** Use CSS variables / utility classes. Never hardcode hex, px font size, or arbitrary spacing.
3. **One Primary button per view.** Multiple gradient CTAs = violation.
4. **1–2% gradient budget.** The brand gradient is a focal point, not decoration.
5. **Callouts are blue (`#3171FF`), not gradient.** Selected chips, links, progress, focus.
6. **StatusTag success green is unique.** Only `--color-accent-green` / `-green-bg`. Not used anywhere else.
7. **11 text styles only.** `.type-display` / `.type-h1` / `.type-h1--emphasized` / `.type-body` / `.type-body-emphasized` / `.type-h2` / `.type-h2-emphasized` / `.type-detail` / `.type-detail-emphasized` / `.type-caption` / `.type-footnote`.
8. **Icons = lucide-react.** Never render letters or abbreviations as icon stand-ins. Never import other icon libraries.
9. **Dark-mode automatic.** All colors come from CSS vars bound to `:root` / `.dark`. PNGs use `.icon-theme`. Lucide SVGs inherit `currentColor`.
10. **Three-panel shell.** Every feature is a slot in NavPanel / ConversationPanel / InspectorPanel. No new top-level chrome.
11. **Review queue for new components.** If a need truly can't be met by `shared.tsx`, build it, then register it under the Design System **Review Queue** tab for explicit approval. Approved → promote into `shared.tsx`. Rejected → revert to closest existing component.

### 3.1 When in doubt — decision tree

```
Need a button?
  └─ primary CTA (one per view)       → PrimaryButton
  └─ secondary emphasis               → SecondaryButton
  └─ tertiary / bordered              → TertiaryButton

Need a pill / tag?
  └─ status meaning (success/fail/…) → StatusTag + variant
  └─ on/off filter                    → FilterChip
  └─ neutral label                    → Tag
  └─ shows a time                     → TimePill

Need a page shell?
  └─ full standard page                → PageLayout
  └─ page + side column                → PageLayout inside SplitView(main, side)
  └─ bare header only (e.g. chat)      → HeaderBar

Need a side panel?
  └─ wrap in SplitView.side
  └─ section inside it                 → SideCard (collapsible)
  └─ panel header                      → SidePanelHeader

Need a card?
  └─ single metric                     → MetricCard
  └─ insight / callout                 → InsightCard
  └─ progress + steps                  → TaskProgressCard
  └─ artifact / file                   → ArtifactCard
  └─ connector / integration row       → ConnectorCard
  └─ empty section placeholder         → EmptyState

Need a toolbar control (ChatInput-style)?
  └─ labeled pill                      → ToolbarPill
  └─ icon-only square                  → ToolbarIconButton (+ Tooltip)
  └─ connected segments (Chat/Tasks…)  → ToolbarSegmented
  └─ binary on/off                     → Switch (Review Queue)

Need data viz?
  └─ linear 0–100                      → ProgressBar
  └─ % breakdown (categories → 100%)   → CategoryBreakdown
  └─ step glyph                        → StepIndicator
  └─ single-series area                → AreaChart

Nothing fits? → build in shared.tsx, register in Review Queue.
```

---

## 4. CSS utility reference (`src/index.css`)

| Class | Effect |
|---|---|
| `.type-display` / `.type-h1` / `.type-h1--emphasized` / `.type-body` / `.type-body-emphasized` / `.type-h2` / `.type-h2-emphasized` / `.type-detail` / `.type-detail-emphasized` / `.type-caption` / `.type-footnote` | Type scale |
| `.gradient-btn` | Primary CTA gradient fill + shadow |
| `.gradient-text` | Brand gradient text |
| `.chip-gradient-hover` | Unselected chip: gradient border on hover (`padding-box/border-box`) |
| `.input-gradient-hover` | Input: gradient border on focus/hover |
| `.toolbar-gradient-hover` | Dark-mode-only gradient border for toolbar buttons |
| `.icon-theme` | PNG auto-invert in dark mode |
| `.app-bg` | Page background (white light / radial blobs dark) |
| `.message-appear` | fadeInUp, 0.2s ease-out |
| `.loading-dot` | 3-dot loader (brand colors, 1.4s) |
| `.animate-progress-bar` | 0→100% fill, 2.5s ease-in-out |
| `.scrollbar-autohide` | Thin scrollbar, hidden until hover |

---

## 5. Agent workflow when building UI

1. Open the Design System page (Foundations tab) → confirm token you need exists; if not, add a CSS var in `src/index.css` first.
2. Layouts tab → identify which panel the feature slots into.
3. Component Library tab → find an existing component. **Compose, don't build.**
4. If and only if no existing component can do the job:
   - Build the new component in `src/components/shared.tsx` (not inline in a page).
   - Add a new entry to the Review Queue in `DesignSystemPage.tsx` → `ReviewTab` with `name`, `builtFor`, `reason`, `closestExisting`, and a live `preview`.
5. Re-read the 11 Principles (§3). Verify none are violated.
6. Run `npm run dev` → open `/` → click through to Design System → visually confirm the component appears and renders in both light and dark mode.

---

## 6. Reusing this as a skill in another project

Everything needed to port this system:
- Copy `src/index.css` (tokens + utilities).
- Copy `tailwind.config.js` (token → Tailwind mapping).
- Copy `src/components/shared.tsx` (primitives).
- Copy `src/components/DesignSystemPage.tsx` (reference surface).
- Rewrite section §2.7 (feature components) for the new app.
- Keep §3 (Principles) verbatim.

---

## 7. Review — open questions

Items observed while syncing this doc on 2026-04-21 where the "right" answer isn't obvious. Each one is a candidate for either (a) blessing and documenting, (b) rolling back into a unified token/component, or (c) leaving as-is with a note. Resolve in a design pass rather than silently fixing.

### 7.1 Tokens — possible duplication or drift

1. **`--color-bg-message` and `--color-bg-hover` have identical values** in both modes (`rgba(20,39,64,0.05)` light / `rgba(226,243,255,0.1)` dark). Are these kept separate for future semantic divergence, or should they collapse into one token (e.g. `--color-surface-subtle`)?
2. **Several dark-mode tokens flatten to `#001424`** — `--color-bg-page`, `--color-sidebar-bg`, `--color-outer-bg`, `--color-outer-border`. Light mode still distinguishes page (`#F7F7F8`) from outer shell (`#F5F5F7`). Was the dark flattening intentional (single charcoal canvas) or accidental?
3. **`--color-sidebar-bg` now equals `--color-bg-page`** in both modes. Previously the sidebar had its own fill. If the merge is intentional, the sidebar token may be redundant.
4. **`--color-bg-page` changed from `#FFFFFF` to `#F7F7F8`** — light mode now has a warm off-white page. Worth an explicit note in the token table about why (reduces contrast fatigue vs pure white?) so agents don't "fix" it back to white.

### 7.2 Hardcoded colors outside the token system

5. **Chart series colors in `OverviewPage` bypass `--color-accent-*`** — `STRESS_SOURCES` uses `#EF4444`, `#F59E0B`, `#7652B9`, `#3171FF`; Weekly Trends stroke gradient uses `#DC2626 / #F59E0B / #16A34A`; Energy/Sleep/Stress series use `#3171FF / #8B5CF6 / #028901`. Should data-viz have its own palette tokens (`--dataviz-1..N`) or re-use `--color-accent-*` where values match?
6. **`ConnectorCard` hardcodes a dark fill** — `dark:bg-[rgba(226,243,255,0.05)]` inline. Same literal appears in `OverviewPage.tsx` (stress-detail panel). Candidate for a `--color-surface-subtle` token in dark mode.

### 7.3 Text size escape hatches

7. **Inline `text-[13px]` / `text-[11px]`** appear in `ConnectorCard` (name label, Connect button) and `DemoBadge` (Demo pill text). Principle §1.3 forbids these sizes for running text. Are these controls explicitly exempted (UI chrome), or drift to be pulled back into `.type-detail` (14px) / the `sm` StatusTag size?

### 7.4 Emoji vs Lucide drift

8. **`SectionTitle` and `SolutionRow` still take `emoji: string` props.** Meanwhile Overview-page Work/Family/Self tags and Impact cards just migrated from emoji to Lucide icons (2026-04-21). If we're steering toward Lucide-everywhere, the two shared components should accept `icon?: LucideIcon` too (emoji fallback optional) so new callers don't re-introduce the pattern.
9. **`DemoExplainerModal` bullet list still uses emoji** (`✨ 📂 🤖 📊 ⚖️`). It's a demo-only surface but lives in `shared.tsx`. Consistent with #8 — decide if emoji is OK in demo/marketing copy vs forbidden system-wide.

### 7.5 Review Queue status

10. **`Switch<T>` is documented as "Review Queue"** in its own JSDoc. The Review Queue tab in `DesignSystemPage.tsx` should confirm it's registered there with a preview and promotion criteria; otherwise it's floating between "shared primitive" and "pending".
