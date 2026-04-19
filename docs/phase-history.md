# WorkPal Phases 1–5 History

这份文档是**历史回顾**，不是当下工作。Phase 6 开工时，当前计划写在 `docs/phase-6-requirements.md`（living doc，由下一次 planning session 起草）。这里只负责 **"之前发生过什么"**。

## Overview

| 阶段 | 主题 | 近似时间 | 主要 PR / 标记 |
|---|---|---|---|
| **Phase 1** | 前端 prototype + 模拟 AI 流程 | 2025 年底 | V0–V1（pre-PR） |
| **Phase 2** | 真实后端：Express + OpenAI GPT streaming | 2026 年初 | Backend Phase 1 |
| **Phase 3** | 连接器 + 真实工具调用（Gmail/Calendar/Google OAuth） | 2026-02 → 2026-03 | PR #60, #61 |
| **Phase 4** | V2 → V3 UX 大改造：single-input + Promote-to-Project + Dashboard + PermissionPrompt UI | 2026-04-18 | PR #64（tag `v2-with-task-button`） |
| **Phase 5** | Claude Code SDK 集成：真 agent / 真文件 / 真权限 / 真 undo | 2026-04-18 → 2026-04-19 | PR #67, #68, #69, #70, #71, #73, #75 |

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

## Lessons extracted

Phase 5 一路踩下的坑和形成的宗旨，**沉淀在 `docs/principles.md`**（15 条）。读那份。

几条高光：
- 复用，不重造（用 Claude Code SDK，不自己写 agent loop）
- Shared decisions 一次锁定（关键词表、路径规则、事件过滤）
- 懒创建 + 完事清理（5.4e 的 mkdir/rmdir 范式）
- 前端生成的 path 一路下传（UI = 磁盘 = git = 日志 四处一致）
- 按风险路由测试（异步/权限/git 必测；视觉/文案跳过）

---

## 当前状态（2026-04-19）

**Phase 5 完整收官**。整个 Claude Code SDK 集成链已经端到端跑通：用户在 UI 里用中文说"写个 hello.txt"，Claude Code 真的会 mkdir 真实 folder、弹权限、写文件、auto commit、用户点 Undo 能 git reset 回退。

**下一步**：Phase 6 —— worktree 并行隔离。由下一次 planning session 起草 `docs/phase-6-requirements.md`，形成新的 living doc。

---

## 延伸阅读

- **`docs/phase-5-requirements.md`** — Phase 5 的 living doc，每个 sub-step 的 scope / context / acceptance tests
- **`docs/principles.md`** — 15 条开发宗旨（Phase 5 里验证过的）
- **MEMORY.md** — planning/testing Claude 自动加载的 cross-session context
