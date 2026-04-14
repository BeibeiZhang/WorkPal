import { useState, useCallback } from 'react';
import {
  Sparkles, ChevronRight, Check,
  Brain, Volume2, Briefcase, Home, Smile,
} from 'lucide-react';
import {
  SectionTitle, LabeledBar, CircularProgress,
  Tag, SolutionRow, SummaryFooter, PrimaryButton, SecondaryButton,
  MetricCard, InsightCard, AreaChart, TaskProgressCard, ReviewItemCard,
} from './shared';

/* ═══════════════════════════════════════════════════════════════
   Overview Page — "Morning Briefing" dashboard
   ═══════════════════════════════════════════════════════════════ */

interface OverviewPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isDark?: boolean;
  selectedAvatarId?: string;
}

const AVATAR_VIDEOS: Record<string, { light: string; dark: string }> = {
  'black-woman': { light: '/animations/black-woman-light.mp4', dark: '/animations/black-woman-dark.mp4' },
  'asian-woman': { light: '/animations/asian-woman-light.mp4', dark: '/animations/asian-woman-dark.mp4' },
  'white-man': { light: '/animations/white-man-light.mp4', dark: '/animations/white-man-dark.mp4' },
};

/* ── Data ── */

const REVIEW_ITEMS = [
  { title: 'UX meeting summary — 6 action items extracted', source: 'Zoom → Docs', type: 'Document', time: 'Ready 3 min ago', urgent: true, humanTime: '~5 min' },
  { title: '3 Jira tickets drafted from design feedback', source: 'Docs → Jira', type: 'Tickets', time: 'Ready 1h ago', urgent: false, humanTime: '~8 min' },
  { title: 'Weekly stakeholder email draft', source: 'Gmail', type: 'Email', time: 'Ready 2h ago', urgent: false, humanTime: '~3 min' },
];

const IN_PROGRESS = [
  { title: 'Analyzing Q2 design metrics report', progress: 62, eta: '~8 min', steps: 'Pulling data from Sheets → Building charts → Formatting' },
  { title: 'Researching competitor onboarding flows', progress: 35, eta: '~20 min', steps: 'Scanning 4 competitor apps → Extracting screenshots → Compiling' },
];

const HEALTH_DIMENSIONS = [
  { emoji: '🧠', label: 'Focus Time', value: 2, target: 2, unit: 'h', status: 'on-track', desc: '9–11am blocked & protected', met: true },
  { emoji: '👶', label: 'Family Time', value: 2, target: 2, unit: 'h', status: 'on-track', desc: '陪孩子 + 桌游时间已安排', met: true },
  { emoji: '😴', label: 'Sleep', value: 7, target: 7, unit: 'h', status: 'on-track', desc: 'Last night: 7h 12min — well rested', met: true },
  { emoji: '⚡', label: 'Workload', value: 3, target: null as number | null, unit: 'tasks', status: 'balanced', desc: 'Manageable pace today', met: true },
];

const STRESS_LEVEL = 48;

const STRESS_SOURCES = [
  { label: 'Deadline pressure', pct: 35, color: '#EF4444' },
  { label: 'Keeping up with AI', pct: 28, color: '#F59E0B' },
  { label: 'Cross-team alignment', pct: 22, color: '#7652B9' },
  { label: 'Context switching', pct: 15, color: '#3171ff' },
];

