import { useRef, useState } from 'react';
import { Download, Volume2, VolumeX, Globe, Loader2, AlertCircle, ArrowUpRight } from 'lucide-react';
import { CardData, MeetingCard, ResearchCard, TicketCard, ScheduleCard, AgentCard, ArtifactCard } from '../types';
import { markArtifactViewed } from '../lib/artifacts';
import { iconAsana, iconDoc20, iconGmail, iconUsers, iconPin, iconClock, iconCalendar } from '../assets';
import type { CardSource } from '../types';

/** App-header meta for cards that come from a specific connector. Keys match
 *  `CardSource` in types.ts. */
const SOURCE_META: Record<CardSource, { icon: string; label: string }> = {
  gmail: { icon: iconGmail, label: 'Gmail' },
  calendar: { icon: iconCalendar, label: 'Google Calendar' },
  doc: { icon: iconDoc20, label: 'Document' },
};
import { PrimaryButton, TertiaryButton, StatusTag as SharedStatusTag, type StatusVariant } from './shared';

interface MessageCardProps {
  card: CardData;
  /** Second arg carries the card so parents can open a detail view for this
   *  specific message (used by Research "view-report" to show real tool data). */
  onAction?: (action: string, card?: CardData) => void;
}

/* ── Shared card shell ── */
function CardShell({ children, className = 'mb-3' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg overflow-hidden w-full max-w-[370px] ${className}`}
      style={{ background: 'var(--color-card-panel-bg)' }}
    >
      {children}
    </div>
  );
}

/* ── Soft divider: 1px line that fades to transparent at both ends ── */
function SoftDivider() {
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-stroke-outline to-transparent" />
  );
}

/* ── Card header ── */
function CardHeader({ icon, title, rightElement, borderBottom = false }: {
  icon: string;
  title: string;
  rightElement?: React.ReactNode;
  borderBottom?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 h-[61px]">
        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
          <img src={icon} alt="" className="w-[18px] h-[18px] object-contain" />
        </div>
        <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">{title}</p>
        {rightElement}
      </div>
      {borderBottom && <SoftDivider />}
    </>
  );
}

/* ── Gradient action button — uses shared PrimaryButton ── */

/* ── Horizontal divider ── */
function Divider() {
  return <div className="border-t border-stroke-outline" />;
}

/* ── Icon row (pin, users, clock) ── */
function InfoRow({ icon, children, textClass = 'text-text-primary' }: {
  icon: string;
  children: React.ReactNode;
  textClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        <img src={icon} alt="" className="w-[18px] h-[18px] object-contain icon-theme" />
      </div>
      <p className={`flex-1 text-base leading-[22px] ${textClass}`}>{children}</p>
    </div>
  );
}

/* ── Inline text with @mention highlighting ── */
function RichText({ text, assignee, due }: { text: string; assignee?: string; due?: string }) {
  return (
    <span className="text-base leading-[22px] text-text-primary">
      {assignee && <span className="text-[#3171ff]">@{assignee}</span>}
      {assignee && ' '}
      {text}
      {due && <> &ndash; <span className="text-[#3171ff]">{due}</span></>}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Card type views
   ═══════════════════════════════════════════════════ */

/* ── Meeting card content renderer — parses the "**heading**\n body" format
 *  into sections. Used by both the bare (demo) and source-branded variants. */
function renderMeetingContent(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.startsWith('**') && line.endsWith('**')) {
      const heading = line.replace(/\*\*/g, '');
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !(lines[i].startsWith('**') && lines[i].endsWith('**'))) {
        bodyLines.push(lines[i]);
        i++;
      }
      const isBulletList = bodyLines.every(l => l.startsWith('•') || l.startsWith('- '));
      elements.push(
        <div key={`section-${elements.length}`} className="mb-4">
          <p className="font-bold text-base leading-[22px] text-text-primary">{heading}</p>
          {isBulletList ? (
            <ul className="list-disc pl-5 mt-0">
              {bodyLines.map((bl, j) => (
                <li key={j} className="text-base leading-[22px] text-text-primary mt-1">
                  {bl.replace(/^(•\s*|-\s*)/, '')}
                </li>
              ))}
            </ul>
          ) : (
            bodyLines.map((bl, j) => (
              <p key={j} className="text-base leading-[22px] text-text-primary">{bl}</p>
            ))
          )}
        </div>
      );
      continue;
    }

    // Inline bold within a plain line (e.g. "- **Subject** — sender ...").
    if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={`line-${i}`} className="text-base leading-[22px] text-text-primary mb-1">
          {parts.map((p, k) => p.startsWith('**') && p.endsWith('**')
            ? <span key={k} className="font-bold">{p.slice(2, -2)}</span>
            : <span key={k}>{p}</span>
          )}
        </p>
      );
      i++;
      continue;
    }

    elements.push(
      <p key={`line-${i}`} className="text-base leading-[22px] text-text-primary mb-1">{line}</p>
    );
    i++;
  }

  return elements;
}

/* ── Meeting card — two variants:
 *     1. source set  → branded shell (e.g. Gmail / Google Calendar header + subject/title + body)
 *     2. source unset → legacy freeform markdown (alcohol-delivery demo, ux-meeting) */
function MeetingCardView({ card }: { card: MeetingCard }) {
  if (card.source) {
    const meta = SOURCE_META[card.source];
    return (
      <CardShell>
        <CardHeader icon={meta.icon} title={meta.label} borderBottom />
        <div className="p-4 flex flex-col gap-2">
          <p className="font-bold text-base leading-[22px] text-text-primary">{card.title}</p>
          <div className="flex flex-col gap-1">
            {renderMeetingContent(card.content)}
          </div>
        </div>
      </CardShell>
    );
  }

  // Legacy freeform rendering — used by demo chats.
  // Parse content into sections: group heading + body lines together
  const lines = card.content.split('\n');
  const elements: React.ReactNode[] = [];

  // Title
  elements.push(
    <p key="title" className="font-bold text-base leading-[22px] text-text-primary mb-4">
      {card.title}
    </p>
  );

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // Bold heading followed by body text
    if (line.startsWith('**') && line.endsWith('**')) {
      const heading = line.replace(/\*\*/g, '');
      const bodyLines: string[] = [];
      i++;
      // Collect body lines until next heading or empty line pair
      while (i < lines.length && lines[i].trim() !== '' && !(lines[i].startsWith('**') && lines[i].endsWith('**'))) {
        bodyLines.push(lines[i]);
        i++;
      }

      // Check if body lines are bullet points
      const isBulletList = bodyLines.every(l => l.startsWith('•'));

      elements.push(
        <div key={`section-${elements.length}`} className="mb-4">
          <p className="font-bold text-base leading-[22px] text-text-primary">
            {heading}
          </p>
          {isBulletList ? (
            <ul className="list-disc pl-5 mt-0">
              {bodyLines.map((bl, j) => (
                <li key={j} className="text-base leading-[22px] text-text-primary mt-1">
                  {bl.slice(2)}
                </li>
              ))}
            </ul>
          ) : (
            bodyLines.map((bl, j) => (
              <p key={j} className="text-base leading-[22px] text-text-primary">
                {bl}
              </p>
            ))
          )}
        </div>
      );
      continue;
    }

    // Regular line
    elements.push(
      <p key={`line-${i}`} className="text-base leading-[22px] text-text-primary mb-4">
        {line}
      </p>
    );
    i++;
  }

  return <div className="w-full">{elements}</div>;
}

/* ── Loading dots component ── */
function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] ml-2">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
}

/* ── Status tag (Sent, Done, Saved, In progress, etc.) ──
 * Maps a free-form status label to the shared StatusTag variant.
 * Compact card headers → no icon.
 */
function variantFromLabel(label: string): StatusVariant {
  const k = label.trim().toLowerCase();
  if (k === 'pending') return 'pending';
  if (k === 'in progress' || k === 'in-progress') return 'in-progress';
  if (k === 'submitted') return 'submitted';
  if (k === 'in review' || k === 'in-review') return 'in-review';
  if (k === 'failed') return 'failed';
  if (k === 'expired') return 'expired';
  // Default: Sent / Done / Saved / Connected → success
  return 'success';
}
function StatusTag({ label }: { label: string }) {
  return <SharedStatusTag variant={variantFromLabel(label)} label={label} showIcon={false} />;
}

/* ── Research / text-only card ── */
function ResearchCardView({ card, onAction }: { card: ResearchCard; onAction?: (a: string, c?: CardData) => void }) {
  // In-progress state: compact card with loading dots and status tag
  if (card.status === 'in-progress' || card.status === 'sent') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 px-4 h-[61px]">
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <img src={iconDoc20} alt="" className="w-[18px] h-[18px] object-contain" />
          </div>
          <div className="flex-1 flex items-center gap-[10px] overflow-hidden">
            <p className="font-bold text-base leading-[22px] text-text-primary whitespace-nowrap">
              {card.title}
            </p>
            {card.status === 'in-progress' && <LoadingDots />}
          </div>
          {card.statusLabel && <StatusTag label={card.statusLabel} />}
        </div>
      </CardShell>
    );
  }

  // Default: full card with content — clickable to open the report detail panel.
  // The header is source-aware: Gmail / Google Calendar / default doc icon.
  const parts = card.summary.split(/(\*\*[^*]+\*\*)/g);
  const meta = card.source ? SOURCE_META[card.source] : null;
  const headerIcon = meta?.icon ?? iconDoc20;
  const headerLabel = meta?.label ?? card.title;
  return (
    <button
      type="button"
      onClick={() => onAction?.('view-report', card)}
      className="inline-block max-w-full mb-3 text-left cursor-pointer transition-shadow hover:shadow-[0_4px_20px_rgba(1,44,197,0.12)] rounded-lg"
    >
      <CardShell className="">
        <CardHeader
          icon={headerIcon}
          title={headerLabel}
          borderBottom
          rightElement={
            <span
              role="button"
              tabIndex={0}
              aria-label="Download report"
              onClick={(e) => { e.stopPropagation(); onAction?.('download-report'); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onAction?.('download-report');
                }
              }}
              className="w-6 h-6 shrink-0 flex items-center justify-center text-text-primary cursor-pointer rounded hover:bg-bg-hover"
            >
              <Download size={18} />
            </span>
          }
        />
        <div className="p-4 flex flex-col gap-2">
          {meta && (
            <p className="font-bold text-base leading-[22px] text-text-primary">{card.title}</p>
          )}
          <p className="text-base leading-[22px] text-text-primary line-clamp-6">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={i} className="font-bold">{part.slice(2, -2)}</span>;
              }
              return <span key={i}>{part}</span>;
            })}
          </p>
        </div>
      </CardShell>
    </button>
  );
}

/* ── Gradient progress bar (animated) ── */
function GradientProgressBar() {
  return (
    <div className="w-full h-[3px] rounded-full overflow-hidden bg-[#E8E8E8]">
      <div
        className="h-full rounded-full animate-progress-bar"
        style={{
          backgroundImage: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)',
        }}
      />
    </div>
  );
}

/* ── Ticket / checklist card ── */
function TicketCardView({ card, onAction }: { card: TicketCard; onAction?: (a: string) => void }) {
  const status = card.status || 'created';

  // In-progress state: compact card with progress bar (full-width, no padding)
  if (status === 'in-progress') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 px-4 h-[61px]">
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <img src={iconAsana} alt="" className="w-[18px] h-[18px] object-contain" />
          </div>
          <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">
            {card.title}
          </p>
        </div>
        <GradientProgressBar />
      </CardShell>
    );
  }

  // Sent state: card with Sent tag, no button, muted body
  if (status === 'sent') {
    const items = card.items ?? [{ text: card.description, assignee: card.assignee, due: card.due }];
    return (
      <CardShell>
        <CardHeader
          icon={iconAsana}
          title={card.title}
          borderBottom
          rightElement={<StatusTag label={card.statusLabel || 'Sent'} />}
        />
        <div className="p-4 flex flex-col gap-4">
          {items.map((item, i) => (
            <div key={i}>
              {i > 0 && <div className="border-t border-stroke-outline mb-4" />}
              <div className="flex items-start">
                <p className="flex-1 text-base leading-[22px] text-text-primary">
                  <RichText text={item.text} assignee={item.assignee} due={item.due} />
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardShell>
    );
  }

  // Default (created): full card with Create button
  const items = card.items ?? [{ text: card.description, assignee: card.assignee, due: card.due }];
  return (
    <CardShell>
      <CardHeader icon={iconAsana} title={card.title} borderBottom />
      <div className="p-4 flex flex-col gap-4">
        {items.map((item, i) => (
          <div key={i}>
            {i > 0 && <div className="border-t border-stroke-outline mb-4" />}
            <div className="flex items-start">
              <p className="flex-1 text-base leading-[22px] text-text-primary">
                <RichText text={item.text} assignee={item.assignee} due={item.due} />
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <PrimaryButton fullWidth className="h-12" onClick={() => onAction?.('confirm-ticket')}>Create</PrimaryButton>
      </div>
    </CardShell>
  );
}

/* ── Schedule / radio-list card ── */
function ScheduleCardView({ card, onAction }: { card: ScheduleCard; onAction?: (a: string) => void }) {
  // Source-branded variant (real tool result): app icon + card title in the
  // header, simple info rows below. No Scheduling radios, no Send button —
  // this is a confirmation/info card, not a meeting proposal.
  if (card.source) {
    const meta = SOURCE_META[card.source];
    return (
      <CardShell>
        <CardHeader icon={meta.icon} title={card.title} borderBottom />
        <div className="p-4 flex flex-col gap-2">
          {card.location && (
            <InfoRow icon={iconPin}>{card.location}</InfoRow>
          )}
          {card.attendees.length > 0 && (
            <InfoRow icon={iconUsers} textClass="text-[#3171ff]">
              {card.attendees.map((a, i) => (
                <span key={i}>{i > 0 ? '  ' : ''}@{a}</span>
              ))}
            </InfoRow>
          )}
          {(card.date || card.time) && (
            <InfoRow icon={iconClock}>
              {[card.date, card.time].filter(Boolean).join(', ')}
            </InfoRow>
          )}
        </div>
      </CardShell>
    );
  }

  // Legacy (demo) variant — full Schedule with radios + Send button.
  const isSent = card.status === 'sent';
  return (
    <CardShell>
      <CardHeader
        icon={iconGmail}
        title={card.title}
        borderBottom
        rightElement={isSent ? <StatusTag label={card.statusLabel || 'Sent'} /> : undefined}
      />
      <div className="p-4 flex flex-col gap-4">
        {/* Meeting info */}
        <div className="flex flex-col gap-2">
          {card.location && (
            <InfoRow icon={iconPin}>{card.location}</InfoRow>
          )}
          <InfoRow icon={iconUsers} textClass="text-[#3171ff]">
            {card.attendees.map((a, i) => {
              const parts = a.split(' ');
              const display = parts.length > 1
                ? `${parts[0]} ${parts.slice(1).map(p => p[0] + '.').join(' ')}`
                : parts[0];
              return <span key={i}>{i > 0 ? '  ' : ''}@{display}</span>;
            })}
          </InfoRow>
          <InfoRow icon={iconClock}>
            {card.date}, {card.time}
          </InfoRow>
        </div>

        {/* Divider */}
        {!isSent && card.timeOptions && card.timeOptions.length > 0 && <Divider />}

        {/* Scheduling section */}
        {!isSent && card.timeOptions && card.timeOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-bold text-base leading-[22px] text-text-primary h-[30px] flex items-center">
              Scheduling
            </p>
            {card.timeOptions.map((opt, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-2 rounded ${
                  opt.selected
                    ? 'bg-[rgba(49,113,255,0.1)]'
                    : 'bg-bg-hover'
                }`}
              >
                <div className="flex-1 flex flex-col leading-[22px] text-text-primary">
                  <span className="text-base">{opt.date}</span>
                  <span className="text-base font-bold">{opt.time}</span>
                </div>
                {/* Radio indicator */}
                <div className="w-11 h-11 flex items-center justify-center shrink-0">
                  {opt.selected ? (
                    <div className="w-5 h-5 rounded-full border-2 border-[#3171ff] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-[#3171ff]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[#c4c4c4]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!isSent && (
        <div className="px-4 pb-4">
          <PrimaryButton fullWidth className="h-12" onClick={() => onAction?.('confirm-schedule')}>Send</PrimaryButton>
        </div>
      )}
    </CardShell>
  );
}

