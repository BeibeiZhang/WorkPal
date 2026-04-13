/**
 * Shared UI Components
 * ====================
 * Single source of truth — used by both app pages and the Design System page.
 * Update a component here → it updates everywhere in the app.
 */
import { Check, Clock, Eye, Play, Timer, User, Sparkles } from 'lucide-react';
import { type ReactNode, useRef, useState, useLayoutEffect } from 'react';

/* ─── 1. SectionTitle ─── */
export function SectionTitle({
  emoji,
  title,
  count,
}: {
  emoji: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[14px]">{emoji}</span>
      <span className="text-[14px] font-bold text-text-primary tracking-[-0.43px]">{title}</span>
      {count !== undefined && (
        <span className="text-[14px] px-2.5 py-0.5 rounded-full bg-bg-hover text-text-primary font-bold">{count}</span>
      )}
    </div>
  );
}

/* ─── 2. ProgressBar ─── */
export function ProgressBar({
  value,
  color = '#3171ff',
  height = 6,
  showLabel = false,
}: {
  value: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-full bg-bg-hover overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
        />
      </div>
      {showLabel && <span className="text-[14px] font-bold text-text-primary shrink-0">{value}%</span>}
    </div>
  );
}

/* ─── 3. LabeledBar (stress / category bars) ─── */
export function LabeledBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span className="text-[14px] text-text-primary">{label}</span>
        <span className="text-[14px] font-bold text-text-primary">{pct}%</span>
      </div>
      <div className="h-[5px] rounded-full bg-bg-hover overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ─── 4. CircularProgress ─── */
export function CircularProgress({
  value,
  max = 100,
  size: sizeProp,
  strokeWidth = 8,
  color = '#3171ff',
  innerPadding = 4,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  innerPadding?: number;
  children?: ReactNode;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [autoSize, setAutoSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (sizeProp || !measureRef.current) return;
    const el = measureRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // Content rect diagonal must fit inside the inner circle (ring inner edge)
    // Inner circle diameter = size - 2*strokeWidth
    // Content diagonal + 2*padding <= inner circle diameter
    const diagonal = Math.sqrt(w * w + h * h);
    const needed = diagonal + innerPadding * 2 + strokeWidth * 2;
    // round up to even number for clean SVG
    setAutoSize(Math.ceil(needed / 2) * 2);
  }, [sizeProp, strokeWidth, innerPadding, children]);

  const size = sizeProp ?? autoSize ?? 100;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Hidden measurement element for auto-sizing */}
      {!sizeProp && children && (
        <span ref={measureRef} className="flex flex-col items-center justify-center" style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' }}>
          {children}
        </span>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-hover)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${pct * circumference} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── 5. TimePill ─── */
export function TimePill({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-hover border border-stroke-outline shrink-0">
      <User size={12} className="text-text-primary" />
      <span className="text-[14px] text-text-primary">{time}</span>
    </div>
  );
}

/* ─── 6. StepIndicator ─── */
export function StepIndicator({ status }: { status: 'done' | 'in-progress' | 'pending' }) {
  if (status === 'done') {
    return <Check size={14} className="text-text-primary shrink-0" />;
  }
  if (status === 'in-progress') {
    return (
      <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: 'var(--color-text-primary)' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-text-primary)' }} />
      </div>
    );
  }
  return <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0" style={{ borderColor: 'var(--color-stroke-outline)' }} />;
}

/* ─── 7. Tag ─── */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="text-[14px] text-text-primary bg-bg-hover px-2 py-0.5 rounded-lg">
      {children}
    </span>
  );
}

/* ─── 7b. PrimaryButton ─── */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className: extra = '',
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`gradient-btn flex items-center justify-center px-5 py-2.5 rounded-[4px] text-white font-bold text-[14px] leading-[22px] cursor-pointer transition-opacity disabled:opacity-40 ${fullWidth ? 'w-full' : ''} ${extra}`}
    >
      {children}
    </button>
  );
}

/* ─── 7c. SecondaryButton ─── */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  className: extra = '',
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-5 py-2.5 rounded-[4px] border border-stroke-outline text-text-primary font-semibold text-[14px] leading-[22px] cursor-pointer hover:bg-bg-hover chip-gradient-hover transition-colors disabled:opacity-40 ${fullWidth ? 'w-full' : ''} ${extra}`}
    >
      {children}
    </button>
  );
}

/* ─── 7d. FilterChip ─── */
export function FilterChip({
  label,
  active = false,
  icon,
  count,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 px-3 py-1 rounded-full border text-[14px] leading-[22px] tracking-[-0.43px] transition-colors cursor-pointer ${
        active ? 'border-transparent font-medium' : 'chip-gradient-hover border-stroke-outline text-text-primary'
      }`}
      style={
        active
          ? { background: 'rgba(49,113,255,0.1)', color: '#3171ff' }
          : undefined
      }
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span className={active ? '' : 'text-text-primary'}>{count}</span>
      )}
    </button>
  );
}

