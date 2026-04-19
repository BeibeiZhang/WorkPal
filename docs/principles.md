# WorkPal Development Principles

这不是 spec，不是 playbook，也不是步骤清单 —— 是我们通过 Phase 5 这一路**踩坑、讨论、试错沉淀下来的判断依据**。

**什么时候看**：
- 开始一个新 sub-step / Phase 前
- 对某个设计决策拿不准
- 新 Cowork session / planning session 上手时

**什么时候修**：这份文档不是石头上刻的。任何 session 在遵守原则时发现与实际矛盾，**可以提出异议** —— 给出具体场景、讨论 trade-off、由 Beibei 仲裁是否修订。

---

## Product Philosophy

### 1. One input, AI decides (单一输入，AI 自己判断)
用户只看到"聊天"。**永远不让用户选 "task vs chat"、"哪个模式"、"哪个模型"**。AI 根据输入判断要做什么类型的工作。如果 AI 判断错了，那是模型/prompt 问题，**不是通过加选择器来解决的 UX 问题**。

### 2. Subtract before adding (先减后加)
决定一个功能去留时，**默认移除**。5.1 删掉多选 UI → 代码缩了 148 行，bug 消失，用户没抱怨。如果用户真的需要，他们会来问。

### 3. No user-facing "task" concept (用户端不出现"task")
隔离、worktree、权限、后台任务 —— 全是后端概念。用户只看到 "chats" 和 "dashboard"。**"task" 这个词永远不浮到 UI**。

---

## Engineering Philosophy

### 4. Reuse, don't rebuild (复用，不重造)
有现成的（Claude Code SDK、Claude Agent SDK、git、Vercel 部署），**就用**。不自己从头写 agent loop、权限系统、文件系统监视器。**Beibei 的价值在 UX 和产品判断，不在重造 Anthropic 的基础设施**。

### 5. Lock shared decisions once (shared decisions 一次锁定)
关键词表、路径方案、事件过滤、错误处理策略 —— **议一次，在 living doc 的 shared-decisions 块里锁死**，所有后续 sub-step 直接引用。不要每个 sub-step 都重新讨论。

### 6. Lazy creation, clean up on exit (懒创建，完事清理)
不给"可能不用的东西"留痕迹。5.4e 的范式：需要时 `mkdir`，`finally` 里 `rmdir` 空目录。ENOTEMPTY 保数据、ENOENT 防泄漏。

### 7. Safe by default (默认安全)
路径越狱防护、权限门、auto-commit 撤销、破坏性操作门槛。**永远不信任客户端路径输入**。用户数据不能有风险。

### 8. Bilingual from day 1 (双语原生)
所有用户相关的启发式（关键词匹配、提示语、错误消息）**同时覆盖英文 + 中文**。Beibei 混用，用户也混用 —— 不要只英文。

### 9. Frontend-generated paths flow through (前端生成的 path 一路下传)
UI 显示什么路径，backend 就 mkdir 那个路径、git init 那个路径、permission scope 用那个路径。**四处永远一致**。

禁止：backend 自己从 `chat.id` 派生一套内部路径而 UI 显示另一套。用户看到什么，就是什么。

---

## Process Philosophy

### 10. Living documents over frozen specs (活文档，不要冻结 spec)
`docs/phase-X-requirements.md` 随每个 PR 演化。"Context from X" 块捕捉上一步的教训。**不做 50 页前期设计**，just-in-time 加规则。

### 11. Parallel sparingly (并行 ≤ 2-3)
主 impl session + planning/testing session。额外并行一个独立支线 OK。**超过 3 个 session 并行，coordination 就把并行收益吞掉了**。

### 12. Risk-routed testing (按风险路由测试)
- **High-risk（必测）**：异步/streaming、权限时序、文件/git 状态、跨进程 state
- **Low-risk（跳过 live 测试）**：视觉 polish、文案、类型重构

Impl session 在 PR 上标类别，低风险的直接走 code review → merge，不走测试车道。不要 over-test。

### 13. Clean up after yourself (离开前收拾干净)
预览服务器、临时进程、测试文件夹 —— handoff 前全拆。**"留下来的东西能跑" = "下一个人不用先收拾"**。

### 14. When in doubt, ask Beibei (拿不准就问 Beibei)
架构方向、产品 scope、命名决策 —— 这些不是 Claude 的权限。**带着 trade-off 提问**，让 Beibei 做决定。

---

## Architecture Direction (方向性，非规定)

### 15. Target: web + local agent, shape TBD (目标：web + local agent，形态待定)
**大方向**：前端部署到云，用户装本地 agent 处理文件操作。

**但具体形态**（纯 web + CLI agent / Tauri 桌面 / Electron）**暂缓决定** —— HTTPS-to-localhost 问题可能迫使走 Tauri。

**决策时机**：Phase 5 + 6 完成之后。

---

## How this doc evolves

1. **新发现 → 异议提出**：任何 session 在遵守原则时发现与实际矛盾，**提出异议**。不要默默违背原则。
2. **异议要有具体案例**：抽象反驳无效。给出具体场景：哪一步、哪个选择、原则不适用的理由。
3. **Beibei 仲裁**：小改动直接 commit；大改动在 PR description 或 commit message 里留下讨论过程。
4. **修改后自动同步**：`MEMORY.md` 的指针不用改（相对路径），下个 session 自动读到新版。

---

**This doc is a living contract, not law. 原则是用来帮助决策的，不是用来拦住你做该做的事的。**
