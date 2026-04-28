# WorkPal Phases 1–7 History

这份文档是**历史回顾**，不是当下工作。每个 Phase 各自的 **living doc**（`docs/phase-N-requirements.md`）记录细节、locked decisions、context blocks per sub-step；这份文档是 milestone 浓缩版，给后来人 5 分钟读懂全局。

## Overview

| 阶段 | 主题 | 近似时间 | 主要 PR / 标记 |
|---|---|---|---|
| **Phase 1** | 前端 prototype + 模拟 AI 流程 | 2025 年底 | V0–V1（pre-PR） |
| **Phase 2** | 真实后端：Express + OpenAI GPT streaming | 2026 年初 | Backend Phase 1 |
| **Phase 3** | 连接器 + 真实工具调用（Gmail/Calendar/Google OAuth） | 2026-02 → 2026-03 | PR #60, #61 |
| **Phase 4** | V2 → V3 UX 大改造：single-input + Promote-to-Project + Dashboard + PermissionPrompt UI | 2026-04-18 | PR #64（tag `v2-with-task-button`） |
| **Phase 5** | Claude Code SDK 集成：真 agent / 真文件 / 真权限 / 真 undo | 2026-04-18 → 2026-04-19 | PR #67, #68, #69, #70, #71, #73, #75 |
| **Phase 6** | Worktree 并行隔离：project=git repo / session=worktree / Complete=git merge --ff-only | 2026-04-19 → 2026-04-20 | PR #80–#86 |
| **Phase 7** | Web + 本地 Agent（deployment shape C）：menu-bar Electron app + HTTPS + GitHub Releases CI + 真 v1 launch | 2026-04-24 → 2026-04-25 | PR #128, #129, #131, #133, #134, #135（含 candidate #7/#8/#9/#10 中间 ship） |

---

## Phase 1: Frontend-only prototype

**目标**：把"AI 工作助手"的交互想法可视化。

- React 18 + TypeScript + Vite + Tailwind
- 纯前端，**所有 AI 流程 simulated**（data.ts 里预埋对话 + 模拟响应）
- Demo 流程：Meeting notes → Ticket、Research、Schedule 等卡片
- 角色：走通 UX 原型、拿反馈

**当时还没有**：真 LLM、真文件、真 agent。所有"AI 回复"都是 `setTimeout` 模拟。

---

## Phase 2: Real backend (Express + OpenAI streaming)

**目标**：把 prototype 的模拟响应换成真 LLM。

- 新增 `server/` 目录（Express）
- 接 OpenAI GPT（streaming）
- SSE 把 token 流到前端聊天气泡
- Dual-track 聊天逻辑：chat 模式 vs task 模式

**核心文件**：`server/src/routes/chat.ts`, `server/src/lib/llm.ts`

**当时还没有**：连接器、工具调用、Claude Code。只是"文本对话"层级的 LLM 集成。

---

## Phase 3: Connectors + real tool-calling

**目标**：让 AI 真的能帮用户做事，不只是聊天。

- **Gmail / Calendar 连接器**：读邮件、查日历、发邮件、建会议
- **Google OAuth 流程**：用户授权 → token 存 Supabase → server 代用户调 API
- **Task mode real tool-calling**：LLM 返回 tool_use → server 调真 API → tool_result 塞回对话
- **Memory 系统**：用户的长期偏好持久化（Supabase 表）

**相关 PR**：
- #60 — Nav 重组（Connectors/Library/Memory/Onboarding 收进 avatar menu）
- #61 — 连接器真实持久化 + Google OAuth + Task mode real tool-calling

**serverless 相关**（可以算 Phase 3 尾声 或 Phase 4 前奏）：
- #62 — Gmail + Calendar 工具 port 到 Vercel serverless
- #63 — 整合 connector + OAuth 路由 / 换用 per-API sub-packages 塞进 Vercel 12-function 限制

