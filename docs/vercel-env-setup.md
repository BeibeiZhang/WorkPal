# Vercel environment variables — two-project setup

This document is the **exact checklist** to paste into the Vercel dashboard
after the demo-deployment PR merges. Follow it in order.

这份文档是 demo 部署 PR 合并后,需要你在 Vercel dashboard 里照着一项一项配置的**精确清单**。按顺序操作。

## TL;DR

- **Two Vercel projects, one GitHub repo.** Same code, different env vars.
  Vercel auto-deploys both on every push to `main`.
- **`workpal`** (`my-workpal.vercel.app`) = **demo** for HRs/interviewers.
  Minimal env vars, no OAuth, no Supabase.
- **`workpal-beibei`** (`workpal-beibei.vercel.app`) = **your personal**
  external instance. Full env var set.

两个 Vercel project 同一个 GitHub 仓库。同一份代码,不同的环境变量。每次 push 到 `main`,Vercel 自动部署两个。

`workpal` = 公开给 HR / 面试官的 demo。env 变量最少,不走 OAuth,不连 Supabase。

`workpal-beibei` = 你自用的外部实例。全部 env 变量齐全。

---

## Before you start / 开始前确认

- [ ] Both Vercel projects already exist in your dashboard (`workpal` +
      `workpal-beibei`). If not, create them first and connect both to the
      GitHub repo.
- [ ] You know where to find your current env var values — either from the
      existing `workpal` project's Settings → Environment Variables page,
      or from your local `.env` file (`~/WorkPal/Code/.env` and
      `~/WorkPal/Code/server/.env`).

---

## How to add an env var in Vercel / 在 Vercel 里怎么添加环境变量

1. Open <https://vercel.com/dashboard>.
2. Click the project name (e.g. `workpal` or `workpal-beibei`).
3. Click **Settings** in the top nav.
4. Click **Environment Variables** in the left sidebar.
5. For each variable below: type the **Key** (left box) and **Value** (right
   box), leave the three environment checkboxes (**Production**,
   **Preview**, **Development**) all ticked, then click **Save**.
6. After all variables are in, open the **Deployments** tab and click
   **Redeploy** on the most recent deployment so the new env vars take
   effect.

1. 打开 <https://vercel.com/dashboard>
2. 点击项目名(`workpal` 或 `workpal-beibei`)
3. 顶部导航点 **Settings**
4. 左侧栏点 **Environment Variables**
5. 下面每个变量:左边输入 **Key**(变量名),右边输入 **Value**(值),下面三个勾选框 **Production / Preview / Development** 全部勾上,点 **Save**
6. 全部添加完后,打开 **Deployments** 标签,对最新的 deployment 点 **Redeploy**,让新 env 生效

> **Double-check each value before saving.** Vercel does not validate
> anything — a typo in `OPENAI_API_KEY` just means a silent 401 at runtime.
>
> **存盘前再核对一遍值。** Vercel 不做任何校验,`OPENAI_API_KEY` 敲错一个字母,运行时就是静默 401。

---

## Project 1: `workpal` (demo, `my-workpal.vercel.app`)

**Copy these, and ONLY these, into the `workpal` project:**

请**只**把下面这些变量填入 `workpal` project:

| Key | Value | Notes |
|---|---|---|
| `VITE_WORKPAL_DEMO` | `true` | **Required.** Turns on demo mode (DemoBadge, seed chats, read-only memory, mocked connectors). Must be exactly the lowercase string `true`. |
| `OPENAI_API_KEY` | *your OpenAI key* | Chat + voice + image-description work. Use a **separate key with a low spend cap** — this will be hit by strangers. Anthropic billing dashboard → "Usage limits". |
| `TAVILY_API_KEY` | *your Tavily key* | Optional — web search. Skip if you're OK with web search being broken on the demo. |
| `UNSPLASH_ACCESS_KEY` | *your Unsplash key* | Optional — image search. |
| `YOUTUBE_API_KEY` | *your YouTube key* | Optional — video search. |

