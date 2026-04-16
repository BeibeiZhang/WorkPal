import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { FileText, X } from 'lucide-react';
import { iconGoals, iconDoc16, iconBarChart, iconAdd, iconPhoto, iconCamera, iconUpload, iconSend, iconSendActive, iconChevronDown } from '../assets';
import { ActionChip, Attachment } from '../types';
import { ToolbarPill, ToolbarIconButton, ToolbarSegmented, Tooltip } from './shared';

type InputMode = 'Chat' | 'Tasks' | 'Code';

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
  onModeChange?: (mode: 'Chat' | 'Tasks' | 'Code') => void;
  chatOnly?: boolean;
  isAiResponding?: boolean;
  /** Identifier for the active chat — when this changes, draftValue/forceMode are re-applied. */
  chatKey?: string;
  /** Value to populate the input with when chatKey changes. */
  draftValue?: string;
  /** Mode to force when chatKey changes. */
  forceMode?: InputMode;
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

/** 16×16 inline SVG icons for mode selector */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
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

const MODE_ICONS: Record<InputMode, () => JSX.Element> = {
  Chat: ChatIcon,
  Tasks: TasksIcon,
  Code: CodeIcon,
};

/** Simulated folder options */
const FOLDER_OPTIONS = [
  '~/Projects/WorkPal',
  '~/Documents',
  '~/Desktop',
  '~/Downloads',
];

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

/** Simulated branch options */
const BRANCH_OPTIONS = ['main', 'develop', 'feature/chat-input', 'fix/ui-polish'];