**核心学到**：`feedback_never_request_secrets_in_chat.md`、`reference_google_oauth_setup.md`

---

## Phase 4: V2 → V3 UX refactor

**目标**：砍掉显式 "Task vs Chat" 选择，AI 自己判断。

这是 WorkPal 产品哲学的转折点 —— **"单一输入，AI 决定"** 首次落地。

**一次性大改（PR #64, commit `827d323`）**：

1. **砍掉 Chat/Tasks/Code mode selector** —— 用户再也不用选模式
2. **Auto-open inspector panel** —— LLM 第一次 tool_active 就触发面板展开
3. **Session folders** —— Chat.sessionFolder（slugify 保留 CJK）+ folder chip
4. **Promote to project** —— Session 可以升级成 Project
5. **Multi-select + Move to project**（后来在 5.1 被砍）
6. **Dashboard Scheduled** —— 定时任务 section + SourceChip + Pause/Run now
7. **Changes card with Undo UI**（UI 做好，5.5 才接真 git）
8. **PermissionPrompt 组件**（4 种 kind：file-write/read/command/external-url；5.4d 才接真 canUseTool）

**历史标记**：
- Tag `v2-with-task-button` —— V2 最后一版（带显式 Task 按钮），用于演示对比
- 静态 demo 在 `../Demo History/v2-with-task-button-2026-04-18/`

---

## Phase 5: Claude Code SDK integration

**目标**：把 WorkPal 的 UI **真接**到 Claude Code，让用户真的能让 AI 改本地文件。

这是迄今为止最长、最复杂的一条链。**所有细节在 `docs/phase-5-requirements.md` 的 living doc 里**；下面是高层 summary。

### 5.1 – 5.3: Simplification + lazy folder (PR #67, commit `101c0c6`)

pre-cleanup 阶段：
- **5.1** 砍 Recents 多选 + 批量 move UI（-189 行 Sidebar.tsx）
- **5.2** 修单 session 菜单缺 "New project…" bug
- **5.3** Lazy folder materialization（frontend flag，真实 mkdir 在 5.4e）

### 5.4a – 5.4e: SDK wiring

| Sub-step | PR | Commit | 做什么 |
|---|---|---|---|
| **5.4a** | #68 | `0ff403b` | 装 `@anthropic-ai/claude-agent-sdk`；subprocess + log stream 验通 |
| **5.4b** | #69 | `9fc9365` | SSE streaming + 意图路由（关键词 EN+CN） |
| **5.4c** | #70 | `757be62` | tool_use → inspector + Changes；tool_result → Progress step completed |
| **5.4d** | #71 | `6683788` + `04d2591` | canUseTool → PermissionPrompt 桥接；FIFO 队列；useRef race fix |
| **5.4e** | #73 | `1b64629` + `f02cfd4` | 真实 sessionFolder cwd；eager mkdir + rmdir cleanup；Finder open |

### 5.5: Auto-commit + real Undo via git (PR #75, commits `ed29387` + `742d6fb`)

- 每次文件修改工具成功 → 自动 `git commit`
- Undo 按钮 → POST `/undo` → `git reset --hard HEAD~1` → UI 标 "Undone"
- 纯 Q&A 不 init git，所以 rmdir cleanup 还能正常跑

### 附带改动

- **PR #72** — Design System pause video 修复（非 Phase 5 主线，但并行做了）

---

## Phase 6: Worktree-based parallel session isolation

**目标**：让多个 session 真正物理隔离 —— 用户在 chat A 改文件，chat B 同时改另一个分支的文件，互不污染。

**核心心智模型**：**project = git repo（main 分支）；session = worktree of main；Complete Session = `git merge --ff-only` 把 session 工作折回 project**。

### 6.1 – 6.5 sub-steps

