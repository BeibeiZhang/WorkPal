# WorkPal Design System Rules

> Figma file: `vpMqEZURIWcE8F40GBQJju` | Design System page: `6:166` (node: `291:11305`)
> This document maps Figma design tokens and components to code implementations.

---

## 1. Design Tokens

### 1.1 Colors (CSS Variables)

Defined in `src/index.css` `:root` / `.dark` selectors.

| Figma Variable | CSS Variable | Light | Dark |
|---|---|---|---|
| `color/text/primary` | `--color-text-primary` | `#142740` | `#FFFFFF` |
| `color/text/secondary` | `--color-text-secondary` | `rgba(20,39,64,0.7)` | `rgba(226,243,255,0.8)` |
| `color/text/tertiary` | `--color-text-tertiary` | `rgba(20,39,64,0.4)` | `rgba(226,243,255,0.4)` |
| `color/background/page` | `--color-bg-page` | `#FFFFFF` | `#001424` |
| `color/background/hover-&-message` | `--color-bg-message`, `--color-bg-hover` | `#F2F3F4` | `rgba(226,243,255,0.1)` |
| `color/background/web-menu` | `--color-sidebar-bg` | `#f2f3f4` | `rgba(226,243,255,0.1)` |
| `color/stroke/outline` | `--color-stroke-outline` | `#E8E8E8` | `rgba(115,178,255,0.2)` |
| `color/stroke/toggle` | `--color-stroke-toggle` | `#e6e8ea` | `rgba(115,178,255,0.2)` |
| `color/icon/primary` | `--color-icon-primary` | `#001424` | `#FFFFFF` |
| `color/state/web-menu/hover` | (inline) | `#e6e8ea` | `rgba(226,243,255,0.1)` |

**Tailwind shortcuts:** `text-text-primary`, `text-text-secondary`, `bg-bg-hover`, `border-stroke-outline` (configured in `tailwind.config.js`).

### 1.2 Brand Gradient

```css
/* Text gradient */
.gradient-text {
  background: linear-gradient(31.6deg, #7652B9 0%, #B46470 51.9%, #CA9D8C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Button/fill gradient */
.gradient-btn {
  background: linear-gradient(183.5deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%);
}

/* Card button gradient (horizontal) */
background: linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)

/* Border gradient (chips, nav items) — padding-box/border-box technique */
background:
  linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box,
  linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box;
border: 1px solid transparent;

/* Loading dots colors: #7652B9, #B46470, #CA9D8C */
```

### 1.3 Special Colors

| Usage | Value |
|---|---|
| StatusTag bg | `rgba(2,137,1,0.1)` |
| StatusTag text | `#028901` |
| Callout / RichText @mention / link | `#3171ff` |
| Selected chip bg | `rgba(49,113,255,0.1)` |
| Selected chip text | `#3171ff` |
| Agent profile bg | `#E5E9F1` |
| Shadow (gradient button) | `0 5px 15px rgba(1,44,197,0.2)` |

### 1.4 Typography

| Figma Style | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| `Page Title` | SF Pro | 40px | 700 | 48px | -0.5px |
| `Body/Regular` | SF Pro | 16px | 400 | 32px | -0.43px |
| `Body/Emphasized` | SF Pro | 16px | 700 | 32px | -0.43px |
| `Detail/Regular` | SF Pro | 14px | 400 | 22px | 0px |
| `Detail/Emphasized` | SF Pro | 14px | 700 | 22px | 0px |

**CSS font stack:** `font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Inter', sans-serif`

### 1.5 Spacing & Border Radius

| Figma Token | Value | Tailwind |
|---|---|---|
| `spacing/1` | 4px | `p-1`, `gap-1` |
| `spacing/2` | 8px | `p-2`, `gap-2` |
| `spacing/4` | 16px | `p-4`, `gap-4` |
| `spacing/5` | 24px | `p-6`, `gap-6` |
| `spacing/6` | 32px | `p-8`, `gap-8` |
| `radius/xl` | 100px | `rounded-full` |
| `radius/full` | 1000px | `rounded-full` |
| Outer shell | 40px | `rounded-[40px]` |

---

## 2. Icons

### 2.1 Icons 24px (`src/assets/icons/`)

