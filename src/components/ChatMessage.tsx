import { useState, useCallback } from 'react';
import { FileText, Download, Play } from 'lucide-react';
import { Message, Attachment, ImageResult, VideoResult, WebResult, CardData, ArtifactRef } from '../types';
import MessageCard from './MessageCard';
import { AgentRequiredHint, ArtifactCard } from './shared';
import { useIsMobile } from '../lib/useIsMobile';
import { renderMarkdownBlocks } from '../lib/markdown';
import { timeAgo } from '../lib/timeAgo';
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

/** 6.4: end-of-turn marker the agent system prompt teaches.
 *  `[PREVIEW: http://localhost:5173]` → running dev server
 *  `[ARTIFACT: outputs/index.html]`   → single file deliverable
 *  Matches only when the tag is on its own line; trailing whitespace ok. */
const DELIVERABLE_MARKER_RE = /^\s*\[(PREVIEW|ARTIFACT):\s*([^\]]+?)\s*\]\s*$/im;

/** Strip the end-of-turn marker line from displayed chat text. The raw tag
 *  is machine-readable signal, not user-facing copy. */
function stripDeliverableMarker(text: string): string {
  return text.replace(DELIVERABLE_MARKER_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Pick the ONE deliverable to surface as a card for this assistant turn.
 *  Preference order (Cowork-style):
 *    1. [PREVIEW: URL] marker → synthesize a URL-based artifact (opens in
 *       new tab via ArtifactCard's href branch).
 *    2. [ARTIFACT: path] marker → match against the artifacts the agent
 *       actually wrote; use that ArtifactRef so the existing preview panel
 *       / open-file handler fires correctly.
 *    3. Last artifact whose path contains `/outputs/` — the layout
 *       convention we taught the agent.
 *    4. Last artifact overall — weakest fallback, but keeps parity with
 *       the pre-6.4 behavior for turns that pre-date the marker convention. */
function pickPrimaryArtifact(message: Message): ArtifactRef | null {
  const artifacts = message.artifacts || [];
  const text = message.content || '';
  const match = text.match(DELIVERABLE_MARKER_RE);

  if (match) {
    const kind = match[1].toUpperCase();
    const value = match[2].trim();
    if (kind === 'PREVIEW') {
      // URL-mode: the ArtifactCard's `href` branch handles the click
      // (target=_blank, no server round-trip). Name shows host so the card
      // reads naturally ("localhost:5173").
      return {
        name: hostFromUrl(value) || 'Preview',
        fileType: 'Web',
        href: value,
        source: 'claude-code',
      };
    }
    if (kind === 'ARTIFACT') {
      // Match against tracked artifacts by exact path OR by basename (agent
      // may have used a relative path while we stored absolute). Falls
      // through to outputs/last-write below if nothing matches — the
      // marker was wrong but we still want to show something.
      const byPath = artifacts.find(a => a.path === value);
      if (byPath) return byPath;
      const base = value.split('/').pop() || value;
      const byName = artifacts.find(a => a.name === base);
      if (byName) return byName;
    }
  }

  // Directory-convention fallback: the agent followed the outputs/ layout
  // rule but forgot to add the marker. Pick the last such write — if there
  // are multiple, later writes tend to be the user-facing entry point.
  const inOutputs = artifacts.filter(a => a.path && a.path.includes('/outputs/'));
  if (inOutputs.length > 0) return inOutputs[inOutputs.length - 1];

  // Weakest fallback: last artifact overall. Known to mis-fire on project
  // scaffolds (last write is sometimes a config tweak), but the marker +
  // outputs/ path above should catch those cases when the agent behaves.
  if (artifacts.length > 0) return artifacts[artifacts.length - 1];

  return null;
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
    <div className="mt-4 flex flex-wrap gap-1.5">
      {unique.map((r) => {
        const host = hostFromUrl(r.url);
        return (
          <a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            title={r.title || host}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-bg-hover hover:bg-stroke-outline border border-stroke-outline type-footnote text-text-secondary hover:text-text-primary transition-colors no-underline max-w-[200px]"
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
    <div className={`mt-4 grid gap-2 ${cols}`}>
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
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 type-footnote text-white opacity-0 group-hover/img:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent truncate">
              {img.attribution}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

/** YouTube video cards rendered under an assistant message. Thumbnail on the
 *  left, title / channel / meta on the right — clicking opens the watch page
 *  in a new tab. Layout is a single vertical column so titles stay readable
 *  even on narrow widths. */
function VideoResultsGrid({ videos }: { videos: VideoResult[] }) {
  const shown = videos.slice(0, 8);
  return (
    <div className="mt-4 flex flex-col gap-2 max-w-[560px]">
      {shown.map((v) => (
        <a
          key={v.videoId}
          href={v.url}
          target="_blank"
          rel="noreferrer"
          className="group/vid flex gap-3 rounded-xl overflow-hidden border border-stroke-outline bg-bg-hover hover:bg-bg-message transition-colors no-underline p-2"
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
            <div className="type-detail-emphasized text-text-primary line-clamp-2">
              {v.title}
            </div>
            <div className="mt-1 type-detail text-text-secondary truncate">
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
                <div className="type-detail text-text-primary truncate">{att.name}</div>
                <div className="type-detail text-text-secondary">{formatBytes(att.size)}</div>
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
  /** `messageId` is injected by this component (from `message.id`) so callers
   *  like the DetailPanel edit flow can find the source message to write back
   *  to. MessageCard itself only knows about (action, card). */
  onCardAction?: (action: string, card?: CardData, messageId?: string) => void;
  /** Clicked on an inline artifact pill under the assistant message. Caller
   *  decides what to do — for Claude-Code files, POST the open-file endpoint
   *  so the OS opens the file in the default app. */
  onArtifactClick?: (artifact: ArtifactRef) => void;
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={playing ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-[25px] h-[25px] md:w-5 md:h-5 ${playing ? 'text-accent-blue' : 'opacity-40 hover:opacity-70'}`}>
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
  // WCAG 1.1.1 / 3.3.2 — icon-only buttons need an explicit aria-label so
  // screen readers announce the action. `title` keeps the visible browser
  // tooltip on mouse hover, but is unreliable as the sole accessible name.
  return (
    <div className="flex items-center gap-1.5 md:gap-1 mt-4 text-text-primary" role="toolbar" aria-label="Message actions">
      {/* TTS play/stop button */}
      <button
        title={isSpeaking ? 'Stop reading' : 'Read aloud'}
        aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
        aria-pressed={isSpeaking}
        onClick={toggleSpeak}
        className={`w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-lg transition-colors ${isSpeaking ? 'bg-accent-blue-faint hover:bg-accent-blue-faint-hover' : 'hover:bg-bg-hover'}`}
      >
        <SpeakerIcon playing={isSpeaking} />
      </button>
      {actions.map(({ src, label, flip }) => (
        <button
          key={label}
          title={label}
          aria-label={label}
          className="w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors"
        >
          <img
            src={src}
            alt=""
            className={`w-5 h-5 md:w-4 md:h-4 object-contain opacity-40 hover:opacity-70 icon-theme ${flip ? 'scale-y-[-1]' : ''}`}
          />
        </button>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1 py-3 px-1"
      role="status"
      aria-label="AI is responding"
    >
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full loading-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/** Candidate #15 — wraps an ArtifactCard with the mobile guard. Hosted
 *  artifacts (`href` set) are cloud-served and skip the guard entirely
 *  (no agent involved). Path-only artifacts (the Claude-Code Write/Edit
 *  case) get a visually-disabled card on mobile; clicking shows a tip
 *  instead of dispatching to the unreachable agent. 5s auto-dismiss
 *  matches the FolderChip / undo-error pattern. */
function GuardedArtifactCard({
  artifact,
  onArtifactClick,
}: {
  artifact: ArtifactRef;
  onArtifactClick?: (artifact: ArtifactRef) => void;
}) {
  const isMobile = useIsMobile();
  const [showHint, setShowHint] = useState(false);
  const isAgentBound = !artifact.href;
  if (isMobile && isAgentBound) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <div className="opacity-50 cursor-not-allowed">
          <ArtifactCard
            artifact={artifact}
            onClick={() => {
              setShowHint(true);
              window.setTimeout(() => setShowHint(false), 5000);
            }}
          />
        </div>
        {showHint && <AgentRequiredHint variant="tip" />}
      </div>
    );
  }
  return <ArtifactCard artifact={artifact} onClick={onArtifactClick} />;
}

export default function ChatMessage({ message, isLastAssistant, onCardAction, onArtifactClick }: ChatMessageProps) {
  if (message.role === 'user') {
    const hasAttachments = !!message.attachments && message.attachments.length > 0;
    const hasText = !!message.content;
    return (
      <div className="flex flex-col items-end mb-6 message-appear">
        {hasAttachments && <MessageAttachments attachments={message.attachments!} />}
        {hasText && (
          <div className="max-w-[320px] rounded-lg bg-bg-hover px-4 py-3">
            <p className="type-h2 text-text-primary">{message.content}</p>
          </div>
        )}
      </div>
    );
  }

  if (message.agentRequiredHint) {
    // Candidate #15 — assistant-side hint card. handleSend pushes this in
    // place of dispatching to OpenAI when intent routing detects a code/file
    // request on a mobile viewport. Skips bubble chrome / feedback bar /
    // artifact rendering since the hint is the entire message.
    return (
      <div className="mb-6 message-appear">
        <AgentRequiredHint variant="card" />
      </div>
    );
  }

  return (
    <div className={`mb-6 message-appear ${!isLastAssistant ? 'group/msg' : ''}`}>
      {message.isLoading ? (
        <TypingIndicator />
      ) : (
        <>
          {/* Card if any */}
          {message.card && (
            <MessageCard
              card={message.card}
              onAction={(action, card) => onCardAction?.(action, card, message.id)}
            />
          )}

          {/* Divider between meeting card content and follow-up text */}
          {message.card?.type === 'meeting' && message.content && (
            <div className="h-px dashed-border-b my-4" />
          )}

          {/* Text content — markdown-rendered so the AI can format with
              bold / lists / code blocks. Shared renderer with DetailPanel. */}
          {message.content && (() => {
            // 6.4: hide the [PREVIEW: ...] / [ARTIFACT: ...] marker from the
            // displayed text — it's consumed by pickPrimaryArtifact below as
            // a signal for which card to surface, not user copy.
            const displayText = stripDeliverableMarker(message.content);
            return displayText ? (
              <div className="type-h2 text-text-primary">
                {renderMarkdownBlocks(displayText)}
              </div>
            ) : null;
          })()}

          {/* 6.4: one primary artifact card per turn — the deliverable, not
              every scaffold file the agent touched. See pickPrimaryArtifact
              for the selection stack (marker → outputs/ → last-write).
              Scaffolding files still exist on disk and in the Folder chip /
              Changes panel; they just don't spam the chat bubble. */}
          {(() => {
            const primary = pickPrimaryArtifact(message);
            if (!primary) return null;
            return (
              <div className="mt-4 flex flex-col gap-2">
                <GuardedArtifactCard
                  key={`${primary.path ?? primary.href ?? primary.name}`}
                  artifact={primary}
                  onArtifactClick={onArtifactClick}
                />
              </div>
            );
          })()}

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
