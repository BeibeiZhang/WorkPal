# WorkPal Demo Checklist

> Run this **before any demo, HR walkthrough, case study screenshot, or live recording**. Any one item failing = don't demo. 5-minute pass.

## Pre-flight (browser hygiene — 1 min)

- [ ] Open **Incognito mode** (Chrome / Safari) — strips Grammarly / LastPass / 1Password / translation extensions that inject UI noise
- [ ] Hard-reload `https://workpal-beibei.vercel.app` (`Cmd+Shift+R`) — bust stale cache
- [ ] DevTools open, Console tab visible — catch JS errors mid-demo before HR notices

## Core flows (data integrity — 2 min)

- [ ] **Chat round-trip**: New chat → type "hello" → AI replies → close tab → reopen → chat history intact (no "chat lost" bug)
- [ ] **Send English message**: type "test message" → no Grammarly icon overlay (extension off in incognito) — chat input clean
- [ ] **Sidebar Recents**: chat list sorts by latest activity (not random order)
- [ ] **Profile page (if applicable)**: cross-device data loads (not stuck on loading skeleton)

## Overview page (numbers must be real — 1 min)

- [ ] **API Spend section**: switch 1d → 7d → 30d Range tab — numbers change reasonably (not stuck at $0 / NaN / undefined)
- [ ] **Subscription Health Check**: numbers + Verdict **stable across 1d/7d/30d** (per §55 fix — Voice mode same number on all three tabs)
- [ ] **Needs Your Eyes / Agents at Work / Scheduled** sections: render without console error

## Agent reachability (Mac only — 30 sec)

- [ ] Local **WorkPal Agent.app** running (menu bar icon visible)
- [ ] In incognito browser open vercel.app — Sidebar shows "Agent reachable" green dot or status indicator
- [ ] Type "改一下 src/App.tsx" in chat → Progress panel shows `Glob` / `Read` / `Bash` (Claude SDK path), **NOT** `search_gmail` (OpenAI fallback). If wrong path → §21 routing broke, abort demo

## Visual sanity (4 min — light + dark + mobile)

- [ ] Toggle **Light mode** → no text out-of-bounds, no truncated `file://` URLs (per Beibei screenshot 2026-05-04), no overlapping elements
- [ ] Toggle **Dark mode** → same checks, plus `--color-error` resolves to `#F97066` not stuck at light value
- [ ] Open DevTools → resize to **iPhone @ 375px** (mobile responsive) → no `OnboardingSurface` slamming the chat panel; AI features show graceful `AgentRequiredHint`
- [ ] **Focus a chat input** — no double focus ring (per §56 fix); only the wrapper purple/pink gradient should appear

## Demo URL sanity (if demoing `my-workpal.vercel.app` for HR)

- [ ] Demo URL → "Hi, Beibei" greeting renders (no LoginScreen hold-up)
- [ ] DemoBadge visible top-right
- [ ] AvatarMenu shows 5 items (no "Sign out" — per §2 demo gate)
- [ ] Memory page → read-only banner; Add / Edit / Delete UI hidden
- [ ] Connectors page → all "Connect" buttons say "Try with demo data"

## Pre-share final check

- [ ] **Take 1 fresh screenshot of each page you'll show** — file URLs not truncated, numbers loaded, no spinner stuck
- [ ] Walk through the actual demo script silently in your head once — no surprises
- [ ] Have **Sandbox URL** + **Live demo (Calendly) URL** + **Case study URL** in clipboard — paste-ready

---

## If something fails

1. **Don't demo** — better to delay than show broken to HR
2. **Screenshot the failure** — share with planning session
3. Planning opens § candidate → impl session fixes → re-verify with this checklist before re-attempt

## Maintenance

This checklist evolves. After every demo, add new items if you caught a bug not yet listed. Remove items that turned out to never fail (false-positive noise).

Last updated: 2026-05-04 (initial version, post §55+§56 ship)
