import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp,
  Volume2, Smile,
  Gauge, BarChart3, Search,
  CalendarClock, Globe, Download,
  Rocket, MessageCircle,
  Dice5, Baby, Gamepad2, BookOpen, Footprints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SectionTitle,
  Tag, SummaryFooter, PrimaryButton, GhostPillButton,
  MetricCard, TaskProgressCard, ReviewItemCard,
  PageLayout, CategoryBreakdown,
} from './shared';
import { fetchUnreadArtifacts, markArtifactViewed, artifactItemCount, type Artifact } from '../lib/artifacts';
import { fetchUsage, formatUsd, type UsageSummary } from '../lib/usage';
import { IS_DEMO } from '../lib/demoMode';

/* ═══════════════════════════════════════════════════════════════
   Overview Page — "Morning Briefing" dashboard
   ═══════════════════════════════════════════════════════════════ */

interface OverviewPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
  /** Jump into a chat or project — the Dashboard's review/in-progress items
   *  and scheduled tasks link back to the session that produced them via a
   *  small source chip. */
  onOpenChat?: (chatId: string) => void;
  onOpenProject?: (projectId: string) => void;
}

/* ── Data ── */

type SourceKind = 'chat' | 'project';
type Source = { kind: SourceKind; id: string; label: string };

const REVIEW_ITEMS: Array<{ title: string; source: string; type: string; time: string; urgent: boolean; from?: Source }> = [
  { title: '3 Jira tickets drafted from design feedback', source: 'Docs → Jira', type: 'Tickets', time: 'Ready 1h ago', urgent: false, from: { kind: 'chat', id: 'alcohol-delivery', label: 'Alcohol Delivery Issues' } },
  { title: 'Weekly stakeholder email draft', source: 'Gmail', type: 'Email', time: 'Ready 2h ago', urgent: false, from: { kind: 'project', id: 'proj-1', label: 'Agent Design' } },
];

const IN_PROGRESS: Array<{ title: string; progress: number; steps: string; icon: LucideIcon; from?: Source }> = [
  { title: 'Analyzing Q2 design metrics report', progress: 62, steps: 'Pulling data from Sheets → Building charts → Formatting', icon: BarChart3, from: { kind: 'project', id: 'proj-1', label: 'Agent Design' } },
  { title: 'Researching competitor onboarding flows', progress: 35, steps: 'Scanning 4 competitor apps → Extracting screenshots → Compiling', icon: Search, from: { kind: 'chat', id: 'alcohol-delivery', label: 'Alcohol Delivery Issues' } },
];

/** Mock scheduled automations. Not persisted, not real cron — the dashboard
 *  is purely a status surface per Phase 3 spec (no creation entry point here;
 *  users set these up inside a chat). */
const SCHEDULED: Array<{
  id: string;
  name: string;
  cron: string;
  lastRun: string;
  nextRun: string;
  paused?: boolean;
  from?: Source;
}> = [
  { id: 's1', name: 'Weekly Spark driver incident digest', cron: 'Every Monday · 9:00 AM', lastRun: '2 days ago', nextRun: 'Tomorrow 9:00 AM', from: { kind: 'chat', id: 'alcohol-delivery', label: 'Alcohol Delivery Issues' } },
  { id: 's2', name: 'Daily design component audit', cron: 'Weekdays · 6:00 PM', lastRun: '18h ago', nextRun: 'Today 6:00 PM', from: { kind: 'project', id: 'proj-1', label: 'Agent Design' } },
];

const IMPACT_WORK = [
  { label: 'Delivery Flow shipped', detail: 'Completion rate +12%, satisfaction 4.6/5', type: 'feature' as const },
  { label: 'Onboarding V2 activation', detail: '+18% activation, -34% drop-off', type: 'metric' as const },
  { label: 'User feedback score', detail: 'NPS +8 this week across 3 features', type: 'feedback' as const },
];

const IMPACT_FAMILY = {
  husbandMood: 10,
  detail: 'Came home relaxed 5/7 days, helped with bedtime routine, weekend board game night',
};

const IMPACT_SELF = {
  extraHours: 2,
  detail: 'AI handled emails, meeting notes, and research → you got 2h back for yourself',
};

