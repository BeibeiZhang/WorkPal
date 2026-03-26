import { useState, useRef, useEffect } from 'react';
import { Chat, Message, ActionChip } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { avatarBlackWoman, avatarAsianWoman, avatarWhiteMan, iconChevronDown } from '../assets';

interface ChatPanelProps {
  chat: Chat | null;
  onSend: (message: string) => void;
  onChipClick: (chip: ActionChip) => void;
  onCardAction: (action: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isDark?: boolean;
  selectedAvatarId?: string;
  onAvatarChange?: (id: string) => void;
}

const WELCOME_CHIPS = ['Create performance goals', 'Analyze doc(s)', 'Visualize data'];

const AVATARS = [
  { id: 'black-woman', src: avatarBlackWoman, alt: 'Black woman', videoLight: '/animations/black-woman-light.mp4', videoDark: '/animations/black-woman-dark.mp4' },
  { id: 'asian-woman', src: avatarAsianWoman, alt: 'Asian woman', videoLight: '/animations/asian-woman-light.mp4', videoDark: '/animations/asian-woman-dark.mp4' },
  { id: 'white-man', src: avatarWhiteMan, alt: 'White man', videoLight: '/animations/white-man-light.mp4', videoDark: '/animations/white-man-dark.mp4' },
];

function WelcomeState({ isDark, selectedAvatarId, onAvatarChange }: { isDark?: boolean; selectedAvatarId?: string; onAvatarChange?: (id: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedAvatar = AVATARS.find(a => a.id === selectedAvatarId) || AVATARS[0];
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleSelect = (avatar: typeof AVATARS[number]) => {
    onAvatarChange?.(avatar.id);
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
          {AVATARS.map(avatar => (
            <button
              key={avatar.id}
              onClick={() => handleSelect(avatar)}
              className="w-[100px] h-[100px] rounded-full shrink-0 cursor-pointer relative group"
            >
              <div
                className="absolute inset-0 rounded-full overflow-hidden transition-all group-hover:bg-[rgba(49,113,255,0.1)] group-active:border group-active:border-[#3171ff]"
                style={{ background: 'var(--color-bg-hover)' }}
              >
                <img src={avatar.src} alt={avatar.alt} className="w-full h-full object-cover" />
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
            <video
              ref={videoRef}
              key={`${selectedAvatar.id}-${isDark ? 'dark' : 'light'}`}
              src={isDark ? selectedAvatar.videoDark : selectedAvatar.videoLight}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover relative"
            />
          </div>
        </button>
      )}
      {/* Greeting */}
      <h1
        className="text-[24px] text-center w-full"
        style={{
          fontFamily: 'SF Pro, system-ui, sans-serif',
          fontWeight: 590,
          lineHeight: '22px',
          letterSpacing: '-0.43px',
          backgroundImage: 'linear-gradient(31.6deg, #7652B9 0%, #B46470 51.9%, #CA9D8C 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Hi, Beibei
      </h1>
      {/* Subtitle */}
      <div className="flex items-center justify-center px-8 w-full">
        <p
          className="flex-1 text-center text-text-primary"
          style={{
            fontFamily: 'SF Pro, system-ui, sans-serif',
            fontSize: 17,
            lineHeight: '22px',
            letterSpacing: '-0.43px',
          }}
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
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  const isNewChat = !chat || chat.messages.length === 0;
  const chatTitle = chat?.title || 'WorkPal';

  return (
    <div className="flex flex-col h-full flex-1 min-w-0 app-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0">
        {/* Left: menu toggle (when sidebar closed) */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor"/>
              <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
            </svg>
          </button>
        )}

        {/* Center: title */}
        <div className="flex-1 flex items-center justify-center gap-1.5">
          {chat && chat.id !== 'my-workpal' ? (
            <h2 className="text-base font-semibold text-text-primary">{chatTitle}</h2>
          ) : (
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-text-primary">WorkPal</h2>
              <div className="relative overflow-hidden w-5 h-5 shrink-0 flex items-center justify-center">
                <img src={iconChevronDown} alt="" className="object-contain opacity-50 icon-theme" style={{ width: 12, height: 6 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-8 py-4">
        <div className={`max-w-2xl mx-auto ${isNewChat ? 'h-full flex flex-col justify-center' : ''}`}>
          {isNewChat ? (
            <WelcomeState isDark={isDark} selectedAvatarId={selectedAvatarId} onAvatarChange={onAvatarChange} />
          ) : (
            <>
              {chat.messages.map((msg: Message) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onChipClick={onChipClick}
                  onCardAction={onCardAction}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-8 pb-6 shrink-0">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            onSend={onSend}
            quickChips={isNewChat ? WELCOME_CHIPS : undefined}
          />
        </div>
      </div>
    </div>
  );
}
