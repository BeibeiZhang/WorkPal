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
--color-text-secondary        rgba(20,39,64,0.6)   / rgba(226,243,255,0.8)
--color-text-tertiary         rgba(20,39,64,0.4)   / rgba(226,243,255,0.4)
--color-bg-page               #F3F4F5              / #001424
--color-bg-message            rgba(20,39,64,0.05)  / rgba(226,243,255,0.1)
--color-bg-hover              rgba(20,39,64,0.05)  / rgba(226,243,255,0.1)
--color-card-panel-bg         #FFFFFF              / rgba(226,243,255,0.1)
--color-input-bg              rgba(20,39,64,0.05)  / rgba(0,0,0,0.2)
--color-input-bg-active       #FFFFFF              / rgba(0,0,0,0.2)
--color-icon-primary          #142740              / #FFFFFF
--color-sidebar-bg            #F3F4F5              / #001424
--color-outer-bg              #F5F5F7              / #001424
--color-outer-border          #F5F5F7              / #001424
--color-stroke-outline        rgba(20,39,64,0.1)   / rgba(115,178,255,0.2)
--color-stroke-toggle         rgba(20,39,64,0.1)   / rgba(115,178,255,0.2)
--color-selected-bg           rgba(49,113,255,0.1) / #3171FF
--color-selected-text         #3171FF              / #FFFFFF
--color-progress-bar          —                    / #3171FF

# Semantic accents (mode-invariant)
--color-accent-blue            #3171FF
--color-accent-blue-faint      rgba(49,113,255,0.1)
--color-accent-blue-faint-hover rgba(49,113,255,0.15)
--color-accent-green           #028901
--color-accent-green-bg        rgba(2,137,1,0.1)
--color-accent-red             #C93838
--color-accent-amber           #A87725
--color-accent-orange          #B8541A
--color-accent-violet          #6B54E6
--color-accent-neutral         #6B7280

# Form / inline error red (distinct from --color-accent-red status indicator)
--color-error                  #B42318              / #F97066

# Form / inline warning amber (distinct from --color-accent-amber status pill)
--color-warning                #F79009              / #FDB022

# Keyboard focus ring (WCAG 2.4.7) — consumed by global *:focus-visible rule
--color-focus-ring             #3171FF              / #73B2FF

# Inverted tooltip surface (dark in both modes)
--color-tooltip-bg             #1a1a1a

# Loading overlay over media previews (mode-flipped to invert dim direction)
--color-overlay-loading        rgba(0,0,0,0.4)      / rgba(255,255,255,0.4)

# Foreground locked to light-mode primary, regardless of theme.
# For colored cover surfaces (Library tile peach, ComingSoon pink) where
# theme-aware text-text-primary would flip to white-on-peach unreadable.
--color-fixed-dark-text        #142740

# Brand gradient stops
--brand-grad-start            #7652B9
--brand-grad-mid              #B46470
--brand-grad-end              #CA9D8C

# Typography
--font-display-xl-size/lh/weight/tracking  60px / 65px / 700 / -0.5px
--font-display-size/lh/weight/tracking     40px / 48px / 700 / -0.5px
--font-h1-size/lh/weight/tracking          22px / normal / 700 / 0px
--font-body-size/lh/weight/tracking        16px / 32px / 400 (emph 700) / 0px
--font-h2-size/lh/weight/tracking          16px / 22px / 400 (emph 700) / 0px
--font-h3-size/lh/weight/tracking          14px / 16px / 400 / 0px
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

# Motion (transitions + short entry/exit animations only — long looping animations keep bespoke values)
--motion-duration-instant     100ms                       Tight feedback (checkbox check)
--motion-duration-fast        150ms                       Hover/active transitions, ring fades
--motion-duration-normal      200ms                       Message appear, micro-modal
--motion-duration-slow        300ms                       Scrollbar fade, panel reveal
--motion-ease-standard        cubic-bezier(.4,0,.2,1)     Default — element starts and stops at rest
--motion-ease-decelerate      cubic-bezier(.16,1,.3,1)    Element appearing on screen (panel sliding in)
--motion-ease-accelerate      cubic-bezier(.4,0,.7,1)     Element leaving viewport (panel sliding out)

# Data viz (chart series + semantic deltas; aliases of accent-* / brand-grad-* so chart visually matches StatusTag)
--dataviz-cat-1               #3171FF                     Categorical 1 — alias of --color-accent-blue
--dataviz-cat-2               #7652B9                     Categorical 2 — alias of --brand-grad-start
--dataviz-cat-3               #028901                     Categorical 3 — alias of --color-accent-green
--dataviz-cat-4               #B8541A                     Categorical 4 — alias of --color-accent-orange
--dataviz-cat-5               #6B54E6                     Categorical 5 — alias of --color-accent-violet
--dataviz-cat-6               #B46470                     Categorical 6 — alias of --brand-grad-mid
--dataviz-cat-7               #A87725                     Categorical 7 — alias of --color-accent-amber
--dataviz-cat-8               #6B7280                     Categorical 8 — alias of --color-accent-neutral
--dataviz-positive            #028901                     Positive delta, success metric
--dataviz-negative            #C93838                     Negative delta, regression
--dataviz-warning             #F79009                     Threshold breach
--dataviz-neutral             #6B7280                     No-change baseline
```

**Rule:** never hardcode these values. If a value is missing, add a new var here first.

### 1.0a Token tiers (three-tier model)

Tokens are layered so a brand swap or theme variant doesn't touch component code.

```
Tier 1 — Primitives  →  raw color/size, no semantics       (--navy, --blue-500)
Tier 2 — Aliases     →  semantic, mode-aware                (--color-text-primary, --color-bg-page)
Tier 3 — Component   →  surface-specific                    (--toolbar-btn-h, --shadow-card-hover)
```

Components consume **Tier 2** (e.g. `text-text-primary`, `bg-bg-page`). Tier 2 consumes Tier 1 via `var()` or `color-mix(in srgb, var(--X) N%, transparent)` for alpha. Tier 3 may consume either, depending on whether the value is brand-driven or mode-driven.

**Rules**
- Add a Tier 1 primitive **before** writing an alias that needs it — never inline a hex into a Tier 2 declaration.
- Components import Tier 2 (`text-text-secondary`), never Tier 1. Exception: brand gradient stops (`var(--brand-grad-start)`) are consumed directly by gradient utilities — they're brand-axis primitives, not part of a hue scale.
- Mode-flip happens in Tier 2 only — `:root` and `.dark` redefine aliases. Primitives have a single value across modes (which is why `--error-700` and `--error-300` are separate primitives, not one alias swapping value).

**Tier 1 primitives (current set, in `src/index.css`):**

```
# Surface bases
--white          #FFFFFF       Pure white
--black          #000000       Pure black
--navy           #142740       Light-mode foreground tint base (alpha-mixed)
--navy-deep      #001424       Dark-mode page surface
--ice            #E2F3FF       Dark-mode foreground tint base (alpha-mixed)
--gray-50        #F5F5F7       Light outer shell
--gray-100       #F3F4F5       Light page / sidebar
--gray-500       #6B7280       Neutral text/accent
--neutral-900    #1A1A1A       Tooltip surface