export default function ChatInput({ onSend, placeholder = 'Message WorkPal', quickChips, actionChips, onChipClick, onModeChange, chatOnly, chatKey, draftValue, forceMode, forceSendActive, onVoiceMode, voiceModeActive }: ChatInputProps) {
  const [value, setValue] = useState(() => draftValue ?? '');
  const [focused, setFocused] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [mode, setMode] = useState<InputMode>(() => forceMode ?? 'Chat');
  const [folder, setFolder] = useState(FOLDER_OPTIONS[0]);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [branch, setBranch] = useState(BRANCH_OPTIONS[0]);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [useWorktree, setUseWorktree] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft value + forced mode whenever the active chat changes
  const lastChatKeyRef = useRef<string | undefined>(chatKey);
  useEffect(() => {
    if (chatKey === lastChatKeyRef.current) return;
    lastChatKeyRef.current = chatKey;
    setValue(draftValue ?? '');
    setAttachments([]);
    setAttachError(null);
    if (forceMode && forceMode !== mode) {
      setMode(forceMode);
      onModeChange?.(forceMode);
    }
  }, [chatKey, draftValue, forceMode, mode, onModeChange]);

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
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, 120);
    ta.style.height = next + 'px';
    // Single line is 22px (line-height). Anything taller has wrapped.
    setIsMultiline(ta.scrollHeight > 30);
  }, [value]);

  // Close popups on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showAttachMenu && attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
      if (showFolderMenu && folderRef.current && !folderRef.current.contains(e.target as Node)) {
        setShowFolderMenu(false);
      }
      if (showBranchMenu && branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setShowBranchMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAttachMenu, showFolderMenu, showBranchMenu]);

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

  const closeAllMenus = () => {
    setShowAttachMenu(false);
    setShowFolderMenu(false);
    setShowBranchMenu(false);
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
                <div className="text-[13px] leading-[16px] text-text-primary truncate">{att.name}</div>
                <div className="text-[11px] leading-[14px] text-text-secondary">{formatBytes(att.size)}</div>
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
              className="chip-gradient-hover flex items-center gap-1 px-3 py-1 rounded-full border border-stroke-outline text-base leading-[22px] text-text-primary transition-colors cursor-pointer"
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
              className="chip-gradient-hover shrink-0 px-3 py-1 rounded-full border border-stroke-outline text-base leading-[22px] text-text-primary transition-colors cursor-pointer whitespace-nowrap"
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
          {/* Show Send when focused/typing, Voice icon when idle (not in voice mode) */}
          {voiceModeActive || focused || canSend ? (
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

      {/* Toolbar — separate row */}
      <div className="flex items-center relative">
        {/* Left tools — + button, Mode selector, mode-specific options */}
        <div className="flex items-center gap-3 md:gap-2 flex-wrap min-w-0">
          {/* + Attach button with border and popup */}
          <div ref={attachRef} className="relative">
            <Tooltip label="Attach">
              <ToolbarIconButton
                ariaLabel="Attach"
                onClick={() => { setShowAttachMenu(v => !v); setShowFolderMenu(false); setShowBranchMenu(false); }}
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
                    className="w-full flex items-center gap-[18px] md:gap-3 px-6 md:px-4 py-[15px] md:py-2.5 hover:bg-bg-hover transition-colors text-text-primary text-[21px] md:text-sm cursor-pointer"
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

          {/* Mode selector — segmented pill, selected segment is blue */}
          <ToolbarSegmented<InputMode>
            value={mode}
            onChange={m => { setMode(m); onModeChange?.(m); closeAllMenus(); }}
            segments={(['Chat', 'Tasks', 'Code'] as InputMode[]).map(m => {
              const Icon = MODE_ICONS[m];
              const isDisabled = !!chatOnly && m !== 'Chat';
              return {
                value: m,
                icon: <Icon />,
                label: m,
                disabled: isDisabled,
                disabledTooltip: isDisabled ? `${m} (not available)` : undefined,
              };
            })}
          />

          {/* Mode-specific options */}
          {(mode === 'Tasks' || mode === 'Code') && (
            <div ref={folderRef} className="relative">
              <ToolbarPill
                onClick={() => { setShowFolderMenu(v => !v); setShowBranchMenu(false); setShowAttachMenu(false); }}
                className="max-w-[270px] md:max-w-[180px]"
                leading={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                }
                trailing={<img src={iconChevronDown} alt="" className="w-[18px] h-[18px] md:w-3 md:h-3 icon-theme shrink-0" />}
              >
                {folder}
              </ToolbarPill>
              {showFolderMenu && (
                <div className="absolute bottom-full left-0 mb-3 md:mb-2 w-[336px] md:w-56 bg-bg-page border border-stroke-outline rounded-2xl md:rounded-xl shadow-lg py-3 md:py-2 z-50">
                  {FOLDER_OPTIONS.map(f => (
                    <button
                      key={f}
                      onClick={() => { setFolder(f); setShowFolderMenu(false); }}
                      className={`w-full flex items-center justify-between px-6 md:px-4 py-3 md:py-2 text-[18px] md:text-xs transition-colors cursor-pointer ${
                        folder === f ? 'text-text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      <span className="truncate">{f}</span>
                      {folder === f && <span className="gradient-text font-semibold text-[18px] md:text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'Code' && (
            <>
              {/* Branch selector */}
              <div ref={branchRef} className="relative">
                <ToolbarPill
                  onClick={() => { setShowBranchMenu(v => !v); setShowFolderMenu(false); setShowAttachMenu(false); }}
                  className="max-w-[240px] md:max-w-[160px]"
                  leading={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  }
                  trailing={<img src={iconChevronDown} alt="" className="w-[18px] h-[18px] md:w-3 md:h-3 icon-theme shrink-0" />}
                >
                  {branch}
                </ToolbarPill>
                {showBranchMenu && (
                  <div className="absolute bottom-full left-0 mb-3 md:mb-2 w-[312px] md:w-52 bg-bg-page border border-stroke-outline rounded-2xl md:rounded-xl shadow-lg py-3 md:py-2 z-50">
                    {BRANCH_OPTIONS.map(b => (
                      <button
                        key={b}
                        onClick={() => { setBranch(b); setShowBranchMenu(false); }}
                        className={`w-full flex items-center justify-between px-6 md:px-4 py-3 md:py-2 text-[18px] md:text-xs transition-colors cursor-pointer ${
                          branch === b ? 'text-text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        <span className="truncate">{b}</span>
                        {branch === b && <span className="gradient-text font-semibold text-[18px] md:text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Worktree checkbox */}
              <ToolbarPill
                as="label"
                leading={
                  <input
                    type="checkbox"
                    checked={useWorktree}
                    onChange={e => setUseWorktree(e.target.checked)}
                    className="worktree-checkbox w-[21px] h-[21px] md:w-3.5 md:h-3.5 rounded cursor-pointer"
                  />
                }
              >
                Worktree
              </ToolbarPill>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
