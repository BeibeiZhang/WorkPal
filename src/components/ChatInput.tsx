import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { iconGoals, iconDoc16, iconBarChart, iconAdd, iconPhoto, iconCamera, iconUpload, iconSend, iconSendActive, iconChevronDown } from '../assets';
import { ActionChip } from '../types';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};
const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

type InputMode = 'Chat' | 'Tasks' | 'Code';

/** Dark tooltip on hover — black bg, white text */
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-[#1a1a1a] text-white text-[11px] leading-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </div>
    </div>
  );
}

const CHIP_ICONS: Record<string, string> = {
  'Create performance goals': iconGoals,
  'Analyze doc(s)': iconDoc16,
  'Visualize data': iconBarChart,
};

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  quickChips?: string[];
  actionChips?: ActionChip[];
  onChipClick?: (chip: ActionChip) => void;
  onModeChange?: (mode: 'Chat' | 'Tasks' | 'Code') => void;
  chatOnly?: boolean;
  isAiResponding?: boolean;
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

/** 16×16 inline SVG icons for mic / voice in input field */
function MicIcon16() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
      <rect x="9" y="1" width="6" height="11" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon16() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="shrink-0 w-[24px] h-[24px] md:w-[16px] md:h-[16px]">
      <rect x="6" y="6" width="12" height="12" rx="2" />
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

/** Simulated branch options */
const BRANCH_OPTIONS = ['main', 'develop', 'feature/chat-input', 'fix/ui-polish'];

