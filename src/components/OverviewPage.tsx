import { useState, useCallback, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp,
  Brain, Volume2, Briefcase, Home, Smile,
  Moon, Zap, Gauge, BarChart3, Search,
  CalendarClock, Globe, Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SectionTitle,
  Tag, SolutionRow, SummaryFooter, PrimaryButton, TertiaryButton,
  MetricCard, InsightCard, MultiLineChart, TaskProgressCard, ReviewItemCard,
  HealthDimensionRow, PageLayout, CategoryBreakdown,
} from './shared';
import { fetchUnreadArtifacts, markArtifactViewed, artifactItemCount, type Artifact } from '../lib/artifacts';

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
  { id: 's3', name: 'Monthly competitor UX snapshot', cron: '1st of month · 10:00 AM', lastRun: 'Apr 1', nextRun: 'May 1', from: { kind: 'project', id: 'proj-1', label: 'Agent Design' } },
  { id: 's4', name: 'Morning briefing email', cron: 'Every day · 8:30 AM', lastRun: 'Today', nextRun: 'Tomorrow 8:30 AM' },
];

const HEALTH_DIMENSIONS: Array<{
  icon: LucideIcon;
  label: string;
  value: number;
  target: number | null;
  unit: string;
  status: string;
  desc: string;
  met: boolean;
}> = [
  { icon: Brain, label: 'Focus Time', value: 2, target: 2, unit: 'h', status: 'on-track', desc: '9–11am blocked & protected', met: true },
  { icon: Home, label: 'Family Time', value: 2, target: 2, unit: 'h', status: 'on-track', desc: 'Kids + board game time scheduled', met: true },
  { icon: Moon, label: 'Sleep', value: 7, target: 7, unit: 'h', status: 'on-track', desc: 'Last night: 7h 12min — well rested', met: true },
  { icon: Zap, label: 'Workload', value: 3, target: null, unit: 'tasks', status: 'balanced', desc: 'Manageable pace today', met: true },
];

const STRESS_LEVEL = 48;

const STRESS_SOURCES = [
  { label: 'Deadline pressure', pct: 35, color: '#EF4444' },
  { label: 'Keeping up with AI', pct: 28, color: '#F59E0B' },
  { label: 'Cross-team alignment', pct: 22, color: '#7652B9' },
  { label: 'Context switching', pct: 15, color: '#3171ff' },
];

const STRESS_SOLUTIONS = [
  { icon: '🎧', title: '3-Min AI Briefing', desc: 'Daily audio digest on industry trends, every morning', tag: 'For: Keeping up with AI' },
  { icon: '🧘', title: 'Focus Block Guard', desc: '9-11am auto-block non-urgent meetings', tag: 'For: Deadline pressure' },
  { icon: '📋', title: 'Async Alignment Template', desc: 'Cut 30% of alignment meetings', tag: 'For: Cross-team' },
];

const IMPACT_WORK = [
  { label: 'Delivery Flow shipped', detail: 'Completion rate +12%, satisfaction 4.6/5', type: 'feature' as const },
  { label: 'Onboarding V2 activation', detail: '+18% activation, -34% drop-off', type: 'metric' as const },
  { label: 'User feedback score', detail: 'NPS +8 this week across 3 features', type: 'feedback' as const },
  { label: 'Revenue attribution', detail: 'Your features contribute to ~$42K MRR lift', type: 'revenue' as const },
];

const IMPACT_FAMILY = {
  husbandMood: 10,
  detail: 'Came home relaxed 5/7 days, helped with bedtime routine, weekend board game night',
};

const IMPACT_SELF = {
  extraHours: 2,
  detail: 'AI handled emails, meeting notes, and research → you got 2h back for yourself',
};

// Data shaped for dramatic interweaving waves
const WEEKLY_ENERGY = [
  { label: 'Mon', value: 40 },
  { label: 'Tue', value: 80 },
  { label: 'Wed', value: 35 },
  { label: 'Thu', value: 90 },
  { label: 'Fri', value: 45 },
  { label: 'Sat', value: 85 },
  { label: 'Sun', value: 95 },
];

const WEEKLY_SLEEP = [
  { label: 'Mon', value: 5.5 },
  { label: 'Tue', value: 8.0 },
  { label: 'Wed', value: 5.0 },
  { label: 'Thu', value: 9.0 },
  { label: 'Fri', value: 5.5 },
  { label: 'Sat', value: 8.5 },
  { label: 'Sun', value: 9.0 },
];

// Stress: 0-100. Color: ≤33 green, ≤66 yellow, >66 red
const WEEKLY_STRESS = [
  { label: 'Mon', value: 65 },
  { label: 'Tue', value: 30 },
  { label: 'Wed', value: 80 },
  { label: 'Thu', value: 25 },
  { label: 'Fri', value: 70 },
  { label: 'Sat', value: 35 },
  { label: 'Sun', value: 15 },
];