**Do NOT paste any of these into `workpal`:** `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MEMORY_PASSWORD`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
`ANTHROPIC_API_KEY`. The demo build doesn't use them, and keeping them out
reduces your blast-radius if the demo URL ever gets brute-forced.

**千万不要**把下面这些贴进 `workpal`:`SUPABASE_*`、`MEMORY_PASSWORD`、
`GOOGLE_*`、`ANTHROPIC_API_KEY`。demo 根本不会用,不配就是最小爆炸半径。

---

## Project 2: `workpal-beibei` (your personal, `workpal-beibei.vercel.app`)

**Copy your FULL env var set** — this is now your external personal instance.

把你**完整**的 env 变量集合都贴进来 —— 这是你自己的外部实例。

| Key | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | *your OpenAI key* | Can be your main key. |
| `TAVILY_API_KEY` | *your Tavily key* | For web search. |
| `UNSPLASH_ACCESS_KEY` | *your Unsplash key* | For image search. |
| `YOUTUBE_API_KEY` | *your YouTube key* | For video search. |
| `SUPABASE_URL` | *your Supabase project URL* | For memory + connectors persistence. |
| `SUPABASE_ANON_KEY` | *your Supabase anon key* | Public-read. |
| `SUPABASE_SERVICE_ROLE_KEY` | *your Supabase service role key* | Server-only writes. |
| `MEMORY_PASSWORD` | *your password* | Gates memory mutations. |
| `GOOGLE_CLIENT_ID` | *your Google OAuth client ID* | Gmail + Calendar. |
| `GOOGLE_CLIENT_SECRET` | *your Google OAuth client secret* | Gmail + Calendar. |
| `GOOGLE_REDIRECT_URI` | `https://workpal-beibei.vercel.app/api/auth/google/callback` | **Must match** the redirect URI you registered in Google Cloud Console for this domain. If you haven't added `workpal-beibei.vercel.app` there yet, do that first: <https://console.cloud.google.com/apis/credentials> → your OAuth client → Authorized redirect URIs → add the URL above → Save. |
| `ANTHROPIC_API_KEY` | *your Anthropic key* | Not actually used on Vercel (Claude Code SDK needs a persistent cwd + native binary), but harmless to have set for future migrations. |

**Do NOT set `VITE_WORKPAL_DEMO` on `workpal-beibei`.** The flag being absent
(or not equal to `'true'`) means the app renders normally — no DemoBadge,
real memory, real OAuth.

`workpal-beibei` 上**不要**设 `VITE_WORKPAL_DEMO`。flag 不存在(或不等于 `'true'`)就是正常模式 —— 没有 DemoBadge、走真实 memory、真实 OAuth。

---

## After both projects are configured

1. **Trigger a redeploy** on each project (Deployments tab → … menu on most
   recent deployment → Redeploy → **Use existing Build Cache = off**).
2. **Test the demo in a private/incognito browser window:**
   - Open <https://my-workpal.vercel.app> → you should see a small
     **"Demo / 体验版"** pill in the top-right corner. Click it → the
     bilingual explainer modal appears.
   - Go to **Memory** → you should see a bilingual "Demo mode — seed data"
     banner, read-only entries, no Add/Edit/Delete buttons.
   - Go to **Connectors** → Gmail/Calendar cards show a
     **"Try with demo data / 使用 Demo 数据"** button. Click → the pill
     flips to **"Connected (Demo)"**.
3. **Test your own instance:**
   - Open <https://workpal-beibei.vercel.app> → **no** Demo badge.
   - Memory page → you should see your real memories (or empty if
     Supabase is fresh).
   - Connectors → real Google OAuth popup on click.
4. If anything looks wrong, check **Vercel → Deployments → (most recent) →
   Build Logs** and **Runtime Logs** for errors. The most common miss is
   typos in env var names (must be exact — `VITE_WORKPAL_DEMO`, not
   `VITE_WORKPAL_DEMO_MODE`).

