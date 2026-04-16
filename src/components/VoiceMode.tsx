import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeSession } from '../lib/realtime';
import type { RealtimeState, TranscriptEvent } from '../lib/realtime';

interface VoiceModeProps {
  /** Called when voice session ends */
  onClose: () => void;
  /** Called in real-time as messages arrive — lets App add them to the chat */
  onMessage?: (role: 'user' | 'assistant', text: string) => void;
  /** Send text into the voice conversation (e.g. a pasted URL) */
  pendingText?: string;
  onPendingTextConsumed?: () => void;
}

/**
 * Inline voice control bar — sits above ChatInput.
 * NOT a full-screen overlay. The chat UI stays fully visible and interactive.
 * Users can still type in ChatInput to send text/URLs into the voice conversation.
 */
export default function VoiceMode({ onClose, onMessage, pendingText, onPendingTextConsumed }: VoiceModeProps) {
  const [state, setState] = useState<RealtimeState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const sessionRef = useRef<RealtimeSession | null>(null);
  const transcriptRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Connect on mount. Each mount gets its own session, cleanup always disconnects.
  useEffect(() => {
    // Disconnect any prior session (handles StrictMode re-mount)
    sessionRef.current?.disconnect();

    const session = new RealtimeSession({
      onStateChange: setState,
      onTranscript: (evt: TranscriptEvent) => {
        if (evt.role === 'user' && evt.isFinal && evt.text.trim()) {
          transcriptRef.current.push({ role: 'user', content: evt.text });
          onMessage?.('user', evt.text);
        } else if (evt.role === 'assistant' && evt.isFinal && evt.text.trim()) {
          transcriptRef.current.push({ role: 'assistant', content: evt.text });
          onMessage?.('assistant', evt.text);
        }
      },
      onAudioStart: () => setIsSpeaking(true),
      onAudioEnd: () => setIsSpeaking(false),
      onError: (msg) => setErrorMsg(msg),
    });

    sessionRef.current = session;
    session.connect();

    return () => {
      session.disconnect();
      sessionRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Forward pending text (typed URL/info) into the voice conversation
  useEffect(() => {
    if (pendingText && sessionRef.current && state === 'connected') {
      sessionRef.current.sendText(pendingText);
      onPendingTextConsumed?.();
    }
  }, [pendingText, state, onPendingTextConsumed]);

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

  const stateLabel = state === 'connecting' ? 'Connecting...'
    : state === 'connected' ? (isSpeaking ? 'AI is speaking...' : (isMuted ? 'Muted' : 'Listening...'))
    : state === 'error' ? 'Error'
    : 'Starting...';

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl mx-4 mb-2 voice-bar-bg">
      {/* Animated orb — small version */}
      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
        state === 'connecting' ? 'bg-white/10 animate-pulse'
        : state === 'connected' && isSpeaking ? 'voice-orb-speaking'
        : state === 'connected' ? 'voice-orb-listening'
        : state === 'error' ? 'bg-red-500/30'
        : 'bg-white/10'
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
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {state === 'error' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      {/* Status text */}
      <span className="text-sm text-white/80 flex-1 min-w-0 truncate">
        {errorMsg || stateLabel}
      </span>

      {/* Mute button */}
      <button
        onClick={handleMute}
        disabled={state !== 'connected'}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
          isMuted ? 'bg-red-500/30' : 'bg-white/10 hover:bg-white/20'
        } disabled:opacity-30`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        )}
      </button>

      {/* End button */}
      <button
        onClick={handleEnd}
        className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shrink-0"
        title="End voice"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      </button>
    </div>
  );
}