/* ── Agent card (creating / ready / saved) ── */
function AgentCardView({ card, onAction }: { card: AgentCard; onAction?: (a: string) => void }) {
  const status = card.status || 'creating';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  // WorkPal brand logo for card header
  const gradientIcon = (
    <img src="/favicon.svg" alt="WorkPal" className="w-5 h-5 shrink-0" />
  );

  // Creating state: header + progress bar
  if (status === 'creating') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 px-4 h-[61px]">
          {gradientIcon}
          <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">
            {card.title}
          </p>
        </div>
        <GradientProgressBar />
      </CardShell>
    );
  }

  // Ready / Saved states
  return (
    <CardShell>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-[61px]">
        {gradientIcon}
        <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">
          {card.title}
        </p>
        {status === 'saved' && <StatusTag label="Saved" />}
      </div>
      <SoftDivider />
      {/* Body: Video left + blue right with text */}
      <div className="flex flex-col gap-4 p-4">
        <div className="flex rounded-lg overflow-hidden" style={{ height: 160, background: '#1B2943' }}>
          {/* Video — left half */}
          <div className="w-1/2 shrink-0 relative">
            <video
              ref={videoRef}
              src="/animations/agent-intro.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Sound toggle */}
            <button
              onClick={toggleMute}
              className="absolute bottom-2.5 left-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX size={14} className="text-white" /> : <Volume2 size={14} className="text-white" />}
            </button>
          </div>
          {/* Intro text — right half */}
          <div className="w-1/2 flex items-center p-4">
            <p
              className="text-white"
              style={{
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontSize: 14,
                lineHeight: '22px',
              }}
            >
              {card.agentIntro}
            </p>
          </div>
        </div>

        {/* Set as my agent + go back — only in 'ready' state */}
        {status === 'ready' && (
          <div className="flex flex-col gap-2">
            <PrimaryButton fullWidth className="h-12" onClick={() => onAction?.('set-agent')}>Set as my agent</PrimaryButton>
            <TertiaryButton fullWidth className="h-12" onClick={() => onAction?.('change-selections')}>← Change my selections</TertiaryButton>
          </div>
        )}
      </div>
    </CardShell>
  );
}