const TYPE_CONFIG: Record<string, { emoji: string; classes: string }> = {
  feature: { emoji: '🚀', classes: 'bg-bg-hover' },
  metric: { emoji: '📊', classes: 'bg-bg-hover' },
  feedback: { emoji: '💬', classes: 'bg-bg-hover' },
  revenue: { emoji: '💰', classes: 'bg-bg-hover' },
};

/* ── Main Component ── */

export default function OverviewPage({ sidebarOpen, onToggleSidebar, onNewChat, onOpenChat, onOpenProject }: OverviewPageProps) {
  const videoSrc = '/animations/avatar.mp4';
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
  const [showStressDetail, setShowStressDetail] = useState(false);

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
            <div className="flex flex-col md:flex-row relative">
              <div className="w-full md:w-[45%] shrink-0 overflow-hidden">
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 p-6 md:p-8 flex flex-col justify-center">
                <h2
                  className="text-[16px] font-bold text-text-primary leading-[32px] mb-2.5 tracking-[-0.43px]"
                  style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Good morning, Beibei! Today feels like a steady day ☀️
                </h2>
                <p className="text-[14px] text-text-primary leading-[1.65] tracking-[-0.43px]">
                  Your life commitments are all locked in — 2h family time, 7h sleep, check ✓. I've protected your 9–11am focus block, and today's workload is light. I finished your meeting notes and drafted 3 tickets — review them whenever you're ready.
                </p>
                <PrimaryButton onClick={toggleSpeak} className="mt-3 gap-2">
                  <Volume2 size={16} />
                  {isSpeaking ? 'Stop' : 'Listen'}
                </PrimaryButton>
              </div>
            </div>
          </div>

          {/* ━━━ 2. LIFE HEALTH INDEX ━━━ */}
          <div className="mb-12">
            <SectionTitle emoji="" title="Life Health Index" size={20} />

            <div className="flex flex-col">
                <div className="flex flex-col">
                  {HEALTH_DIMENSIONS.map((d, i) => (
                    <HealthDimensionRow
                      key={i}
                      icon={d.icon}
                      label={d.label}
                      desc={d.desc}
                      value={d.value}
                      target={d.target}
                      unit={d.unit}
                      status={d.status}
                    />
                  ))}
                </div>

                {/* Stress Index — Clickable */}
                <button
                  onClick={() => setShowStressDetail(!showStressDetail)}
                  className="rounded-2xl px-5 py-4 flex items-center gap-3.5 text-left transition-colors bg-bg-hover"
                >
                  <Gauge size={22} strokeWidth={1.75} className="text-text-primary shrink-0 icon-theme" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[14px] font-bold text-text-primary">Stress Level</span>
                    <div className="text-[14px] text-text-primary mt-0.5">
                      Tap to see stress analysis & solutions →
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 md:hidden">
                      <Tag>{STRESS_LEVEL}/100 · {STRESS_LEVEL > 60 ? 'Moderate' : 'Low'}</Tag>
                      <span className="text-[14px] text-text-primary">↓16</span>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <Tag>{STRESS_LEVEL}/100 · {STRESS_LEVEL > 60 ? 'Moderate' : 'Low'}</Tag>
                    <span className="text-[14px] text-text-primary">↓16</span>
                    {showStressDetail ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                  </div>
                  <div className="md:hidden shrink-0">
                    {showStressDetail ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                  </div>
                </button>

                {/* Stress Detail Panel (expandable) */}
                {showStressDetail && (
                  <div className="bg-bg-page rounded-2xl p-5 mt-[4px] dark:bg-[rgba(226,243,255,0.05)]">
                    <div className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
                      <Brain size={14} className="text-text-primary" /> Stress Analysis
                    </div>

                    <CategoryBreakdown categories={STRESS_SOURCES} />

                    <div className="mt-4 pt-3.5 border-t border-stroke-outline">
                      <div className="text-[14px] font-bold text-text-primary mb-2.5">Stephen's Solutions</div>
                      {STRESS_SOLUTIONS.map((sol, i) => (
                        <SolutionRow key={i} icon={sol.icon} title={sol.title} desc={sol.desc} tag={sol.tag} />
                      ))}
                    </div>

                    <TertiaryButton className="mt-3 gap-1.5">
                      View Full Health Report <ChevronRight size={12} />
                    </TertiaryButton>
                  </div>
                )}
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
                    className="text-left border-b border-dashed border-stroke-outline last:border-0 hover:bg-bg-hover transition-colors"
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
                    className="text-left w-full border-b border-dashed border-stroke-outline last:border-0 hover:bg-bg-hover transition-colors disabled:cursor-default disabled:hover:bg-transparent"
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
                    className="px-5 py-4 border-b border-dashed border-stroke-outline last:border-0 text-left hover:bg-bg-hover transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <div className="flex items-center gap-3.5">
                      <CalendarClock size={22} strokeWidth={1.75} className="shrink-0 icon-theme text-text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold text-text-primary">{job.name}</div>
                        <div className="text-[13px] text-text-primary mt-0.5">
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

          {/* ━━━ 5. STEPHEN'S INSIGHT ━━━ */}
          <div className="mb-12">
            <InsightCard
              body="I noticed your focus time has dropped 40% this week compared to your best weeks. Your most productive hours are usually between 9-11am, but those slots got filled with meetings. Want me to protect those morning blocks going forward?"
              actions={[
                { label: 'Yes, protect my mornings', secondary: true },
                { label: 'Show me the data' },
              ]}
            />
          </div>

          {/* ━━━ 6. POSITIVE IMPACT — 7 DAY, THREE DIMENSIONS ━━━ */}
          <div className="mb-20">
            <div className="flex flex-wrap items-center justify-between mb-4 [&>*]:mb-0">
              <SectionTitle emoji="" title="Your Positive Impact This Week" size={20} />
              <span className="text-[14px] text-text-primary">Apr 7 – 13, 2026 · 7 days</span>
            </div>

            {/* ── WORK IMPACT ── */}
            <div className="border border-stroke-outline rounded-2xl p-6 mb-3">
              <div className="flex items-center gap-2 mb-3.5">
                <div className="w-8 h-8 rounded-xl bg-bg-hover flex items-center justify-center">
                  <Briefcase size={16} className="text-text-primary" />
                </div>
                <span className="text-[14px] font-bold text-text-primary">Work</span>
                <TertiaryButton onClick={() => { /* cosmetic — no real export yet */ }} className="gap-1.5 ml-auto">
                  <Download size={14} />
                  Export report
                </TertiaryButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {IMPACT_WORK.map((item, i) => {
                  const tc = TYPE_CONFIG[item.type];
                  return (
                    <div key={i} className={`p-3.5 rounded-[8px] ${tc.classes}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[16px]">{tc.emoji}</span>
                        <span className="text-[14px] font-bold text-text-primary">{item.label}</span>
                      </div>
                      <div className="text-[14px] text-text-primary leading-[1.5]">{item.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── FAMILY + SELF side by side ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3.5">
              {/* Family */}
              <div className="border border-stroke-outline rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3.5">
                  <div className="w-8 h-8 rounded-xl bg-bg-hover flex items-center justify-center">
                    <Home size={16} className="text-text-primary" />
                  </div>
                  <span className="text-[14px] font-bold text-text-primary">Family</span>
                </div>

                <MetricCard title="Emotional value to hubby" value={String(IMPACT_FAMILY.husbandMood)} subtitle="/10 — Perfect!" />

                <div className="px-3.5 py-2.5 rounded-xl bg-bg-hover text-[14px] text-text-primary leading-[1.5]">
                  {IMPACT_FAMILY.detail}
                </div>

                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {['😊 Relaxed evenings', '🎲 Board game night', '👶 Co-bedtime routine'].map((tag, i) => (
                    <Tag key={i}>{tag}</Tag>
                  ))}
                </div>
              </div>

              {/* Self */}
              <div className="border border-stroke-outline rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3.5">
                  <div className="w-8 h-8 rounded-xl bg-bg-hover flex items-center justify-center">
                    <Smile size={16} className="text-text-primary" />
                  </div>
                  <span className="text-[14px] font-bold text-text-primary">Self</span>
                </div>

                <MetricCard title="Extra disposable time" value={`+${IMPACT_SELF.extraHours}h`} subtitle="this week gained back" />

                <div className="px-3.5 py-2.5 rounded-xl bg-bg-hover text-[14px] text-text-primary leading-[1.5]">
                  {IMPACT_SELF.detail}
                </div>

                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {['🎮 Gaming time', '📚 Reading', '💪 Morning walk'].map((tag, i) => (
                    <Tag key={i}>{tag}</Tag>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekly trend chart */}
            <div className="border border-stroke-outline rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[14px] font-bold text-text-primary">Weekly Trends</div>
                <div className="flex items-center gap-4 text-[12px] text-text-primary opacity-70">
                  <span className="flex items-center gap-1.5"><span className="w-5 h-[2.5px] rounded-full inline-block" style={{ background: '#3171FF' }} />Energy</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-[2.5px] rounded-full inline-block" style={{ background: '#8B5CF6' }} />Sleep</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 h-[2.5px] rounded-full inline-block" style={{ background: '#028901' }} />Stress</span>
                </div>
              </div>
              <MultiLineChart
                labels={WEEKLY_ENERGY.map(d => d.label)}
                height={180}
                series={[
                  { data: WEEKLY_ENERGY, color: '#3171FF' },
                  { data: WEEKLY_SLEEP.map(d => ({ ...d, value: (d.value / 9.5) * 100 })), color: '#8B5CF6' },
                  {
                    data: WEEKLY_STRESS,
                    color: '#028901',
                    strokeGradient: [
                      { offset: '0%', color: '#DC2626' },   // top = high stress = red
                      { offset: '50%', color: '#D97706' },  // mid = orange
                      { offset: '100%', color: '#028901' }, // bottom = low stress = green
                    ],
                  },
                ]}
              />
            </div>
          </div>
    </PageLayout>
  );
}
