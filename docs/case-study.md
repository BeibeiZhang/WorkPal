# Designing WorkPal — A Year of AI-Native Product Decisions

> A case study by Beibei Zhang. Updated 2026-05-03.

## TL;DR

**WorkPal** is a desktop AI workplace assistant I designed and shipped over 12 months. v0.1.13 is in production with auto-update. 53 product candidates surfaced, ~33 shipped, ~10 still in pipeline.

I'm a designer. I don't write production code line by line. I drove every product decision, owned the design system, wrote specs, and used **Claude Code's planning + impl agents as my engineering team**. This is what AI-native solo product work looks like in 2026.

This case study walks through 5 product calls I'm proud of, the planning ↔ impl workflow I built, and what I'd do differently next time.

> [Cover screenshot — WorkPal Overview page, real data]

---

## What WorkPal is

A menu-bar Mac app that turns chat into real work on your computer.

- Open `workpal-beibei.vercel.app` on any browser
- Your Mac runs a local Electron agent that exposes Claude Agent SDK on `https://127.0.0.1:3001`
- Type "改一下我的简历加上这个项目" — the AI Globs your resume folder, Reads the file, edits it, commits it, you review and save

Built for: **knowledge workers who want AI to actually do work** — write reports, organize folders, generate weekly digests, edit drafts — not just chat about it.

The wedge: AI has **real filesystem access** via the Claude Agent SDK. Agent runs locally (not in cloud), edits stay on your Mac, full undo via git auto-commit.

> [Screenshot — chat panel + file edit + Output card with "Save to Knowledge" button]

---

## 5 product decisions I'm proud of

### 1. Single input — AI decides what to do

V1 had a "Task vs Chat" mode selector. Users had to pick before they typed.

I killed it. One input. The AI routes the prompt itself: chat reply, file edit, web search, calendar booking, document generation — all from natural language.

**Why:** every selector is friction. If the model picks wrong, that's a model problem, not a UX problem to solve with another dropdown.

This call became Principle #1 in our 15-principle living doc: *"One input, AI decides. Never let the user pick mode."* Every subsequent surface honors it.

> [Before / after screenshot — V1 mode selector vs V2 single input]

### 2. Subtract before adding

In Phase 5.1 I deleted **148 lines** of working code: the multi-select + "move to project" UI for chats.

It worked. No bugs. Users hadn't complained. But it was scaffolding around a behavior people did maybe 0.5 times per week.

Removed it. Bug surface dropped. Sidebar visually calmer. Nobody asked for it back.

**Decision criterion:** *"Default to remove. If users really need it, they'll come ask."*

### 3. Reuse the user's mental model, not invent a new one

When I added Reference Folders (point AI at `~/Documents/我的设计资料/` and let it read files there), I faced a choice:

- **A.** New permission system — let AI write directly into the reference folder
- **B.** Reuse the existing "Complete Session" merge gesture — AI writes to its session working dir, user later chooses whether to merge into the reference folder

I picked **B**. Same mental model users already learned. No new "did I authorize this write?" anxiety. No new UI to teach.

The result: AI gets read access to user's real knowledge, but writes always stay in a safe sandbox until the user explicitly merges. **The hardest UX question (write permission) became invisible** because we reused an existing gesture instead of inventing one.

> [Diagram — Reference Folder read flow → AI writes to session dir → user clicks "Save to Knowledge" → merge]

### 4. Walk back "simpler" when it doesn't fit

In §43.2 I accepted the impl agent's proposal to make the "Save to Knowledge" button always-enabled (simpler logic, fewer states). Click → if no changes, a modal says "already up to date".

Two days later in production, it felt wrong. A saved chat with no new changes still showed the button as enabled = visual lie about state. The button **promises** "you have something to save" — and lying about that breaks trust in the whole UI.

I reverted in §53 to a 3-state reactive button: `saved` (disabled) / `has unsaved changes` (enabled) / `fetching` (undefined, no flicker). More code, but the button now means what it shows.

**Lesson:** "simpler" is the right default — *until* the user's mental model is already established otherwise. When that happens, walk it back. Costing 332 lines was the right tradeoff for a button that doesn't lie.

### 5. Warmer copy as a reward, not just status

For the Overview "All clear" banner: the obvious copy is functional — "No chats waiting. No agents running. No scheduled tasks."

I pushed for warmer: **"🎉 Nothing pending, nothing running, nothing scheduled. Nice work — take a break."**

Tiny detail. But AI products especially need this. The AI is doing a lot. The user can feel disposable. Every banner is a chance to acknowledge they did good work, not just report system state.

The 8 banner permutations (combinations of which sections are empty) each have hand-tuned positive copy. None say "no". All say things like "Inbox zero", "AI's resting", "Open runway". This is the design taste that doesn't show up in PRDs but compounds across thousands of micro-moments.

