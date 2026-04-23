import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp,
  Volume2, Briefcase, Home, Smile,
  Gauge, BarChart3, Search,
  CalendarClock, Globe, Download,
  Rocket, MessageCircle,
  Dice5, Baby, Gamepad2, BookOpen, Footprints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SectionTitle,
  Tag, SummaryFooter, PrimaryButton, TertiaryButton,
  MetricCard, TaskProgressCard, ReviewItemCard,
  PageLayout, CategoryBreakdown, Switch,
} from './shared';
import { fetchUnreadArtifacts, markArtifactViewed, artifactItemCount, type Artifact } from '../lib/artifacts';
import { fetchUsage, formatUsd, type UsageSummary } from '../lib/usage';

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

const REVIEW_ITEMS: Array<{ title: string; source: string; type: string; time: string; urgent: boolean; humanTime: string; from?: Source }> = [
  { title: 'UX meeting summary — 6 action items extracted', source: 'Zoom → Docs', type: 'Document', time: 'Ready 3 min ago', urgent: true, humanTime: '~5 min', from: { kind: 'chat', id: 'ux-meeting', label: 'UX Meeting Minutes' } },
  { title: '3 Jira tickets drafted from design feedback', source: 'Docs → Jira', type: 'Tickets', time: 'Ready 1h ago', urgent: false, humanTime: '~8 min', from: { kind: 'chat', id: 'alcohol-delivery', label: 'Alcohol Delivery Issues' } },
  { title: 'Weekly stakeholder email draft', source: 'Gmail', type: 'Email', time: 'Ready 2h ago', urgent: false, humanTime: '~3 min', from: { kind: 'project', id: 'proj-1', label: 'Agent Design' } },
];

