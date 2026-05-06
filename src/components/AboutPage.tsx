import { Mail, ExternalLink } from 'lucide-react';
import { PageLayout, StatusTag } from './shared';
import { IS_DEMO } from '../lib/demoMode';

interface AboutPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
}

export default function AboutPage({ sidebarOpen, onToggleSidebar, onNewChat }: AboutPageProps) {
  return (
    <PageLayout
      title="About"
      bgClass="app-bg"
      maxWidth="full"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onNewChat={onNewChat}
    >
      <div className="space-y-16 pb-10">
        {/* Hero — image, big gradient headline, CTAs, 4-cell glance (matches workpal.html ordering) */}
        <section className="space-y-6">
          {IS_DEMO && (
            <div className="bg-bg-hover rounded-[12px] px-5 py-3.5 type-detail text-text-secondary">
              Voice chat and search are live in this demo. Real file editing requires local installation—
              <a
                href="mailto:beibeizhang1122@gmail.com?subject=Request%3A%20Production%20Walkthrough%20for%20WorkPal"
                className="type-detail-emphasized text-accent-blue underline"
              >
                schedule a production walkthrough
              </a>
              .
            </div>
          )}
          <img
            src="/og-image.jpg"
            alt="WorkPal 2.0 — Chat + Tasks in the Same Project, Voice-Enabled Rich Input, Selective Knowledge Output, Overview page."
            loading="lazy"
            className="w-full aspect-video md:aspect-auto md:h-[50vh] object-cover object-center rounded-[16px] shadow-[0_16px_50px_rgba(118,82,185,0.18),0_4px_12px_rgba(20,39,64,0.08)]"
          />
          <h2 className="type-h1--emphasized text-text-primary max-w-[880px]" style={{ fontSize: '40px', lineHeight: '48px', letterSpacing: '-0.5px' }}>
            An <span className="gradient-text">agentic workspace</span> where chat, tasks, and knowledge evolve together.
          </h2>
          {/* Glance — 4-cell grid with vertical dividers (collapses to 2x2 on mobile) */}
          <div className="panel-border rounded-[12px] overflow-hidden grid grid-cols-2 sm:grid-cols-4">
            {OVERVIEW.map((item, i) => (
              <div
                key={item.title}
                className={[
                  'p-4 px-6 border-white dark:border-stroke-outline',
                  [0, 2].includes(i) ? 'border-r' : '',
                  [0, 1].includes(i) ? 'border-b sm:border-b-0' : '',
                  i === 1 ? 'sm:border-r' : '',
                ].filter(Boolean).join(' ')}
              >
                <p className="type-detail-emphasized text-text-tertiary uppercase" style={{ letterSpacing: '0.5px' }}>{item.title}</p>
                <p className="type-h2-emphasized text-text-primary mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What problems WorkPal solves — 2-col grid, illust + screenshot composition at the bottom */}
        <section>
          <h2 className="type-h1--emphasized text-text-primary mb-6">What problems WorkPal solves.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROBLEMS.map((p, i) => (
              <div
                key={p.title}
                className="bg-white dark:bg-bg-hover rounded-[16px] px-7 pt-7 pb-0 flex flex-col overflow-hidden"
              >
                <div className="flex items-start gap-3.5 mb-1">
                  <span className="type-h2-emphasized text-text-primary shrink-0">{i + 1}.</span>
                  <h3 className="type-h2-emphasized text-text-primary">{p.title}</h3>
                </div>
                <div className="relative mt-2 flex justify-end">
                  {/* Screenshot in flow — its rendered height drives the container, so it's never clipped at any card width. */}
                  <img
                    src={p.image}
                    alt={p.alt}
                    loading="lazy"
                    className="block w-[65%] h-auto z-[2]"
                  />
                  {/* Illust overlays the empty left ~35% space, anchored to the bottom edge. */}
                  <img
                    src={p.illust}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="absolute bottom-0 left-0 w-[34%] h-auto z-[1] dark:invert dark:hue-rotate-180"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Four things WorkPal does differently — 2x2 grid, copy-left + illust-right inside each card */}
        <section>
          <h2 className="type-h1--emphasized text-text-primary mb-6">Four things WorkPal does differently.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map((f) => (
              <div
                key={f.title}
                className="bg-white dark:bg-bg-hover rounded-[12px] flex overflow-hidden min-h-[220px]"
              >
                <div className="flex flex-row items-center gap-4 p-7 sm:px-8 w-full">
                  <div className="flex-1 min-w-0 flex flex-col gap-2.5 pr-4">
                    <p className="type-h2-emphasized text-text-primary">{f.title}</p>
                    <p className="type-detail text-text-secondary">{f.body}</p>
                  </div>
                  <img
                    src={f.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="w-[170px] max-w-[45%] h-auto shrink-0 block pointer-events-none select-none dark:invert dark:hue-rotate-180"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Price & Transparency — standalone section. Card chrome mirrors a Four-things card
            (white bg, rounded-12, p-7 / sm:px-8, items-center row, copy-left + illust-right);
            illust is widened to fit the horizontal Usage→Person→Providers infographic. */}
        <section>
          <h2 className="type-h1--emphasized text-text-primary mb-6">Price & Transparency</h2>
          <div className="bg-white dark:bg-bg-hover rounded-[12px] flex overflow-hidden min-h-[220px]">
            <div className="flex flex-row items-center gap-4 p-7 sm:px-8 w-full">
              <div className="flex-1 min-w-0 flex flex-col gap-2.5 pr-4">
                <p className="type-h2-emphasized text-text-primary">Access top AI experiences — no subscription required.</p>
                <p className="type-detail text-text-secondary">Your usage is billed directly by the model providers (e.g., OpenAI, Anthropic), with no markup.</p>
              </div>
              <img
                src="/about/adv-pricing.png"
                alt="Your usage flows directly to model providers (OpenAI, Anthropic). Access top AI experiences with no subscription required — you pay them, not us."
                loading="lazy"
                className="w-[560px] max-w-[55%] h-auto shrink-0 block pointer-events-none select-none dark:invert dark:hue-rotate-180"
              />
            </div>
          </div>
        </section>

        {/* Milestones — 9 phases, vertical timeline with brand-gradient line and colored circles */}
        <section>
          <h2 className="type-h1--emphasized text-text-primary mb-2">Milestones</h2>
          <p className="type-detail text-text-secondary mb-6">Mar 26 → Apr 28, 2026.</p>
          <div className="relative pl-[60px]">
            {/* gradient vertical line */}
            <div className="absolute left-[18.5px] top-5 bottom-5 w-px gradient-bar-y" />
            {TIMELINE.map((m, i) => (
              <div
                key={m.num}
                className={`relative ${i === TIMELINE.length - 1 ? 'pb-0' : 'pb-4'}`}
              >
                <div
                  className="absolute left-[-60px] top-3.5 inline-flex items-center justify-center w-[38px] h-[38px] rounded-full border z-[1] type-detail-emphasized"
                  style={{ background: 'var(--color-bg-page)', borderColor: TIMELINE_COLORS[i], color: TIMELINE_COLORS[i] }}
                >
                  {m.num}
                </div>
                <div className="bg-white dark:bg-bg-hover rounded-[12px] px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3 flex-wrap mb-2.5">
                    <span className="type-caption text-text-tertiary uppercase tracking-[0.3px]">
                      {m.date}
                    </span>
                    {m.now && (
                      <StatusTag variant="in-progress" label="Now" size="sm" showIcon={false} />
                    )}
                  </div>
                  <p className="type-h2-emphasized text-text-primary mb-2">{m.title}</p>
                  <p
                    className="type-detail text-text-secondary [&_b]:font-semibold [&_b]:text-text-primary [&_i]:italic [&_code]:font-mono [&_code]:bg-bg-hover [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.85em]"
                    dangerouslySetInnerHTML={{ __html: m.body }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer credit */}
        <section className="pt-6 border-t border-stroke-outline">
          <div className="flex flex-wrap gap-4">
            <a
              href="mailto:beibeizhang1122@gmail.com"
              className="type-h2-emphasized text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <Mail size={16} />
              beibeizhang1122@gmail.com
            </a>
            <a
              href="https://beibeidesign.com"
              target="_blank"
              rel="noopener noreferrer"
              className="type-h2-emphasized text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <ExternalLink size={16} />
              beibeidesign.com
            </a>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

const OVERVIEW = [
  { title: 'Role',   value: 'Team of one · designer-PM-builder' },
  { title: 'Scope',  value: '0→1 · system + surfaces' },
  { title: 'Stack',  value: 'React · Tailwind · tokens' },
  { title: 'System', value: '36 primitives · 11 principles' },
];

const PROBLEMS = [
  {
    title: 'Why was one project divided into chat and task files?',
    illust: 'https://beibeizhang.github.io/workpal-assets/problem-illust-dizzy.png',
    image:  'https://beibeizhang.github.io/workpal-assets/problem-projects-split.png',
    alt:    'Two sidebars showing Projects under both Chat and Cowork tabs, highlighted in red',
  },
  {
    title: 'Voice input is too limited for real work.',
    illust: 'https://beibeizhang.github.io/workpal-assets/problem-illust-annoyed.png',
    image:  'https://beibeizhang.github.io/workpal-assets/problem-voice-split.png',
    alt:    'Two phone screenshots — voice chat and ChatGPT Voice issues',
  },
];

const DIFFERENTIATORS = [
  {
    title: 'Chat + Tasks in the Same Project',
    body:  'Chat (OpenAI models) and Tasks (Anthropic agents) share the same project memory—keeping conversation and execution seamlessly connected.',
    image: '/about/adv-chat-tasks.png',
  },
  {
    title: 'Voice-Enabled Rich Input',
    body:  'In voice mode, you can add rich inputs anytime—text, images, or files—without breaking the flow.',
    image: '/about/adv-voice.png',
  },
  {
    title: 'Selective Knowledge Output',
    body:  'Merge high-quality task results into your documents—turning outputs into reusable knowledge for future tasks.',
    image: '/about/adv-knowledge.png',
  },
  {
    title: 'Overview Page',
    body:  "Get a clear view of your agent's progress across all projects—at a glance.",
    image: '/about/adv-overview.png',
  },
];

// Per-circle gradient stops — interpolated between brand gradient (#7652B9 → #B46470 → #CA9D8C)
// across 9 milestones. Pre-computed so each circle reads as one color while the
// timeline line flows continuously. (Mirrors source CSS at workpal.html.)
const TIMELINE_COLORS = [
  '#7652B9', '#8557A7', '#955B95', '#A56082', '#B46470',
  '#BA7277', '#BF817E', '#C58F85', '#CA9D8C',
];

interface Milestone {
  num: number;
  date: string;
  title: string;
  body: string;
  now?: boolean;
}

const TIMELINE: Milestone[] = [
  {
    num: 1,
    date: 'Mar 26, 2026',
    title: 'Research & design exploration',
    body: '<b>Research decks</b> on agentic AI UI/UX patterns — competitive analysis + visual pattern study. Then <b>rounds of concept exploration</b> (dashboard directions, product proposals, style references).',
  },
  {
    num: 2,
    date: 'Apr 6, 2026',
    title: 'Foundation — design system & Figma pipeline',
    body: 'Three-panel shell, first design tokens, dark mode, and a primitives library. Figma → Tailwind pipeline, tokenized end-to-end. The design system that every later surface fits into.',
  },
  {
    num: 3,
    date: 'Apr 7, 2026',
    title: 'Product direction + frontend architecture',
    body: '<b>The product call that came out of research:</b> under a project foundation, chat and tasks share memory. The key decision: <b>integrate the best chat experience and the best agent experience on the market.</b> Then built the frontend architecture to hold this shape.',
  },
  {
    num: 4,
    date: 'Apr 16, 2026',
    title: 'Connect OpenAI — streaming chat, integrations, memory',
    body: 'Integrated OpenAI GPT streaming over SSE. Designed the animated token bubble, feedback bar, and a <b>mode-switching composer (chat / task)</b> — the first version before Phase 06 unified it. Then Gmail + Calendar OAuth, structured tool-call cards, and persistent cross-session memory.',
  },
  {
    num: 5,
    date: 'Apr 18, 2026',
    title: 'Connect Claude Code — real agent, real files, real Undo',
    body: 'Wired the UI into Claude Agent SDK. The AI now edits local files with per-action permission prompts, every write auto-commits to git, and <b>Undo is a real <code>git reset --hard HEAD~1</code></b>. The agent actually <i>does</i> things — safely and reversibly.',
  },
  {
    num: 6,
    date: 'Apr 19, 2026',
    title: 'AI routes intent — the big UX change',
    body: "The big UX change I made as designer-PM: <b>users shouldn't pick chat vs. task — the AI classifies intent from the input.</b> Mode overhead drops to zero. Ships with single-input composer, auto-opening inspector, Promote-to-Project, and a 4-kind PermissionPrompt (file-write / read / command / external-url).",
  },
  {
    num: 7,
    date: 'Apr 23, 2026',
    title: 'Cross-device sync — chats & projects via Supabase',
    body: "Chats and projects <b>sync via Supabase</b> so anything you say in the browser shows up on every device. Memory and agent execution intentionally stayed local-first — that became Phase 08's design problem to solve.",
  },
  {
    num: 8,
    date: 'Apr 24, 2026',
    title: 'Web + Local Agent — web UI editing your local Mac',
    body: '<b>Browsers can\'t touch your local files.</b> So I shipped a small Mac menu-bar app — the web UI calls it to do the file, git, and agent work. One-click install, auto-update from GitHub.',
  },
  {
    num: 9,
    date: 'Apr 27–28, 2026',
    title: 'Reference folders — project becomes a knowledge base',
    body: '<b>The product call behind "Selective Task Output":</b> a project isn\'t just chats — it\'s a living knowledge base. Users attach external folders (résumé, brand guidelines) via native picker. The AI proactively reads them, and on Complete Session, you choose which task outputs merge back into the project\'s reference folders. <b>Knowledge accrues across sessions.</b> Plus channel-aware routing (natural language without keywords still goes to Claude) and one-click Output preview with reveal-in-Finder.',
    now: true,
  },
];
