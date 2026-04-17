import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RealtimeSession, VOICE_OPTIONS } from '../lib/realtime';
import type { RealtimeState, TranscriptEvent, VoiceId, VoiceGender } from '../lib/realtime';
import type { ImageResult } from '../types';

interface VoiceModeProps {
  /** Called when voice session ends */
  onClose: () => void;
  /** Called in real-time as messages arrive — lets App add them to the chat */
  onMessage?: (role: 'user' | 'assistant', text: string) => void;
  /** Called when the AI fetches photos via search_images — App renders an
   *  assistant message with imageResults so they appear inline in the chat. */
  onImages?: (query: string, images: ImageResult[]) => void;
  /** Send text into the voice conversation (e.g. a pasted URL) */
  pendingText?: string;
  /** Image data URLs to send alongside the pending text (or standalone). */
  pendingImages?: string[];
  onPendingTextConsumed?: () => void;
  /** Restrict voice options to match the agent's gender (the agent already has a name). */
  agentGender?: VoiceGender;
}

// Separate keys per gender so switching agents doesn't thrash each other's preference.
const voiceStorageKey = (gender: VoiceGender) => `workpal.voice.${gender}`;

function loadStoredVoice(gender: VoiceGender): VoiceId {
  const pool = VOICE_OPTIONS.filter((v) => v.gender === gender);
  try {
    const stored = localStorage.getItem(voiceStorageKey(gender));
    if (stored && pool.some((v) => v.id === stored)) return stored as VoiceId;
  } catch {
    // ignore — fall back to default
  }
  return pool[0].id as VoiceId;
}

/**
 * Inline voice control bar — sits above ChatInput.
 * NOT a full-screen overlay. The chat UI stays fully visible and interactive.
 * Users can still type in ChatInput to send text/URLs into the voice conversation.
 */
