import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import ChatInput from './ChatInput';
import { Tag } from './shared';

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

type Zone = 'available' | 'important';

export default function Onboarding({ onComplete, sidebarOpen, onToggleSidebar }: OnboardingProps) {
  const [available, setAvailable] = useState<string[]>(INITIAL_TRAITS);
  const [important, setImportant] = useState<string[]>([]);
  const [dragOverZone, setDragOverZone] = useState<Zone | null>(null);

  const moveTrait = useCallback(
    (trait: string, from: Zone, to: Zone) => {
      if (from === to) return;
      if (to === 'important' && important.length >= 3) return;

      const remove = (list: string[]) => list.filter(t => t !== trait);
      const add = (list: string[]) => (list.includes(trait) ? list : [...list, trait]);

      if (from === 'available') setAvailable(remove);
      if (from === 'important') setImportant(remove);

      if (to === 'available') setAvailable(add);
      if (to === 'important') setImportant(add);
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

  const handleChipClick = (trait: string, from: Zone) => {
    if (from === 'available') {
      moveTrait(trait, 'available', 'important');
    } else {
      moveTrait(trait, 'important', 'available');
    }
  };

  const canProceed = important.length === 3;

  const handleChatSend = (text: string) => {
    const trimmed = text.trim();
    if (!canProceed && !trimmed) return;
    onComplete(important, [], trimmed || undefined);
  };

  const renderChip = (trait: string, from: Zone, removable = false) => {
    const inZone = from === 'important';
    return (
      <div
        key={`${from}-${trait}`}
        draggable
        onDragStart={(e) => handleDragStart(e, trait, from)}
        onClick={() => handleChipClick(trait, from)}
        className={`flex items-center gap-1 px-3 py-1 rounded-full border border-stroke-outline text-base leading-[22px] tracking-[-0.43px] transition-all cursor-grab active:cursor-grabbing select-none ${
          inZone
            ? 'bg-[var(--color-selected-bg)] text-[var(--color-selected-text)] border-transparent'
            : 'text-text-primary chip-gradient-hover'
        }`}
      >
        <span>{trait}</span>
        {removable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleChipClick(trait, from); }}
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
      <div className="flex-1 overflow-y-auto min-h-0 px-8 py-4">
        <div className="max-w-[863px] mx-auto">
          {/* Page title — matches design system Page Title: 40px/48px/700 */}
          <h1 className="text-[40px] font-bold leading-[48px] tracking-[-0.5px] text-text-primary">
            Welcome to WorkPal
          </h1>

          {/* Scenario question — Body/Emphasized: 16px/32px/700/-0.43px */}
          <p className="text-base font-bold leading-[32px] tracking-[-0.43px] text-text-primary mt-6">
            Think about the teammates you've admired most in your career — what qualities inspired you the most?
          </p>

          {/* Subtitle — Body/Regular: 16px/32px/400/-0.43px */}
          <p className="text-base leading-[32px] tracking-[-0.43px] text-text-primary mt-3">
            All qualities help shape your agent. Pick your <strong>top 3</strong> for extra weight — or describe what matters in your own words.
          </p>

          {/* Drop zone header */}
          <div className="mt-8 flex items-center gap-3">
            <p className="text-base font-bold leading-[32px] tracking-[-0.43px] text-text-primary">
              Extra Weight — Your Top 3
            </p>
            <Tag>{important.length}/3</Tag>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => handleDragOver(e, 'important')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'important')}
            className="mt-3 rounded-2xl p-5 transition-all"
            style={{
              border: `1px ${dragOverZone === 'important' ? 'solid' : 'dashed'} var(--color-stroke-outline)`,
              background: dragOverZone === 'important' ? 'var(--color-bg-hover)' : 'transparent',
              minHeight: 64,
            }}
          >
            {important.length === 0 ? (
              <p className="text-base text-text-tertiary text-center">
                Click or drag qualities here...
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {important.map(t => renderChip(t, 'important', true))}
              </div>
            )}
          </div>

          {/* Available traits */}
          <div
            className="mt-6 flex flex-wrap gap-2 transition-colors"
            onDragOver={(e) => handleDragOver(e, 'available')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'available')}
          >
            {available.map(t => renderChip(t, 'available'))}
          </div>

        </div>
      </div>

      {/* Bottom: ChatInput */}
      <div className="px-4 pb-[40px] shrink-0">
        <div className="max-w-[863px] mx-auto">
          <ChatInput
            onSend={handleChatSend}
            chatOnly
            voiceAsSend
            forceSendActive={canProceed}
            placeholder={canProceed ? 'Want to add anything in your own words? Or just hit send' : 'Describe what matters in your own words'}
          />
        </div>
      </div>
    </div>
  );
}
