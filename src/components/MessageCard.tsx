import { CardData, MeetingCard, ResearchCard, TicketCard, ScheduleCard } from '../types';
import { iconAsana, iconDoc20, iconGmail, iconUsers, iconPin, iconClock } from '../assets';

interface MessageCardProps {
  card: CardData;
  onAction?: (action: string) => void;
}

/* ── Shared card shell ── */
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-stroke-outline rounded-lg overflow-hidden mb-3 w-full max-w-[370px]" style={{ background: 'var(--color-bg-page)' }}>
      {children}
    </div>
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
    <div className={`flex items-center gap-2 px-4 h-[61px] ${borderBottom ? 'border-b border-stroke-outline' : ''}`}>
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        <img src={icon} alt="" className="w-[18px] h-[18px] object-contain icon-theme" />
      </div>
      <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">{title}</p>
      {rightElement}
    </div>
  );
}

/* ── Gradient action button (Create / Send) ── */
function GradientButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 h-12 px-4 rounded text-white font-bold text-base leading-[22px] transition-opacity hover:opacity-90 cursor-pointer"
      style={{
        backgroundImage: 'linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%)',
        boxShadow: '0 5px 15px rgba(1, 44, 197, 0.2)',
      }}
    >
      {/* Calendar icon */}
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        <svg width="12" height="6" viewBox="0 0 12 6" fill="none">
          <path d="M1 1L6 5L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="flex-1 text-left">{label}</span>
      {/* Chevron down */}
      <div className="w-11 h-11 flex items-center justify-center rounded-full shrink-0">
        <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
          <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

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

/* ── Meeting card (content with markdown) ── */
function MeetingCardView({ card }: { card: MeetingCard }) {
  const lines = card.content.split('\n');
  return (
    <CardShell>
      <CardHeader icon={iconAsana} title={card.title} borderBottom />
      <div className="p-4 space-y-3">
        {lines.map((line, i) => {
          if (line.trim() === '---') {
            return <div key={i} className="border-t border-stroke-outline my-1" />;
          }
          if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <p key={i} className="font-bold text-base leading-[22px] text-text-primary">
                {line.replace(/\*\*/g, '')}
              </p>
            );
          }
          if (line.startsWith('•')) {
            return (
              <div key={i} className="flex gap-2">
                <span className="text-text-primary text-base mt-0.5">•</span>
                <p className="text-base leading-[22px] text-text-primary">{line.slice(2)}</p>
              </div>
            );
          }
          if (line.trim() === '') return null;
          return <p key={i} className="text-base leading-[22px] text-text-primary">{line}</p>;
        })}
      </div>
    </CardShell>
  );
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

/* ── Status tag (Sent, Done, etc.) ── */
function StatusTag({ label }: { label: string }) {
  return (
    <span
      className="text-sm font-semibold leading-[22px] tracking-[-0.3px] whitespace-nowrap px-[10px] py-1 rounded shrink-0"
      style={{ background: 'rgba(2, 137, 1, 0.1)', color: '#028901' }}
    >
      {label}
    </span>
  );
}

/* ── Research / text-only card ── */
function ResearchCardView({ card }: { card: ResearchCard }) {
  // In-progress state: compact card with loading dots and status tag
  if (card.status === 'in-progress' || card.status === 'sent') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 px-4 h-[61px]">
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <img src={iconDoc20} alt="" className="w-[18px] h-[18px] object-contain icon-theme" />
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

  // Default: full card with content
  const parts = card.summary.split(/(\*\*[^*]+\*\*)/g);
  return (
    <CardShell>
      <CardHeader icon={iconDoc20} title={card.title} borderBottom />
      <div className="p-4">
        <p className="text-base leading-[22px] text-text-primary">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <span key={i} className="font-bold">{part.slice(2, -2)}</span>;
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      </div>
    </CardShell>
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

  // In-progress state: compact card with progress bar
  if (status === 'in-progress') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 px-4 h-[61px]">
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <img src={iconAsana} alt="" className="w-[18px] h-[18px] object-contain icon-theme" />
          </div>
          <p className="font-bold text-base leading-[22px] text-text-primary flex-1 truncate">
            {card.title}
          </p>
        </div>
        <div className="px-4 pb-4">
          <GradientProgressBar />
        </div>
      </CardShell>
    );
  }

  // Sent state: card with Sent tag, no button
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
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 mt-[3px] shrink-0 border border-[#757575] rounded" style={{ background: 'var(--color-bg-page)' }} />
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
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <div className="w-4 h-4 mt-[3px] shrink-0 border border-[#757575] rounded" style={{ background: 'var(--color-bg-page)' }} />
              <p className="flex-1 text-base leading-[22px] text-text-primary">
                <RichText text={item.text} assignee={item.assignee} due={item.due} />
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <GradientButton label="Create" onClick={() => onAction?.('confirm-ticket')} />
      </div>
    </CardShell>
  );
}

/* ── Schedule / radio-list card ── */
function ScheduleCardView({ card, onAction }: { card: ScheduleCard; onAction?: (a: string) => void }) {
  return (
    <CardShell>
      <CardHeader icon={iconGmail} title={card.title} borderBottom />
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
        {card.timeOptions && card.timeOptions.length > 0 && <Divider />}

        {/* Scheduling section */}
        {card.timeOptions && card.timeOptions.length > 0 && (
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
      <div className="px-4 pb-4">
        <GradientButton label="Send" onClick={() => onAction?.('confirm-schedule')} />
      </div>
    </CardShell>
  );
}

/* ═══════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════ */
export default function MessageCard({ card, onAction }: MessageCardProps) {
  if (card.type === 'meeting') return <MeetingCardView card={card as MeetingCard} />;
  if (card.type === 'research') return <ResearchCardView card={card as ResearchCard} />;
  if (card.type === 'ticket') return <TicketCardView card={card as TicketCard} onAction={onAction} />;
  if (card.type === 'schedule') return <ScheduleCardView card={card as ScheduleCard} onAction={onAction} />;
  return null;
}