/* ─── 8. SolutionRow ─── */
export function SolutionRow({
  icon,
  title,
  desc,
  tag,
}: {
  icon: string;
  title: string;
  desc: string;
  tag: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-bg-hover mb-1.5">
      <span className="text-[16px]">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-bold text-text-primary">{title}</span>
        <span className="text-[14px] text-text-primary"> — {desc}</span>
      </div>
      <span className="text-[14px] text-text-primary bg-bg-hover px-1.5 py-0.5 rounded-md whitespace-nowrap border border-stroke-outline">{tag}</span>
    </div>
  );
}

/* ─── 9. SummaryFooter ─── */
export function SummaryFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1.5 py-1.5 text-[14px] text-text-primary">
      <Clock size={12} />
      <span>{children}</span>
    </div>
  );
}

/* ─── 10. MetricCard ─── */
export function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="text-center mb-3.5">
      <div className="text-[14px] font-bold text-text-primary uppercase tracking-[0.5px] mb-1">{title}</div>
      <div className="text-[40px] font-bold text-text-primary leading-none">{value}</div>
      <div className="text-[14px] text-text-primary">{subtitle}</div>
    </div>
  );
}

/* ─── 11. InsightCard ─── */
export function InsightCard({
  body,
  actions,
}: {
  body: string;
  actions: { label: string; primary?: boolean; onClick?: () => void }[];
}) {
  return (
    <div className="rounded-2xl p-7 bg-bg-hover">
      <div className="text-[14px] font-bold text-text-primary mb-3 flex items-center gap-1.5">
        <Sparkles size={14} className="text-text-primary" /> MAYA'S INSIGHT
      </div>
      <p className="text-[14px] text-text-primary leading-[1.7] mb-4 tracking-[-0.43px]">{body}</p>
      <div className="flex flex-wrap gap-2.5">
        {actions.map((a, i) =>
          a.primary ? (
            <PrimaryButton key={i} onClick={a.onClick}>{a.label}</PrimaryButton>
          ) : (
            <SecondaryButton key={i} onClick={a.onClick}>{a.label}</SecondaryButton>
          )
        )}
      </div>
    </div>
  );
}

/* ─── 12. AreaChart ─── */
export function AreaChart({
  data,
  color = '#3171ff',
  height = 100,
  gradientId,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  gradientId?: string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 600;
  const h = 80;
  const padX = 40;
  const padY = 8;
  const stepX = (w - padX * 2) / (data.length - 1);
  const gId = gradientId || `areaGrad-${Math.random().toString(36).slice(2, 8)}`;

  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + (h - padY * 2) * (1 - d.value / max),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          <text x={p.x} y={h + 16} textAnchor="middle" fill="var(--color-text-primary)" fontSize={14} fontFamily="Inter, sans-serif">
            {data[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── 13. TaskProgressCard ─── */
export function TaskProgressCard({
  title,
  progress,
  eta,
  steps,
  expanded = false,
  onClick,
}: {
  title: string;
  progress: number;
  eta: string;
  steps: string[];
  expanded?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-bg-page rounded-2xl border border-stroke-outline p-5 text-left transition-colors dark:bg-[rgba(226,243,255,0.05)] w-full"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-bg-hover flex items-center justify-center shrink-0">
          <Play size={14} className="text-text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="text-[14px] font-bold text-text-primary">{title}</div>
            <div className="text-[14px] text-text-primary flex items-center gap-1 shrink-0">
              <Timer size={12} /> ETA {eta}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1"><ProgressBar value={progress} height={6} /></div>
            <span className="text-[14px] text-text-primary shrink-0">{progress}%</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3.5 p-3.5 bg-bg-hover rounded-xl text-[14px] text-text-primary leading-[1.8] ml-[52px]">
          <div className="font-bold text-text-primary mb-1">Steps:</div>
          {steps.map((s, j) => (
            <div key={j} className="flex items-center gap-2">
              <StepIndicator status={j < steps.length - 1 ? 'done' : 'in-progress'} />
              <span className="text-text-primary">{s}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

/* ─── 14. ReviewItemCard ─── */
export function ReviewItemCard({
  title,
  source,
  type,
  time,
  humanTime,
  urgent = false,
  done = false,
  onToggle,
}: {
  title: string;
  source: string;
  type: string;
  time: string;
  humanTime: string;
  urgent?: boolean;
  done?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className={`bg-bg-page rounded-2xl border border-stroke-outline px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 transition-all dark:bg-[rgba(226,243,255,0.05)] ${done ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-bold text-text-primary ${done ? 'line-through' : ''}`}>
          {title}
        </div>
        <div className="text-[14px] text-text-primary mt-1 flex items-center gap-2 flex-wrap">
          <span>{source}</span>
          <span>·</span>
          <span className="bg-bg-hover px-2 rounded">{type}</span>
          <span>·</span>
          <span>{time}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        <TimePill time={humanTime} />
        <SecondaryButton onClick={onToggle} className="gap-1.5 shrink-0">
          {done ? <><Check size={14} /> Done</> : <><Eye size={14} /> Review</>}
        </SecondaryButton>
      </div>
    </div>
  );
}
