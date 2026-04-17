import { useState, useCallback } from 'react';
import { FileText, Download, Play } from 'lucide-react';
import { Message, Attachment, ImageResult, VideoResult, WebResult } from '../types';
import MessageCard from './MessageCard';
import { iconCopy, iconShare, iconThumbsUp, iconRefresh } from '../assets';

/** Extract a clean display host from a URL — strips leading "www." and falls
 *  back to the raw string if parsing fails (e.g. relative URL, bad input). */
function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Source chips rendered under the assistant's synthesized answer — one small
 *  rounded pill per unique domain cited by the web_search tool. Favicon is
 *  pulled from Google's s2 service to avoid the chip failing when the source
 *  site blocks direct /favicon.ico hotlinking. */
function WebSourceChips({ results }: { results: WebResult[] }) {
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const host = hostFromUrl(r.url);
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  }).slice(0, 6);
  if (unique.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {unique.map((r) => {
        const host = hostFromUrl(r.url);
        return (
          <a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            title={r.title || host}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-bg-hover hover:bg-stroke-outline border border-stroke-outline text-[11px] leading-none text-text-secondary hover:text-text-primary transition-colors no-underline max-w-[200px]"
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
              alt=""
              className="w-3.5 h-3.5 rounded-sm shrink-0"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
            />
            <span className="truncate">{host}</span>
          </a>
        );
      })}
    </div>
  );
}

/** Assistant image-search grid. Layout adapts to count:
 *   1 → single wide image (max-w tight so it doesn't dominate)
 *   2 → two equal columns
 *   3+ → 2-column masonry-ish grid, max 6 shown
 *  Style is deliberately restrained: neutral border, soft rounding, subtle
 *  attribution on hover — matches the "clean, professional, not flashy" ask. */