const TYPE_CONFIG: Record<string, { icon: LucideIcon }> = {
  feature: { icon: Rocket },
  metric: { icon: BarChart3 },
  feedback: { icon: MessageCircle },
};

/* ── Subscription Health Check ──
   Published subscription quotas (soft approximations — OpenAI/Anthropic
   adjust these periodically). Each dimension maps to one capability bucket
   in the usage summary. `null` means the plan doesn't support that dimension
   at all (different from "0 used"), which the verdict logic treats as "API
   is the only option for this kind of work". */

type DimensionKey = 'chat' | 'voice_minutes' | 'web_query' | 'images' | 'agent';

interface Plan {
  name: string;
  price: number;
  /** null = capability not offered. number = monthly quota. */
  quotas: Record<DimensionKey, number | null>;
}

const SUBSCRIPTION_PLANS: Plan[] = [
  {
    name: 'ChatGPT Plus',
    price: 20,
    quotas: {
      chat: 2400,          // ~80 msg / 3h → ~640/day, heavily underused
      voice_minutes: 1800, // ~30h/mo Advanced Voice
      web_query: 25,       // Deep Research
      images: 2400,        // shares chat limit
      agent: null,         // no Claude-style agent / code mode
    },
  },
  {
    name: 'Claude Pro',
    price: 20,
    quotas: {
      chat: 1000,          // ~45 msg / 5h shared
      voice_minutes: null, // no voice product
      web_query: null,     // no Deep Research product
      images: 1000,
      agent: 1000,         // Cowork / Code shares chat quota
    },
  },
];

interface HealthDimension {
  key: DimensionKey;
  label: string;
  used: number;
  unit: string;
  /** Per-plan quotas, aligned to SUBSCRIPTION_PLANS order. */
  quotas: (number | null)[];
}

interface HealthReport {
  monthlyApiCost: number;
  verdict: string;
  verdictTone: 'win' | 'even' | 'sub-better';
  dimensions: HealthDimension[];
  planFitStatus: Array<{ plan: Plan; fits: boolean; blockers: string[] }>;
}

function scaleToMonth(value: number, rangeDays: number): number {
  if (rangeDays <= 0) return 0;
  return (value / rangeDays) * 30;
}

