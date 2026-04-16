import { useState, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp,
  Brain, Volume2, Briefcase, Home, Smile,
  Moon, Zap, Gauge, BarChart3, Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SectionTitle,
  Tag, SolutionRow, SummaryFooter, PrimaryButton, TertiaryButton,
  MetricCard, InsightCard, MultiLineChart, TaskProgressCard, ReviewItemCard,
  HealthDimensionRow, PageLayout,
} from './shared';

/* ═══════════════════════════════════════════════════════════════
   Overview Page — "Morning Briefing" dashboard
   ═══════════════════════════════════════════════════════════════ */

interface OverviewPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
}

/* ── Data ── */

const REVIEW_ITEMS = [
  { title: 'UX meeting summary — 6 action items extracted', source: 'Zoom → Docs', type: 'Document', time: 'Ready 3 min ago', urgent: true, humanTime: '~5 min' },
  { title: '3 Jira tickets drafted from design feedback', source: 'Docs → Jira', type: 'Tickets', time: 'Ready 1h ago', urgent: false, humanTime: '~8 min' },
  { title: 'Weekly stakeholder email draft', source: 'Gmail', type: 'Email', time: 'Ready 2h ago', urgent: false, humanTime: '~3 min' },
];

const IN_PROGRESS: Array<{ title: string; progress: number; eta: string; steps: string; icon: LucideIcon }> = [
  { title: 'Analyzing Q2 design metrics report', progress: 62, eta: '~8 min', steps: 'Pulling data from Sheets → Building charts → Formatting', icon: BarChart3 },
  { title: 'Researching competitor onboarding flows', progress: 35, eta: '~20 min', steps: 'Scanning 4 competitor apps → Extracting screenshots → Compiling', icon: Search },
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
  { label: 'Mon', value: 8.5 },
  { label: 'Tue', value: 5.0 },
  { label: 'Wed', value: 9.0 },
  { label: 'Thu', value: 5.5 },
  { label: 'Fri', value: 8.0 },
  { label: 'Sat', value: 6.0 },
  { label: 'Sun', value: 7.5 },
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

export default function OverviewPage({ sidebarOpen, onToggleSidebar, onNewChat }: OverviewPageProps) {
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
  const [expandedProgress, setExpandedProgress] = useState<number | null>(null);
  const [reviewDone, setReviewDone] = useState<Record<number, boolean>>({});
  const [showStressDetail, setShowStressDetail] = useState(false);

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
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[14px] font-bold text-text-primary tracking-[0.5px]">
                    STEPHEN · MONDAY MORNING BRIEFING
                  </span>
                </div>
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

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
              {/* Overall Score Video */}
              <div className="overflow-hidden rounded-2xl relative h-[320px] md:h-auto" style={{ backgroundColor: '#E8755A' }}>
                <video
                  src="/life-health.mov"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover object-bottom block"
                />
              </div>

              {/* Dimensions */}
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
                  <div className="bg-bg-page rounded-2xl p-5 -mt-1 dark:bg-[rgba(226,243,255,0.05)]">
                    <div className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
                      <Brain size={14} className="text-text-primary" /> Stress Analysis
                    </div>

                    {/* Stacked bar */}
                    <div className="flex h-[10px] rounded-full overflow-hidden mb-3">
                      {STRESS_SOURCES.map((s, i) => (
                        <div key={i} className="h-full transition-[width] duration-700" style={{ width: `${s.pct}%`, background: s.color }} />
                      ))}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {STRESS_SOURCES.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                          <span className="text-[13px] text-text-secondary">{s.label}</span>
                          <span className="text-[13px] font-bold text-text-primary">{s.pct}%</span>
                        </div>
                      ))}
                    </div>

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
          </div>

          {/* ━━━ 3. NEEDS YOUR EYES ━━━ */}
          <div className="mb-12">
            <div className="flex flex-wrap items-center justify-between mb-4 [&>*]:mb-0">
              <SectionTitle emoji="" title="Needs Your Eyes" count={REVIEW_ITEMS.filter((_, i) => !reviewDone[i]).length} size={20} />
              <SummaryFooter>
                Total review time: <strong className="text-text-primary">~16 min</strong> for 3 items
              </SummaryFooter>
            </div>

            <div className="flex flex-col">
              {REVIEW_ITEMS.map((item, i) => (
                <ReviewItemCard
                  key={i}
                  title={item.title}
                  source={item.source}
                  type={item.type}
                  time={item.time}
                  humanTime={item.humanTime}
                  done={reviewDone[i] || false}
                  onToggle={() => setReviewDone(p => ({ ...p, [i]: !p[i] }))}
                />
              ))}
            </div>
          </div>

          {/* ━━━ 4. STEPHEN IS WORKING ON ━━━ */}
          <div className="mb-12">
            <SectionTitle emoji="" title="Agents at Work" count={IN_PROGRESS.length} size={20} />

            <div className="flex flex-col">
              {IN_PROGRESS.map((task, i) => (
                <TaskProgressCard
                  key={i}
                  title={task.title}
                  progress={task.progress}
                  eta={task.eta}
                  steps={task.steps.split(' → ')}
                  icon={task.icon}
                  expanded={expandedProgress === i}
                  onClick={() => setExpandedProgress(expandedProgress === i ? null : i)}
                />
              ))}
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
                <span className="text-[14px] text-text-primary">— Project impact, user data, feedback & revenue</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {IMPACT_WORK.map((item, i) => {
                  const tc = TYPE_CONFIG[item.type];
                  return (
                    <div key={i} className={`p-3.5 rounded-xl ${tc.classes}`}>
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
