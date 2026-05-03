import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { AtSign, Camera, FileText, FileUp, Image, X } from 'lucide-react';
import { iconGoals, iconDoc16, iconBarChart, iconAdd, iconSend, iconSendActive } from '../assets';
import { ActionChip, Attachment } from '../types';
import { Chip, ToolbarIconButton, Tooltip } from './shared';

const CHIP_ICONS: Record<string, string> = {
  'Create performance goals': iconGoals,
  'Analyze doc(s)': iconDoc16,
  'Visualize data': iconBarChart,
};

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  placeholder?: string;
  quickChips?: string[];
  actionChips?: ActionChip[];
  onChipClick?: (chip: ActionChip) => void;
  isAiResponding?: boolean;
  /** Identifier for the active chat — when this changes, draftValue is re-applied. */
  chatKey?: string;
  /** Value to populate the input with when chatKey changes. */
  draftValue?: string;
  /** Force the send button into its active state even when the input is empty. Click still calls onSend (with empty string if no text). */
  forceSendActive?: boolean;
  /** Open real-time voice mode (OpenAI Realtime API) */
  onVoiceMode?: () => void;
  /** Whether Realtime voice mode is currently active — hides voice buttons, shows send only */
  voiceModeActive?: boolean;
}

/** Exact pixel dimensions from Figma for each toolbar icon within its 24×24 container */
const ICON_DIMS: Record<string, { w: number; h: number; ox?: number; oy?: number }> = {
  Add:        { w: 16,     h: 16 },
  Photo:      { w: 18,     h: 17.45 },
  Camera:     { w: 20.4,   h: 17,   ox: 0.2, oy: -0.5 },
  Upload:     { w: 15.43,  h: 19.64 },
  Microphone: { w: 14.45,  h: 22.91 },
  Voice:      { w: 22.5,   h: 18 },
  Send:       { w: 20.257, h: 24,   ox: 0.13 },
};

function IconImg({ src, alt, noTheme, size = 24 }: { src: string; alt: string; noTheme?: boolean; size?: number }) {
  const dim = ICON_DIMS[alt];
  if (dim) {
    const scale = size / 24;
    const cx = (size / 2) + (dim.ox || 0) * scale;
    const cy = (size / 2) + (dim.oy || 0) * scale;
    return (
      <div className="overflow-clip relative shrink-0" style={{ width: size, height: size }}>
        <div
          className="absolute"
          style={{ width: dim.w * scale, height: dim.h * scale, left: cx, top: cy, transform: 'translate(-50%,-50%)' }}
        >
          <img alt={alt} className={`absolute block max-w-none w-full h-full ${noTheme ? '' : 'icon-theme'}`} src={src} />
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-clip relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <img src={src} alt={alt} className={`block ${noTheme ? '' : 'icon-theme'}`} style={{ maxWidth: size, maxHeight: size }} />
    </div>
  );
}

function VoiceIcon16() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
      <line x1="4" y1="8" x2="4" y2="16" />
      <line x1="8" y1="5" x2="8" y2="19" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="16" y1="5" x2="16" y2="19" />
      <line x1="20" y1="8" x2="20" y2="16" />
    </svg>
  );
}

/** Per-attachment cap (2MB) and per-message cap (10 files). 2MB binary
 *  inflates to ~2.7MB after base64, leaving margin under Vercel's 4.5MB
 *  serverless body limit for PUT /api/chats/[id]. Past MVP, larger
 *  attachments would need Supabase Storage rather than a raised ceiling. */
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

let attachmentIdCounter = 0;
const nextAttachmentId = () => `att-${Date.now()}-${++attachmentIdCounter}`;

