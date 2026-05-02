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

## 当前状态（2026-05-02）

**Phase 7 完整收官 + v0.1.13 production launched + Save to Knowledge UX 真完美闭环 + Software Update page + Reference folders 整链路 + AI 主动用项目历史**：

- WorkPal Agent **v0.1.13** from `/Applications/WorkPal Agent.app`，launchd 开机自启
- 用户主入口：**`https://workpal-beibei.vercel.app`**（Mac 全功能 / iPhone cloud-only graceful degrade）
- 用户体验链路（截止 §53 完整闭环）：ProjectPage 挂 ref folder → 自然语言 chat → §21 自动走 Claude → AI Glob 项目历史 deliverable（§44）+ ref folder（§19+§22）→ Read/Write 编辑或新建 → Output 区显示 main + in-session 合并 + status tag（§43）→ 点 card 多候选 path 永远 preview-able（§52）→ Save to Knowledge button 反应实时状态（§53 reactive）→ 完成后 chat 跨设备 visible（§50+§50.1）

**v0.1.7 → v0.1.13 release sequence** (2026-04-28 → 2026-05-02)：

| Version | Ship | Highlights |
|---|---|---|
| v0.1.7 | 2026-04-28 | §38/§39/§40 ProjectPage chat routing + projectIdOverride + Save to Knowledge rename |
| v0.1.8 | 2026-04-29 | §41 ref folder fallback `base...session` diff (catch committed files) |
| v0.1.9 | 2026-04-29 | §42 Software Update page (Agent + 2 SDKs + 3 model groups) |
| v0.1.10 | 2026-04-30 | §43 + §44 (Output main+in-session + status tag, AI 主动 surface 历史) |
| v0.1.11 | 2026-04-30 | §43.1+§43.2+§43.3 Save to Knowledge UX batch (catch M, button gate改, overwrite一致) |
| v0.1.12 | 2026-05-01 | §52 file path multi-candidate resolve chain |
| v0.1.13 | 2026-05-02 | §53 button reactive + backend graceful for reaped branch |

Plus frontend-only (Vercel auto, 不需 dmg)：§29 ChatInput multi-Enter race · §31/§32 Output legacy backfill · §50 chat isDraft display · §50.1 cross-device sync · §51 sidebar 双 highlight · 多个 fast-lane UI polish PRs。

**最近 batch ships**（compressed，详见 `docs/post-phase-6-candidates.md` § entries）：

- **§41** ref folder fallback (PR #160) — `git status` 漏 Phase 5.5 auto-committed 文件 → 改 `git diff base...session --diff-filter=A`，三态语义 (`undefined` 走旧 path / `[]` truly empty)
- **§42** Software Update page (PR #166) — 6 行实时 dashboard。**首次 surface "agent shared mirror is impl-mandatory" pattern**（memory `feedback_agent_shared_mirror.md`）
- **§43** ProjectPage Output 数据源 (PR #168) — `GET /api/project/:slug/deliverables` 解决 "8 文件 ProjectPage 只显 3 个"
- **§43.1+§43.2+§43.3** Save to Knowledge UX batch (PR #169) — `--diff-filter=A` → `AM`; `sessionCompleted` 不再 gate disable; COPYFILE_EXCL → overwrite 一致
- **§44** Project context system prompt (PR #167) — `PROJECT_CONTEXT_PROMPT(deliverables)` 让 AI 主动 Glob/Read 历史
- **§50** chat isDraft display (PR #170) — `messages.length > 0 = not draft` defensive filter
- **§50.1** cross-device sync (PR #174) — 3-layer normalize. Impl disprove planning race hypothesis (historical data, not active race)
- **§51** sidebar 双 highlight (PR #171) — 1 LOC `&& !activeProjectId` guard. Impl browser verify 后修正 spec field
- **§52** file path fallback chain (PR #175) — `read-file` 加 fallbackPaths。**第二次 catch agent mirror 缺失**（memory pattern 起作用）
- **§53** Save to Knowledge reactive + backend graceful (PR #178) — Revert §43.2 simpler approach; `git rev-parse --verify refs/heads/<branch>` pre-flight 防 ambiguous argument error

**当前 backlog 状态**（53 candidate · ~45 shipped · 8 pending）：
- **#3** Artifact 生成（decided-next，5-7 天，**最大产品扩面**，下一阶段重点）
- **#6** CN→EN translate fix · **#13C** Apple Developer 签名 · **#24** Progress 面板路由透出 · **#25** Debug overlay · **#28** Test infra vitest（all candidate）
- **#4** Bilingual scaffold（parked，principle #8 翻转后过期）
- **§50.2** delete isDraft field（cleanup defer）

**Triggered-only**：#26 single-ref-folder cwd / #27 tool-level Bash deny — trigger: §22 软约束失败时启动

**Process learnings 2026-04-29 → 2026-05-02 ship cycle**:

- **Agent shared mirror is impl-mandatory** (memory `feedback_agent_shared_mirror.md` 新沉淀)：§42 PR #166 + §52 PR #175 都 catch 缺失 mirror, impl follow-up commit 修。任何 `server/src/{routes,lib}/` 改动需要 `scripts/sync-agent-shared.sh` + 同 PR commit。
- **Plan correctness override**：§50.1 PR #174 impl disprove planning race hypothesis (historical data); §51 PR #171 impl 在 browser verify 后修正 spec field。多次体现 `feedback_verify_before_deferring` pattern.
- **Simpler approach 谨慎收回**：§43.2 accept simpler approach 后 v0.1.12 实测 Beibei 表达不要 → §53 revert 走 reactive。Lesson: UX 决策不能 simpler-first if user mental model already otherwise.
- **Multi-PR batch dmg release** 沿用：先 merge all PRs 再 bump dmg, no orphan ship.
- **Plan-quality bar 持续高**：多个 §（§22/§23/§29/§30/§31/§43/§50.1/§52/§53）impl plan 都 grep-verify spec → 自加 safety patterns beyond spec → 自提 follow-up candidates → 自 disprove planning hypothesis 当 evidence 不支持。

---

## 延伸阅读

- **`docs/phase-5-requirements.md`** — Phase 5 living doc，每个 sub-step 的 scope / context / acceptance tests
- **`docs/phase-6-requirements.md`** — Phase 6 living doc，worktree + merge-ff-only 全流程
- **`docs/phase-7-requirements.md`** — Phase 7 living doc，5 个 sub-phase + locked decisions + Context from blocks
- **`docs/post-phase-6-candidates.md`** — **28 个 candidate** 的 living backlog（**21 已 shipped，7 pending**：#3 #4 #6 #13C #24 #25 #28，加 in-flight #29 #30，加 triggered-only #26 #27）
- **`docs/principles.md`** — 15 条开发宗旨（Phase 5 形成、6/7 验证）
- **MEMORY.md** — planning/testing Claude 自动加载的 cross-session context