| Figma Node | Name | File |
|---|---|---|
| `10:345` | Microphone | `microphone.svg` |
| `15:223` | Voice | `voice.svg` |
| `15:228` | Camera | `camera.svg` |
| `15:255` | Photo | `photo.svg` |
| `15:240` | Upload | `upload.svg` |
| `257:23375` | Send | `send.svg` |
| `410:29953` | Sun | `sun.svg` |
| `410:29958` | Moon | `moon.svg` |
| `72:3378` | Clock | `clock.svg` |
| `1005:30258` | Users | `users.svg` |
| `1005:29312` | Pin | `pin.svg` |
| `675:12029` | Spinner/Progress | `spinner.svg` |

### 2.2 Icons 20px

| Figma Node | Name | File |
|---|---|---|
| `111:2984` | Apps | `apps.svg` |
| `483:23558` | Zoom | `zoom.svg` |
| `1111:30131` | Doc | `doc20.svg` |
| `1111:30139` | Sheet | `sheet.svg` |
| `1111:30193` | Asana | `asana.svg` |
| `1111:30183` | Gmail | `gmail.svg` |

### 2.3 Icons 16px

| Figma Node | Name | File |
|---|---|---|
| `675:11975` | Thumbs up | `thumbs-up.svg` |
| `675:11976` | Thumbs down | `thumbs-down.svg` |
| `675:11974` | Copy | `copy.svg` |
| `876:35440` | Share | `share.svg` |
| `675:11977` | Refresh | `refresh.svg` |
| `965:30509` | Goals | `goals.svg` |
| `965:30452` | Bar chart | `bar-chart.svg` |
| `965:30499` | Doc 16 | `doc16.svg` |

---

## 3. Component Mapping

### 3.1 Sidebar (`src/components/Sidebar.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Nav Item / Default | `269:7666` | `<button>` (inactive) | `px-4 py-2 rounded-full gap-4` + `hover:bg-[#e6e8ea]` |
| Nav Item / Active | `269:7682` | `<button>` (active) | Gradient border `padding-box/border-box` + spinner |
| Nav Item / Hover | `269:7944` | CSS hover | `bg-[#e6e8ea]` (= `--color-stroke-toggle`) |
| Account | `113:2933` | Footer section | Profile 35px + bold name + toggle |
| Toggle Light | `410:30025` | `DarkToggle` | Pill bg `stroke-toggle`, Sun active gets `bg-page` |
| Toggle Dark | `410:30024` | `DarkToggle` | Moon active gets `bg-page` |
| Search Field | `109:3216` | `<input>` | `rounded-full border-stroke-toggle bg-bg-hover` |

### 3.2 Chat Input (`src/components/ChatInput.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Chip / Default | `142:16550` | Quick chip / action chip | `rounded-full border border-stroke-outline px-3 py-1 text-base leading-[22px]` |
| Chip / Hover | `518:36675` | `.chip-gradient-hover:hover` | Gradient border via `padding-box/border-box` |
| Chip / Select | `142:16548` | `.onboarding-chip-selected` | `bg: rgba(49,113,255,0.1)`, `color: #3171ff`, no border, gradient border via `::before` on hover |
| Text Field / Default | `156:47510` | `<textarea>` wrapper | `rounded-full bg-bg-message border: 2px solid transparent` |
| Text Field / Hover | `1202:12169` | `.input-gradient-hover:hover` | Gradient border via `padding-box/border-box` |
| Text Field / Filled | `15:2805` | Focused state | Same gradient border |
| Text Field / Multiline | `72:12105` | Multiline | `rounded-lg` instead of `rounded-full` |
| Icon button / L | `246:8885` | Tool buttons | `44×44 rounded-full` |