export default function ChatInput({ onSend, placeholder = 'Message WorkPal', quickChips, actionChips, onChipClick, onModeChange, chatOnly, isAiResponding }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [mode, setMode] = useState<InputMode>('Chat');
  const [folder, setFolder] = useState(FOLDER_OPTIONS[0]);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [branch, setBranch] = useState(BRANCH_OPTIONS[0]);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [useWorktree, setUseWorktree] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceModeRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  // Simulated voice phrases for demo fallback when mic permission is denied
  const DEMO_PHRASES = [
    'Can you summarize yesterday\'s meeting about alcohol delivery?',
    'Set up a UX review meeting for the team.',
    'Find any reports about Spark drivers experiencing issues.',
    'Create performance goals for Q2.',
  ];
  const demoIndexRef = useRef(0);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulate typing out a phrase character by character
  const simulateVoiceInput = useCallback((phrase: string, onDone: () => void) => {
    let i = 0;
    const typeNext = () => {
      if (i <= phrase.length) {
        setValue(phrase.slice(0, i));
        i++;
        simTimerRef.current = setTimeout(typeNext, 40 + Math.random() * 30);
      } else {
        onDone();
      }
    };
    typeNext();
  }, []);

  const clearSimTimer = useCallback(() => {
    if (simTimerRef.current) { clearTimeout(simTimerRef.current); simTimerRef.current = null; }
  }, []);

  // Try real speech recognition; fall back to simulation on permission error
  const tryStartRecognition = useCallback((opts: {
    continuous: boolean;
    onResult: (text: string) => void;
    onEnd: (finalText: string) => void;
    onError: (error: string) => void;
  }): { stop: () => void; isSimulated: boolean } => {
    if (!SpeechRecognitionCtor) {
      // No API — simulate
      const phrase = DEMO_PHRASES[demoIndexRef.current % DEMO_PHRASES.length];
      demoIndexRef.current++;
      simulateVoiceInput(phrase, () => opts.onEnd(phrase));
      return { stop: () => { clearSimTimer(); opts.onEnd(''); }, isSimulated: true };
    }

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
    recognition.continuous = opts.continuous;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    let finalTranscript = '';
    let fell_back = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      opts.onResult(finalTranscript + interim);
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Permission denied — fall back to simulation
        fell_back = true;
        const phrase = DEMO_PHRASES[demoIndexRef.current % DEMO_PHRASES.length];
        demoIndexRef.current++;
        simulateVoiceInput(phrase, () => opts.onEnd(phrase));
        return;
      }
      opts.onError(e.error);
    };
    recognition.onend = () => {
      if (!fell_back) opts.onEnd(finalTranscript);
    };

    try { recognition.start(); } catch { /* already started */ }

    return {
      stop: () => { try { recognition.stop(); } catch { /* */ } clearSimTimer(); },
      isSimulated: false,
    };
  }, [simulateVoiceInput, clearSimTimer]);

  // --- Mic button: click to start, click to stop & send ---
  const activeRecRef = useRef<{ stop: () => void } | null>(null);
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      activeRecRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setIsRecording(true);
    const handle = tryStartRecognition({
      continuous: true,
      onResult: (text) => setValue(text),
      onEnd: (finalText) => {
        setIsRecording(false);
        if (finalText.trim()) {
          onSend(finalText.trim());
          setValue('');
        }
      },
      onError: () => setIsRecording(false),
    });
    activeRecRef.current = handle;
  }, [isRecording, onSend, tryStartRecognition]);

  // --- Voice conversation mode ---
  const activeVoiceRecRef = useRef<{ stop: () => void } | null>(null);

  const startVoiceListening = useCallback(() => {
    if (!voiceModeRef.current) return;
    setVoiceListening(true);
    setValue('');
    const handle = tryStartRecognition({
      continuous: false,
      onResult: (text) => setValue(text),
      onEnd: (finalText) => {
        setVoiceListening(false);
        if (finalText.trim() && voiceModeRef.current) {
          onSend(finalText.trim());
          setValue('');
        } else if (voiceModeRef.current) {
          setTimeout(() => startVoiceListening(), 300);
        }
      },
      onError: (error) => {
        if (error === 'no-speech' && voiceModeRef.current) {
          setTimeout(() => startVoiceListening(), 300);
          return;
        }
        setVoiceListening(false);
      },
    });
    activeVoiceRecRef.current = handle;
  }, [onSend, tryStartRecognition]);

  const toggleVoiceMode = useCallback(() => {
    if (voiceMode) {
      // Exit voice mode
      voiceModeRef.current = false;
      setVoiceMode(false);
      setVoiceListening(false);
      activeVoiceRecRef.current?.stop();
      clearSimTimer();
      setValue('');
    } else {
      // Enter voice mode
      voiceModeRef.current = true;
      setVoiceMode(true);
      startVoiceListening();
    }
  }, [voiceMode, startVoiceListening, clearSimTimer]);

  // When AI finishes responding while in voice mode, resume listening
  const prevAiRespondingRef = useRef(false);
  useEffect(() => {
    const wasResponding = prevAiRespondingRef.current;
    prevAiRespondingRef.current = !!isAiResponding;
    // AI just finished responding → resume listening
    if (wasResponding && !isAiResponding && voiceModeRef.current) {
      setTimeout(() => startVoiceListening(), 500);
    }
  }, [isAiResponding, startVoiceListening]);

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
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  const canSend = value.trim().length > 0;
  const isMultiline = textareaRef.current ? textareaRef.current.scrollHeight > 44 : false;
  const isActive = focused || canSend || voiceMode;

  const voicePlaceholder = voiceMode
    ? (isAiResponding ? 'AI is thinking...' : voiceListening ? 'Listening...' : 'Waiting...')
    : placeholder;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Quick chips */}
      {quickChips && quickChips.length > 0 && (
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
        <div className="flex flex-wrap gap-2">
          {actionChips.map(chip => (
            <button
              key={chip.action}
              onClick={() => onChipClick?.(chip)}
              className="chip-gradient-hover px-3 py-1 rounded-full border border-stroke-outline text-base leading-[22px] text-text-primary transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Text field — follows Figma component library states */}
      <div
        className={`px-4 py-4 flex items-center transition-all ${
          isActive
            ? (isMultiline ? 'rounded-lg' : 'rounded-full')
            : 'rounded-full input-gradient-hover'
        }`}
        style={
          isActive
            ? {
                border: '2px solid transparent',
                background: 'linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box',
              }
            : { border: '2px solid transparent', background: 'var(--color-bg-message)' }
        }
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={voicePlaceholder}
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-text-primary placeholder-text-tertiary"
          style={{
            fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            fontSize: 16,
            lineHeight: '22px',
            letterSpacing: '0px',
          }}
        />
        {/* Mic / Voice / Send — inside input, right-aligned, 24×24 buttons */}
        <div className="flex items-center gap-4 md:gap-2 shrink-0 ml-2">
          <Tooltip label={isRecording ? 'Stop & send' : 'Microphone'}>
            <button
              onClick={toggleRecording}
              className={`flex items-center justify-center shrink-0 cursor-pointer rounded-full transition-all ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'hover:bg-bg-hover text-text-primary'}`}
              style={{ width: 'var(--input-btn-size)', height: 'var(--input-btn-size)' } as React.CSSProperties}
            >
              <MicIcon16 />
            </button>
          </Tooltip>
          {voiceMode ? (
            <Tooltip label="Stop voice mode">
              <button
                onClick={toggleVoiceMode}
                className="flex items-center justify-center shrink-0 cursor-pointer rounded-full transition-all bg-red-500 text-white hover:bg-red-600"
                style={{ width: 'var(--input-btn-size)', height: 'var(--input-btn-size)' } as React.CSSProperties}
              >
                <StopIcon16 />
              </button>
            </Tooltip>
          ) : focused || canSend ? (
            <Tooltip label="Send">
              <button
                onClick={canSend ? handleSend : undefined}
                className={`flex items-center justify-center shrink-0 cursor-pointer rounded-full transition-all ${canSend ? 'hover:shadow-[0_2px_15px_rgba(1,44,197,0.3)]' : 'hover:bg-bg-hover'}`}
                style={{
                  width: 'var(--input-btn-size)', height: 'var(--input-btn-size)',
                  ...(canSend ? { backgroundImage: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)' } : {}),
                } as React.CSSProperties}
              >
                {canSend ? (
                  <IconImg src={iconSendActive} alt="Send" noTheme size={16} />
                ) : (
                  <IconImg src={iconSend} alt="Send" size={16} />
                )}
              </button>
            </Tooltip>
          ) : (
            <Tooltip label="Voice mode">
              <button
                onClick={toggleVoiceMode}
                className="flex items-center justify-center shrink-0 cursor-pointer rounded-full hover:bg-bg-hover transition-all text-text-primary"
                style={{ width: 'var(--input-btn-size)', height: 'var(--input-btn-size)' } as React.CSSProperties}
              >
                <VoiceIcon16 />
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
              <button
                onClick={() => { setShowAttachMenu(v => !v); setShowFolderMenu(false); setShowBranchMenu(false); }}
                className="flex items-center justify-center rounded-full border border-stroke-outline hover:bg-bg-hover toolbar-gradient-hover transition-all shrink-0 cursor-pointer text-text-primary"
                style={{ width: 'var(--toolbar-btn-h)', height: 'var(--toolbar-btn-h)' } as React.CSSProperties}
              >
                <span className="toolbar-icon-scale"><IconImg src={iconAdd} alt="Add" size={16} /></span>
              </button>
            </Tooltip>
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-3 md:mb-2 w-72 md:w-48 bg-bg-page border border-stroke-outline rounded-2xl md:rounded-xl shadow-lg py-3 md:py-2 z-50">
                {[
                  { icon: null, label: 'Mention', isMention: true },
                  { icon: iconPhoto, label: 'Photo', isMention: false },
                  { icon: iconCamera, label: 'Camera', isMention: false },
                  { icon: iconUpload, label: 'Upload File', isMention: false },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => setShowAttachMenu(false)}
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
          <div className="flex items-center rounded-full border border-stroke-outline toolbar-gradient-hover">
            {(['Chat', 'Tasks', 'Code'] as InputMode[]).map((m, i, arr) => {
              const Icon = MODE_ICONS[m];
              const isSelected = mode === m;
              const isFirst = i === 0;
              const isLast = i === arr.length - 1;
              const isDisabled = chatOnly && m !== 'Chat';
              const btn = (
                <button
                  key={m}
                  onClick={() => { if (isDisabled) return; setMode(m); onModeChange?.(m); closeAllMenus(); }}
                  className={`flex items-center justify-center gap-1 transition-all text-text-primary ${
                    isDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : isSelected
                        ? 'px-3 cursor-pointer'
                        : 'hover:bg-bg-hover cursor-pointer'
                  }`}
                  style={{
                    height: 'var(--toolbar-btn-h)',
                    ...(!isSelected ? { width: 'var(--mode-btn-unselected-w)' } : {}),
                    backgroundColor: isSelected ? 'var(--color-selected-bg)' : undefined,
                    color: isSelected ? 'var(--color-selected-text)' : undefined,
                    borderRadius: isFirst ? '9999px 0 0 9999px' : isLast ? '0 9999px 9999px 0' : '0',
                  }}
                >
                  <Icon />
                  {isSelected && <span className="text-xs font-medium">{m}</span>}
                </button>
              );
              return isSelected ? btn : <Tooltip key={m} label={isDisabled ? `${m} (not available)` : m}>{btn}</Tooltip>;
            })}
          </div>

          {/* Mode-specific options */}
          {(mode === 'Tasks' || mode === 'Code') && (
            <div ref={folderRef} className="relative">
              <button
                onClick={() => { setShowFolderMenu(v => !v); setShowBranchMenu(false); setShowAttachMenu(false); }}
                className="flex items-center gap-[9px] md:gap-1.5 px-[18px] md:px-3 rounded-full border border-stroke-outline text-xs text-text-primary hover:bg-bg-hover toolbar-gradient-hover transition-colors cursor-pointer max-w-[270px] md:max-w-[180px]"
                style={{ height: 'var(--toolbar-btn-h)' } as React.CSSProperties}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[21px] h-[21px] md:w-[14px] md:h-[14px]">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="truncate">{folder}</span>
                <img src={iconChevronDown} alt="" className="w-[18px] h-[18px] md:w-3 md:h-3 icon-theme shrink-0" />
              </button>
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
                <button
                  onClick={() => { setShowBranchMenu(v => !v); setShowFolderMenu(false); setShowAttachMenu(false); }}
                  className="flex items-center gap-[9px] md:gap-1.5 px-[18px] md:px-3 rounded-full border border-stroke-outline text-xs text-text-primary hover:bg-bg-hover toolbar-gradient-hover transition-colors cursor-pointer max-w-[240px] md:max-w-[160px]"
                  style={{ height: 'var(--toolbar-btn-h)' } as React.CSSProperties}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 w-[21px] h-[21px] md:w-[14px] md:h-[14px]">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                  <span className="truncate">{branch}</span>
                  <img src={iconChevronDown} alt="" className="w-[18px] h-[18px] md:w-3 md:h-3 icon-theme shrink-0" />
                </button>
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
              <label className="flex items-center gap-[9px] md:gap-1.5 px-[18px] md:px-3 rounded-full border border-stroke-outline text-xs text-text-primary cursor-pointer select-none hover:bg-bg-hover toolbar-gradient-hover transition-colors" style={{ height: 'var(--toolbar-btn-h)' } as React.CSSProperties}>
                <input
                  type="checkbox"
                  checked={useWorktree}
                  onChange={e => setUseWorktree(e.target.checked)}
                  className="worktree-checkbox w-[21px] h-[21px] md:w-3.5 md:h-3.5 rounded cursor-pointer"
                />
                Worktree
              </label>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