| Sub-step | 做什么 |
|---|---|
| **6.1** | Project-init useEffect：`activeProjectId` 切换时一次性 `postInitProject` 创 git repo + baseline commit。Idempotent（已存在跳过）。 |
| **6.2** | Session = worktree of project main：postSessionStart 创 `session/<slug>` 分支 + `git worktree add` 到 `~/WorkPal/<project>/sessions/<slug>/`。SDK cwd 切到这个 worktree。 |
| **6.3** | Complete Session 按钮 → diff preview modal → `git merge --ff-only` 把 session 分支折回 main → worktree 清理。non-FF 失败时给"复制 CLI"兜底。 |
| **6.4** | 复制到剪贴板的 CLI 命令兜底 non-FF（手动 rebase/merge）。 |
| **6.5** | Mount-time orphan worktree reaper：app 启动时扫每个 project 的 worktrees，对照 chats 列表标记孤儿 (`session/<slug>` 分支但 chat 不存在或已 sessionCompleted) → 清理。 |

### 关键决策

- **Mental model 用户视角**：不暴露 git 术语。用户只看到 "Complete Session" 按钮，背后是 merge。
- **session 分支命名**：`session/<chat-slug>`，slug 保留 CJK（principle #8 双语 from day 1）。
- **non-FF 处理**：不强制 rebase（破坏性），给用户一条 CLI 命令复制走，他自己决定。
- **Reaper 触发时机**：mount-time 一次，不是周期性。empty deps + reaperRanRef 确保只跑一次（这条在 7.4 升级后还保住了）。

### Lessons sealed for 7.x

- 路径流向：UI 的 chat-slug → `~/WorkPal/<project>/sessions/<slug>` → SDK cwd → git 分支名，**全程一致**。
- "Complete = merge" 的隐喻自然：用户不学 git 也能用，但 git 在底下保所有可逆。
- Lazy mkdir + 用完清理（继承 5.4e 的范式）：非常态 worktree 不持久占盘。

---

## Phase 7: Web + Local Agent (deployment shape C)

**目标**（最重的一 Phase）：把 Claude Code SDK 从 dev-only `localhost:2006` 推向**任何 Mac 用户从 vercel.app 直接编辑本机文件**的产品形态。

**Deployment shape C** 在 Phase 6 末尾被锁定（其他选项 A/B 被否）：
- **A**：把 server/ 全搬上 Vercel serverless — Claude Code SDK 用不了（需要持久 cwd + native binary）
- **B**：用户跑 dev server 自己开 — 不能成为产品
- **C** ✅：Web UI 留在 Vercel + 装一个**菜单栏 Electron agent** 在用户 Mac 跑本地 API + HTTPS + auto-update

**5 个 sub-phase 全部在 ~2 calendar days 内 ship 完（2026-04-24 → 2026-04-25）**，比 10–13 天估计快了一截。

### 7.1 – 7.5 sub-steps