### 3.3 Message Cards (`src/components/MessageCard.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Card / Checklist | `49:3550` | `TicketCardView` | Checklist items with @assignee / due |
| Card / Text only | `86:7812` | `ResearchCardView` | Rich text content |
| Card / Radio list | `67:2363` | `ScheduleCardView` | Radio options for scheduling |
| Button / Large | `67:2970` | `GradientButton` | `h-12 rounded justify-center gradient 74deg`, `box-shadow: 0 5px 15px rgba(1,44,197,0.2)`, **no left icon** |
| Progress bar | `167:54150` | `GradientProgressBar` | 3px gradient bar, `animate-progress-bar` |
| Tag | `1631:31413` | `StatusTag` | `bg: rgba(2,137,1,0.1)`, `color: #028901` |
| Loading dots | `339:8731` | `.loading-dot` | 3 dots: `#7652B9`, `#B46470`, `#CA9D8C` |
| Agent Card (creating) | `1541:43057` | `AgentCardView` status=creating | Gradient icon + progress bar |
| Agent Card (ready) | `1541:43882` | `AgentCardView` status=ready | 120px avatar on `#E5E9F1` + intro + button |
| Agent Card (saved) | `1627:45498` | `AgentCardView` status=saved | Same + `StatusTag "Saved"` |

### 3.4 Chat Message (`src/components/ChatMessage.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Action Chip | `142:16526` | Post-AI chip buttons | Same as quick chips |
| Feedback bar | `676:35551` | `FeedbackBar` | Copy, Share, Thumbs up/down, Refresh — 16px icons |

### 3.5 Chat Panel (`src/components/ChatPanel.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Avatar Selector | `431:25286` | Avatar circle | `150px rounded-full bg-bg-hover` |
| Welcome title | — | "Hi, Beibei" | `.gradient-text text-[24px] font-semibold` |

### 3.6 Onboarding (`src/components/Onboarding.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Onboarding Default | `1541:41805` | Full onboarding screen | Steps 1-2 in `Onboarding.tsx` |
| Welcome title | `1541:42444` | `<h1>` | SF Pro 40px/700, `text-text-primary`, left-aligned (NOT gradient) |
| Trait Chip unselected | `1541:42446` | `<button>` | `rounded-full border border-stroke-outline px-[11px] py-[3px]` + `.chip-gradient-hover` |
| Trait Chip selected | `1541:42446` | `<button>` | `bg: rgba(49,113,255,0.1)` + `.onboarding-chip-selected` |
| Onboarding In-progress | `5794:50162` | Steps 3-5 in ChatPanel | Agent creating card |
| Onboarding Complete | `5794:50621` | AgentCardView status=saved | Saved state |

---

## 4. Conversation Flow States (node IDs for reference)

| State | Node ID |
|---|---|
| Onboarding Default | `1541:41805` |
| Onboarding In-progress | `5794:50162` |
| Onboarding Requires Action | `5794:50475` |
| Onboarding Complete | `5794:50621` |
| Research In-progress | `156:43027` |
| Research Complete | `156:43068` |
| Schedule In-progress | `156:42891` |
| Schedule Requires Action | `156:42936` |
| Schedule Complete | `156:42971` |
| Meeting Confirm | `2848:40157` |
| Meeting Complete | `52:4724` |
| Ticket In-progress | `156:42736` |
| Ticket Requires Action | `156:42780` |
| Ticket Complete | `5748:53975` |
| Text Only | `2848:40571` |

---

## 5. Design Principles

These rules MUST be followed when building or modifying any page/component. They override any default assumptions.

### 5.1 Primary Button Rule

**Only ONE primary button (`.gradient-btn`) per page/view.**

- The gradient button is the single highest-emphasis action on the screen.
- All other buttons must use secondary styles: `border border-stroke-outline text-text-primary hover:bg-bg-hover chip-gradient-hover`.
- Having multiple gradient buttons on the same page is a violation.
- Gradient button border radius: `rounded-[4px]`.

### 5.2 Brand Color Budget (1–2% Rule)

**Brand gradient (`#7652B9 → #B46470 → #CA9D8C`) must occupy no more than 1–2% of any page's visual area.**

The brand gradient exists to create a single focal point. Overusing it makes every element compete for attention and dilutes brand impact.

| Allowed | NOT Allowed |
|---|---|
| One `.gradient-btn` per page | Multiple gradient buttons |
| Active nav indicator (sidebar gradient border) | Text colors |
| Urgent item accent bar (thin 4px strip) | Icon colors |
| `.gradient-text` for hero/welcome titles only | Progress bars, badges, tags |
| Loading dots (`.loading-dot`) | Data visualizations |

