import { useState, useRef, useEffect, useMemo, type MouseEvent } from 'react';
import { PanelRight, FolderClosed, Check } from 'lucide-react';
import { Chat, Message, ActionChip, Attachment, ImageResult, VideoResult, WebResult, CardData, ArtifactRef } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import VoiceMode from './VoiceMode';
import { HeaderBar } from './shared';
import { AGENTS, useAgentVideoStatus } from '../agentVideos';

/** Chip showing the session's folder path.
 *  - Click → reveal the folder in Finder (POSTs to /api/claude-chat/open-folder
 *    via the `onOpen` handler plumbed from App).
 *  - Shift+click → copy the path to the clipboard (preserved from the pre-5.4e
 *    behavior as a secondary gesture). The icon briefly flips to a checkmark
 *    for 1.5s to confirm the copy.
 *  `onOpen` is optional so DesignSystemPage can still render the chip in a
 *  static preview without wiring a real handler. */
function FolderChip({ path, onOpen }: { path: string; onOpen?: (path: string) => void | Promise<unknown> }) {
  const [copied, setCopied] = useState(false);
  const handleClick = async (e: MouseEvent) => {
    if (e.shiftKey) {
      try {
        await navigator.clipboard.writeText(path);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard API unavailable (e.g. insecure context) — fail silently */
      }
      return;
    }
    if (onOpen) {
      try {
        await onOpen(path);
      } catch {
        /* App-level handler already logs; the chip shouldn't pop a toast */
      }
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? 'Folder path copied' : `Open folder in Finder: ${path}. Shift-click to copy path.`}
      className="flex items-center gap-1.5 min-w-0 max-w-[320px] px-3 h-10 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors text-text-primary"
      title={`${path} — click to open in Finder, shift+click to copy`}
    >
      {copied
        ? <Check size={14} className="shrink-0 text-[#028901]" />
        : <FolderClosed size={14} className="shrink-0" />}
      <span className="font-mono type-caption truncate">{path}</span>
    </button>
  );
}