/* ═══════════════════════════════════════════════════
   Artifact card — candidate #3
   Shown after an artifact-intent send. Three states:
   - generating: cover skeleton + spinner + "Generating..."
   - ready: cover image + title + "N items" + "Open" → /artifact/<slug>
   - failed: error row + short reason
   ═══════════════════════════════════════════════════ */
function ArtifactCardView({ card }: { card: ArtifactCard }) {
  const handleOpen = () => {
    if (!card.url || !card.slug) return;
    markArtifactViewed(card.slug);
    window.open(card.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <CardShell>
      {/* Cover area — fixed aspect so generating skeleton and ready image share the same footprint */}
      <div className="relative w-full aspect-[16/9] bg-bg-hover flex items-center justify-center overflow-hidden">
        {card.status === 'ready' && card.coverImageUrl ? (
          <img
            src={card.coverImageUrl}
            alt=""
            className="w-full h-full object-cover"
            // Tavily returns third-party image URLs — if hot-link blocks us,
            // fall back to the placeholder glyph rather than a broken-image icon.
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <Globe className="w-10 h-10 text-text-primary/30" />
        )}
        {card.status === 'generating' && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-hover/60">
            <Loader2 className="w-6 h-6 animate-spin text-text-primary/60" />
          </div>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {card.status === 'generating' && (
          <>
            <p className="font-bold text-base leading-[22px] text-text-primary truncate">
              {card.title || 'Generating artifact…'}
            </p>
            <p className="text-sm text-text-primary/60">
              正在生成 · Generating… Tavily + OpenAI · ~15-30s
            </p>
          </>
        )}

        {card.status === 'ready' && (
          <>
            <p className="font-bold text-base leading-[22px] text-text-primary line-clamp-2">
              {card.title}
            </p>
            {typeof card.itemCount === 'number' && card.itemCount > 0 && (
              <p className="text-sm text-text-primary/60">
                {card.itemCount} items · {card.templateId === 'bay-area-weekend' ? 'this weekend' : card.templateId}
              </p>
            )}
            <PrimaryButton fullWidth className="h-11" onClick={handleOpen}>
              <span className="inline-flex items-center gap-1.5">
                Open <ArrowUpRight className="w-4 h-4" />
              </span>
            </PrimaryButton>
          </>
        )}

        {card.status === 'failed' && (
          <>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="font-bold text-base leading-[22px] text-text-primary">
                  Couldn’t generate
                </p>
                <p className="text-sm text-text-primary/60 break-words">
                  {card.error || 'Unknown error — try again in a moment.'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}

/* ═══════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════ */
export default function MessageCard({ card, onAction }: MessageCardProps) {
  if (card.type === 'meeting') return <MeetingCardView card={card as MeetingCard} />;
  if (card.type === 'research') return <ResearchCardView card={card as ResearchCard} onAction={onAction} />;
  if (card.type === 'ticket') return <TicketCardView card={card as TicketCard} onAction={onAction} />;
  if (card.type === 'schedule') return <ScheduleCardView card={card as ScheduleCard} onAction={onAction} />;
  if (card.type === 'agent') return <AgentCardView card={card as AgentCard} onAction={onAction} />;
  if (card.type === 'artifact') return <ArtifactCardView card={card as ArtifactCard} />;
  return null;
}