### 5.3 Default Text & Icon Colors

**All text uses default system colors unless specifically called out.**

| Role | Class | When to use |
|---|---|---|
| Primary | `text-text-primary` | Headings, body copy, labels, most text |
| Secondary | `text-text-secondary` | Descriptions, captions, helper text |
| Tertiary | `text-text-tertiary` | Disabled labels, muted metadata |

- **Never** use brand gradient colors (`#7652B9`, `#B46470`, `#CA9D8C`) for text.
- **Never** use hardcoded hex colors for text — always use the CSS variable classes above.
- **Icons** always use `text-text-primary` (= `var(--color-icon-primary)`) by default.

### 5.4 Callout & Highlight Color (Blue)

**When you need emphasis, selection, or callout — use blue `#3171ff`, NOT the brand gradient.**

| Use case | Style |
|---|---|
| Selected/active chip | `bg: var(--color-selected-bg)` + `color: var(--color-selected-text)` |
| Progress bars | `background: #3171ff` |
| Links & @mentions | `color: #3171ff` |
| Focus indicators | `border-color: #3171ff` |

- Light mode selected: `bg: rgba(49,113,255,0.1)`, `color: #3171ff`
- Dark mode selected: `bg: #3171ff`, `color: #ffffff`

### 5.5 Chip Selected State

**Selected/active chips must use the blue selected style, NEVER `.gradient-btn`.**

| State | Style |
|---|---|
| Default | `border border-stroke-outline text-text-primary` + `.chip-gradient-hover` |
| Selected | `bg: var(--color-selected-bg)` + `color: var(--color-selected-text)` + `border-transparent` |

### 5.6 Typography Scale

**Only 5 text styles exist. Do not invent new sizes.**

| Style | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| Page Title | 40px | 700 (bold) | 48px | -0.5px | Page headings (e.g. "Overview", "Design System") |
| Body / Regular | 16px | 400 | 32px | -0.43px | Default body text, paragraphs |
| Body / Emphasized | 16px | 700 (bold) | 32px | -0.43px | Labels, titles, section headers |
| Detail / Regular | 14px | 400 | 22px | 0px | Metadata, captions, secondary info |
| Detail / Emphasized | 14px | 700 (bold) | 22px | 0px | Emphasized metadata, bold detail |

- Large display numbers (e.g. "10", "+2h") may use larger sizes for data emphasis.
- **Never** use 17px, 13px, 12px, 11px, 10px, or 9px — they are not in the type scale.

### 5.7 StatusTag Colors

**StatusTag (Connected, Sent, Done, etc.) always uses the design system green.**

- Background: `rgba(2, 137, 1, 0.1)`
- Text: `#028901`
- This is the ONLY place this green appears. It is not used for text, icons, or other elements.

### 5.8 Shared-First Development

**Always build reusable UI in `shared.tsx` first.** App pages import from shared — never duplicate component code inline.

- **Workflow:** Define in `shared.tsx` → Import into app pages → Monitor on Design System page → Update once, updates everywhere
- **Avoid:** Inline one-off components in pages, copy-pasting component code, styling variants outside shared file, skipping Design System registration

---

## 6. Dark Mode

Dark mode is toggled via `.dark` class on `<html>`. All components use CSS variables that automatically switch. Icons use `.icon-theme` class (`filter: brightness(0) invert(1)` in dark mode). Gradient avatars/spinner do NOT use `.icon-theme`.

---

## 7. CSS Utility Classes (`src/index.css`)

| Class | Usage |
|---|---|
| `.gradient-text` | Brand gradient text (Welcome title, etc.) |
| `.gradient-btn` | Vertical gradient fill for buttons |
| `.app-bg` | Page background with radial gradient blobs |
| `.chip-gradient-hover` | Unselected chip: gradient border on hover |
| `.onboarding-chip-selected` | Selected chip: `::before` pseudo-element gradient border ring on hover |
| `.input-gradient-hover` | Input field: gradient border on hover (inactive state only) |
| `.animate-progress-bar` | Progress bar fill animation |
| `.loading-dot` | Individual animated dot (use 3 in sequence) |
| `.message-appear` | Fade-in-up for new messages |
| `.icon-theme` | Auto-invert icons in dark mode |