const STRESS_SOLUTIONS = [
  { icon: '🎧', title: 'AI趋势3分钟速报', desc: '替你追行业动态，每天早上3分钟音频', tag: '针对：跟不上AI' },
  { icon: '🧘', title: 'Focus Block 守护', desc: '9-11am 自动拦截非紧急会议', tag: '针对：Deadline' },
  { icon: '📋', title: '异步对齐模板', desc: '减少30%的对齐会议', tag: '针对：跨团队' },
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

const WEEKLY_ENERGY = [
  { label: 'Mon', value: 85 },
  { label: 'Tue', value: 72 },
  { label: 'Wed', value: 65 },
  { label: 'Thu', value: 78 },
  { label: 'Fri', value: 60 },
  { label: 'Sat', value: 90 },
  { label: 'Sun', value: 95 },
];

const TYPE_CONFIG: Record<string, { emoji: string; classes: string }> = {
  feature: { emoji: '🚀', classes: 'bg-bg-hover border-stroke-outline' },
  metric: { emoji: '📊', classes: 'bg-bg-hover border-stroke-outline' },
  feedback: { emoji: '💬', classes: 'bg-bg-hover border-stroke-outline' },
  revenue: { emoji: '💰', classes: 'bg-bg-hover border-stroke-outline' },
};

/* ── Main Component ── */

export default function OverviewPage({ sidebarOpen, onToggleSidebar, isDark, selectedAvatarId = 'black-woman' }: OverviewPageProps) {
  const avatarVideo = AVATAR_VIDEOS[selectedAvatarId] || AVATAR_VIDEOS['black-woman'];
  const videoSrc = isDark ? avatarVideo.dark : avatarVideo.light;
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

  const metCount = HEALTH_DIMENSIONS.filter(d => d.met).length;
  const totalDimensions = HEALTH_DIMENSIONS.length;
  const overallScore = Math.round((metCount / totalDimensions) * 100);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full app-bg">
      {/* Header bar */}
      <div className="flex items-center gap-4 px-4 h-12 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors shrink-0"
            style={{ color: 'var(--color-icon-primary)' }}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor" />
              <rect width="15" height="2" rx="1" y="7" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>

      {/* Page title */}
      <div className="px-8 pb-2 shrink-0">
        <h1
          className="text-[40px] font-bold leading-[48px] tracking-[-0.5px] text-text-primary"
          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Overview
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-8 pb-10 scrollbar-autohide">

          {/* ━━━ 1. GREETING ━━━ */}
          <div className="rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden bg-bg-hover">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative">
              <div className="w-[72px] h-[72px] rounded-2xl shrink-0 overflow-hidden bg-bg-hover">
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 mb-1.5">
                  <Sparkles size={12} className="text-text-primary" />
                  <span className="text-[14px] font-bold text-text-primary tracking-[0.5px]">
                    MAYA · MONDAY MORNING BRIEFING
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
          <div className="mb-6">
            <SectionTitle emoji="🔋" title="Life Health Index" />

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
              {/* Overall Score Ring */}
              <div className="bg-bg-page rounded-2xl border border-stroke-outline p-6 text-center flex flex-col items-center dark:bg-[rgba(226,243,255,0.05)]">
                <div className="mb-3">
                  <CircularProgress value={overallScore} color="#3171ff">
                    <span className="text-[28px] font-bold text-text-primary">{metCount}/{totalDimensions}</span>
                    <span className="text-[14px] text-text-primary">goals met</span>
                  </CircularProgress>
                </div>
                <div className="text-[14px] font-bold text-text-primary">All On Track ✓</div>
                <div className="text-[14px] text-text-primary mt-1">Life + Work balanced today</div>
              </div>

              {/* Dimensions */}
              <div className="flex flex-col gap-2">
                {HEALTH_DIMENSIONS.map((d, i) => (
                  <div key={i} className="bg-bg-page rounded-xl border border-stroke-outline px-4 py-3 flex items-center gap-3.5 dark:bg-[rgba(226,243,255,0.05)]">
                    <span className="text-[22px] shrink-0">{d.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-text-primary">{d.label}</span>
                        {d.target ? (
                          <Tag bold>{d.value}/{d.target}{d.unit}</Tag>
                        ) : (
                          <Tag bold>{d.value} {d.unit} · {d.status}</Tag>
                        )}
                      </div>
                      <div className="text-[14px] text-text-primary mt-0.5">{d.desc}</div>
                    </div>
                    {d.met && <Check size={16} className="text-text-primary shrink-0" />}
                  </div>
                ))}

                {/* Stress Index — Clickable */}
                <button
                  onClick={() => setShowStressDetail(!showStressDetail)}
                  className="rounded-xl px-4 py-3 flex items-center gap-3.5 text-left transition-colors bg-bg-hover border border-stroke-outline"
                >
                  <span className="text-[22px] shrink-0">🧘</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-text-primary">Stress Level</span>
                      <Tag bold>{STRESS_LEVEL}/100 · {STRESS_LEVEL > 60 ? 'Moderate' : 'Low'}</Tag>
                      <span className="text-[14px] text-text-primary">↓16 vs last week</span>
                    </div>
                    <div className="text-[14px] text-text-primary mt-0.5">
                      Tap to see stress analysis & solutions →
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-primary shrink-0" />
                </button>

                {/* Stress Detail Panel (expandable) */}
                {showStressDetail && (
                  <div className="bg-bg-page rounded-2xl border border-stroke-outline p-5 -mt-1 dark:bg-[rgba(226,243,255,0.05)]">
                    <div className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
                      <Brain size={14} className="text-text-primary" /> Stress Analysis
                    </div>

                    {STRESS_SOURCES.map((s, i) => (
                      <LabeledBar key={i} label={s.label} pct={s.pct} color={s.color} />
                    ))}

                    <div className="mt-4 pt-3.5 border-t border-stroke-outline">
                      <div className="text-[14px] font-bold text-text-primary mb-2.5">Maya's Solutions</div>
                      {STRESS_SOLUTIONS.map((sol, i) => (
                        <SolutionRow key={i} icon={sol.icon} title={sol.title} desc={sol.desc} tag={sol.tag} />
                      ))}
                    </div>

                    <SecondaryButton className="mt-3 gap-1.5">
                      View Full Health Report <ChevronRight size={12} />
                    </SecondaryButton>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ━━━ 3. NEEDS YOUR EYES ━━━ */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between">
              <SectionTitle emoji="👀" title="Needs Your Eyes" count={REVIEW_ITEMS.filter((_, i) => !reviewDone[i]).length} />
              <SummaryFooter>
                Total review time: <strong className="text-text-primary">~16 min</strong> for 3 items
              </SummaryFooter>
            </div>

            <div className="flex flex-col gap-2.5">
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

          {/* ━━━ 4. MAYA IS WORKING ON ━━━ */}
          <div className="mb-6">
            <SectionTitle emoji="⚡" title="Maya is Working On" />

            <div className="flex flex-col gap-3">
              {IN_PROGRESS.map((task, i) => (
                <TaskProgressCard
                  key={i}
                  title={task.title}
                  progress={task.progress}
                  eta={task.eta}
                  steps={task.steps.split(' → ')}
                  expanded={expandedProgress === i}
                  onClick={() => setExpandedProgress(expandedProgress === i ? null : i)}
                />
              ))}
            </div>
          </div>

          {/* ━━━ 5. MAYA'S INSIGHT ━━━ */}
          <div className="mb-6">
            <InsightCard
              body="I noticed your focus time has dropped 40% this week compared to your best weeks. Your most productive hours are usually between 9-11am, but those slots got filled with meetings. Want me to protect those morning blocks going forward?"
              actions={[
                { label: 'Yes, protect my mornings' },
                { label: 'Show me the data' },
              ]}
            />
          </div>

          {/* ━━━ 6. POSITIVE IMPACT — 7 DAY, THREE DIMENSIONS ━━━ */}
          <div className="mb-10">
            <div className="flex flex-wrap items-center justify-between mb-4">
              <SectionTitle emoji="🌟" title="Your Positive Impact This Week" />
              <span className="text-[14px] text-text-primary">Apr 7 – 13, 2026 · 7 days</span>
            </div>

            {/* ── WORK IMPACT ── */}
            <div className="bg-bg-page rounded-2xl border border-stroke-outline p-6 mb-3 dark:bg-[rgba(226,243,255,0.05)]">
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
                    <div key={i} className={`p-3.5 rounded-xl border ${tc.classes}`}>
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
              <div className="bg-bg-page rounded-2xl border border-stroke-outline p-5 dark:bg-[rgba(226,243,255,0.05)]">
                <div className="flex items-center gap-2 mb-3.5">
                  <div className="w-8 h-8 rounded-xl bg-bg-hover flex items-center justify-center">
                    <Home size={16} className="text-text-primary" />
                  </div>
                  <span className="text-[14px] font-bold text-text-primary">Family</span>
                </div>

                <MetricCard title="Emotional value to hubby" value={String(IMPACT_FAMILY.husbandMood)} subtitle="/10 — 满分！" />

                <div className="px-3.5 py-2.5 rounded-xl bg-bg-hover border border-stroke-outline text-[14px] text-text-primary leading-[1.5]">
                  {IMPACT_FAMILY.detail}
                </div>

                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {['😊 Relaxed evenings', '🎲 Board game night', '👶 Co-bedtime routine'].map((tag, i) => (
                    <Tag key={i}>{tag}</Tag>
                  ))}
                </div>
              </div>

              {/* Self */}
              <div className="bg-bg-page rounded-2xl border border-stroke-outline p-5 dark:bg-[rgba(226,243,255,0.05)]">
                <div className="flex items-center gap-2 mb-3.5">
                  <div className="w-8 h-8 rounded-xl bg-bg-hover flex items-center justify-center">
                    <Smile size={16} className="text-text-primary" />
                  </div>
                  <span className="text-[14px] font-bold text-text-primary">Self</span>
                </div>

                <MetricCard title="Extra disposable time" value={`+${IMPACT_SELF.extraHours}h`} subtitle="this week gained back" />

                <div className="px-3.5 py-2.5 rounded-xl bg-bg-hover border border-stroke-outline text-[14px] text-text-primary leading-[1.5]">
                  {IMPACT_SELF.detail}
                </div>

                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {['🎮 Gaming time', '📚 Reading', '💪 Morning walk'].map((tag, i) => (
                    <Tag key={i}>{tag}</Tag>
                  ))}
                </div>
              </div>
            </div>

            {/* Energy trend */}
            <div className="bg-bg-page rounded-2xl border border-stroke-outline p-5 dark:bg-[rgba(226,243,255,0.05)]">
              <div className="text-[14px] font-bold text-text-primary mb-2.5">Energy Trend This Week</div>
              <AreaChart data={WEEKLY_ENERGY} color="#3171ff" gradientId="energyGrad" />
            </div>
          </div>
      </div>
    </div>
  );
}