1. **每个 project 手动 redeploy 一次**(Deployments → 最新 deployment 的 "…" 菜单 → Redeploy → **Use existing Build Cache = off**)
2. **在隐私 / 无痕浏览器窗口里测试 demo:**
   - 打开 <https://my-workpal.vercel.app> → 右上角应该有一个 **"Demo / 体验版"** 小 pill。点它 → 弹出双语解释 modal
   - 进 **Memory** 页 → 应该能看到"Demo mode — seed data"双语条幅,只读记忆,没有添加/编辑/删除按钮
   - 进 **Connectors** 页 → Gmail / 日历卡片上按钮写 **"Try with demo data / 使用 Demo 数据"**。点 → pill 变 **"Connected (Demo)"**
3. **测试你自己的实例:**
   - 打开 <https://workpal-beibei.vercel.app> → **没有** Demo 徽章
   - Memory 页 → 显示你的真实记忆(Supabase 是新的就是空)
   - Connectors → 点击真的走 Google OAuth 弹窗
4. 有问题去 **Vercel → Deployments → 最新 deployment → Build Logs** + **Runtime Logs** 看报错。最常见的错是 env 变量名敲错(必须精确 —— `VITE_WORKPAL_DEMO`,不是 `VITE_WORKPAL_DEMO_MODE`)

---

## Troubleshooting / 故障排查

**Demo badge doesn't appear on `my-workpal.vercel.app`:**
- Did you click **Redeploy** after adding `VITE_WORKPAL_DEMO=true`? Env
  vars only apply to *new* builds — they don't retroactively patch an
  existing deployment.
- Is the value exactly `true` (lowercase, no quotes in the value field)?
- Check Build Logs: search for `VITE_WORKPAL_DEMO`. Vite inlines it at
  build time, so you won't see it in runtime logs — only in the built
  bundle.

**徽章在 `my-workpal.vercel.app` 没出现:**
- 加 `VITE_WORKPAL_DEMO=true` 后点了 **Redeploy** 吗?env 变量只对**新** build 生效,不会追溯性地更新已存在的 deployment
- 值必须是精确的 `true`(小写,Value 框里不要加引号)
- 去 Build Logs 里搜 `VITE_WORKPAL_DEMO`。Vite 在 build 时内联这个值,所以 runtime log 里看不到 —— 只在构建产物里

**Gmail OAuth fails on `workpal-beibei.vercel.app`:**
- Double-check `GOOGLE_REDIRECT_URI` matches exactly what's in Google
  Cloud Console's "Authorized redirect URIs" list — scheme, domain, path,
  trailing slash all have to be byte-identical.
- If you have the old `workpal.vercel.app` redirect URI registered but
  not `workpal-beibei.vercel.app`, add the new one (keeping the old one
  is fine).

**Gmail OAuth 在 `workpal-beibei.vercel.app` 登不上:**
- 核对 `GOOGLE_REDIRECT_URI` 和 Google Cloud Console 里 "Authorized redirect URIs" 完全一致 —— 协议、域名、路径、斜杠都要字节级相同
- 如果你之前只注册过 `workpal.vercel.app` 的 redirect URI,没有 `workpal-beibei.vercel.app` 的,就加上新的(旧的保留无害)

**Demo deployment shows real memory / connector data by mistake:**
- This should not be possible — the code guards on `IS_DEMO` for all
  memory and connector calls. If it happens, screenshot + git commit SHA
  of the deployment and open a bug. **Do not share the demo URL until
  fixed** — principle #7 safe by default.

**Demo 页面误显示真实 memory / connector 数据:**
- 代码层面不应该出现 —— 所有 memory / connector 调用都门禁 `IS_DEMO`。如果真发生了,截图 + deployment 的 git commit SHA 开个 bug,**在修复前不要分享 demo URL** —— 原则 #7 安全优先