const IN_PROGRESS: Array<{ title: string; progress: number; eta: string; steps: string; icon: LucideIcon; from?: Source }> = [
  { title: 'Analyzing Q2 design metrics report', progress: 62, eta: '~8 min', steps: 'Pulling data from Sheets → Building charts → Formatting', icon: BarChart3, from: { kind: 'project', id: 'proj-1', label: 'Agent Design' } },
  { title: 'Researching competitor onboarding flows', progress: 35, eta: '~20 min', steps: 'Scanning 4 competitor apps → Extracting screenshots → Compiling', icon: Search, from: { kind: 'chat', id: 'alcohol-delivery', label: 'Alcohol Delivery Issues' } },
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

const TYPE_CONFIG: Record<string, { icon: LucideIcon; classes: string }> = {
  feature: { icon: Rocket, classes: '' },
  metric: { icon: BarChart3, classes: '' },
  feedback: { icon: MessageCircle, classes: '' },
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
  const videoSrc = '/animations/white-man-coffee.mp4';
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

  // API Spend — live OpenAI + Anthropic token usage logged server-side after
  // every chat turn. Re-fetches when the 1/7/30 range flips so the card stays
  // in sync without a full page reload.
  const [spendRange, setSpendRange] = useState<1 | 7 | 30>(7);
  const [spend, setSpend] = useState<UsageSummary | null>(null);
  const [spendLoading, setSpendLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setSpendLoading(true);
    fetchUsage(spendRange).then((s) => {
      if (cancelled) return;
      setSpend(s);
      setSpendLoading(false);
    });
    return () => { cancelled = true; };
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
          <div className="rounded-2xl mb-12 relative overflow-hidden bg-bg-hover">
            {/* Desktop: video column fixed at 240px so the text column always has
                room to breathe. Stretch makes the video fill the row height;
                object-cover trims to fit. Mobile stacks with a square video. */}
            <div className="flex flex-col md:flex-row md:items-stretch relative">
              <div className="relative w-full aspect-square md:w-[240px] md:aspect-auto md:shrink-0 overflow-hidden">
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 p-6 md:p-8 flex flex-col justify-center">
                <h2 className="type-h2-emphasized text-text-primary mb-2.5">
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
          <div className="mb-12">
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
                      humanTime="~3 min"
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
                      humanTime={item.humanTime}
                      done={reviewDone[i] || false}
                      onToggle={() => setReviewDone(p => ({ ...p, [i]: !p[i] }))}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ━━━ 4. STEPHEN IS WORKING ON ━━━ */}
          <div className="mb-12">
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
                    eta={task.eta}
                    steps={task.steps.split(' → ')}
                    icon={task.icon}
                    onClick={openFrom}
                  />
                );
              })}
            </div>
          </div>

          {/* ━━━ 4b. SCHEDULED ━━━ */}
          <div className="mb-12">
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
          <div className="mb-20">
            <div className="flex flex-wrap items-center justify-between mb-4 [&>*]:mb-0">
              <SectionTitle emoji="" title="Your Positive Impact This Week" size={20} />
              <span className="type-detail text-text-primary">Apr 7 – 13, 2026 · 7 days</span>
            </div>

            {/* ── WORK · FAMILY · SELF — 3-up on wide pages, stacked on narrow ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3.5">
              {/* Work */}
              <div className="border border-stroke-outline rounded-2xl p-5">
                <div className="flex items-center gap-[4px] mb-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                    <Briefcase size={16} className="text-text-primary" />
                  </div>
                  <span className="type-h2-emphasized text-text-primary">Work</span>
                  <TertiaryButton onClick={() => { /* cosmetic — no real export yet */ }} className="gap-1.5 ml-auto">
                    <Download size={14} />
                    Export report
                  </TertiaryButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-0">
                  {IMPACT_WORK.map((item, i) => {
                    const tc = TYPE_CONFIG[item.type];
                    const Icon = tc.icon;
                    return (
                      <div key={i} className={`p-3.5 rounded-[8px] ${tc.classes}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={16} className="text-text-primary shrink-0" />
                          <span className="type-detail-emphasized text-text-primary">{item.label}</span>
                        </div>
                        <div className="type-detail text-text-primary">{item.detail}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Family */}
              <div className="border border-stroke-outline rounded-2xl p-5">
                <div className="flex items-center gap-[4px] mb-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                    <Home size={16} className="text-text-primary" />
                  </div>
                  <span className="type-h2-emphasized text-text-primary">Family</span>
                </div>

                <MetricCard title="Emotional value to hubby" value={String(IMPACT_FAMILY.husbandMood)} subtitle="/10 — Perfect!" />

                <div className="py-2.5 type-detail text-text-primary">
                  {IMPACT_FAMILY.detail}
                </div>

                <div className="flex gap-1.5 mt-2.5 flex-wrap">
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

              {/* Self */}
              <div className="border border-stroke-outline rounded-2xl p-5">
                <div className="flex items-center gap-[4px] mb-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                    <Smile size={16} className="text-text-primary" />
                  </div>
                  <span className="type-h2-emphasized text-text-primary">Self</span>
                </div>

                <MetricCard title="Extra disposable time" value={`+${IMPACT_SELF.extraHours}h`} subtitle="this week gained back" />

                <div className="py-2.5 type-detail text-text-primary">
                  {IMPACT_SELF.detail}
                </div>

                <div className="flex gap-1.5 mt-2.5 flex-wrap">
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

          {/* ━━━ 5. API SPEND ━━━ */}
          <div className="mb-12">
            <SectionTitle emoji="" title="API Spend" size={20} />

            {/* Range segmented toggle — Switch primitive (design system) */}
            <div className="mb-4">
              <Switch<'1' | '7' | '30'>
                value={String(spendRange) as '1' | '7' | '30'}
                onChange={(v) => setSpendRange(Number(v) as 1 | 7 | 30)}
                segments={[
                  { value: '1', label: 'Past day' },
                  { value: '7', label: 'Past 7 days' },
                  { value: '30', label: 'Past 30 days' },
                ]}
                ariaLabel="API spend date range"
              />
            </div>

            {/* Total cost — clickable, with a chevron in the top-right that
                toggles the By provider + By model breakdowns below. MetricCard
                stays centered; the chevron is absolute-positioned so the
                headline number isn't knocked off center. */}
            <button
              onClick={() => setSpendDetailsOpen(!spendDetailsOpen)}
              className="relative w-full rounded-2xl p-6 pb-[10px] bg-bg-hover mb-3 transition-colors"
            >
              <MetricCard
                title={spendRange === 1 ? 'Past 24 hours' : `Past ${spendRange} days`}
                value={spend ? formatUsd(spend.total_cost_usd) : spendLoading ? '—' : 'Free'}
                subtitle={spend
                  ? `${spend.call_count} call${spend.call_count === 1 ? '' : 's'} · ${(spend.total_input_tokens + spend.total_output_tokens).toLocaleString()} tokens`
                  : spendLoading
                    ? 'Loading…'
                    : 'No activity yet'}
              />
              <div className="absolute top-4 right-4">
                {spendDetailsOpen
                  ? <ChevronUp size={16} className="text-text-primary" />
                  : <ChevronDown size={16} className="text-text-primary" />}
              </div>
            </button>

            {spendDetailsOpen && (
              <div className="bg-bg-page rounded-2xl p-5 mt-[4px] mb-3 dark:bg-[rgba(226,243,255,0.05)]">
                {/* By provider */}
                {spend && spend.total_cost_usd > 0 && spend.by_provider.some(p => p.cost_usd > 0) && (
                  <>
                    <div className="type-detail-emphasized text-text-primary mb-3">By provider</div>
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
                    <div className="type-detail-emphasized text-text-primary mb-3">By model</div>
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
                              <div className="type-detail-emphasized text-text-primary truncate">{m.model}</div>
                              <div className="type-detail text-text-secondary">{meta}</div>
                            </div>
                            <div className="type-detail-emphasized text-text-primary shrink-0">
                              {formatUsd(m.cost_usd)}
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
          {health && (
            <div className="mb-12">
              <SectionTitle emoji="" title="Subscription Health Check" size={20} />

              {/* Verdict header — click to expand details. Mirrors the Stress
                  Level collapsible pattern above so the interaction feels
                  familiar. */}
              <button
                onClick={() => setHealthExpanded(!healthExpanded)}
                className="rounded-2xl px-5 py-4 flex items-center gap-3.5 text-left transition-colors bg-bg-hover w-full"
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
                <div className="bg-bg-page rounded-2xl p-5 mt-[4px] dark:bg-[rgba(226,243,255,0.05)]">
                  <div className="type-detail-emphasized text-text-primary mb-3">
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
                      <div className="type-detail-emphasized text-text-primary min-w-0 truncate">{d.label}</div>
                      <div className="type-detail-emphasized text-text-primary text-right">
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
                                {exceeds && <span className="type-detail-emphasized text-text-primary ml-1"> ⚠</span>}
                                {d.used > 0 && !exceeds && <span className="type-detail-emphasized text-text-primary ml-1"> ✓</span>}
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
                    <div className="type-detail-emphasized text-text-primary mb-2.5">Plan options</div>
                    {health.planFitStatus.map((p) => (
                      <div key={p.plan.name} className="flex items-start gap-2 py-1.5">
                        <div className="shrink-0 type-detail-emphasized text-text-primary w-[190px]">
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