# Accent hues (status & emphasis)
--blue-500       #3171FF       Selected, links, focus (light), primary accent
--blue-300       #73B2FF       Dark focus ring, dark stroke tint base
--green-500      #028901       Status success
--red-500        #C93838       Status failed
--amber-500      #A87725       Status in-review
--orange-500     #B8541A       Status pending
--violet-500     #6B54E6       Status submitted, insight

# Form / inline validation (distinct from status accents above)
--error-700      #B42318       Light: deep crimson
--error-300      #F97066       Dark: softer red
--warning-500    #F79009       Light
--warning-300    #FDB022       Dark

# Brand gradient stops (axis, not hue scale)
--brand-grad-start  #7652B9
--brand-grad-mid    #B46470
--brand-grad-end    #CA9D8C
```

**Why `color-mix` over `rgba()` for alpha aliases?** A primitive shift (e.g. swapping `--navy` to a different brand foreground) propagates automatically to every alpha-derived alias. With `rgba()` literals each rung had to be re-computed by hand. The visual result is byte-identical to the `rgba()` form (`color-mix(in srgb, #142740 60%, transparent)` ≡ `rgba(20,39,64,0.6)`). Browser support: Chrome 111+, Firefox 113+, Safari 16.2+.

**Anti-pattern reminder (still applies):** Tailwind alpha modifiers like `text-text-primary/60` continue to fail silently — aliases now resolve to `color-mix()` or `var(--solid)` outputs, neither of which is the RGB triplet Tailwind's modifier expects. Always pick the closest existing alias (`text-text-secondary` ≡ navy at 60%) or add a new explicit Tier 2 token.

### 1.1 Color tokens (CSS variables, mode-aware)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-text-primary` | `#142740` | `#FFFFFF` | Headings, body, primary icons |
| `--color-text-secondary` | `rgba(20,39,64,0.6)` | `rgba(226,243,255,0.8)` | Descriptions, helper text |
| `--color-text-tertiary` | `rgba(20,39,64,0.4)` | `rgba(226,243,255,0.4)` | Disabled, muted metadata |
| `--color-bg-page` | `#F7F7F8` | `#001424` | Main surfaces |
| `--color-bg-message` / `--color-bg-hover` | `rgba(20,39,64,0.05)` | `rgba(226,243,255,0.1)` | Message bubbles, hover, input fields |
| `--color-card-panel-bg` | `#FFFFFF` | `rgba(226,243,255,0.1)` | CardShell, ArtifactCard, AgentRequiredHint card, VoiceMode panel — dark value mirrors bg-hover for consistent elevated-surface tone |
| `--color-input-bg` | `var(--color-bg-page)` | `rgba(0,0,0,0.2)` | ChatInput idle fill, DarkToggle outer pill (dark), OverviewPage tinted cards |
| `--color-input-bg-active` | `#FFFFFF` | `rgba(0,0,0,0.2)` | ChatInput active (focused/composing) fill — pure white in light, mirrors idle in dark |
| `--color-sidebar-bg` | `#F7F7F8` | `#001424` | NavPanel surface |
| `--color-stroke-outline` | `#E8E8E8` | `rgba(115,178,255,0.2)` | Borders, dividers |
| `--color-stroke-toggle` | `#E6E8EA` | `rgba(115,178,255,0.2)` | Inputs, toggles |
| `--color-selected-bg` | `rgba(49,113,255,0.1)` | `#3171FF` | Active chip/filter |
| `--color-selected-text` | `#3171FF` | `#FFFFFF` | Active chip/filter label |
| `--color-accent-blue` | `#3171FF` | — | Links, @mentions, progress, focus, selected outputs |
| `--color-accent-blue-faint` / `-faint-hover` | `rgba(49,113,255,0.1/0.15)` | — | Active state bg (e.g. TTS playing button) |
| `--color-accent-green` / `-green-bg` | `#028901` / `rgba(2,137,1,0.1)` | — | StatusTag success, success messages, +insertions |
| `--color-accent-red` | `#C93838` | — | StatusTag failed (status indicator) |
| `--color-accent-amber` | `#A87725` | — | StatusTag in-review |
| `--color-accent-orange` | `#B8541A` | — | StatusTag pending |
| `--color-accent-violet` | `#6B54E6` | — | StatusTag submitted, Maya's insight |
| `--color-accent-neutral` | `#6B7280` | — | StatusTag expired |
| `--color-error` | `#B42318` | `#F97066` | Form validation, inline error text, -deletions, error backgrounds |
| `--color-tooltip-bg` | `#1a1a1a` | — | Inverted tooltip / docs sample bg |
| `--color-overlay-loading` | `rgba(0,0,0,0.4)` | `rgba(255,255,255,0.4)` | Translucent dim over media previews while loading |
| `--color-fixed-dark-text` | `#142740` | — | Force dark text on always-light overlays (Library peach, ComingSoon pink) |

**Tailwind shortcuts:** `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-fixed-dark`, `bg-bg-page`, `bg-bg-hover`, `border-stroke-outline`, `bg-selected-bg`, `text-selected-text`, `text-error`, `bg-error`, `border-error`, `text-accent-blue`, `bg-accent-blue`, `bg-accent-blue-faint`, `bg-accent-blue-faint-hover`, `text-accent-green`, `bg-accent-green`, `text-accent-red`, `bg-accent-red`, `text-accent-amber`, `bg-accent-amber`, `text-accent-orange`, `bg-accent-orange`, `text-accent-violet`, `bg-accent-violet`, `text-accent-neutral`, `bg-accent-neutral`, `bg-tooltip`, `bg-overlay-loading`.

**Anti-pattern — silent failure:** Tailwind alpha modifiers on these CSS-var-backed color classes (e.g. `text-text-primary/60`, `bg-bg-hover/40`) **silently fail** because the underlying tokens are stored as `rgba(...)` literals (or hex), not RGB triplets — Tailwind emits no rule and the element falls back to inherit. Always pick the closest existing token (`text-text-secondary` rgba .6 / `text-text-tertiary` rgba .4) or add a new explicit token.

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

### 1.3 Typography (13 styles, no more)

| Class | Size / LH / Weight / Tracking | Use |
|---|---|---|
| `.type-display-xl` | 60 / 65 / 700 / −0.5 | Oversized numeric — MetricCard values |
| `.type-display` | 40 / 48 / 700 / −0.5 | Page H1 (only one per page) |
| `.type-h1` | 22 / normal / 500 / 0 | Brand wordmark, hero greetings (display-weight regular H1) |
| `.type-h1--emphasized` | 22 / normal / 700 / 0 | Section headers — top-level regions inside a page |
| `.type-body-emphasized` | 16 / 32 / 700 / 0 | Long-form section headings where loose 32px leading reads better (ArtifactPage category headers, DesignSystemPage checklists) |
| `.type-body` | 16 / 32 / 400 / 0 | Long-form paragraph copy (loose leading for multi-line reading) |
| `.type-h2-emphasized` | 16 / 22 / 700 / 0 | Default bold 16px title — card titles, SidePanel/SideCard titles, sidebar & page section headers, profile name |
| `.type-h2` | 16 / 22 / 400 / 0 | Chat messages (user + assistant), dialog inputs + textareas, onboarding prompts, drop-zone headers, side-panel file/change rows — the default 16px copy style |
| `.type-h3` | 14 / 16 / 400 / 0 | Compact 14px heading — same body size as Detail but with tighter 16px leading for short titles where 22px feels airy. Use for sub-section labels and dense card titles |
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

### 1.7 Motion (4 durations, 3 easings — transitions only)

Tokenize **transitions and short entry/exit animations**. Long looping animations (`loading-dot` 1.4s, `voice-pulse` 1.5–2.1s, `progressFill` 2.5s, `taskPanelPreview` 3s, `speaker-wave`) keep their bespoke durations because the exact tempo carries semantic meaning — a 1.4s "thinking" pulse and a 2.5s "filling" bar are not interchangeable.

| Token | Value | Use |
|---|---|---|
| `--motion-duration-instant` | 100ms | Tight, almost-imperceptible feedback (checkbox check) |
| `--motion-duration-fast` | 150ms | Hover/active transitions, ring fades, card-hover-shadow |
| `--motion-duration-normal` | 200ms | Message appear, micro-modal |
| `--motion-duration-slow` | 300ms | Scrollbar fade, panel reveal |
| `--motion-ease-standard` | `cubic-bezier(.4,0,.2,1)` | Default — element starts and stops at rest (color/opacity/box-shadow) |
| `--motion-ease-decelerate` | `cubic-bezier(.16,1,.3,1)` | Element appearing on screen (panel sliding in, message-appear) |
| `--motion-ease-accelerate` | `cubic-bezier(.4,0,.7,1)` | Element leaving viewport (panel sliding out, dismissals) |

**Reduced-motion respect (WCAG 2.3.3):** the global `@media (prefers-reduced-motion: reduce)` rule in `src/index.css` collapses all animations and transitions to ~0ms when the user has the OS-level "Reduce motion" preference set. **Always use these tokens** — never inline `0.15s ease` — so the rule consistently applies.

Pattern:
```css
/* ✅ Use tokens */
transition: box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
animation: fadeInUp var(--motion-duration-normal) var(--motion-ease-decelerate);

/* ❌ Don't hardcode */
transition: box-shadow 0.15s ease;
```

### 1.8 Data viz (categorical 8 + semantic 4 — chart tokens)

For charts, breakdowns, sparklines, deltas. **Aliases of accent-* / brand-grad-***, so a chart series visually matches its StatusTag counterpart — cross-surface consistency without rebuilding the palette.

| Token | Value (light & dark) | Use |
|---|---|---|
| `--dataviz-cat-1` | `#3171FF` (alias `--color-accent-blue`) | Categorical 1 — primary series, default first hue |
| `--dataviz-cat-2` | `#7652B9` (alias `--brand-grad-start`) | Categorical 2 |
| `--dataviz-cat-3` | `#028901` (alias `--color-accent-green`) | Categorical 3 |
| `--dataviz-cat-4` | `#B8541A` (alias `--color-accent-orange`) | Categorical 4 |
| `--dataviz-cat-5` | `#6B54E6` (alias `--color-accent-violet`) | Categorical 5 |
| `--dataviz-cat-6` | `#B46470` (alias `--brand-grad-mid`) | Categorical 6 |
| `--dataviz-cat-7` | `#A87725` (alias `--color-accent-amber`) | Categorical 7 |
| `--dataviz-cat-8` | `#6B7280` (alias `--color-accent-neutral`) | Categorical 8 |
| `--dataviz-positive` | `#028901` | Positive delta, success metric, +insertion |
| `--dataviz-negative` | `#C93838` | Negative delta, regression, -deletion |
| `--dataviz-warning`  | `#F79009` | Threshold breach, attention needed |
| `--dataviz-neutral`  | `#6B7280` | No-change baseline, comparison reference |

**Tailwind shortcuts:** `text-dataviz-cat-1` … `text-dataviz-cat-8`, `bg-dataviz-positive`, `border-dataviz-negative`, etc.

**Series ordering rule:** when a chart has N series with no inherent order, use `cat-1` through `cat-N` in declaration order — never skip. Picking arbitrary hues (`cat-3` and `cat-7` for two series) destroys the consistency the categorical scale provides.

**Sequential / divergent palettes** are intentionally omitted until a real chart needs them (subtract first — `docs/principles.md`). When a need arises, add `--dataviz-seq-1..N` or `--dataviz-div-+/-` here first.

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
| `TertiaryButton` | Button | Bordered transparent, `rounded-[4px]` | `onClick`, `icon?`, `children` |
| `GhostPillButton` | Button | Pill-shaped bordered secondary, `h-10 rounded-full` | `onClick`, `icon?`, `ariaLabel?`, `children` |
| `HeaderIconButton` | Button | Square icon-only for page headers, `w-10 h-10 rounded-xl` | `onClick`, `ariaLabel?`, `children` |
| `NavItem` | Nav | Sidebar main-nav row: icon + label + optional trailing, `.gradient-ring` active | `icon?`, `label`, `active?`, `onClick`, `rightElement?`, `reserveRightPadding?` |
| `AddRowButton` | Button | Inline "add a new row" button — full-width `rounded-lg` row w/ leading Plus; secondary → primary text on hover | `onClick`, `icon?`, `children` |
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
| `TertiaryButton` | Bordered transparent | `rounded-[4px]`, `.chip-gradient-hover` on hover |
| `GhostPillButton` | Bordered pill secondary | `h-10 px-4 rounded-full`, 1px stroke-outline border, `hover:bg-bg-hover`. Use when a `rounded-[4px]` TertiaryButton would clash with pill chrome (FilterChip rows, page headers). Single leading icon + short label is the canonical shape. |
| `HeaderIconButton` | Header icon | `w-10 h-10 rounded-xl` icon-only, no border, `hover:bg-bg-hover`. Used at the top of pages for sidebar/panel toggles and modal-style "close" actions. Bigger and rounder than `ToolbarIconButton` (composer-scale). |
| `NavItem` | Sidebar nav | `w-full px-4 py-2 rounded-full gap-4` list-item: icon (20px) + flex-1 label (`type-h2`) + optional trailing element. Active = `.gradient-ring`; inactive = `hover:bg-bg-hover`. `reserveRightPadding` shifts padding to `pl-4 pr-10` so a hover-revealed row-menu can sit on top. |
| `AddRowButton` | Inline add-row | `w-full px-3 py-2 rounded-lg gap-2` row button. Text is `text-text-secondary` by default and darkens to `text-text-primary` on hover, signalling an empty slot. Pair with a leading Plus icon. Sits at the end of an editable list. Distinct from `NavItem` (pill navigation) and `GhostPillButton` (standalone pill CTA). |

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
7. **13 text styles only.** `.type-display-xl` / `.type-display` / `.type-h1` / `.type-h1--emphasized` / `.type-body` / `.type-body-emphasized` / `.type-h2` / `.type-h2-emphasized` / `.type-h3` / `.type-detail` / `.type-detail-emphasized` / `.type-caption` / `.type-footnote`.
8. **Icons = lucide-react.** Never render letters or abbreviations as icon stand-ins. Never import other icon libraries.
9. **Dark-mode automatic.** All colors come from CSS vars bound to `:root` / `.dark`. PNGs use `.icon-theme`. Lucide SVGs inherit `currentColor`.
10. **Three-panel shell.** Every feature is a slot in NavPanel / ConversationPanel / InspectorPanel. No new top-level chrome.
11. **Review queue for new components.** If a need truly can't be met by `shared.tsx`, build it, then register it under the Design System **Review Queue** tab for explicit approval. Approved → promote into `shared.tsx`. Rejected → revert to closest existing component.
12. **Bg fill or border, not both.** A card / panel uses **either** a background fill (`bg-bg-hover`, `bg-bg-page`, `bg-card`, etc.) **or** a border (`border-stroke-outline`) — never both on the same surface. Pick whichever creates the right visual separation in the surrounding context. **Defaults:** inline mini-previews, intro cards, hover zones → bg fill. Free-standing cards on the page background → border-only. **Exception:** dashed borders (`border-dashed`) carry placeholder / skeleton / drop-zone semantics and may coexist with bg fills. **Why:** stacking bg-change + border produces a redundant double-frame — either signal alone is enough to lift an element from its surroundings; doubling competes with surrounding chrome and breaks the design's quiet hierarchy.
13. **Tab structure — Pattern A or Pattern B.** Documentation tabs (DesignSystemPage and any future spec page) follow one of two structures.
    - **Pattern A** — Intro card → **L2 SectionTitle (OUT of box)** → content **wrapped in a single border-only box** (`rounded-2xl border-stroke-outline p-5`). Used by Foundations, Components, Review, Layouts, AI Patterns. The box gives each section visual closure.
    - **Pattern B** — Intro card → **flat list of cards (no L2 wrapper)** → each card has **IN-box L3 title (16px)**. Used by Principles, Agent Videos, Voice & Tone. Each card is a self-contained section that doesn't need a heading above the chrome.

    **Same-level content must look identical across tabs.** A Pattern A section content box is always `rounded-2xl border-stroke-outline p-5` (no bg per Principle #12); a Pattern B card title is always 16px in-box `type-h2-emphasized` with the same card chrome. **Why:** without this rule, sections drift between in-box and out-of-box (App Shell vs Color Palette vs 8.X Pattern), and same-level content uses different sizes (Principles 16px vs Agent Videos 22px) — breaking the "scan one tab, recognize all" reading flow. The border-box wrap on Pattern A also gives a SectionTitle visual closure — a bare paragraph after the title reads as "loose copy", a wrapped block reads as "this is the section's content".

### 3.1 When in doubt — decision tree

```
Need a button?
  └─ primary CTA (one per view)       → PrimaryButton
  └─ secondary emphasis               → SecondaryButton
  └─ tertiary / bordered (square)     → TertiaryButton
  └─ pill-shaped bordered secondary   → GhostPillButton
  └─ square icon-only in page header  → HeaderIconButton
  └─ sidebar main-nav row             → NavItem
  └─ inline "add a new row" in a list → AddRowButton

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
| `.type-display-xl` / `.type-display` / `.type-h1` / `.type-h1--emphasized` / `.type-body` / `.type-body-emphasized` / `.type-h2` / `.type-h2-emphasized` / `.type-h3` / `.type-detail` / `.type-detail-emphasized` / `.type-caption` / `.type-footnote` | Type scale |
| `.gradient-btn` | Primary CTA gradient fill + shadow |
| `.gradient-text` | Brand gradient text |
| `.chip-gradient-hover` | Unselected chip: gradient border on hover (masked `::before`, interior stays transparent) |
| `.input-gradient-hover` | Input: gradient border on hover (same masked pattern) |
| `.toolbar-gradient-hover` | Dark-mode-only toolbar gradient border on hover (same masked pattern) |
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

5. ~~**Chart series colors in `OverviewPage` bypass `--color-accent-*`**~~ — **Resolved 2026-05-05.** OverviewPage no longer contains chart hex (verified by grep). Forward-looking solution shipped as **§1.8 Data viz** — categorical 8 + semantic 4 tokens, all aliases of `--color-accent-*` / `--brand-grad-*`, so any future chart series visually matches its StatusTag counterpart.
6. **`ConnectorCard` hardcodes a dark fill** — `dark:bg-[rgba(226,243,255,0.05)]` inline. Same literal appears in `OverviewPage.tsx` (stress-detail panel). Candidate for a `--color-surface-subtle` token in dark mode.

### 7.3 Text size escape hatches

7. **Inline `text-[13px]` / `text-[11px]`** appear in `ConnectorCard` (name label, Connect button) and `DemoBadge` (Demo pill text). Principle §1.3 forbids these sizes for running text. Are these controls explicitly exempted (UI chrome), or drift to be pulled back into `.type-detail` (14px) / the `sm` StatusTag size?

### 7.4 Emoji vs Lucide drift

8. **`SectionTitle` and `SolutionRow` still take `emoji: string` props.** Meanwhile Overview-page Work/Family/Self tags and Impact cards just migrated from emoji to Lucide icons (2026-04-21). If we're steering toward Lucide-everywhere, the two shared components should accept `icon?: LucideIcon` too (emoji fallback optional) so new callers don't re-introduce the pattern.
9. **`DemoExplainerModal` bullet list still uses emoji** (`✨ 📂 🤖 📊 ⚖️`). It's a demo-only surface but lives in `shared.tsx`. Consistent with #8 — decide if emoji is OK in demo/marketing copy vs forbidden system-wide.

### 7.5 Review Queue status

10. **`Switch<T>` is documented as "Review Queue"** in its own JSDoc. The Review Queue tab in `DesignSystemPage.tsx` should confirm it's registered there with a preview and promotion criteria; otherwise it's floating between "shared primitive" and "pending".

---

## 8. AI Patterns

> Where §2 documents *atomic UI primitives* (buttons, chips, cards), §8 documents *AI-specific interaction patterns* — composed flows for streaming output, citing sources, confirming agent actions, etc. These sit one level above components: a pattern says "for problem X, here's the canonical shape we converge on."
>
> Primary references: `src/components/ChatMessage.tsx`, `src/components/MessageCard.tsx`, `src/components/InsightCard.tsx`, `src/components/TaskProgressCard.tsx`, `src/components/MemoryPage.tsx`. The 11 patterns below cover the AI-product surfaces an early-stage assistant must handle. Each pattern has **status**: ✅ shipped (raw material exists in components), 🟡 partial (some pieces exist, gaps remain), 🆕 placeholder (pattern reserved, no component yet).

### 8.1 Conversation layout — Prompt / Reply / Grow  ✅

**The macro pattern.** Every AI conversation unit follows a three-segment skeleton plus an action-chips area in the input. This is the *layout* spec — inline patterns below (§8.2–§8.7) are how each segment fills in.

```
Prompt    ── Text prompt                          (user message bubble, right-aligned)
          ── --space-6 (24px) ────────────────────
Reply     ── Analysis (loader)                     (only while streaming hasn't started)
          ── --space-4 (16px)
          ── Text answer                           (markdown body — required)
          ── --space-4 (16px)
          ── Card / Image / Video / Citation       (optional structured output)
          ── --space-4 (16px)
Grow      ── Text suggestion (markdown w/ **bold** options inline — NOT a button row)
          ── --space-4 (16px)
          ── Answer Toolbar                        (TTS · Copy · Share · 👍 · 👎 · 🔄 — always)
          ── --space-6 (24px) ────────────────────
                                                  ↓
Input     ── Action chips (Message.chips → <Chip /> row above textarea)
          ── ChatInput textarea
```

**Spacing rule:** every gap is a token from §1.4. Inter-segment gaps are `--space-6` (24px); intra-segment gaps are `--space-4` (16px). **Never hardcode** `mb-2` / `mt-2` for these gaps — those are intra-component overrides for tighter clusters (e.g. icon + label inside a chip).

**Anatomy → component mapping**

| Slot | Component | Required? |
|---|---|---|
| Prompt — Text prompt | `ChatMessage` (user variant) | yes |
| Reply — Analysis | `TypingIndicator` (3-dot brand-gradient loader) | only while `message.isLoading` |
| Reply — Text answer | `renderMarkdownBlocks(message.content)` inside `ChatMessage` | yes (markdown body) |
| Reply — Card / Image / Video / Citation | `MessageCard` · `ArtifactCard` · `ImageResultsGrid` · `VideoResultsGrid` · `WebSourceChips` | optional |
| Grow — Text suggestion | **Markdown text** in `message.content` with `**bold**` on the offered options. Not a separate component. Example: `"...let me know if you'd like me to **explore solutions** or **set up a meeting**."` | optional — write inline when the AI offers follow-up directions |
| Grow — Answer Toolbar | `FeedbackBar` private to `ChatMessage.tsx` — TTS speaker (custom SVG) + Copy / Share / 👍 / 👎 / 🔄 (PNG via `../assets`: `iconCopy` / `iconShare` / `iconThumbsUp` / `iconRefresh`) | always on assistant messages |
| Input — Action chips | `<ChatInput actionChips={message.chips} />` — renders existing `<Chip>` primitive in a row above the textarea, **automatically** when the assistant message has `chips: ActionChip[]` | optional — emit when AI is offering one-tap shortcuts |

**Toolbar order (locked):** TTS speaker · Copy · Share · 👍 Good · 👎 Bad · 🔄 Retry. Adding a new action? Place to the right of Retry, never insert mid-row — muscle memory matters.

**The "two halves" of an AI suggestion:**
1. **Verbal half** lives in the message body — markdown text describing the options, with `**bold**` on the action verbs. Carries tone (Voice & Tone §9.3).
2. **Tactile half** lives above the input — `Message.chips` array → ChatInput renders as `<Chip>` row. Lets users one-tap the suggestion without retyping it.

These two halves are **complementary, not redundant.** Always emit both for AI follow-ups: text for context + chips for action.

**Don't:**
- ❌ Stack two `MessageCard`s in one Reply — pick the primary deliverable, surface the rest in DetailPanel or the Folder chip. (See `pickPrimaryArtifact` selection rule.)
- ❌ Render follow-up *buttons* in the message body. The verbal suggestion stays as bold-styled text inline; clickable affordances belong in `Message.chips` → ChatInput's chips row. Mixing the two creates duplicate CTAs.
- ❌ Skip the Toolbar on assistant messages, even short ones. Users rely on Retry as an "the model misread me" escape hatch.
- ❌ Use lucide icons for the toolbar — it's PNG assets with `.icon-theme` for dark-mode auto-inversion. Lucide would break the inversion.

**Why this layout exists:** before §8.1, ChatMessage gaps were ad-hoc — `mb-4` (16px) for inter-segment, `mt-2` (8px) for intra-segment, drifted from the Figma source by a factor of ~1.5×. The 2026-05-05 PR aligned every gap to `--space-4 / --space-6` per the Figma spec (node `2848:39001`).

### 8.2 Streaming  ✅

**Problem:** the model produces tokens incrementally (200ms–10s). Users need to (a) see progress immediately, (b) be able to stop generation, (c) trust that "no movement" means done, not stuck.

**Pattern:**
- Render tokens as they arrive (no buffer-then-flush) inside the `ChatMessage` assistant bubble.
- Show a 3-dot loader (`.loading-dot`, brand-gradient) when the stream hasn't started yet (network round-trip).
- A blinking caret or trailing pulse during active streaming is **not** required — token arrival itself signals liveness.
- Show a **Stop** affordance (icon button, tooltip "Stop generating") in the composer area while streaming; collapses to **Send** when done.
- Switch caret to "done" by removing the loader; do not flash a "complete" icon.
- Animation entry uses `var(--motion-duration-normal) var(--motion-ease-decelerate)` — see `.message-appear`.

**Don't:** buffer tokens to render whole sentences. Buffering looks frozen and breaks the trust loop.

**Anatomy:** `ChatMessage` (assistant variant) + 3-dot loader + stop button in `ChatInput`.

### 8.3 Citation  🟡

**Problem:** model output makes claims that need to be traceable to source material (a doc, an email, a meeting transcript, a URL). Without citations, every AI claim has the same trust level — which means none.

**Pattern:**
- Inline citation: a `.type-footnote` chip with a leading source-type icon (`File`, `Mail`, `Calendar`, `Link`, etc.) sits at the end of the citing sentence/clause. Click → opens the source in `DetailPanel`.
- Multiple citations: stack chips with `gap-1`, never wrap mid-sentence — push the entire group to end-of-paragraph if needed.
- Source preview: hovering a citation chip surfaces a `Tooltip` (dark, `--color-tooltip-bg`) with the source title + 1-line excerpt.
- Use `--color-accent-blue` for the citation chip text to mark it as a navigation affordance (consistent with link styling).

**Status:** chip primitive exists (`.type-footnote` + `Tooltip`) but no dedicated `Citation` component. **Action:** promote to `shared.tsx` as `<Citation source={...} onOpen={...} />` when the second consumer appears.

### 8.4 Confirmation  ✅

**Problem:** the agent is about to take a side-effecting action (create ticket, send email, run script). Doing it silently breaks user agency; asking before *every* action breaks the autonomy promise.

**Pattern:**
- Side-effecting actions render a `MessageCard` variant (`ticket`, `schedule`, `meeting`) with a **preview of what will happen** + an explicit confirm/cancel pair.
- Confirm button is `PrimaryButton` (gradient CTA — one per card); Cancel is `TertiaryButton`.
- Reversible read-only actions (search, summarize, draft) **don't** require confirmation — they go directly to result.
- After confirm, the card collapses to a `StatusTag` row showing the result (`success` green / `failed` red / `in-progress` blue).
- A "Don't ask again for X" affordance is reserved for repeated identical actions in the same session — never persist across sessions without explicit consent.

**Anatomy:** `MessageCard` + `PrimaryButton` + `TertiaryButton` + `StatusTag`.

### 8.5 Undo  🆕 placeholder

**Problem:** even with confirmation, the agent's action lands in the real world (ticket created in Linear, email drafted in Gmail). User needs a way to back out within seconds without going to the source system.

**Pattern (proposed):**
- After a side-effecting action lands, the resulting `MessageCard` shows an **Undo** affordance for **N seconds** (default 10s for low-stakes, 30s for irreversible-ish like sending email).
- Undo countdown uses `.animate-progress-bar` (`var(--motion-duration-slow)` is too short — use bespoke 10s/30s as token-exempt loops, like `progressFill`).
- Undo collapses the card to "Reverted" `StatusTag` (`neutral` variant).
- After the window expires, the Undo affordance is replaced by a permanent link to the action source ("View ticket in Linear").

**Status:** **placeholder.** No component yet. Spec reserved here so when an Undo flow ships, it converges on this shape rather than re-inventing.

### 8.6 Confidence / Status  ✅

**Problem:** not every AI output is a finished result — some are guesses, some are partial, some are awaiting user input. A flat list of messages hides this distinction; users default to either over-trusting or never trusting.

**Pattern:**
- Use `StatusTag` (8 variants: `pending · in-progress · submitted · in-review · success · failed · expired · neutral`) on every AI-produced artifact card to signal where it sits.
- Map: model is *generating* → `in-progress` (blue). Model *finished, awaiting user review* → `in-review` (amber). User *approved* → `success` (green). User *rejected / model failed* → `failed` (red). Sent to external system, awaiting response → `submitted` (violet). Blocked on missing input → `pending` (orange).
- **Never** use raw probability numbers ("87% confident") — they imply false precision. Use the categorical pills.
- Insight-level content uses `InsightCard` ("Maya's insight") as a higher-confidence signal — reserved for synthesized observations, not raw output.

**Anatomy:** `StatusTag` (semantic) + `InsightCard` (insight-grade).

### 8.7 Tool transparency  🆕 placeholder

**Problem:** the agent calls tools (search docs, query Calendar, run code). When something goes wrong — or even when it goes right — the user needs to know *what the agent did*, not just the final answer. Black-box agents collapse trust the moment they're wrong once.

**Pattern (proposed):**
- Every tool call emits a collapsed `TaskProgressCard`-like row inside the `ChatMessage` showing: **tool icon + tool name + 1-line input summary + status**.
- Default state: collapsed. Expanded view shows full input + output (truncated to 200 lines, "View raw" link for the full payload).
- Multiple tool calls in one turn stack vertically inside a single card with `StepIndicator` glyphs (done/in-progress/pending).
- Failed tool calls are surfaced inline immediately (red `StatusTag`), not folded into the agent's natural-language response.
- Use `var(--color-accent-violet)` for the agent's "calling tool X" header to distinguish from user-initiated actions.

**Status:** **placeholder.** `TaskProgressCard` has the structural pieces (collapsible, step list); needs a tool-call-specific variant. Build when the first multi-tool agent flow ships.

### 8.8 Hallucination / Uncertainty disclosure  🆕 placeholder

**Problem:** the model produces confident-sounding output even when its source coverage is thin or it's interpolating. A flat assistant bubble makes "confident facts" and "best guesses" look identical — users either over-trust everything or learn to under-trust everything.

**Pattern (proposed):**
- **Three uncertainty grades, three visual signals:**
  - *Cited fact* — claim has a `<Citation>` chip per §8.3. Default trust level.
  - *Synthesis* — model's interpretation of cited material (no chip needed). Standard body text.
  - *Inference / guess* — model has no source and is interpolating. Render in `text-text-tertiary` with an inline marker chip (`StatusTag` `neutral` variant + `?` icon) immediately preceding the inferred sentence/clause.
- **"I don't know" mode**: when the model can't answer with reasonable confidence, the assistant message is a single short paragraph naming the gap and offering a path forward (e.g. "I don't have access to that calendar yet — connect it on **Connectors** to ask again."). Voice from §9.5; ladders into §8.11 Refusal & safety.
- **Never** show probability numbers ("87% confident"); they imply false precision. Categorical pills only — same rule as §8.6.
- **Anti-pattern:** rendering inferred content in standard body text without any marker. Better to under-disclose and break user immersion than over-trust into a hallucination loop.

**Anatomy:** `StatusTag neutral` (uncertain marker) + `text-text-tertiary` (inferred segment) + Citation chips (§8.3) for cited segments + standard `ChatMessage` body for synthesis.

**Status:** **placeholder.** No component yet. The pieces (`StatusTag`, citation chip prototype, tertiary text token) all exist; spec reserved here so the first hallucination-aware flow converges on this shape rather than re-inventing.

### 8.9 Memory surface  ✅

**Problem:** an assistant that "remembers you" is hostile if the memory is invisible. Users can't verify what's stored, can't correct stale facts, can't remove sensitive entries — and silently-applied memory feels manipulative even when it's working.

**Pattern:**
- **Dedicated MemoryPage** (`src/components/MemoryPage.tsx`) lists every stored memory grouped by kind. Three kinds:
  - *Core* — always-on user facts (role, language, locale).
  - *Preference* — how-to-collaborate guidance ("reply in Chinese", "skip the summary").
  - *Project* — facts scoped to a specific project.
- **CRUD must be inline + immediate.** Add via inline `MemoryForm`, edit/delete on each row, no modal indirection. Memory writes that need protection pop a `PasswordModal`; never silent.
- **In-conversation reference**: when the assistant uses a memory in its reply, surface the trigger inline as a citation-style chip (same pattern as §8.3) so users can click → MemoryPage → verify or edit. (Not yet shipped — see Status below.)
- **Filter chip row**: `FilterChip` for All / Core / Preference / Project lets users browse what's stored without a search. Empty state per §9.8.
- **Anti-pattern:** silent memory writes ("I'll remember that for next time") with no visible record. Always confirm or surface what's being saved within the same turn.

**Anatomy:** `MemoryPage.tsx` (CRUD shell) + `FilterChip` (kind filter) + inline `MemoryForm` w/ `FilterChip` for kind selector + `PasswordModal` (write gate).

**Status:** shipped — see `src/components/MemoryPage.tsx`. The in-conversation memory citation chip is the next gap; promote alongside §8.3 Citation when the second consumer of the chip primitive appears.

### 8.10 Retry / Regenerate / Fork  🟡

**Problem:** the model's first attempt isn't always right — wrong tone, missed constraint, hallucinated detail. Users need a low-friction escape to "try again" without re-typing the prompt or losing the original.

**Pattern:**
- **Retry button** sits on the assistant message toolbar (`FeedbackBar` in `ChatMessage.tsx`, far right after 👎 Bad). Clicking re-runs the same prompt with fresh sampling. **Always present** on assistant messages — see §8.1's locked toolbar order.
- **Regenerate-with-mode** (proposed): a small caret next to Retry expands a popover with single-tap mode shifts — *more concise* / *more detail* / *change tone* / *try a different angle*. Each prepends a system instruction to the regen call. Closing the popover defaults to plain Retry.
- **Fork, not replace**: a regenerated reply lands as a **sibling** of the original assistant message, with both reachable through a `1/2 ▸ 2/2` navigator at the top of the bubble. Never destroy the prior reply — users often want it back after seeing a worse regeneration.
- **Regen counter cap**: after 5 sibling regens for the same prompt, surface a hint to refine the prompt instead. Prevents low-value churn.
- **Anti-pattern:** in-place replacement that destroys the rejected reply. Loses the user's anchor for "I didn't like the part where you said X."

**Anatomy:** `FeedbackBar` 🔄 Retry button (existing in `ChatMessage.tsx:317`) + (proposed) sibling-thread navigator + (proposed) regen-mode popover.

**Status:** **partial.** Toolbar Retry button is rendered but no regenerate handler is wired up; click is a no-op today. Promote when the first regen flow ships.

### 8.11 Refusal & safety  🆕 placeholder

**Problem:** sometimes the assistant can't or won't help — out-of-scope task, missing connector, destructive action, sensitive content. A flat "I can't help with that" feels dismissive and severs the conversation. Refusals are part of the trust loop, not error states.

**Pattern (proposed):**
- **Refusal copy follows §9 Voice & Tone — name the gap, offer the next step.** Categories:
  - *Capability gap* (no tool): "I can't run shell commands yet — let me know what you're trying to do and I'll suggest the steps."
  - *Permission gap* (need user to connect): "I don't have access to your calendar yet. Connect it on **Connectors** to ask again."
  - *Policy refusal* (destructive / irreversible): "I can't move money for you, but I can draft the steps if you'd like."
  - *Safety refusal* (could harm user): handled with the same calm-structured tone — never lecturing, never moralizing.
- **Visually a normal assistant message**, no special chrome. Refusals are part of the conversation, not error states. Do **not** wrap in a red error card — that conflates "I refused" with "system broke."
- **Optional `StatusTag neutral`** with label "Out of scope" if a downstream surface needs to filter refusal turns later (e.g. analytics dashboard).
- **Never expose**: stack traces, policy names, model IDs, or "as an AI language model…" preambles. The user needs the gap and the path forward, nothing else.
- **Anti-pattern:** terse "I can't help with that" with no reason and no path forward. Drops the user into a dead end and breaks the §9.1 brand promise of *empathetic + structured*.

**Anatomy:** standard `ChatMessage` (assistant variant) + voice templates pinned in §9. Optional `StatusTag neutral` for surface-level classification.

**Status:** **placeholder.** No component-level affordance needed (it's a copy/voice pattern). Voice templates pinned here; promote to a dedicated §9.10 ("Refusal copy templates") when a second refusal surface appears.

---

## 9. Voice & Tone

> The voice of WorkPal is **two layers**:
>
> 1. **System baseline** (this section) — the default voice the product ships with, before any user customization. *Calm, structured, empathetic.* These are the rails.
> 2. **User personalization** — every user names their agent (`agentName` in `types.ts:70`) and selects 3 weighted personality traits during Onboarding (`src/components/Onboarding.tsx`). Their top-3 traits *modulate* the baseline; the remaining 9 traits still shape it at lower weight; a free-text description provides escape-hatch nuance.
>
> The system baseline is what cowork writes against when the user hasn't set traits yet, and what every output falls back to when no trait clearly dominates. The personalization layer is applied at generation time, not at design time.

### 9.1 Brand Philosophy

**Born from the best people you've worked with.**

WorkPal is a **calm, structured, and empathetic** AI assistant — built not just to execute tasks, but to understand your pace, lighten your load, and always be there when you need support.

### 9.2 Personalization Philosophy

Personalization builds on the baseline — it **enhances**, but doesn't replace the core identity. Two psychological mechanisms drive the design:

- **Parasocial bonding.** When users assign traits they admire to the assistant, they begin to project the **warmth** and **trust** they associate with real people. This deepens trust and fosters acceptance of the virtual character.
- **Participation builds connection.** When users take part in shaping the assistant's tone, personality, or appearance, that sense of involvement strengthens emotional connection and creates **ownership** and **belonging**.

**How this lands in code:** the Onboarding flow (`src/components/Onboarding.tsx`) presents 12 traits — *🛟 Stable · 🧠 Organized · 🤗 Kind · 🧘 Calm · 🌱 Open-minded · 🫶 People-first · 😊 Always smiling · 🎭 Has a sense of humor · ⚡ Energetic · ✨ Minimal · 👔 Formal · 🙈 Not sure yet*. The user drags 3 into an "important" zone (top-3 carry extra weight); the remaining 9 still shape the agent at lower weight. Plus an optional free-text description (`onComplete(important, [], description?)`).

### 9.3 Tone — by situation

The baseline tone shifts subtly with the emotional weight of the moment. **Never** drop the calm-structured floor; only flex the warmth dial.

| Situation | Tone style | Example response |
|---|---|---|
| ✅ Task completed | Warm, affirming, lightly celebratory | "All done! You can relax now, I've got this 😊" |
| ⚠️ User made a mistake | Gentle, non-judgmental, supportive | "Looks like we're missing a file — no worries, let's fix it together." |
| ❓ Uncertainty or hesitation | Clear, helpful, reassuring | "I've got a few options. Want to take a look and choose what fits best?" |
| 📈 Offering suggestions | Logical, structured, calm | "Here are three key insights: 1. Time usage, 2. Repetitive tasks, 3. Collaboration gaps." |

### 9.4 Voice Personality Traits

The five baseline traits below describe *how WorkPal speaks* before the user sets any personalization. They are the **floor**, not the ceiling.

| Trait | Description |
|---|---|
| **Inclusive** | Welcomes users of all levels. Never rushes, never pressures. |
| **Kind** | Speaks like a trusted colleague — professional yet human. |
| **Structured** | Provides clarity with clean, step-by-step responses. |
| **Reliable** | Remembers your progress, fills in gaps, never lets you do extra work. |
| **Calm** | Stays steady during chaos, offering logic and composure. |

### 9.5 Style Guide for Language

- **Avoid cold or technical jargon.** "Error 404" → "Can't find the file, want to retry?"
- **Friendly use of emojis (context-dependent):** 😊 👍. Used at most once per message; never in error/warning copy.
- **Keep sentences short, smart, and clear.** One idea per sentence.
- **Never cutesy or forced** — just steady, helpful, and warm.

### 9.6 Sample Phrases (for UI / system surfaces)

Default phrases for common transient states. These ship as the baseline; personalization may rewrite them at runtime.

| Context | Phrase |
|---|---|
| Starting | "Ready when you are." |
| Task done | "All done. What's next?" |
| Processing | "I'm on it. Just a sec." |
| Error hint | "Looks like we're missing a file." |

### 9.7 UX Strategy Matrix — by task state

What the **interaction surface** does in each state, not just what the *language* does. Pattern decisions ladder up to §8 AI Patterns.

| Task state | UX interaction strategy |
|---|---|
| ✅ Task completed | 1. Proactive suggestion of next steps based on inferred intent (uses `MessageCard` follow-up chips) |
| ❌ Task incomplete / failed | 1. Intent clarification & input reconstruction · 2. Alternative action suggestion · 3. Progressive disclosure (show error reason on demand, not by default) |

### 9.8 Empty-state copy templates

For `EmptyState` component — title is short and action-oriented, description optional.

| Surface | Title | Description |
|---|---|---|
| No chats yet | "Ready when you are." | "Start a conversation — I'll keep track of where we left off." |
| No projects | "Nothing here yet." | "Create a project to bring tasks, files, and conversations together." |
| No search results | "Nothing matched." | "Try a different word, or browse recent items." |
| Connector not connected | "Not connected yet." | "Connect to bring your data into WorkPal." |
| No tasks pending | "All caught up. ✨" | "Nothing waiting on you. Take a moment." |
| No notifications | "All quiet." | "I'll let you know when something needs your attention." |

### 9.9 Error message templates

For inline form/validation errors and full-page error states. Pattern: **identify the issue + offer the next step**, never just "Error" or a status code.

| Situation | Avoid | Use |
|---|---|---|
| Required field empty | "This field is required." | "Add a name so we can save it." |
| Network failure | "Network error." | "Couldn't reach the network. I'll retry — or you can." |
| Permission denied | "403 Forbidden." | "I don't have access to that yet. Connect it on the **Connectors** page?" |
| Model overloaded | "503 Service Unavailable." | "Servers are busy right now. Try again in a moment." |
| Unsaved changes about to be lost | "You have unsaved changes." | "You have unsaved edits — save before leaving?" |
| Unknown / catch-all | "Something went wrong." | "Something didn't go through. Want me to try again?" |

**Rule:** never expose HTTP status codes, stack traces, or model names to the user.
