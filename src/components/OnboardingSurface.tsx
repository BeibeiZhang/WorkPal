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
// Copy is English-only per principle #8 (English-first UI).

import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { PrimaryButton } from './shared';

const RELEASES_URL = 'https://github.com/BeibeiZhang/WorkPal/releases/latest';

/** Render a step line with `` `code` `` segments wrapped in <code>.
 *  Inline split-on-backticks keeps the helper tiny (no markdown lib) and
 *  handles the only two patterns the copy uses today: prose and inline code. */
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

const STEPS: ReadonlyArray<string> = [
  'Open the .dmg, drag WorkPal Agent to Applications.',
  'Right-click WorkPal Agent → Open. If you see "is damaged", first run `sudo xattr -dr com.apple.quarantine "/Applications/WorkPal Agent.app"` in Terminal.',
  "Click the menu-bar icon → enter your Anthropic API key → install the local CA when prompted.",
];

export default function OnboardingSurface() {
  return (
    <div className="h-full w-full flex items-center justify-center p-8 overflow-y-auto">
      <div className="panel-border bg-bg-page w-[560px] max-w-full rounded-[12px] p-8 flex flex-col gap-6">
        <header>
          <h2 className="type-h2-emphasized text-text-primary">
            Install WorkPal Agent to enable local AI editing
          </h2>
        </header>

        <p className="type-detail text-text-primary">
          WorkPal Agent runs on your Mac so the web app can edit local files,
          manage git, and stream Claude replies. Once it's running, this page
          reconnects automatically.
        </p>

        <PrimaryButton
          fullWidth
          onClick={() => {
            window.open(RELEASES_URL, '_blank', 'noopener,noreferrer');
          }}
        >
          <Download size={16} />
          <span>Download WorkPal Agent</span>
        </PrimaryButton>

        <ol className="flex flex-col gap-4 list-none p-0 m-0">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center type-detail-emphasized bg-bg-message text-text-primary">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="type-detail text-text-primary">{renderWithCode(step)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