interface ChatPanelProps {
  chat: Chat | null;
  onSend: (message: string, attachments?: Attachment[]) => void;
  onChipClick: (chip: ActionChip) => void;
  onCardAction: (action: string, card?: CardData, messageId?: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isDark?: boolean;
  selectedAvatarId?: string;
  onAvatarChange?: (id: string) => void;
  showContextToggle?: boolean;
  contextPanelOpen?: boolean;
  onToggleContextPanel?: () => void;
  isAiResponding?: boolean;
  draftValue?: string;
  /** Mobile-only: shown as a "+" button in the header's right group. */
  onNewChat?: () => void;
  /** Open voice mode */
  onVoiceMode?: () => void;
  /** Whether voice mode is currently active */
  voiceModeActive?: boolean;
  /** Close voice mode */
  onVoiceModeClose?: () => void;
  /** Real-time voice message callback */
  onVoiceMessage?: (role: 'user' | 'assistant', text: string) => void;
  /** Called when the AI fetches photos via the search_images tool during voice mode. */
  onVoiceImages?: (query: string, images: ImageResult[]) => void;
  /** Called when the AI fetches YouTube videos via search_videos during voice mode. */
  onVoiceVideos?: (query: string, videos: VideoResult[]) => void;
  /** Called when the AI invokes web_search during voice mode — App renders an
   *  assistant message with source chips and an optional product photo. */
  onVoiceWebSearch?: (query: string, results: WebResult[], images: ImageResult[]) => void;
  /** Text typed during voice mode to inject into the voice session */
  voicePendingText?: string;
  /** Image data URLs attached during voice mode to send to the voice session */
  voicePendingImages?: string[];
  /** Called after VoiceMode consumes the pending text/images */
  onVoicePendingTextConsumed?: () => void;
  /** 5.4e: click on the session folder chip → open the folder in Finder. The
   *  receiver is expected to POST the path to the backend (resolved + path-
   *  traversal-checked there). Optional so static previews can render the chip
   *  without a live handler. */
  onOpenFolder?: (path: string) => void | Promise<unknown>;
  /** Click on an artifact card under an assistant message (Claude-Code
   *  file write). App wires this to POST the open-file endpoint so the OS
   *  opens the file in its default app (HTML → default browser). */
  onArtifactClick?: (artifact: ArtifactRef) => void | Promise<unknown>;
}

const WELCOME_CHIPS = ['Create performance goals', 'Analyze doc(s)', 'Visualize data'];

function WelcomeState({ isDark, selectedAvatarId, onAvatarChange }: { isDark?: boolean; selectedAvatarId?: string; onAvatarChange?: (id: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedAgent = AGENTS.find(a => a.id === selectedAvatarId) || AGENTS[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const { getStatus } = useAgentVideoStatus();

  // Active pools, filtered by current status (paused/deleted videos are skipped).
  // If every video in a mode is disabled, the pool is empty and the render
  // path falls back to a static avatar image — we honor the user's intent.
  const lightPool = useMemo(
    () => selectedAgent.videos
      .filter(v => v.mode === 'light' && getStatus(v.src) === 'active')
      .map(v => v.src),
    [selectedAgent.id, getStatus],
  );
  const darkPool = useMemo(
    () => selectedAgent.videos
      .filter(v => v.mode === 'dark' && getStatus(v.src) === 'active')
      .map(v => v.src),
    [selectedAgent.id, getStatus],
  );

  // Pick a random video index once per avatar selection (separate for light/dark)
  const lightIdx = useMemo(
    () => Math.floor(Math.random() * Math.max(1, lightPool.length)),
    [selectedAgent.id, lightPool.length],
  );
  const darkIdx = useMemo(
    () => Math.floor(Math.random() * Math.max(1, darkPool.length)),
    [selectedAgent.id, darkPool.length],
  );

  const handleSelect = (agent: typeof AGENTS[number]) => {
    onAvatarChange?.(agent.id);
    setPickerOpen(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Avatar / Character picker */}
      {pickerOpen ? (
        <div
          className="flex items-center gap-4 p-4 rounded-full"
          style={{
            background: 'var(--color-bg-message)',
            boxShadow: '0px 1px 3px 0px rgba(1, 20, 80, 0.25)',
          }}
        >
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => handleSelect(agent)}
              className="w-[100px] h-[100px] rounded-full shrink-0 cursor-pointer relative group"
            >
              <div
                className="absolute inset-0 rounded-full overflow-hidden transition-all group-hover:bg-[rgba(49,113,255,0.1)] group-active:border group-active:border-[#3171ff]"
                style={{ background: 'var(--color-bg-hover)' }}
              >
                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setPickerOpen(true)}
          className="w-[150px] h-[150px] rounded-full shrink-0 cursor-pointer relative group active:w-[152px] active:h-[152px]"
        >
          <div
            className="absolute inset-0 rounded-full overflow-hidden transition-colors group-active:border group-active:border-[#3171ff]"
            style={{ background: 'var(--color-bg-hover)' }}
          >
            {/* Blue tint overlay on hover */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10" style={{ background: 'rgba(49,113,255,0.1)' }} />
            {(() => {
              const pool = isDark ? darkPool : lightPool;
              const idx = isDark ? darkIdx : lightIdx;
              const src = pool[idx];
              // No active videos for this mode → user paused/deleted them all.
              // Fall back to the static avatar so the welcome state still has
              // a face, but never plays something the user disabled.
              if (!src) {
                return (
                  <img
                    src={selectedAgent.avatar}
                    alt={selectedAgent.name}
                    className="w-full h-full object-cover relative"
                  />
                );
              }
              return (
                <video
                  ref={videoRef}
                  key={`${selectedAgent.id}-${isDark ? 'dark' : 'light'}-${src}`}
                  src={src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover relative"
                />
              );
            })()}
          </div>
        </button>
      )}
      {/* Greeting */}
      <h1 className="type-h1 gradient-text text-center w-full">
        Hi, Beibei
      </h1>
      {/* Subtitle */}
      <div className="flex items-center justify-center px-8 w-full">
        <p
          className="flex-1 text-center type-h2 text-text-primary"
          style={{ letterSpacing: '-0.43px' }}
        >
          How can I help you today?
        </p>
      </div>
    </div>
  );
}

export default function ChatPanel({
  chat,
  onSend,
  onChipClick,
  onCardAction,
  sidebarOpen,
  onToggleSidebar,
  isDark,
  selectedAvatarId,
  onAvatarChange,
  showContextToggle,
  contextPanelOpen,
  onToggleContextPanel,
  isAiResponding,
  draftValue,
  onNewChat,
  onVoiceMode,
  voiceModeActive,
  onVoiceModeClose,
  onVoiceMessage,
  onVoiceImages,
  onVoiceVideos,
  onVoiceWebSearch,
  voicePendingText,
  voicePendingImages,
  onVoicePendingTextConsumed,
  onOpenFolder,
  onArtifactClick,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  const isNewChat = !chat || chat.messages.length === 0;
  // Get chips from the last assistant message (for bottom input area)
  const lastMessage = chat?.messages?.[chat.messages.length - 1];
  const activeChips = lastMessage?.role === 'assistant' && lastMessage.chips?.length ? lastMessage.chips : undefined;

  const contextToggleButton =
    showContextToggle && !contextPanelOpen ? (
      <button
        onClick={onToggleContextPanel}
        aria-label="Open context panel"
        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
      >
        <PanelRight size={20} />
      </button>
    ) : null;

  return (
    <div className="relative flex flex-col h-full flex-1 min-w-[360px]">
      <HeaderBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        headerLeft={chat?.sessionFolder && chat?.folderMaterialized ? <FolderChip path={chat.sessionFolder} onOpen={onOpenFolder} /> : undefined}
        headerRight={contextToggleButton}
        onNewChat={onNewChat}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-8 py-4">
        <div className={`max-w-[863px] mx-auto ${isNewChat ? 'h-full flex flex-col justify-center' : ''}`}>
          {isNewChat ? (
            <WelcomeState isDark={isDark} selectedAvatarId={selectedAvatarId} onAvatarChange={onAvatarChange} />
          ) : (
            <>
              {chat.messages.map((msg: Message, idx: number) => {
                // Find the last assistant message index
                const isLastAssistant = msg.role === 'assistant' &&
                  !chat.messages.slice(idx + 1).some(m => m.role === 'assistant');
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLastAssistant={isLastAssistant}
                    onCardAction={onCardAction}
                    onArtifactClick={onArtifactClick as (a: ArtifactRef) => void}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-8 pb-[40px] shrink-0">
        <div className="max-w-[863px] mx-auto">
          {/* Voice mode bar — inline above input */}
          {voiceModeActive && onVoiceModeClose && (
            <VoiceMode
              onClose={onVoiceModeClose}
              onMessage={onVoiceMessage}
              onImages={onVoiceImages}
              onVideos={onVoiceVideos}
              onWebSearch={onVoiceWebSearch}
              pendingText={voicePendingText}
              pendingImages={voicePendingImages}
              onPendingTextConsumed={onVoicePendingTextConsumed}
              agentGender={selectedAvatarId === 'white-man' ? 'male' : 'female'}
            />
          )}
          <ChatInput
            onSend={onSend}
            quickChips={isNewChat && !chat?.draftPrompt ? WELCOME_CHIPS : undefined}
            actionChips={!isNewChat ? activeChips : undefined}
            onChipClick={onChipClick}
            isAiResponding={isAiResponding}
            chatKey={chat?.id}
            draftValue={draftValue}
            onVoiceMode={onVoiceMode}
            voiceModeActive={voiceModeActive}
          />
        </div>
      </div>
    </div>
  );
}