export default function VoiceMode({ onClose, onMessage, onImages, pendingText, pendingImages, onPendingTextConsumed, agentGender = 'female' }: VoiceModeProps) {
  const [state, setState] = useState<RealtimeState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [voice, setVoice] = useState<VoiceId>(() => loadStoredVoice(agentGender));
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);

  // Voices available for this agent's gender
  const availableVoices = useMemo(
    () => VOICE_OPTIONS.filter((v) => v.gender === agentGender),
    [agentGender]
  );

  // If the agent's gender changes mid-session, snap the selection to a matching voice.
  useEffect(() => {
    if (!availableVoices.some((v) => v.id === voice)) {
      setVoice(loadStoredVoice(agentGender));
    }
  }, [agentGender, availableVoices, voice]);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const transcriptRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  // Whisper transcription of the user's turn often lands AFTER the assistant's
  // transcript is final (the assistant starts responding as soon as VAD fires,
  // while Whisper keeps post-processing). Without buffering, the assistant
  // message would appear above the user's question in the chat. Hold the
  // assistant text until the user turn lands, then flush — or release after a
  // short timeout if the user turn never arrives (e.g. assistant-initiated
  // greeting on connect).
  const pendingAssistantRef = useRef<{ text: string; timer: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Connect / reconnect whenever `voice` changes. Each mount (or voice change) gets its own session.
  useEffect(() => {
    sessionRef.current?.disconnect();
    setErrorMsg('');
    setIsSpeaking(false);
    setIsMuted(false);

    const pushAssistant = (text: string) => {
      transcriptRef.current.push({ role: 'assistant', content: text });
      onMessage?.('assistant', text);
    };
    const clearPendingAssistant = () => {
      const p = pendingAssistantRef.current;
      if (!p) return;
      clearTimeout(p.timer);
      pendingAssistantRef.current = null;
      return p.text;
    };

    const session = new RealtimeSession({
      onStateChange: setState,
      onTranscript: (evt: TranscriptEvent) => {
        if (evt.role === 'user' && evt.isFinal && evt.text.trim()) {
          transcriptRef.current.push({ role: 'user', content: evt.text });
          onMessage?.('user', evt.text);
          // Flush any assistant reply that was waiting on this user turn.
          const buffered = clearPendingAssistant();
          if (buffered) pushAssistant(buffered);
        } else if (evt.role === 'assistant' && evt.isFinal && evt.text.trim()) {
          const last = transcriptRef.current[transcriptRef.current.length - 1];
          const userTurnPending = !last || last.role === 'assistant';
          if (userTurnPending) {
            clearPendingAssistant();
            const text = evt.text;
            const timer = window.setTimeout(() => {
              pendingAssistantRef.current = null;
              pushAssistant(text);
            }, 2000);
            pendingAssistantRef.current = { text, timer };
          } else {
            pushAssistant(evt.text);
          }
        }
      },
      onAudioStart: () => setIsSpeaking(true),
      onAudioEnd: () => setIsSpeaking(false),
      onError: (msg) => setErrorMsg(msg),
      onImages: (query, images) => onImages?.(query, images),
    });

    sessionRef.current = session;
    session.connect(voice);

    return () => {
      session.disconnect();
      sessionRef.current = null;
      if (pendingAssistantRef.current) {
        clearTimeout(pendingAssistantRef.current.timer);
        pendingAssistantRef.current = null;
      }
    };
  }, [voice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Forward pending text + images (typed URL / dropped attachments) into the voice conversation
  useEffect(() => {
    const hasText = !!pendingText;
    const hasImages = !!pendingImages && pendingImages.length > 0;
    if ((hasText || hasImages) && sessionRef.current && state === 'connected') {
      sessionRef.current.sendText(pendingText || '', pendingImages || []);
      onPendingTextConsumed?.();
    }
  }, [pendingText, pendingImages, state, onPendingTextConsumed]);

  // Close picker on outside click
  useEffect(() => {
    if (!voicePickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setVoicePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [voicePickerOpen]);

  const handleMute = useCallback(() => {
    if (sessionRef.current) {
      const muted = sessionRef.current.toggleMute();
      setIsMuted(muted);
    }
  }, []);

  const handleEnd = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    onClose();
  }, [onClose]);

  const handleSelectVoice = useCallback((next: VoiceId) => {
    setVoicePickerOpen(false);
    if (next === voice) return;
    try { localStorage.setItem(voiceStorageKey(agentGender), next); } catch { /* ignore */ }
    setVoice(next); // triggers the connect effect → reconnects with new voice
  }, [voice, agentGender]);

  const activeVoice = availableVoices.find((v) => v.id === voice) ?? availableVoices[0];

  const stateLabel = state === 'connecting' ? 'Connecting...'
    : state === 'connected' ? (isSpeaking ? 'AI is speaking...' : (isMuted ? 'Muted' : 'Listening...'))
    : state === 'error' ? 'Error'
    : 'Starting...';

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl mx-4 mb-2 voice-bar-bg relative">
      {/* Animated orb — small version */}
      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
        state === 'connecting' ? 'bg-bg-hover animate-pulse'
        : state === 'connected' && isSpeaking ? 'voice-orb-speaking'
        : state === 'connected' ? 'voice-orb-listening'
        : state === 'error' ? 'bg-red-500/15'
        : 'bg-bg-hover'
      }`}>
        {state === 'connected' && isSpeaking && (
          <div className="flex items-end gap-[2px] h-3">
            <div className="w-[2px] bg-white rounded-full voice-bar" style={{ animationDelay: '0ms' }} />
            <div className="w-[2px] bg-white rounded-full voice-bar" style={{ animationDelay: '150ms' }} />
            <div className="w-[2px] bg-white rounded-full voice-bar" style={{ animationDelay: '300ms' }} />
            <div className="w-[2px] bg-white rounded-full voice-bar" style={{ animationDelay: '150ms' }} />
          </div>
        )}
        {state === 'connected' && !isSpeaking && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        )}
        {state === 'connecting' && (
          <div className="w-3 h-3 border-2 border-text-primary/20 border-t-text-primary rounded-full animate-spin" />
        )}
        {state === 'error' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C93838" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      {/* Status text */}
      <span className="text-sm text-text-secondary flex-1 min-w-0 truncate">
        {errorMsg || stateLabel}
      </span>

      {/* Voice picker */}
      <div ref={pickerRef} className="relative shrink-0">
        <button
          onClick={() => setVoicePickerOpen((o) => !o)}
          className="h-7 px-2.5 rounded-full flex items-center gap-1.5 bg-bg-hover hover:bg-bg-message transition-all text-xs text-text-primary"
          title="Change voice"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10v4" />
            <path d="M7 6v12" />
            <path d="M11 3v18" />
            <path d="M15 8v8" />
            <path d="M19 11v2" />
          </svg>
          <span className="font-medium">{activeVoice.short}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${voicePickerOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {voicePickerOpen && (
          <div
            className="absolute bottom-full right-0 mb-2 min-w-[200px] rounded-xl border border-stroke-outline shadow-lg overflow-hidden z-50"
            style={{ backgroundColor: 'var(--color-card-panel-bg)' }}
          >
            <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-tertiary border-b border-stroke-outline">
              Voice
            </div>
            <div className="py-1 max-h-[280px] overflow-y-auto">
              {availableVoices.map((v) => {
                const active = v.id === voice;
                return (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVoice(v.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-bg-hover transition-colors ${active ? 'bg-bg-hover' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary truncate">{v.hint}</div>
                    </div>
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mute button */}
      <button
        onClick={handleMute}
        disabled={state !== 'connected'}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
          isMuted ? 'bg-red-500/15' : 'bg-bg-hover hover:bg-bg-message'
        } disabled:opacity-30`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C93838" strokeWidth="2.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-text-primary">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        )}
      </button>

      {/* End button — solid black */}
      <button
        onClick={handleEnd}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 shrink-0"
        style={{ backgroundColor: 'var(--color-text-primary)' }}
        title="End voice"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      </button>
    </div>
  );
}