function computeHealth(spend: UsageSummary | null, rangeDays: number): HealthReport | null {
  if (!spend) return null;

  // Normalize all counts to "per 30 days" so we can compare against monthly
  // subscription quotas regardless of the 1/7/30 tab selection.
  const capMap = new Map(spend.by_capability.map(c => [c.capability, c]));
  const chatTurns = Math.round(scaleToMonth(capMap.get('chat')?.call_count ?? 0, rangeDays));
  const voiceMin = Math.round(scaleToMonth(capMap.get('voice')?.voice_minutes ?? 0, rangeDays));
  const webQueries = Math.round(scaleToMonth(capMap.get('web_query')?.call_count ?? 0, rangeDays));
  const agentRuns = Math.round(scaleToMonth(capMap.get('agent')?.call_count ?? 0, rangeDays));
  const images = Math.round(scaleToMonth(spend.total_images_uploaded, rangeDays));
  const monthlyApiCost = scaleToMonth(spend.total_cost_usd, rangeDays);

  const dimensions: HealthDimension[] = [
    {
      key: 'chat',
      label: 'Text chat',
      used: chatTurns,
      unit: 'msgs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.chat),
    },
    {
      key: 'voice_minutes',
      label: 'Voice mode',
      used: voiceMin,
      unit: 'min/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.voice_minutes),
    },
    {
      key: 'web_query',
      label: 'Deep research',
      used: webQueries,
      unit: 'runs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.web_query),
    },
    {
      key: 'images',
      label: 'Image uploads',
      used: images,
      unit: 'imgs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.images),
    },
    {
      key: 'agent',
      label: 'Claude Agent (write / edit files)',
      used: agentRuns,
      unit: 'runs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.agent),
    },
  ];

  // For each plan (solo + combo), can the usage fit inside quotas? A quota
  // of `null` means the plan doesn't offer that capability — if usage > 0
  // there, the plan fails (user would need API or a different plan).
  const evalPlan = (plans: Plan[]): { fits: boolean; blockers: string[] } => {
    const blockers: string[] = [];
    const combined: Record<DimensionKey, number | null> = {
      chat: 0, voice_minutes: 0, web_query: 0, images: 0, agent: 0,
    };
    for (const p of plans) {
      for (const k of Object.keys(p.quotas) as DimensionKey[]) {
        const q = p.quotas[k];
        if (q === null) continue;
        const cur = combined[k];
        combined[k] = (cur ?? 0) + q;
      }
    }
    for (const d of dimensions) {
      const q = combined[d.key];
      if (d.used === 0) continue;
      if (q === null || q === 0) {
        blockers.push(`${d.label} (not supported)`);
      } else if (d.used > q) {
        blockers.push(`${d.label} (${d.used.toLocaleString()} > ${q.toLocaleString()} ${d.unit})`);
      }
    }
    return { fits: blockers.length === 0, blockers };
  };

  const planFitStatus = [
    { plan: SUBSCRIPTION_PLANS[0], ...evalPlan([SUBSCRIPTION_PLANS[0]]) },
    { plan: SUBSCRIPTION_PLANS[1], ...evalPlan([SUBSCRIPTION_PLANS[1]]) },
    {
      plan: { name: 'Plus + Claude Pro', price: 40, quotas: SUBSCRIPTION_PLANS[0].quotas },
      ...evalPlan(SUBSCRIPTION_PLANS),
    },
  ];

  // Verdict logic: pick the cheapest plan that fits your usage; compare its
  // price to your normalized monthly API cost. Three possible outcomes.
  const fittingPlan = planFitStatus.find(p => p.fits);
  let verdict: string;
  let verdictTone: HealthReport['verdictTone'];
  if (!fittingPlan) {
    verdict = `No $20–$40 subscription covers your usage pattern (${planFitStatus[2].blockers.slice(0, 2).join(', ')}). API direct at ${formatUsd(monthlyApiCost)}/mo is effectively the only option.`;
    verdictTone = 'win';
  } else if (monthlyApiCost < fittingPlan.plan.price) {
    const savings = fittingPlan.plan.price - monthlyApiCost;
    verdict = `API direct costs ${formatUsd(monthlyApiCost)}/mo — cheaper than ${fittingPlan.plan.name} ($${fittingPlan.plan.price}/mo). You save ~${formatUsd(savings)}/mo.`;
    verdictTone = 'win';
  } else {
    const extra = monthlyApiCost - fittingPlan.plan.price;
    verdict = `${fittingPlan.plan.name} ($${fittingPlan.plan.price}/mo) would cover your usage. API direct at ${formatUsd(monthlyApiCost)}/mo costs ~${formatUsd(extra)}/mo more.`;
    verdictTone = 'sub-better';
  }

  return { monthlyApiCost, verdict, verdictTone, dimensions, planFitStatus };
}

/* ── Main Component ── */

