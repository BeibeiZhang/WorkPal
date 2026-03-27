import { Message, ActionChip } from '../types';
import MessageCard from './MessageCard';
import { iconCopy, iconShare, iconThumbsUp, iconRefresh } from '../assets';

interface ChatMessageProps {
  message: Message;
  isLastAssistant?: boolean;
  onChipClick?: (chip: ActionChip) => void;
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

function FeedbackBar() {
  const actions = [
    { src: iconCopy, label: 'Copy' },
    { src: iconShare, label: 'Share' },
    { src: iconThumbsUp, label: 'Good' },
    { src: iconThumbsUp, label: 'Bad', flip: true },
    { src: iconRefresh, label: 'Retry' },
  ];
  return (
    <div className="flex items-center gap-1 mt-2">
      {actions.map(({ src, label, flip }) => (
        <button
          key={label}
          title={label}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors"
        >
          <img
            src={src}
            alt={label}
            className={`w-4 h-4 object-contain opacity-40 hover:opacity-70 icon-theme ${flip ? 'scale-y-[-1]' : ''}`}
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
          className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 typing-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

export default function ChatMessage({ message, isLastAssistant, onChipClick, onCardAction }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 message-appear">
        <div className="max-w-[320px] bg-bg-message rounded-lg px-4 py-3">
          <p className="text-base text-text-primary leading-[24px]">{message.content}</p>
        </div>
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

          {/* Feedback bar: always visible on last assistant msg, hover-only on others */}
          <div className={isLastAssistant ? '' : 'opacity-0 group-hover/msg:opacity-100 transition-opacity'}>
            <FeedbackBar />
          </div>

          {/* Action chips moved to input area */}
        </>
      )}
    </div>
  );
}
