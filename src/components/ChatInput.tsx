import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { FileText, X } from 'lucide-react';
import { iconGoals, iconDoc16, iconBarChart, iconAdd, iconPhoto, iconCamera, iconUpload, iconSend, iconSendActive } from '../assets';
import { ActionChip, Attachment } from '../types';
import { ToolbarIconButton, Tooltip } from './shared';

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

/** Per-attachment cap (8MB) and per-message cap (10 files). Keeps localStorage
 *  and in-memory data URLs manageable for a frontend-only prototype. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
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

export default function ChatInput({ onSend, placeholder = 'Message WorkPal', quickChips, actionChips, onChipClick, chatKey, draftValue, forceSendActive, onVoiceMode, voiceModeActive }: ChatInputProps) {
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

  // Close the attach popup on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAttachMenu]);

  const handleSend = () => {
    const trimmed = value.trim();
    const hasAttachments = attachments.length > 0;
    if (!trimmed && !hasAttachments && !forceSendActive) return;
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
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Attachment preview strip — above the input when any files are staged */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Pending attachments">
          {attachments.map(att => (
            <div
              key={att.id}
              className="relative group flex items-center gap-2 pr-2 rounded-lg border border-stroke-outline bg-bg-message overflow-hidden"
            >
              {att.kind === 'image' ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-12 h-12 object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-bg-hover text-text-secondary">
                  <FileText size={22} />
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
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-bg-page/90 border border-stroke-outline text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachError && (
        <div className="text-[12px] leading-[16px] text-[#B42318]" role="status">
          {attachError}
        </div>
      )}

      {/* Quick chips — hidden once the user has started composing (typed text,
          added attachments, or opened voice mode). */}
      {quickChips && quickChips.length > 0 && value.length === 0 && attachments.length === 0 && !voiceModeActive && (
        <div className="flex flex-wrap gap-2">
          {quickChips.map(chip => (
            <button
              key={chip}
              onClick={() => onSend(chip)}
              className="chip-gradient-hover flex items-center gap-1 px-3 py-1 rounded-full border border-stroke-outline type-h2 text-text-primary transition-colors cursor-pointer"
            >
              {CHIP_ICONS[chip] && (
                <div className="relative overflow-hidden w-4 h-4 shrink-0 flex items-center justify-center">
                  <img src={CHIP_ICONS[chip]} alt="" className="max-w-full max-h-full object-contain opacity-70 icon-theme" />
                </div>
              )}
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Action chips from last AI message */}
      {actionChips && actionChips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-autohide -mx-4 px-4">
          {actionChips.map(chip => (
            <button
              key={chip.action}
              onClick={() => onChipClick?.(chip)}
              className="chip-gradient-hover shrink-0 px-3 py-1 rounded-full border border-stroke-outline type-h2 text-text-primary transition-colors cursor-pointer whitespace-nowrap"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Text field — follows Figma component library states.
          When the textarea content wraps to more than one line, the wrapper
          animates from a pill (rounded-full) into a rounded rectangle. */}
      <div
        className={`px-4 py-2 flex items-center transition-[border-radius,background-color,box-shadow] duration-200 ease-out ${
          isActive
            ? `input-gradient-border ${isMultiline ? 'rounded-lg' : 'rounded-full'}`
            : 'rounded-full input-gradient-hover'
        }`}
        style={
          isActive
            ? {
                border: '2px solid transparent',
                backgroundColor: 'var(--color-input-bg)',
                backgroundClip: 'padding-box',
              }
            : { border: '2px solid transparent', background: 'var(--color-bg-message)' }
        }
      >
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
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-text-primary placeholder-text-tertiary chat-textarea py-[11px]"
          style={{
            fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            fontSize: 16,
            lineHeight: '22px',
            letterSpacing: '0px',
          }}
        />
        {/* Mic / Voice / Send — inside input, right-aligned, 24×24 buttons */}
        <div className="flex items-center gap-4 md:gap-2 shrink-0 ml-2">
          {/* Show Send when focused/typing, Voice icon when idle (not in voice mode).
              forceSendActive also triggers the Send render (e.g. Onboarding's
              "3 selected" state) so the gradient active button shows up even
              though the textarea is empty and unfocused. */}
          {voiceModeActive || focused || canSend || forceSendActive ? (
            (() => {
              const isSendActive = canSend || !!forceSendActive;
              return (
                <Tooltip label="Send">
                  <button
                    onClick={isSendActive ? handleSend : undefined}
                    className={`flex items-center justify-center shrink-0 rounded-full transition-all ${isSendActive ? 'cursor-pointer hover:shadow-[0_2px_15px_rgba(1,44,197,0.3)]' : 'cursor-default hover:bg-bg-hover'}`}
                    style={{
                      width: 'var(--input-btn-size)', height: 'var(--input-btn-size)',
                      ...(isSendActive ? { backgroundImage: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)' } : {}),
                    } as React.CSSProperties}
                  >
                    {isSendActive ? (
                      <IconImg src={iconSendActive} alt="Send" noTheme size={16} />
                    ) : (
                      <IconImg src={iconSend} alt="Send" size={16} />
                    )}
                  </button>
                </Tooltip>
              );
            })()
          ) : onVoiceMode ? (
            <Tooltip label="Voice mode">
              <button
                onClick={onVoiceMode}
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
                className="flex items-center justify-center shrink-0 rounded-full transition-all cursor-default hover:bg-bg-hover"
                style={{ width: 'var(--input-btn-size)', height: 'var(--input-btn-size)' } as React.CSSProperties}
              >
                <IconImg src={iconSend} alt="Send" size={16} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Toolbar — single attach button. The mode selector + folder / branch /
          worktree pickers used to live here; they were removed so that chat is
          the only input surface and the AI decides when to escalate to a full
          task (see App.tsx → inspector panel auto-opens on the first tool
          call). */}
      <div className="flex items-center relative">
        <div className="flex items-center gap-3 md:gap-2 flex-wrap min-w-0">
          <div ref={attachRef} className="relative">
            <Tooltip label="Attach">
              <ToolbarIconButton
                ariaLabel="Attach"
                onClick={() => setShowAttachMenu(v => !v)}
              >
                <span className="toolbar-icon-scale"><IconImg src={iconAdd} alt="Add" size={16} /></span>
              </ToolbarIconButton>
            </Tooltip>
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-3 md:mb-2 w-72 md:w-48 bg-bg-page border border-stroke-outline rounded-2xl md:rounded-xl shadow-lg py-3 md:py-2 z-50">
                {([
                  { icon: null, label: 'Mention', isMention: true, action: 'mention' },
                  { icon: iconPhoto, label: 'Photo', isMention: false, action: 'photo' },
                  { icon: iconCamera, label: 'Camera', isMention: false, action: 'camera' },
                  { icon: iconUpload, label: 'Upload File', isMention: false, action: 'file' },
                ] as const).map(item => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.action === 'mention') { setShowAttachMenu(false); return; }
                      openPicker(item.action);
                    }}
                    className="w-full flex items-center gap-[18px] md:gap-3 px-6 md:px-4 py-[15px] md:py-2.5 hover:bg-bg-hover transition-colors type-detail text-text-primary cursor-pointer"
                  >
                    {item.isMention ? (
                      <div className="flex items-center justify-center shrink-0 w-6 h-6 md:w-4 md:h-4">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-text-primary">
                          <circle cx="12" cy="12" r="4" />
                          <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 md:w-4 md:h-4 flex items-center justify-center shrink-0">
                        <img src={item.icon!} alt={item.label} className="w-full h-full icon-theme" />
                      </div>
                    )}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