export default function OverviewPage({ sidebarOpen, onToggleSidebar, onNewChat, onOpenChat, onOpenProject }: OverviewPageProps) {
  // Greeting hero video — different framing per viewport. Mobile gets a
  // square portrait clip designed for the stacked aspect-square slot;
  // desktop keeps the original landscape clip that fills the 240px column.
  const [isMobileHero, setIsMobileHero] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileHero(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const videoSrc = isMobileHero
    ? '/animations/morning-hero-mobile.mp4'
    : '/animations/white-man-coffee.mp4';
  const [isSpeaking, setIsSpeaking] = useState(false);

  const GREETING_TEXT = "Good morning, Beibei! Today feels like a steady day. Your life commitments are all locked in — 2 hours family time, 7 hours sleep, check. I've protected your 9 to 11am focus block, and today's workload is light. I finished your meeting notes and drafted 3 tickets — review them whenever you're ready.";

  const toggleSpeak = useCallback(() => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(GREETING_TEXT);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [isSpeaking]);
  const [reviewDone, setReviewDone] = useState<Record<number, boolean>>({});

  // Candidate #3 — unread artifacts surface at the top of "Needs Your Eyes"
  // per Beibei's 2026-04-20 call. Already-viewed slugs (tracked in
  // localStorage, not Supabase) are filtered out so reading the shared URL
  // on any device makes the row disappear here next visit.
  const [unreadArtifacts, setUnreadArtifacts] = useState<Artifact[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchUnreadArtifacts(3).then((rows) => {
      if (!cancelled) setUnreadArtifacts(rows);
    });
    return () => { cancelled = true; };
  }, []);

  const openArtifact = (a: Artifact) => {
    markArtifactViewed(a.slug);
    setUnreadArtifacts(prev => prev.filter(x => x.slug !== a.slug));
    window.open(`/artifact/${a.slug}`, '_blank', 'noopener,noreferrer');
  };

  // API Spend — live OpenAI + Anthropic + Tavily usage logged to Supabase
  // after every call. Re-fetches on range change (with loading state) and
  // also polls every 60s in the background so the card stays roughly live
  // without a page reload. Background polls don't flip `spendLoading` so
  // the number doesn't flash to "—" while refreshing.
  const [spendRange, setSpendRange] = useState<1 | 7 | 30>(7);
  const [spend, setSpend] = useState<UsageSummary | null>(null);
  const [spendLoading, setSpendLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const load = async (showLoading: boolean) => {
      if (showLoading) setSpendLoading(true);
      const s = await fetchUsage(spendRange);
      if (cancelled) return;
      setSpend(s);
      if (showLoading) setSpendLoading(false);
    };
    load(true);
    const interval = window.setInterval(() => { load(false); }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [spendRange]);

  // Subscription Health Check — compares observed usage against ChatGPT Plus
  // and Claude Pro quotas (and the $40 combo). Collapsed by default; header
  // shows the verdict so the user doesn't have to expand to learn the answer.
  const [healthExpanded, setHealthExpanded] = useState(false);
  // Total card doubles as the toggle for the By provider + By model details.
  // Collapsed by default → page lands on the headline number, user drills in
  // when curious. Same pattern as Subscription Health Check below.
  const [spendDetailsOpen, setSpendDetailsOpen] = useState(false);
  const health = useMemo(() => computeHealth(spend, spendRange), [spend, spendRange]);

  return (
    <PageLayout
      title="Overview"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onNewChat={onNewChat}
      bgClass="app-bg"
    >
          {/* ━━━ 1. GREETING ━━━ */}
          <div className="rounded-2xl mb-[48px] relative overflow-hidden bg-input-bg">
            {/* Desktop: video column fixed at 240px so the text column always has
                room to breathe. Stretch makes the video fill the row height;
                object-cover trims to fit. Mobile stacks; video keeps its
                native aspect ratio (no forced square crop). */}
            <div className="flex flex-col md:flex-row md:items-stretch relative">
              <div className="relative w-full md:w-[240px] md:shrink-0 overflow-hidden">
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="block w-full h-auto md:absolute md:inset-0 md:h-full md:object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 p-6 md:p-8 flex flex-col justify-center">
                <h2 className="type-h1--emphasized text-text-primary mb-2.5">
                  Good morning, Beibei! Today feels like a steady day ☀️
                </h2>
                <p className="type-detail text-text-primary">
                  Your life commitments are all locked in — 2h family time, 7h sleep, check ✓. I've protected your 3–5am focus block, and today's workload is light. I finished your meeting notes and drafted 3 tickets — review them whenever you're ready.
                </p>
                <PrimaryButton onClick={toggleSpeak} className="mt-6 gap-2">
                  <Volume2 size={16} />
                  {isSpeaking ? 'Stop' : 'Listen'}
                </PrimaryButton>
              </div>
            </div>
          </div>

          {/* ━━━ 3. NEEDS YOUR EYES ━━━ */}
          <div className="mb-[48px]">
            <div className="flex flex-wrap items-center justify-between mb-4 [&>*]:mb-0">
              <SectionTitle emoji="" title="Needs Your Eyes" count={unreadArtifacts.length + REVIEW_ITEMS.filter((_, i) => !reviewDone[i]).length} size={20} />
              <SummaryFooter>
                Total review time: <strong className="text-text-primary">~16 min</strong> for 3 items
              </SummaryFooter>
            </div>

            <div className="flex flex-col">
              {unreadArtifacts.map((a) => {
                const title = a.contentEn?.title || a.topic || a.templateId;
                const count = artifactItemCount(a, 'en');
                return (
                  <button
                    key={a.slug}
                    onClick={() => openArtifact(a)}
                    className="text-left dashed-border-b last:bg-none hover:bg-bg-hover transition-colors"
                  >
                    <ReviewItemCard
                      title={title}
                      source="WorkPal"
                      type="Webpage"
                      time={`New${count > 0 ? ` · ${count} items` : ''}`}
                      icon={Globe}
                    />
                  </button>
                );
              })}
              {REVIEW_ITEMS.map((item, i) => {
                const openFrom = item.from
                  ? () => {
                      if (item.from!.kind === 'project') onOpenProject?.(item.from!.id);
                      else onOpenChat?.(item.from!.id);
                    }
                  : undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={openFrom}
                    disabled={!openFrom}
                    className="text-left w-full dashed-border-b last:bg-none hover:bg-bg-hover transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <ReviewItemCard
                      title={item.title}
                      source={item.source}
                      type={item.type}
                      time={item.time}
                      done={reviewDone[i] || false}
                      onToggle={() => setReviewDone(p => ({ ...p, [i]: !p[i] }))}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ━━━ 4. STEPHEN IS WORKING ON ━━━ */}
          <div className="mb-[48px]">
            <SectionTitle emoji="" title="Agents at Work" count={IN_PROGRESS.length} size={20} />

            <div className="flex flex-col">
              {IN_PROGRESS.map((task, i) => {
                const openFrom = task.from
                  ? () => {
                      if (task.from!.kind === 'project') onOpenProject?.(task.from!.id);
                      else onOpenChat?.(task.from!.id);
                    }
                  : undefined;
                return (
                  <TaskProgressCard
                    key={i}
                    title={task.title}
                    progress={task.progress}
                    steps={task.steps.split(' → ')}
                    icon={task.icon}
                    onClick={openFrom}
                  />
                );
              })}
            </div>
          </div>

          {/* ━━━ 4b. SCHEDULED ━━━ */}
          <div className="mb-[48px]">
            <SectionTitle emoji="" title="Scheduled" count={SCHEDULED.length} size={20} />
            <div className="flex flex-col">
              {SCHEDULED.map(job => {
                const openFrom = job.from
                  ? () => {
                      if (job.from!.kind === 'project') onOpenProject?.(job.from!.id);
                      else onOpenChat?.(job.from!.id);
                    }
                  : undefined;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={openFrom}
                    disabled={!openFrom}
                    className="px-5 py-4 dashed-border-b last:bg-none text-left hover:bg-bg-hover transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <div className="flex items-center gap-3.5">
                      <CalendarClock size={22} strokeWidth={1.75} className="shrink-0 icon-theme text-text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="type-detail-emphasized text-text-primary">{job.name}</div>
                        <div className="type-detail text-text-primary mt-0.5">
                          {job.cron}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-text-primary shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ━━━ 6. POSITIVE IMPACT — 7 DAY, THREE DIMENSIONS ━━━ */}
          {/* Figma 6770:24151. Each card is a horizontal split: a 152×322
              hero image on the left (one shared 1536×1024 PNG sliced via
              object-position) + content on the right. White card surface,
              no outline. Title is uppercase 22px (.type-h1--emphasized). */}
          <div className="mb-[48px]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Work */}
              <div className="bg-bg-card rounded-2xl flex flex-col lg:flex-row items-stretch gap-4 overflow-clip">
                <video
                  src="/animations/impact-work.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="impact-img object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-4 p-5">
                  <div className="flex items-center gap-1">
                    <span className="type-h1--emphasized text-text-primary uppercase">Work</span>
                    <div className="flex-1" />
                    <GhostPillButton
                      onClick={() => { /* cosmetic — no real export yet */ }}
                      icon={<Download size={14} />}
                    >
                      Export
                    </GhostPillButton>
                  </div>
                  <div className="flex flex-col">
                    {IMPACT_WORK.map((item, i) => {
                      const Icon = TYPE_CONFIG[item.type].icon;
                      return (
                        <div key={i} className="flex flex-col gap-1 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Icon size={16} className="text-text-primary shrink-0" />
                            <span className="type-detail-emphasized text-text-primary">{item.label}</span>
                          </div>
                          <div className="type-detail text-text-primary">{item.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Family */}
              <div className="bg-bg-card rounded-2xl flex flex-col lg:flex-row items-stretch gap-4 overflow-clip">
                <video
                  src="/animations/impact-family.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="impact-img object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-4 p-5">
                  <span className="type-h1--emphasized text-text-primary uppercase">Family</span>
                  <MetricCard title="Emotional value to hubby" value={String(IMPACT_FAMILY.husbandMood)} subtitle="/10 — Perfect!" />
                  <p className="type-detail text-text-primary">{IMPACT_FAMILY.detail}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { icon: Smile, label: 'Relaxed evenings' },
                      { icon: Dice5, label: 'Board game night' },
                      { icon: Baby, label: 'Co-bedtime routine' },
                    ].map(({ icon: Icon, label }, i) => (
                      <Tag key={i}>
                        <Icon size={12} className="shrink-0" />
                        {label}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>

              {/* Self */}
              <div className="bg-bg-card rounded-2xl flex flex-col lg:flex-row items-stretch gap-4 overflow-clip">
                <video
                  src="/animations/impact-self.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="impact-img object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-4 p-5">
                  <span className="type-h1--emphasized text-text-primary uppercase">Self</span>
                  <MetricCard title="Extra disposable time" value={`+${IMPACT_SELF.extraHours}h`} subtitle="this week gained back" />
                  <p className="type-detail text-text-primary">{IMPACT_SELF.detail}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { icon: Gamepad2, label: 'Gaming time' },
                      { icon: BookOpen, label: 'Reading' },
                      { icon: Footprints, label: 'Morning walk' },
                    ].map(({ icon: Icon, label }, i) => (
                      <Tag key={i}>
                        <Icon size={12} className="shrink-0" />
                        {label}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ━━━ 5. API SPEND ━━━ */}
          <div className="mb-[48px]">
            <SectionTitle emoji="" title="API Spend" size={20} />

            {/* Range picker + spend card. Left: a tall 1/7/30 "deck" that
                deliberately overflows the card top + bottom (wheel-picker
                feel) — the deck has its own white border + drop shadow so it
                reads as a card sitting in front. Selected box pops to white;
                others fade. Then a single capsule with stacked up/down
                triangles cycles ranges. Vertical divider. Right: label +
                $value + subtitle. Far right: chevron toggles details below. */}
            {(() => {
              const RANGES = [1, 7, 30] as const;
              const idx = RANGES.indexOf(spendRange);
              const rangeLabel = spendRange === 1 ? 'Past 24 Hours' : `Past ${spendRange} Days`;
              // Step = item-height (28px: 20 line-height + 8 py) + gap-4 (16).
              // Translates the column so the selected item sits at the deck's
              // vertical centre; items above/below get clipped by the deck.
              const STEP = 44;
              return (
                <div className="rounded-2xl bg-bg-message flex items-center gap-4 sm:gap-10 px-4 sm:px-10 py-5 overflow-visible">
                  {/* Range deck — Figma node 6744:27188. Brand-gradient
                      surface + 1px gradient ring (double-bg trick on the
                      deck class). The wheel-picker scroll behaviour is
                      preserved: clicking any number translates the column
                      so that number sits at the centre, with adjacent
                      items partially visible and far items clipped. */}
                  <div className="flex items-center shrink-0">
                    <div className="spend-picker-deck w-[60px] h-[141px] flex flex-col items-center justify-center px-2 py-6 rounded-[4px] overflow-clip">
                      <div
                        className="flex flex-col gap-4 items-stretch w-full transition-transform duration-300 ease-out"
                        style={{ transform: `translateY(${(1 - idx) * STEP}px)` }}
                      >
                        {RANGES.map((r) => {
                          const selected = r === spendRange;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setSpendRange(r)}
                              aria-pressed={selected}
                              aria-label={`Past ${r === 1 ? '24 hours' : `${r} days`}`}
                              className={`spend-picker-item ${selected ? 'is-selected' : ''} type-h1--emphasized w-full flex items-center justify-center px-0 py-1 rounded-[4px] bg-transparent text-center focus:outline-none focus-visible:outline-none`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Vertical divider — fades at top + bottom edges */}
                  <div className="w-px self-stretch divider-fade-v shrink-0" />

                  {/* Spend headline — clickable to expand details */}
                  <button
                    type="button"
                    onClick={() => setSpendDetailsOpen(!spendDetailsOpen)}
                    className="flex-1 min-w-0 flex items-start text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="type-detail-emphasized text-text-primary mb-1 whitespace-nowrap">{rangeLabel}</div>
                      <div className="type-display-xl text-text-primary leading-none mb-2 whitespace-nowrap">
                        {spend ? formatUsd(spend.total_cost_usd) : spendLoading ? '—' : 'Free'}
                      </div>
                      <div className="type-detail text-text-primary">
                        {spend
                          ? `${spend.call_count} call${spend.call_count === 1 ? '' : 's'} · ${(spend.total_input_tokens + spend.total_output_tokens).toLocaleString()} tokens`
                          : spendLoading
                            ? 'Loading…'
                            : 'No activity yet'}
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      {spendDetailsOpen
                        ? <ChevronUp size={16} className="text-text-primary" />
                        : <ChevronDown size={16} className="text-text-primary" />}
                    </div>
                  </button>
                </div>
              );
            })()}

            {spendDetailsOpen && (
              <div className="bg-bg-page rounded-2xl p-5 mt-2 mb-3 dark:bg-[rgba(226,243,255,0.05)]">
                {/* By provider */}
                {spend && spend.total_cost_usd > 0 && spend.by_provider.some(p => p.cost_usd > 0) && (
                  <>
                    <div className="type-detail text-text-primary mb-3">By provider</div>
                    <CategoryBreakdown
                      categories={spend.by_provider.filter(p => p.cost_usd > 0).map((p) => {
                        const label =
                          p.provider === 'openai' ? 'OpenAI'
                          : p.provider === 'anthropic' ? 'Anthropic'
                          : 'Tavily (Web Search)';
                        const color =
                          p.provider === 'openai' ? '#10A37F'
                          : p.provider === 'anthropic' ? '#D97757'
                          : '#3171ff';
                        return {
                          label,
                          pct: Math.round((p.cost_usd / spend.total_cost_usd) * 100),
                          color,
                        };
                      })}
                    />
                  </>
                )}

                {/* By model */}
                {spend && spend.by_model.length > 0 && (
                  <>
                    {spend.total_cost_usd > 0 && (
                      <div className="h-px dashed-border-b my-5" />
                    )}
                    <div className="type-detail text-text-primary mb-3">By model</div>
                    <div className="flex flex-col">
                      {spend.by_model.map((m) => {
                        // Tavily bills per-search (not per-token), and the first
                        // 1,000/month are free. Show the quota burn rate instead
                        // of the meaningless "0 tokens" readout.
                        const isTavily = m.provider === 'tavily';
                        const meta = isTavily
                          ? `${m.call_count} search${m.call_count === 1 ? '' : 'es'} · 1,000/mo free`
                          : `${m.call_count} call${m.call_count === 1 ? '' : 's'} · ${(m.input_tokens + m.output_tokens).toLocaleString()} tokens`;
                        return (
                          <div
                            key={m.model}
                            className="flex items-center justify-between py-2.5 dashed-border-b last:bg-none"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="type-detail text-text-primary truncate">{m.model}</div>
                              <div className="type-detail text-text-secondary">{meta}</div>
                            </div>
                            <div className="type-detail text-text-primary shrink-0">
                              {formatUsd(m.cost_usd)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* By source — which deployment recorded each row. Drives
                    the "is workpal-beibei traffic from someone other than me?"
                    diagnostic. Pre-migration rows have null source and bucket
                    as 'unknown'. Hidden if no rows have source data at all. */}
                {spend && spend.by_source.length > 0 && (
                  <>
                    <div className="h-px dashed-border-b my-5" />
                    <div className="type-detail text-text-primary mb-3">By source (deployment)</div>
                    <div className="flex flex-col">
                      {spend.by_source.map((s) => {
                        const label =
                          s.source === 'localhost' ? 'Local dev (your computer)'
                          : s.source === 'workpal-beibei' ? 'workpal-beibei.vercel.app (your prod)'
                          : s.source === 'my-workpal' ? 'my-workpal.vercel.app (demo)'
                          : 'Unknown / pre-2026-04-28';
                        return (
                          <div
                            key={s.source}
                            className="flex items-center justify-between py-2.5 dashed-border-b last:bg-none"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="type-detail text-text-primary truncate">{label}</div>
                              <div className="type-detail text-text-secondary">
                                {s.call_count} call{s.call_count === 1 ? '' : 's'}
                              </div>
                            </div>
                            <div className="type-detail text-text-primary shrink-0">
                              {formatUsd(s.cost_usd)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ━━━ 6. SUBSCRIPTION HEALTH CHECK ━━━ */}
          {!IS_DEMO && health && (
            <div className="mb-[48px]">
              <SectionTitle emoji="" title="Subscription Health Check" size={20} />

              {/* Verdict header — click to expand details. Mirrors the Stress
                  Level collapsible pattern above so the interaction feels
                  familiar. */}
              <button
                onClick={() => setHealthExpanded(!healthExpanded)}
                className="rounded-2xl px-5 py-4 flex items-center gap-3.5 text-left transition-colors bg-input-bg w-full"
              >
                <Gauge size={22} strokeWidth={1.75} className="text-text-primary shrink-0 icon-theme" />
                <div className="flex-1 min-w-0">
                  <div className="type-detail-emphasized text-text-primary">
                    API vs subscription — {health.verdictTone === 'win' ? 'API wins' : health.verdictTone === 'sub-better' ? 'subscription wins' : 'even'}
                  </div>
                  <div className="type-detail text-text-primary mt-0.5">
                    {health.verdict}
                  </div>
                </div>
                <div className="shrink-0">
                  {healthExpanded ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                </div>
              </button>

              {healthExpanded && (
                <div className="bg-bg-page rounded-2xl p-5 mt-2 dark:bg-[rgba(226,243,255,0.05)]">
                  <div className="type-detail text-text-primary mb-3">
                    Your usage vs plan quotas (normalized to /month)
                  </div>

                  {/* Header row */}
                  <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 pb-2 dashed-border-b">
                    <div className="type-detail text-text-secondary">Dimension</div>
                    <div className="type-detail text-text-secondary text-right">You</div>
                    <div className="type-detail text-text-secondary text-right">Plus ($20)</div>
                    <div className="type-detail text-text-secondary text-right">Claude Pro ($20)</div>
                  </div>

                  {/* Dimension rows */}
                  {health.dimensions.map((d) => (
                    <div
                      key={d.key}
                      className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 py-2.5 dashed-border-b last:bg-none"
                    >
                      <div className="type-detail text-text-primary min-w-0 truncate">{d.label}</div>
                      <div className="type-detail text-text-primary text-right">
                        {d.used > 0 ? `${d.used.toLocaleString()} ${d.unit.split('/')[0]}` : '—'}
                      </div>
                      {d.quotas.map((q, i) => {
                        const exceeds = q !== null && d.used > q;
                        const unsupported = q === null;
                        const color = unsupported ? 'text-text-secondary' : exceeds ? 'text-text-primary' : 'text-text-primary';
                        return (
                          <div key={i} className={`type-detail text-right ${color}`}>
                            {unsupported ? (
                              <span className="type-detail text-text-secondary">not supported</span>
                            ) : (
                              <span>
                                {q.toLocaleString()} {d.unit.split('/')[0]}
                                {exceeds && <span className="type-detail text-text-primary ml-1"> ⚠</span>}
                                {d.used > 0 && !exceeds && <span className="type-detail text-text-primary ml-1"> ✓</span>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Plan-fit summary — the last dimension row already draws
                      a dashed-border-b above this section, so no extra
                      separator here. */}
                  <div className="mt-4">
                    <div className="type-detail text-text-primary mb-2.5">Plan options</div>
                    {health.planFitStatus.map((p) => (
                      <div key={p.plan.name} className="flex items-start gap-2 py-1.5">
                        <div className="shrink-0 type-detail text-text-primary w-[190px]">
                          {p.plan.name} <span className="type-detail text-text-secondary">(${p.plan.price}/mo)</span>
                        </div>
                        <div className="flex-1 min-w-0 type-detail text-text-primary">
                          {p.fits
                            ? <span className="text-text-primary">Fits your usage ✓</span>
                            : <span className="text-text-secondary">Blocked by: {p.blockers.join(', ')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 type-detail text-text-secondary">
                    Quotas are soft approximations — OpenAI &amp; Anthropic tune them quietly. Treat as a rough guide, not a contract.
                  </div>
                </div>
              )}
            </div>
          )}
    </PageLayout>
  );
}
