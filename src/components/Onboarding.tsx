import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import ChatInput from './ChatInput';

interface OnboardingProps {
  onComplete: (mostImportant: string[], avoid: string[], description?: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const INITIAL_TRAITS = [
  '\u{1F6DF} Stable',
  '\u{1F9E0} Organized',
  '\u{1F917} Kind',
  '\u{1F9D8} Calm',
  '\u{1F331} Open-minded',
  '\u{1FAF6} People-first',
  '\u{1F60A} Always smiling',
  '\u{1F3AD} Has a sense of humor',
  '\u26A1 Energetic',
  '\u2728 Minimal',
  '\u{1F454} Formal',
  '\u{1F648} Not sure yet',
];

type Zone = 'available' | 'important' | 'avoid';

export default function Onboarding({ onComplete, sidebarOpen, onToggleSidebar }: OnboardingProps) {
  const [available, setAvailable] = useState<string[]>(INITIAL_TRAITS);
  const [important, setImportant] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [dragOverZone, setDragOverZone] = useState<Zone | null>(null);

  const moveTrait = useCallback(
    (trait: string, from: Zone, to: Zone) => {
      if (from === to) return;
      if (to === 'important' && important.length >= 3) return;

      const remove = (list: string[]) => list.filter(t => t !== trait);
      const add = (list: string[]) => (list.includes(trait) ? list : [...list, trait]);

      if (from === 'available') setAvailable(remove);
      if (from === 'important') setImportant(remove);
      if (from === 'avoid') setAvoid(remove);

      if (to === 'available') setAvailable(add);
      if (to === 'important') setImportant(add);
      if (to === 'avoid') setAvoid(add);
    },
    [important.length]
  );

  const handleDragStart = (e: React.DragEvent, trait: string, from: Zone) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ trait, from }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, zone: Zone) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(zone);
  };

  const handleDragLeave = () => setDragOverZone(null);

  const handleDrop = (e: React.DragEvent, to: Zone) => {
    e.preventDefault();
    setDragOverZone(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { trait: string; from: Zone };
      if (payload?.trait && payload?.from) {
        moveTrait(payload.trait, payload.from, to);
      }
    } catch {
      /* ignore */
    }
  };

  const removeFromZone = (trait: string, from: Zone) => {
    moveTrait(trait, from, 'available');
  };

  const canProceed = important.length === 3;

  const handleChatSend = (text: string) => {
    const trimmed = text.trim();
    if (!canProceed && !trimmed) return;
    onComplete(important, avoid, trimmed || undefined);
  };

  const renderChip = (trait: string, from: Zone, removable = false) => {
    const inZone = from !== 'available';
    return (
      <div
        key={`${from}-${trait}`}
        draggable
        onDragStart={(e) => handleDragStart(e, trait, from)}
        className={`flex items-center gap-1 rounded-full transition-all cursor-grab active:cursor-grabbing ${
          inZone ? '' : 'chip-gradient-hover'
        }`}
        style={{
          padding: '4px 12px',
          border: '1px solid var(--color-stroke-outline)',
          background: inZone ? 'var(--color-selected-bg)' : 'transparent',
          color: inZone ? 'var(--color-selected-text)' : 'var(--color-text-primary)',
          fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontSize: 16,
          fontWeight: 400,
          lineHeight: '22px',
          letterSpacing: '0px',
        }}
      >
        <span>{trait}</span>
        {removable && (
          <button
            type="button"
            onClick={() => removeFromZone(trait, from)}
            className="ml-1 -mr-1 flex items-center justify-center rounded-full hover:opacity-70"
            style={{ width: 16, height: 16, color: 'inherit' }}
            aria-label={`Remove ${trait}`}
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  };

  const dropZoneStyle = (zone: Zone) => ({
    border: `1px ${dragOverZone === zone ? 'solid' : 'dashed'} var(--color-stroke-outline)`,
    background: dragOverZone === zone ? 'var(--color-bg-hover)' : 'transparent',
    minHeight: 140,
  });

  return (
    <div className="flex flex-col h-full flex-1 min-w-0 app-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect width="22" height="2" rx="1" fill="currentColor" />
              <rect width="15" height="2" rx="1" y="7" fill="currentColor" />
            </svg>
          </button>
        )}
        <div className="flex-1" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
        <div className="max-w-[863px] mx-auto">
          {/* Title */}
          <h1
            className="text-text-primary"
            style={{
              fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              fontSize: 40,
              fontWeight: 700,
              lineHeight: '48px',
              letterSpacing: '0px',
            }}
          >
            Welcome to WorkPal
          </h1>

          {/* Scenario + action guide */}
          <div className="mt-6 flex flex-col gap-4">
            <p
              className="text-text-primary"
              style={{
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontSize: 16,
                fontWeight: 700,
                lineHeight: '22px',
                letterSpacing: '0px',
              }}
            >
              Think about the teammates you've admired most in your career — what qualities inspired you or meant the most to you at work?
            </p>
            <p
              className="text-text-primary"
              style={{
                fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontSize: 16,
                fontWeight: 400,
                lineHeight: '22px',
                letterSpacing: '0px',
              }}
            >
              Drag the three qualities that matter most to you into the box below. If there are qualities you'd rather avoid, feel free to drop those into the Avoid box. Can't find what you're looking for? Just type it in the message box at the bottom.
            </p>
          </div>

          {/* Available trait pool */}
          <div
            className="mt-6 flex flex-wrap gap-2 rounded-2xl p-2 transition-colors"
            onDragOver={(e) => handleDragOver(e, 'available')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'available')}
            style={{
              background: dragOverZone === 'available' ? 'var(--color-bg-hover)' : 'transparent',
              minHeight: 48,
            }}
          >
            {available.map(t => renderChip(t, 'available'))}
          </div>

          {/* Drop zones */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Most Important */}
            <div
              onDragOver={(e) => handleDragOver(e, 'important')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'important')}
              className="rounded-2xl p-4 transition-all"
              style={dropZoneStyle('important')}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-text-primary"
                  style={{
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: '22px',
                  }}
                >
                  Most Important to You
                </p>
                <span
                  className="text-text-primary"
                  style={{
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: 14,
                  }}
                >
                  {important.length}/3
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {important.map(t => renderChip(t, 'important', true))}
              </div>
            </div>

            {/* Avoid */}
            <div
              onDragOver={(e) => handleDragOver(e, 'avoid')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'avoid')}
              className="rounded-2xl p-4 transition-all"
              style={dropZoneStyle('avoid')}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-text-primary"
                  style={{
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: '22px',
                  }}
                >
                  Avoid
                </p>
                <span
                  className="text-text-primary"
                  style={{
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: 14,
                  }}
                >
                  Optional
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {avoid.map(t => renderChip(t, 'avoid', true))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom: ChatInput — voice mode replaced with up-arrow send button */}
      <div className="px-4 pb-[40px] shrink-0">
        <div className="max-w-[863px] mx-auto">
          <ChatInput
            onSend={handleChatSend}
            chatOnly
            voiceAsSend
            forceSendActive={canProceed}
          />
        </div>
      </div>
    </div>
  );
}
