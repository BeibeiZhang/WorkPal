# WorkPal Design System Rules

> Figma file: `vpMqEZURIWcE8F40GBQJju` | Design System page: `6:166`
> This document maps Figma design tokens and components to code implementations.

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

**Tailwind shortcuts:** `text-text-primary`, `text-text-secondary`, `bg-bg-hover`, `border-stroke-outline` (configured in `tailwind.config.js`).

### 1.2 Brand Gradient

```css
/* Text gradient */
.gradient-text {
  background: linear-gradient(31.6deg, #7652B9 0%, #B46470 51.9%, #CA9D8C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Button gradient */
.gradient-btn {
  background: linear-gradient(183.5deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%);
}

/* Border gradient (chips hover) */
.chip-gradient-hover:hover {
  background:
    linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box,
    linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box;
  border-color: transparent;
}

/* Loading dots: #7652B9, #B46470, #CA9D8C */
```

### 1.3 Typography

| Figma Style | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| `Body/Regular` | SF Pro | 17px | 400 | 22px | -0.43px |
| `Body/Emphasized` | SF Pro | 16px | 700 (Bold) | 32px | -0.43px |
| `Detail/Regular` | Inter | 16px | 400 | 22px | 0px |
| `Headline/Regular` | SF Pro | 17px | 590 (Semibold) | 22px | -0.43px |

**CSS font stack:** `font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Inter', sans-serif`

### 1.4 Spacing

| Figma Token | Value | Tailwind |
|---|---|---|
| `spacing/1` | 4px | `p-1`, `gap-1` |
| `spacing/2` | 8px | `p-2`, `gap-2` |
| `spacing/4` | 16px | `p-4`, `gap-4` |
| `spacing/5` | 24px | `p-6`, `gap-6` |
| `spacing/6` | 32px | `p-8`, `gap-8` |

### 1.5 Border Radius

| Figma Token | Value | Tailwind |
|---|---|---|
| `radius/xl` | 100px | `rounded-full` |
| `radius/full` | 1000px | `rounded-full` |
| Outer shell | 40px | `rounded-[40px]` |

### 1.6 Special Colors

| Usage | Color |
|---|---|
| Active nav border | Brand gradient via `background-clip: padding-box, border-box` |
| StatusTag bg | `rgba(2,137,1,0.1)` |
| StatusTag text | `#028901` |
| Callout/RichText link | `#3171ff` |
| App background gradients | See `.app-bg` in `src/index.css` |

---

## 2. Component Mapping

### 2.1 Sidebar (`src/components/Sidebar.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Nav Item (default) | `269:7666` | `<button>` in chat list | `px-4 py-2 rounded-full gap-4 hover:bg-bg-hover` |
| Nav Item (active) | `269:7682` | `<button>` with `isActive` | Gradient border (brand gradient via `background-clip`) + spinner |
| Account | `113:2933` | Footer section | Profile 35px + bold name + toggle |
| Toggle (Sun/Moon) | `410:30026` | `DarkToggle` component | Pill bg `stroke-toggle`, active icon gets `bg-page` |
| Search Field | `109:3216` | `<input>` | `rounded-full border-stroke-toggle bg-bg-hover` |

### 2.2 Chat Input (`src/components/ChatInput.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Chip | `142:16526` | Quick chip buttons | `rounded-full border border-stroke-outline px-3 py-1 text-base leading-[22px]` + `.chip-gradient-hover` |
| Text Field | `15:2448` | `<textarea>` | `rounded-full bg-bg-hover p-4 text-base` |
| Icon button/L | `246:8880` | Tool buttons | `44x44 rounded-full p-2` |

### 2.3 Message Cards (`src/components/MessageCard.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Card shell | — | `CardShell` | `rounded-[20px] border border-stroke-outline p-5` |
| Card/Checklist | `49:3550` | `TicketCardView` | Checklist items with assignee/due |
| Card/Text only | `86:7812` | `ResearchCardView` | Rich text content |
| Card/Radio list | `67:2363` | `ScheduleCardView` | Radio options |
| Button/Gradient | `67:2980` | Gradient button | `.gradient-btn rounded-full text-white px-4 py-2` |
| Progress bar | `167:54150` | `GradientProgressBar` | 3px gradient bar, `animate-progress-bar` |
| Tag | `1631:31413` | `StatusTag` | `bg: rgba(2,137,1,0.1)`, `color: #028901` |
| Loading dots | `339:8731` | `.loading-dot` CSS | 3 dots with brand colors |

### 2.4 Chat Message (`src/components/ChatMessage.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Action Chip | `142:16526` | Chip buttons after AI message | Same as quick chips + `.chip-gradient-hover` |
| Feedback | `676:35551` | `FeedbackBar` | Thumbs up/down + copy icons |

### 2.5 Chat Panel (`src/components/ChatPanel.tsx`)

| Figma Component | Node ID | Code Element | Key Styles |
|---|---|---|---|
| Avatar Selector | `431:25286` | Avatar circle | `150px rounded-full bg-bg-hover` |
| Welcome title | — | "Hi, Beibei" | `.gradient-text text-[24px] font-semibold` |

---

## 3. Dark Mode

Dark mode is toggled via `.dark` class on `<html>`. All components use CSS variables that automatically switch. Icons use `.icon-theme` class which applies `filter: brightness(0) invert(1)` in dark mode.

## 4. Icon System

- **App icons:** SVG files in `src/assets/icons/`, imported via `src/assets/index.ts`
- **Tool icons:** lucide-react library
- **SF Symbols:** Used for search icon (Unicode `\u{1F50D}` / `????`)
- **Icon sizing:** Always use exact Figma pixel dimensions centered in container