| Sub-step | 做什么 | PR | 关键决策 / 教训 |
|---|---|---|---|
| **7.1** | Electron agent shell：菜单栏图标 + Settings 窗口 + launchd 自启 + 双 arch DMG（无 API 内容） | [#128](https://github.com/BeibeiZhang/WorkPal/pull/128) | `LSUIElement: true` + 单实例 lock + window-close-hides + plist 动态 `process.execPath` 自愈 |
| **7.2** | 把本地路由（`claudeChat` / `project` / `session` / `reaper` + 6 个 lib 文件）通过 copy-sync 脚本搬到 agent；agent main flip CJS → ESM；HTTP on :3001 | [#129](https://github.com/BeibeiZhang/WorkPal/pull/129) | **ENOTDIR saga**：`asar: true` 默认通过 `import.meta.url` 虚拟化路径，SDK 自带 binary spawn 失败。修法：`asar: false`（卸所有 .app size 80MB → 160MB 但根除整类问题） |
| **7.3** | Local CA mkcert pattern + HTTPS on :3001 | [#131](https://github.com/BeibeiZhang/WorkPal/pull/131) | **3 个 mid-PR bug 全被 live-test 拦下**：(A) `app.getPath('userData')` 实际是 `workpal-agent`（package.json name 而非 productName）；(B) System Keychain + osascript admin 在 LSUIElement context 失败 → **shift 到 login keychain mkcert pattern**（无 sudo + Touch ID）；(C) Chrome 130+ PNA preflight 静默挂 → 加 `Access-Control-Allow-Private-Network: true` |
| **7.4** | Frontend rewire：`IS_CLAUDE_CODE_AVAILABLE` → `IS_AGENT_REACHABLE` 的 live `/health` probe + `fetchAgent()` wrapper + `OnboardingSurface`（agent 不可达时挂 chat 区域） | [#133](https://github.com/BeibeiZhang/WorkPal/pull/133) | Clean ship 0 mid-PR bugs。Probe 三场景：boot + window.focus + on-fetch-failure。1500ms timeout + 300ms boot debounce 关掉 `app.whenReady → listen()` 200ms race |
| **7.5** | GitHub Releases CI on tag push（dual-arch DMG + tag/version guard fail-fast）+ boot-time update check（GitHub API + 内联 x.y.z semver compare + 5th Settings card） | [#134](https://github.com/BeibeiZhang/WorkPal/pull/134) | Clean ship 0 mid-PR bugs。`make_latest: 'true'` 守 OnboardingSurface CTA 的 `/releases/latest` redirect。Tag-version guard 在 build 之前 fail-fast 省 10min |

### v1 实际 launch 流程（2026-04-25）

1. `git tag v0.1.0` → push → CI 跑 ~10min → 第一个真 GitHub Release 发布
2. 浏览器测 `OnboardingSurface` CTA → 真下载 .dmg ✅
3. `agent/package.json` bump → `git tag v0.1.1` → push → 第二个 Release
4. 重启 v0.1.0 agent → boot-check 命中 latest=v0.1.1 → Settings 第 5 张 "Update available" 卡 ✅
5. Beibei 下载 v0.1.1 .dmg → 撞 Sequoia "已损坏" → `sudo xattr -dr com.apple.quarantine` 清 → 装到 /Applications → 双击打开 → 真 v1 落地

### Phase 7 retrospective

- **5/5 sub-phase shipped 在 ~2 calendar days**（vs 10-13 天估计）
- **6 mid-PR bugs 全部被 planning live-test 拦下，0 进 main**（principle #12 风险路由测试 ROI 实打实）
- 两个 clean-ship phase 连在一起（7.4 + 7.5）证明 pattern：planning 在 doc 把 6 个 question 写全 + 答案锁定 → impl 直接落地 + self-test → planning code review + live-test → merge
- 最微妙的 bug：7.3 Bug B（LSUIElement menu-bar app 的 `SecTrustSettingsSetTrustSettings` admin domain auth 失败）只能在打包 .app 跑 launchd 才能 reproduce —— typecheck + sandbox-preview 触不到
- **新增 4 个 candidate** to backlog（[`docs/post-phase-6-candidates.md`](./post-phase-6-candidates.md)）：
  - **#11** `animations.ts` cleanup
  - **#12** `agentVideoStatus.ts` ephemeral storage
  - **#13** Sequoia "已损坏" Gatekeeper（Option A docs-only 已 ship via [#135](https://github.com/BeibeiZhang/WorkPal/pull/135)；Option C 签名 + notarize 还在 backlog）
  - **#14** OnboardingSurface 命令字段升 `<code>` 渲染

### Phase 7 lessons sealed for post-7

- **Sequoia 对 unsigned + browser-downloaded .app 显示"已损坏"对话框**（不是"未识别开发者"）。GUI 没有 Open Anyway 按钮（实测确认）。Workaround `sudo xattr -dr com.apple.quarantine`。永久解只有 Apple Developer enrollment + notarize（$99/yr，candidate #13 Option C）。
- **`server/` 和 `agent/src/shared/` 双副本现实**：Phase 7.2 选了 copy-sync 脚本（`scripts/sync-agent-shared.sh` + `check-agent-shared-sync.sh` drift check）而非 npm workspaces。**未来动 server/src/{routes,lib}/ 任何代码必须 sync**。Drift check 在 CI / 手动跑都能截。
- **Auto-update 是 boot-only**（candidate followup 是周期性 24h re-check）。用户每天重启就够；保持 daemon 长跑的用户拿不到通知，单加一行 `setTimeout` 就行。
- **`/releases/latest` URL 是 load-bearing**：[`OnboardingSurface.tsx`](../src/components/OnboardingSurface.tsx) CTA + [`updateCheck.ts`](../agent/src/main/updateCheck.ts) 都依赖这个 redirect。改 release tag 命名规则前先确认它还指 `.dmg`。
- **launch.json 是 tracked 文件**：impl 自测加 entry **必须在 push PR 前 back out**（PR #135 review 又踩了这个坑，下次直接 reject 那段）。

---

## Lessons extracted

Phase 5 一路踩下的坑和形成的宗旨，**沉淀在 `docs/principles.md`**（15 条）。读那份。Phase 6/7 在那 15 条之上没新增 principle，但有几条 sub-pattern 在 7.x 反复验证：

- **复用，不重造**（用 Claude Code SDK / Electron / electron-builder / softprops/action-gh-release，不自己写）
- **Shared decisions 一次锁定**（双语决策、agent base URL、cert validity windows、tag scheme）
- **懒创建 + 完事清理**（5.4e mkdir/rmdir → 6.5 reaper → 7.3 cert renewal silent on success）
- **前端生成的 path 一路下传**（UI = 磁盘 = git = 日志 = SSE chunks 全程一致）
- **按风险路由测试**（异步/权限/git/auth 必测；视觉/文案跳过；live-test catches 多在打包/真分发链上）

---

## 当前状态（2026-04-28）

**Phase 7 完整收官 + v0.1.5/v0.1.6 production launched + Reference folders 整链路 + AI 真主动用 ref folder 闭环 + Output preview**：
- WorkPal Agent **v0.1.5/v0.1.6** from `/Applications/WorkPal Agent.app`，launchd 开机自启（v0.1.5 = §22 prompt polish；v0.1.6 = §23 Output preview + reveal-in-finder）
- 用户主入口：**`https://workpal-beibei.vercel.app/overview`**
  - 这台 Mac（agent 跑着）：**全 English UI** + 全功能（聊天 + 编辑本地文件 + git + reference folders + native folder picker + **§22 AI 锁定在 ref folder 内搜** + **§23 Output card 点击预览 + Finder 高亮**）
  - 其他 Mac：OnboardingSurface 引导装 agent
  - **iPhone**：cloud-only + §15 mobile graceful degrade + Complete Session button mobile gate（visible-but-disabled + 5s tip）+ §23 Output card mobile silent no-op
  - Demo URL（my-workpal.vercel.app）：mocked，但 chat **真接 OpenAI**（不是 mock）；Agent Video Status 跨域同步自 workpal-beibei
- 用户体验链路（§21 ship 后真闭环）：用户在 ProjectPage 挂外部 reference folder（native picker 选）→ 在该 project chat 里说"加点东西到我简历"等**完全无关键词的自然语言** → §21 channel-aware routing 自动走 Claude（不靠关键字）→ §22 严格 prompt 让 AI Glob ref folder + Read 候选（不漫游 ~/Documents）→ Write 改后版本到 session/outputs/ → ProjectPage Output 区出现 card → §23 点击 card 右侧 DetailPanel 预览 markdown / Finder icon 一键 reveal 文件位置 → 用户点 Complete Session → 选并入 project main / reference folder（Copy semantic 保留 git protection）→ 下次 session 该 output 成为 reference folder 知识库一员
- Update 路径：boot-check → GitHub `/releases/latest` → 5th Settings card → 用户下 .dmg → 装

**最近 ship**（按时间倒序）：
- **PR [#153](https://github.com/BeibeiZhang/WorkPal/pull/153)** (2026-04-28, **frontend-only Vercel auto-deploy 不需 dmg**) — `feat: ProjectPage Output legacy path backfill + icon Primary color (#31 #32)`。8 文件 +302 −8。§31 = 新 `POST /api/project/scan-outputs` (agent + server mirror) + `indexProjectOutputs` 递归 walk sessions/ 5000 cap + `backfillLegacyOutputPaths` DI pure fn + App.tsx `backfilledProjectsRef` Set 守卫 + `setProjects` updater closure concurrent-edit safe。§32 = ProjectPage Output icon `text-text-tertiary` → `text-text-primary` (light only)。Plan-quality 持续高（继 §22/§23 后第三个 plan 体现：grep-verify spec → 自加 3 个 safety pattern beyond spec — DI / idempotent guard / concurrent-edit re-merge）。Multi-match drop 比 spec 严格（避免 wrong-path overwrite）。
- **PR [#152](https://github.com/BeibeiZhang/WorkPal/pull/152)** (2026-04-28, **v0.1.6 dmg**) — `feat: local-file Output detail panel + Finder escape (#23)`。7 文件 +310 −90。点击 Output card → SplitView 右侧 DetailPanel inline 预览（markdown/html/plaintext）。Panel 头部 Finder icon → 新 `POST /api/claude-chat/reveal-in-finder` route (`open -R`) 弹 Finder 高亮文件。Binary 文件（pdf/docx/png 等）BINARY_EXT regex 客户端预判 → DetailPanel `unsupported` mode 双 button (Reveal in Finder / Open with default app)。Mobile silent no-op + Finder hidden。State 拆 chat/project 独立（防跨页面 preview 串台），shared `handleArtifactPreview` callback + `renderPreviewPanel` helper。Plan-quality 高：impl Key Findings 段 grep-verify 80% 已存在（`read-file` endpoint + `renderMarkdownBlocks` lib），只新加 reveal-in-finder route。
- **PR [#151](https://github.com/BeibeiZhang/WorkPal/pull/151)** (2026-04-28, **v0.1.5 dmg**) — `feat: tighten §19 reference folder prompt to forbid out-of-scope search (#22)`。String-only edit (2 mirror files +2 −2)。在 `REFERENCE_FOLDERS_PROMPT` paths 列表后插 hard prohibition："These folders are your ONLY source of user content. Do NOT use Bash `find ~`, `ls /Users/...`, or any Glob outside these paths. If the content isn't in these folders, say so explicitly. Don't roam other directories."（plan reasoning: top 位置比 bottom 强）。Backtick escape 提前 flag 避坑。Out-of-scope 自提 §27 (Tool-level Bash deny) 作为软约束失败 backup。
- **PR [#150](https://github.com/BeibeiZhang/WorkPal/pull/150)** (2026-04-28, **v0.1.5 dmg**) — `feat: project ref-folder defaults text chat to Claude (#21)`。Single-file change in `intentRouter.ts` + 1 caller wire (App.tsx handleSend)。`getAgentRouteIntent` 加第 3 参数 `referenceDirectories: string[]`，新 branch 在 IS_DEMO 之后 / keyword 之前：`length > 0 && isAgentCurrentlyReachable() → 'use-claude'`。Channel-aware routing 解决 keyword router miss 自然语言长尾问题（"加 / 加到 / 提一下" 不在 keyword 列表）。Live 验证：项目挂 ref folder + 自然语言 prompt → progress 面板 Glob/Read/Bash 而不是 search_gmail = §19 system prompt 真注入。
- **PR [#147](https://github.com/BeibeiZhang/WorkPal/pull/147)** (2026-04-28) — Sync agent video status across deployments via Supabase。把 §12 ship 的 localStorage-only video status 升级成 Supabase-backed cross-deployment sync（workpal-beibei 控制 master，demo cross-origin 读）。Beibei 平行 fast-lane session，未走主 candidate 流程。
- **PR [#146](https://github.com/BeibeiZhang/WorkPal/pull/146)** (2026-04-28) — `feat: AI proactively uses reference folders + merge session to reference folders (#19 + #20)`。§19 = system prompt 引导 AI 主动 Glob ref folder 不 hallucinate Gmail。§20 = Complete Session 加并入到 reference folder 选项（Copy semantic, atomic abort policy）+ 新 Checkbox 共享 primitive + AgentRequiredHint customMessage prop + 5 个新 design system token（accent-blue-faint pair / overlay-loading / fixed-dark-text / tooltip-bg / 已 in #144 的 error）+ Mobile §15 gap fix（visible-but-disabled tip）。Bundle 一个 PR。
- **PR [#144](https://github.com/BeibeiZhang/WorkPal/pull/144)** (2026-04-27) — `chore: UI English sweep + picker hotfix + design system tokens (#18)`，38 文件 +286 −292。Bundle 6 件：§17 picker hotfix + §18 双语 sweep（79 strings × 19 files）+ `--color-error` token + accent.* Tailwind class extension + one-off hex tokenization + alpha-modifier silent-failure 24 处 cleanup。包含 principle #8 翻转中触发 + CLAUDE.md violations + extend-don't-bypass 段添加 + stale memory 清理。
- **PR [#143](https://github.com/BeibeiZhang/WorkPal/pull/143)** (2026-04-27) — §16 + §17 reference folders feature（initial ship，详见 §17 候选记录）。
- **PR [#142](https://github.com/BeibeiZhang/WorkPal/pull/142)** (2026-04-27) — §15 follow-up：AgentRequiredHint English-only + hover ring inset fix。
- **PR [#141](https://github.com/BeibeiZhang/WorkPal/pull/141)** (2026-04-27) — Overview API Spend wheel picker，fast-lane。
- **PR [#138](https://github.com/BeibeiZhang/WorkPal/pull/138)** (2026-04-26) — §15 mobile graceful degrade。
- **PR [#136/#137](https://github.com/BeibeiZhang/WorkPal/pull/136)** (2026-04-26) — post-Phase-7 cleanups（#11 / #12 / #14）+ Overview spacing。

**Releases 节奏**：v0.1.1（Phase 7.5 ship）→ v0.1.2（PR #143 ship 后）→ v0.1.3（PR #144 ship 后）→ v0.1.4（PR #146 ship 后）→ **v0.1.5**（PR #150 + #151 ship 后；§21 frontend 通过 Vercel deploy 立即生效，§22 agent prompt 随 dmg 出）→ **v0.1.6**（PR #152 ship 后；§23 Output preview + reveal-in-finder route 含在 agent dmg）。

**v0.1.5 时序记录**（process learning）：v0.1.5 release 在 §22 merge 后 + §23 merge 前 build，**§23 没赶上 v0.1.5 dmg**。Beibei bump v0.1.6 包 §23。**Lesson**：multi-PR batch ship dmg 时，先 merge all PRs 再 bump，避免 release 跑在 PR mid-flight。

**Principle #8 翻转**（commit `f66a5be`，PR #144 中触发）：从 "bilingual day 1" → "English-first UI"。理由：双语 `/ 中文` 视觉累赘 + 维护税重。Voice / AI replies / intent router keywords / user input 不动；只 UI 文案翻转。`feedback_targeted_english_only.md` 删除（principle 翻转后过期）。

**CLAUDE.md violations + extend-don't-bypass**（commits `7c9b612` + `23a382f`）：明确禁止 hex / inline color / alpha modifier 等 ad-hoc 写法；找不到 token / primitive 必须扩 design system，绝不绕过。

**下一步**：根据 [`docs/post-phase-6-candidates.md`](./post-phase-6-candidates.md) 优先级。**当前 backlog 28 条（21 已 shipped，7 在排队）**。pending 7 条：
- **#3** Artifact 生成（decided-next，5-7 天，**最大产品扩面**，§29/§30 ship 后启动）
- **#4** Bilingual scaffold（parked，principle #8 翻转后过期，等真出现非英文 reader 再启）
- **#6** CN→EN translate fix（candidate, ~1-2h）
- **#13 Option C** Apple Developer 签名 + notarize（candidate, $99/yr）
- **#24** Routing decision 显示在 Progress 面板（candidate, ~30min, 测试效率改进）
- **#25** Debug overlay ⌘⇧D toggle（candidate, ~1h, console 命令产品化）
- **#28** Test infra (vitest unit-only first, Playwright e2e later)（candidate, ~1-2h Phase 1）

**In-flight (impl 写代码 / PR pending)**:
- **#29** ChatInput multi-Enter race fix — impl 实现 + 实测 verified（preview MCP 3 Enter → 1 message ✓），但 PR 还没 push
- **#30** Output → ref folder convention (prompt + backend fallback) — impl 在 plan 阶段，3 AskUserQuestion 全答（blocklist + terse 文案 + 递归 0 文件 fallback），等 plan ready

**Triggered-only (休眠候选, 等条件满足才启)**:
- **#26** Single-ref-folder cwd = ref folder — trigger: §22 + §27 ship 后 AI 仍漫游
- **#27** Tool-level Bash deny outside ref folders — trigger: §22 软约束失败

**§21 + §22 + §23 一日三 ship**（2026-04-28）：所有 ref folder workflow 闭环 fix 同日落地。§21 解决 keyword router miss 自然语言 → 走 Claude 路径让 §19 system prompt 真注入；§22 强化 §19 prompt 禁 AI 漫游 ~/Documents；§23 解决 Claude 生成 Output 没 preview 路径。Plan-quality 三连高（§21 + §22 + §23 都体现：grep-verify 现状、reasoning 而非机械、自提 follow-up candidate），impl 沉淀 `feedback_plan_quality_bar.md` memory。

**Process learnings 2026-04-28 ship cycle**:
- **Multi-PR batch dmg release**：先 merge all PRs 再 bump dmg（v0.1.5 漏 §23 教训）。
- **Static review 替代 medium-risk live test 的边界**：§23 是 medium-risk，但 backend reuse `resolveSessionFolder` jail（零新 validation）+ frontend state 拆分 diff verify 完整，merge 决策 OK。Live test 留 dmg 装好后 1 case 验。
- **Live-test 时间花在 cross-state diagnosis**：§21 ship 当日"AI 还是去邮箱" 排查 5 个状态变量（URL preview vs main / projectId / agent reachable / refDirs / §21 code），单次 ~30min Beibei 时间。surfaced §24 (routing transparency) + §25 (debug overlay) + §28 (test infra) 三个 testing-efficiency candidate。

---

## 延伸阅读

- **`docs/phase-5-requirements.md`** — Phase 5 living doc，每个 sub-step 的 scope / context / acceptance tests
- **`docs/phase-6-requirements.md`** — Phase 6 living doc，worktree + merge-ff-only 全流程
- **`docs/phase-7-requirements.md`** — Phase 7 living doc，5 个 sub-phase + locked decisions + Context from blocks
- **`docs/post-phase-6-candidates.md`** — **28 个 candidate** 的 living backlog（**21 已 shipped，7 pending**：#3 #4 #6 #13C #24 #25 #28，加 in-flight #29 #30，加 triggered-only #26 #27）
- **`docs/principles.md`** — 15 条开发宗旨（Phase 5 形成、6/7 验证）
- **MEMORY.md** — planning/testing Claude 自动加载的 cross-session context