function ImageResultsGrid({ images }: { images: ImageResult[] }) {
  const shown = images.slice(0, 6);
  const cols = shown.length === 1 ? 'grid-cols-1 max-w-[420px]' : 'grid-cols-2 max-w-[520px]';
  return (
    <div className={`mt-2 mb-1 grid gap-2 ${cols}`}>
      {shown.map((img, i) => (
        <a
          key={i}
          href={img.sourceUrl || img.url}
          target="_blank"
          rel="noreferrer"
          className="group/img relative block rounded-lg overflow-hidden border border-stroke-outline bg-bg-hover no-underline"
          title={img.alt}
        >
          <img
            src={img.thumbUrl || img.url}
            alt={img.alt}
            loading="lazy"
            className="block w-full h-full object-cover aspect-[4/3] transition-transform duration-300 group-hover/img:scale-[1.02]"
          />
          {img.attribution && (
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] leading-[14px] text-white opacity-0 group-hover/img:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent truncate">
              {img.attribution}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

/** Human-friendly "N ago" label for a YouTube publishedAt ISO string. */
function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'y'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24 * 7, 'w'],
    [60 * 60 * 24, 'd'],
    [60 * 60, 'h'],
    [60, 'm'],
  ];
  for (const [size, label] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n}${label} ago`;
  }
  return 'just now';
}

/** YouTube video cards rendered under an assistant message. Thumbnail on the
 *  left, title / channel / meta on the right — clicking opens the watch page
 *  in a new tab. Layout is a single vertical column so titles stay readable
 *  even on narrow widths. */
function VideoResultsGrid({ videos }: { videos: VideoResult[] }) {
  const shown = videos.slice(0, 8);
  return (
    <div className="mt-2 mb-1 flex flex-col gap-2 max-w-[560px]">
      {shown.map((v) => (
        <a
          key={v.videoId}
          href={v.url}
          target="_blank"
          rel="noreferrer"
          className="group/vid flex gap-3 rounded-xl overflow-hidden border border-stroke-outline bg-bg-hover hover:bg-bg-hover/70 transition-colors no-underline p-2"
          title={v.title}
        >
          <div className="relative shrink-0 w-[160px] aspect-video rounded-lg overflow-hidden bg-stroke-outline">
            <img
              src={v.thumbnailUrl}
              alt={v.title}
              loading="lazy"
              className="block w-full h-full object-cover transition-transform duration-300 group-hover/vid:scale-[1.03]"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-opacity bg-black/30">
              <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                <Play size={16} className="text-black ml-[2px]" fill="currentColor" />
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
            <div className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
              {v.title}
            </div>
            <div className="mt-1 text-xs text-text-secondary truncate">
              {v.channelTitle}{v.publishedAt ? ` · ${timeAgo(v.publishedAt)}` : ''}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter(a => a.kind === 'image');
  const files = attachments.filter(a => a.kind !== 'image');
  return (
    <div className="flex flex-col gap-2 mb-2">
      {images.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {images.map(att => (
            <a
              key={att.id}
              href={att.dataUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg overflow-hidden border border-stroke-outline"
              title={`${att.name} · ${formatBytes(att.size)}`}
            >
              <img
                src={att.dataUrl}
                alt={att.name}
                className="max-w-[220px] max-h-[220px] object-cover block"
                style={{ minWidth: 80, minHeight: 80 }}
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 items-end">
          {files.map(att => (
            <a
              key={att.id}
              href={att.dataUrl}
              download={att.name}
              className="flex items-center gap-2 pr-3 pl-0 rounded-lg border border-stroke-outline bg-bg-message hover:bg-bg-hover transition-colors max-w-[280px] no-underline"
            >
              <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-bg-hover text-text-secondary rounded-l-lg">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <div className="text-[13px] leading-[16px] text-text-primary truncate">{att.name}</div>
                <div className="text-[11px] leading-[14px] text-text-secondary">{formatBytes(att.size)}</div>
              </div>
              <Download size={14} className="text-text-secondary shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  isLastAssistant?: boolean;
  onCardAction?: (action: string) => void;
}

function renderText(text: string) {
  // Convert **bold** to <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={playing ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-[25px] h-[25px] md:w-5 md:h-5 ${playing ? 'text-[#3171FF]' : 'opacity-40 hover:opacity-70'}`}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" className={playing ? 'speaker-wave-inner' : ''} />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" className={playing ? 'speaker-wave-outer' : ''} />
    </svg>
  );
}

function FeedbackBar({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeak = useCallback(() => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    // Strip markdown bold markers for cleaner TTS
    const clean = text.replace(/\*\*/g, '');
    if (!clean.trim()) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = navigator.language || 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [text, isSpeaking]);

  const actions = [
    { src: iconCopy, label: 'Copy' },
    { src: iconShare, label: 'Share' },
    { src: iconThumbsUp, label: 'Good' },
    { src: iconThumbsUp, label: 'Bad', flip: true },
    { src: iconRefresh, label: 'Retry' },
  ];
  return (
    <div className="flex items-center gap-1.5 md:gap-1 mt-2 text-text-primary">
      {/* TTS play/stop button */}
      <button
        title={isSpeaking ? 'Stop reading' : 'Read aloud'}
        onClick={toggleSpeak}
        className={`w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-lg transition-colors ${isSpeaking ? 'bg-[#3171FF]/10 hover:bg-[#3171FF]/15' : 'hover:bg-bg-hover'}`}
      >
        <SpeakerIcon playing={isSpeaking} />
      </button>
      {actions.map(({ src, label, flip }) => (
        <button
          key={label}
          title={label}
          className="w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors"
        >
          <img
            src={src}
            alt={label}
            className={`w-5 h-5 md:w-4 md:h-4 object-contain opacity-40 hover:opacity-70 icon-theme ${flip ? 'scale-y-[-1]' : ''}`}
          />
        </button>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-3 px-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full loading-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

export default function ChatMessage({ message, isLastAssistant, onCardAction }: ChatMessageProps) {
  if (message.role === 'user') {
    const hasAttachments = !!message.attachments && message.attachments.length > 0;
    const hasText = !!message.content;
    return (
      <div className="flex flex-col items-end mb-4 message-appear">
        {hasAttachments && <MessageAttachments attachments={message.attachments!} />}
        {hasText && (
          <div className="max-w-[320px] bg-bg-message rounded-lg px-4 py-3">
            <p className="text-base text-text-primary leading-[24px]">{message.content}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mb-4 message-appear ${!isLastAssistant ? 'group/msg' : ''}`}>
      {message.isLoading ? (
        <TypingIndicator />
      ) : (
        <>
          {/* Card if any */}
          {message.card && (
            <MessageCard card={message.card} onAction={onCardAction} />
          )}

          {/* Divider between meeting card content and follow-up text */}
          {message.card?.type === 'meeting' && message.content && (
            <div className="border-t border-dashed border-stroke-outline my-4" />
          )}

          {/* Text content */}
          {message.content && (
            <p className="text-base text-text-primary leading-[22px]">
              {renderText(message.content)}
            </p>
          )}

          {/* Source chips from the web_search tool — shown directly under the
              synthesized answer so they read as citations for that text. */}
          {message.webResults && message.webResults.length > 0 && (
            <WebSourceChips results={message.webResults} />
          )}

          {/* Images fetched via search_images tool */}
          {message.imageResults && message.imageResults.length > 0 && (
            <ImageResultsGrid images={message.imageResults} />
          )}

          {/* YouTube videos fetched via search_videos tool */}
          {message.videoResults && message.videoResults.length > 0 && (
            <VideoResultsGrid videos={message.videoResults} />
          )}

          {/* Feedback bar: always visible on last assistant msg, hover-only on others */}
          <div className={isLastAssistant ? '' : 'opacity-0 group-hover/msg:opacity-100 transition-opacity'}>
            <FeedbackBar text={message.content || ''} />
          </div>

          {/* Action chips moved to input area */}
        </>
      )}
    </div>
  );
}