---

## How I work — Planning + Impl agents

I don't write production code. I work with Claude Code agents in two roles:

- **Planning session** (me): write specs, review PRs, make product calls, maintain living docs
- **Impl session** (separate cowork agent): receive spec, propose implementation plan, write code, open PR, run tests

> [Diagram — Planning ↔ Impl ↔ Beibei merge cycle]

**Standard cycle per feature:**

1. I write a spec entry in `docs/post-phase-6-candidates.md`
2. I write an impl prompt (terse: role lock + spec ref + verify path + standard handoff footer)
3. Cowork agent grep-verifies spec assumptions, proposes plan back to me
4. I review the plan (high-quality plan flags spec drift + pre-flags pitfalls)
5. Cowork implements + self-runs `/engineering:code-review`
6. PR opens, I do spec compliance + product taste review (live-test if risky)
7. I merge. Document the lesson. Move § entry from candidates to archive.

**Throughput:** 53 product candidates surfaced over 12 months. ~33 shipped. Average sub-feature: 1-3 days end-to-end. Phase 7 (Electron menu-bar agent + HTTPS + GitHub Releases CI + auto-update — 5 sub-phases) shipped in **~2 calendar days**.

**Quality:** 6 mid-PR bugs caught by planning live-test. 0 reached production. Two-layer net — impl-side plugin review + planning-side spec compliance.

The skill isn't writing better code. It's:

- Writing **better specs** (terse, decision-locked, with "open for impl change-list" sections)
- Maintaining **living docs** (specs evolve with each ship; archived after merge for searchable history)
- Knowing **what to live-test** vs trust the system (Principle #12 — risk-routed testing)
- Treating the AI agent as a **collaborator with different judgment**, not a tool to dictate to

This is real. This is shippable. This is now.

---

## What I'd do differently

**Invested in test infra earlier.** I didn't add automated routing tests until v0.1.13 (§28, vitest unit). Before that, every routing/prompt change cost me ~30 minutes of dmg install + browser test cycle. Across hundreds of PRs that's weeks of avoidable manual verification. The 1-2 hour upfront cost would have paid back month one.

**Started with 3-tier docs from day 1.** I began Phase 5 with one big `phase-5-requirements.md`. By Phase 7 the candidates doc was 1100+ lines and I had to split it into pending vs archive. Should have started: *milestone summary + pending backlog + shipped archive* — three docs, three audiences, no drift.

**Killed dead candidates faster.** Some candidates lived in the backlog for months before I decided they weren't worth doing. Should have moved to a `parked` state at first review, not let them haunt active planning.

---

## Why this matters for AI-native design

AI is changing what "designer" means. I'm not arguing every designer needs to code. I argue every designer needs to **operate AI systems with the same instinct they use to operate Figma**.

The real skill set is:

- **Knowing when to subtract** — Most AI features should be removed before they're added
- **Knowing when to override the model** — When AI's "simpler" violates the user's mental model, push back
- **Knowing what to live-test** — Risk-routed testing, not ceremonial QA
- **Treating the AI agent as a collaborator** — With different judgment, not a tool to dictate to

WorkPal is my proof: **one designer with strong product taste + AI as the engineering team can ship production-grade software solo.** Not a prototype. Not a Figma mockup. A real .dmg that auto-updates daily.

If this is what one designer can do in 2026, design teams in 2027 will look very different.

---

## Stack

- React 18 + TypeScript + Vite + Tailwind CSS 3
- Electron menu-bar agent (`LSUIElement: true`, launchd auto-start, dual-arch dmg)
- Claude Agent SDK + Anthropic API + OpenAI fallback
- Express backend (dev) → mirrored to agent shared lib (production runs the agent, not the server)
- Supabase persistence (chats / projects / artifacts cross-device sync)
- Vercel hosting (web frontend) + GitHub Releases CI (dmg auto-update)

---

## The living docs

This case study is a snapshot. The product itself runs on living markdown:

- [`docs/principles.md`](./principles.md) — 15 principles formed in Phase 5, validated in 6/7
- [`docs/phase-history.md`](./phase-history.md) — Phase 1-7 milestone history
- [`docs/post-phase-6-candidates.md`](./post-phase-6-candidates.md) — pending backlog (10 entries)
- [`docs/post-phase-6-archive.md`](./post-phase-6-archive.md) — shipped archive (36 entries with root-cause + fix detail)

Everything in this case study is verifiable in the repo.

---

## Repo + contact

- GitHub: [BeibeiZhang/WorkPal](https://github.com/BeibeiZhang/WorkPal)
- Web: [workpal-beibei.vercel.app](https://workpal-beibei.vercel.app)
- Demo: [my-workpal.vercel.app](https://my-workpal.vercel.app) (no install required)
- Beibei Zhang — [LinkedIn / Twitter / email — to fill]
