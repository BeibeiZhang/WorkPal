// Phase 7.4 — install-agent onboarding surface.
//
// Renders inside the chat area (replacing ChatPanel) when `agentState` settles
// to `unreachable` outside of demo mode. Sidebar + nav stay live so the user
// can browse memory / chats / connectors etc. — only the chat surface is
// gated, since that's the path that actually depends on the agent. When the
// user installs and starts the agent, the boot probe / focus re-probe / fetch
// re-probe in `src/lib/agent.ts` flips state back to `reachable` and the
// regular App tree re-renders automatically.
//
// Copy is the planning-approved bilingual text from
// `docs/phase-7-requirements.md` ("Onboarding surface copy" block).
// "WorkPal Agent" is intentionally kept in English on the Chinese line —
// product-name decision (Q4 of the 7.4 planning round).

import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { PrimaryButton } from './shared';

const RELEASES_URL = 'https://github.com/BeibeiZhang/WorkPal/releases/latest';

/** Render a step line with `` `code` `` segments wrapped in <code>.
 *  Inline split-on-backticks keeps the helper tiny (no markdown lib) and
 *  handles the only two patterns the copy uses today: prose and inline code.
 *  The same wrapping applies to both EN and 中文 lines. */
function renderWithCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length >= 2
      ? (
        <code
          key={i}
          className="font-mono bg-bg-message px-1 py-0.5 rounded"
        >
          {part.slice(1, -1)}
        </code>
      )
      : <span key={i}>{part}</span>,
  );
}

const STEPS: ReadonlyArray<{ en: string; zh: string }> = [
  {
    en: 'Open the .dmg, drag WorkPal Agent to Applications.',
    zh: '打开 .dmg，把 WorkPal Agent 拖进 Applications。',
  },
  {
    en: 'Right-click WorkPal Agent → Open. If you see "is damaged", first run `sudo xattr -dr com.apple.quarantine "/Applications/WorkPal Agent.app"` in Terminal.',
    zh: '右键 WorkPal Agent → 打开。如果看到"已损坏"，请先在 Terminal 跑 `sudo xattr -dr com.apple.quarantine "/Applications/WorkPal Agent.app"`。',
  },
  {
    en: "Click the menu-bar icon → enter your Anthropic API key → install the local CA when prompted.",
    zh: '点击菜单栏图标 → 输入 Anthropic API key → 按提示安装本地 CA。',
  },
];

export default function OnboardingSurface() {
  return (
    <div className="h-full w-full flex items-center justify-center p-8 overflow-y-auto">
      <div
        className="panel-border w-[560px] max-w-full rounded-[12px] p-8 flex flex-col gap-6"
        style={{ background: 'var(--color-bg-page)' }}
      >
        <header className="flex flex-col gap-1.5">
          <h2 className="type-h2-emphasized text-text-primary">
            Install WorkPal Agent to enable local AI editing
          </h2>
          <p className="type-detail text-text-secondary">
            安装 WorkPal Agent 以启用本地 AI 编辑
          </p>
        </header>

        <div className="flex flex-col gap-1.5">
          <p className="type-detail text-text-primary">
            WorkPal Agent runs on your Mac so the web app can edit local files,
            manage git, and stream Claude replies. Once it's running, this page
            reconnects automatically.
          </p>
          <p className="type-detail text-text-secondary">
            WorkPal Agent 在你的 Mac 上运行，让网页能编辑本地文件、管理 git、流式返回 Claude 回复。启动后本页面会自动重连。
          </p>
        </div>

        <PrimaryButton
          fullWidth
          onClick={() => {
            window.open(RELEASES_URL, '_blank', 'noopener,noreferrer');
          }}
        >
          <Download size={16} />
          <span>Download WorkPal Agent / 下载 WorkPal Agent</span>
        </PrimaryButton>

        <ol className="flex flex-col gap-4 list-none p-0 m-0">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center type-detail-emphasized"
                style={{
                  background: 'var(--color-bg-message)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="type-detail text-text-primary">{renderWithCode(step.en)}</p>
                <p className="type-detail text-text-secondary">{renderWithCode(step.zh)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