export default function ChatInput({ onSend, placeholder = 'Message WorkPal', quickChips, actionChips, onChipClick, isAiResponding, chatKey, draftValue, forceSendActive, onVoiceMode, voiceModeActive }: ChatInputProps) {
  const [value, setValue] = useState(() => draftValue ?? '');
  const [focused, setFocused] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Synchronous in-flight gate. The `isAiResponding` prop comes from App-level
  // state, which React commits asynchronously — so a fast triple-Enter burst
  // would all see prop=false within the same task and fire onSend three times.
  // Setting the ref synchronously inside handleSend blocks duplicates within
  // that same burst; the effect below releases it once the assistant turn
  // finishes (isAiResponding flips back to false).
  const sendingRef = useRef(false);
  useEffect(() => {
    if (!isAiResponding) sendingRef.current = false;
  }, [isAiResponding]);

  // Sync draft value whenever the active chat changes
  const lastChatKeyRef = useRef<string | undefined>(chatKey);
  useEffect(() => {
    if (chatKey === lastChatKeyRef.current) return;
    lastChatKeyRef.current = chatKey;
    setValue(draftValue ?? '');
    setAttachments([]);
    setAttachError(null);
  }, [chatKey, draftValue]);

  // Auto-dismiss the inline attach error after a few seconds
  useEffect(() => {
    if (!attachError) return;
    const t = window.setTimeout(() => setAttachError(null), 4000);
    return () => window.clearTimeout(t);
  }, [attachError]);

  // Auto-resize textarea whenever its value changes (covers both typing and
  // programmatic updates like draft pre-fills, voice transcription, etc.).
  // Also tracks whether the content has wrapped to multiple lines so the
  // wrapper can animate from a pill to a rounded rectangle.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Empty = single-line pill. Skip scrollHeight — on initial mount it can
    // report the 120px max (e.g. when the footer is still being laid out
    // inside a SplitView), leaving the input stuck at that height.
    if (value === '') {
      ta.style.height = 'auto';
      setIsMultiline(false);
      return;
    }
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, 120);
    ta.style.height = next + 'px';
    // Single line is 22px (line-height). Anything taller has wrapped.
    setIsMultiline(ta.scrollHeight > 30);
  }, [value]);

  // Close the attach popup on outside click — and on Escape (WCAG 2.1.2 +
  // WAI-ARIA menu pattern). Esc returns focus to the trigger so keyboard
  // users can re-open the menu without re-tabbing.
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    // Note: `KeyboardEvent` is imported from 'react' at the top, which
    // shadows the DOM `KeyboardEvent`. Letting TS infer the param type
    // from `addEventListener('keydown', ...)` resolves to the DOM type.
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showAttachMenu]);

  const handleSend = () => {
    if (isAiResponding || sendingRef.current) return;
    const trimmed = value.trim();
    const hasAttachments = attachments.length > 0;
    if (!trimmed && !hasAttachments && !forceSendActive) return;
    sendingRef.current = true;
    onSend(trimmed, hasAttachments ? attachments : undefined);
    setValue('');
    setAttachments([]);
    setAttachError(null);
    setIsMultiline(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const remaining = MAX_ATTACHMENTS_PER_MESSAGE - attachments.length;
    if (remaining <= 0) {
      setAttachError(`Up to ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`);
      return;
    }
    const toProcess = files.slice(0, remaining);
    const droppedForLimit = files.length - toProcess.length;
    const oversized: string[] = [];
    const results = await Promise.all(
      toProcess.map(async (f): Promise<Attachment | null> => {
        if (f.size > MAX_ATTACHMENT_BYTES) {
          oversized.push(f.name);
          return null;
        }
        try {
          const dataUrl = await readFileAsDataUrl(f);
          return {
            id: nextAttachmentId(),
            name: f.name || 'file',
            mimeType: f.type || 'application/octet-stream',
            size: f.size,
            kind: f.type.startsWith('image/') ? 'image' : 'file',
            dataUrl,
          };
        } catch {
          return null;
        }
      }),
    );
    const added = results.filter((a): a is Attachment => a !== null);
    if (added.length) {
      setAttachments(prev => [...prev, ...added]);
    }
    const problems: string[] = [];
    if (oversized.length) problems.push(`${oversized.length} file${oversized.length > 1 ? 's' : ''} over ${formatBytes(MAX_ATTACHMENT_BYTES)}`);
    if (droppedForLimit) problems.push(`${droppedForLimit} skipped (limit ${MAX_ATTACHMENTS_PER_MESSAGE})`);
    setAttachError(problems.length ? problems.join(' • ') : null);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addFiles(e.target.files);
    // Reset so picking the same file twice in a row still fires onChange
    e.target.value = '';
  };

  const openPicker = (kind: 'photo' | 'camera' | 'file') => {
    setShowAttachMenu(false);
    const ref =
      kind === 'photo' ? photoInputRef :
      kind === 'camera' ? cameraInputRef :
      fileInputRef;
    ref.current?.click();
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const canSend = value.trim().length > 0 || attachments.length > 0;
  const isActive = focused || canSend;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Hidden file inputs — triggered by the attach menu */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-label="Attach photos"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
        aria-label="Take a photo with camera"
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-label="Attach files"
      />

      {/* Attachment preview strip — above the input when any files are staged */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Pending attachments">
          {attachments.map(att => (
            <div
              key={att.id}
              className="relative group flex items-center gap-2 pr-2 rounded-lg border border-bg-card bg-bg-message overflow-hidden"
            >
              {att.kind === 'image' ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-12 h-12 object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-bg-hover text-text-primary">
                  <FileText size={22} strokeWidth={1.5} />
                </div>
              )}
              <div className="min-w-0 max-w-[160px] pr-1">
                <div className="type-detail text-text-primary truncate">{att.name}</div>
                <div className="type-detail text-text-secondary">{formatBytes(att.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                aria-label={`Remove ${att.name}`}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-bg-page border border-stroke-outline text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachError && (
        <div className="type-caption text-error" role="status">
          {attachError}
        </div>
      )}

      {/* Quick chips — hidden once the user has started composing (typed text,
          added attachments, or opened voice mode). */}
      {quickChips && quickChips.length > 0 && value.length === 0 && attachments.length === 0 && !voiceModeActive && (
        <div className="flex flex-wrap gap-2">
          {quickChips.map(chip => (
            <Chip
              key={chip}
              label={chip}
              onClick={() => onSend(chip)}
              icon={
                CHIP_ICONS[chip] ? (
                  <div className="relative overflow-hidden w-4 h-4 shrink-0 flex items-center justify-center">
                    <img src={CHIP_ICONS[chip]} alt="" className="max-w-full max-h-full object-contain opacity-70 icon-theme" />
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Action chips from last AI message */}
      {actionChips && actionChips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-autohide -mx-4 px-4">
          {actionChips.map(chip => (
            <Chip
              key={chip.action}
              label={chip.label}
              onClick={() => onChipClick?.(chip)}
              className="shrink-0 whitespace-nowrap"
            />
          ))}
        </div>
      )}

      {/* Text field — follows Figma component library states.
          When the textarea content wraps to more than one line, the wrapper
          animates from a pill (rounded-full) into a rounded rectangle. The
          attach `+` button sits inside the wrapper on the left so it
          bottom-aligns with the Send/Voice button on the right when text
          wraps. */}
      <div
        className={`px-3 py-2 flex gap-2 transition-[border-radius,background-color,box-shadow] duration-200 ease-out ${
          isMultiline ? 'items-end' : 'items-center'
        } ${
          isActive
            ? `input-gradient-border ${isMultiline ? 'rounded-lg' : 'rounded-full'}`
            : 'rounded-full input-gradient-hover'
        }`}
        style={
          isActive
            ? {
                border: '2px solid transparent',
                backgroundColor: 'var(--color-input-bg-active)',
                backgroundClip: 'padding-box',
              }
            : { border: '2px solid transparent', background: 'var(--color-bg-message)' }
        }
      >
        {/* Attach `+` button — left, inside input. Menu pops upward via
            bottom-full so the rounded-pill / rounded-lg surface stays clean. */}
        <div ref={attachRef} className="relative shrink-0">
          <Tooltip label="Attach">
            <ToolbarIconButton
              ariaLabel="Attach"
              onClick={() => setShowAttachMenu(v => !v)}
            >
              <IconImg src={iconAdd} alt="Add" size={24} />
            </ToolbarIconButton>
          </Tooltip>
          {showAttachMenu && (
            <div
              role="menu"
              className="panel-border absolute bottom-full left-0 mb-2 min-w-[220px] py-1 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--color-bg-page)',
                boxShadow: 'var(--shadow-popup)',
              }}
            >
              {([
                { Icon: AtSign, label: 'Mention', action: 'mention' },
                { Icon: Image,  label: 'Photo',   action: 'photo'   },
                { Icon: Camera, label: 'Camera',  action: 'camera'  },
                { Icon: FileUp, label: 'Upload File', action: 'file' },
              ] as const).map(({ Icon, label, action }) => (
                <button
                  key={label}
                  role="menuitem"
                  onClick={() => {
                    if (action === 'mention') { setShowAttachMenu(false); return; }
                    openPicker(action);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <Icon size={16} strokeWidth={2} className="shrink-0 text-text-primary" />
                  <span className="type-detail text-text-primary">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          onPaste={e => {
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length > 0) {
              e.preventDefault();
              const dt = new DataTransfer();
              files.forEach(f => dt.items.add(f));
              addFiles(dt.files);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label="Chat message — type a message and press Enter to send"
          rows={1}
          className="flex-1 min-w-0 bg-transparent resize-none outline-none type-h2 text-text-primary placeholder-text-tertiary chat-textarea py-[11px]"
        />
        {/* Mic / Voice / Send — inside input, right-aligned, 24×24 buttons */}
        <div className="flex items-center gap-4 md:gap-2 shrink-0">
          {/* Show Send when focused/typing, Voice icon when idle (not in voice mode).
              forceSendActive also triggers the Send render (e.g. Onboarding's
              "3 selected" state) so the gradient active button shows up even
              though the textarea is empty and unfocused. */}
          {voiceModeActive || focused || canSend || forceSendActive ? (
            (() => {
              const isSendActive = canSend || !!forceSendActive;
              const isClickable = isSendActive && !isAiResponding;
              return (
                <Tooltip label="Send">
                  <button
                    onClick={isClickable ? handleSend : undefined}
                    aria-label="Send message"
                    aria-disabled={!isClickable}
                    className={`flex items-center justify-center shrink-0 rounded-full transition-all ${
                      isClickable
                        ? 'cursor-pointer hover:shadow-[0_2px_15px_rgba(1,44,197,0.3)]'
                        : isSendActive
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-default hover:bg-bg-hover'
                    }`}
                    style={{
                      width: 'var(--input-btn-size)', height: 'var(--input-btn-size)',
                      ...(isSendActive ? { backgroundImage: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)' } : {}),
                    } as React.CSSProperties}
                  >
                    {isSendActive ? (
                      <IconImg src={iconSendActive} alt="" noTheme size={16} />
                    ) : (
                      <IconImg src={iconSend} alt="" size={16} />
                    )}
                  </button>
                </Tooltip>
              );
            })()
          ) : onVoiceMode ? (
            <Tooltip label="Voice mode">
              <button
                onClick={onVoiceMode}
                aria-label="Start voice mode"
                className="flex items-center justify-center shrink-0 cursor-pointer rounded-full hover:bg-bg-hover transition-all text-text-primary"
                style={{ width: 'var(--input-btn-size)', height: 'var(--input-btn-size)' } as React.CSSProperties}
              >
                <VoiceIcon16 />
              </button>
            </Tooltip>
          ) : (
            <Tooltip label="Send">
              <button
                onClick={canSend ? handleSend : undefined}
                aria-label="Send message"
                aria-disabled={!canSend}
                className="flex items-center justify-center shrink-0 rounded-full transition-all cursor-default hover:bg-bg-hover"
                style={{ width: 'var(--input-btn-size)', height: 'var(--input-btn-size)' } as React.CSSProperties}
              >
                <IconImg src={iconSend} alt="" size={16} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

    </div>
  );
}
