import { useCallback, useState } from 'react';
import ChatInput from './ChatInput';
import { Chip, Tag, PageLayout } from './shared';

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

  // Placeholder narrates progress so the input nudges the user through the
  // 0→3 selection flow without a separate helper label.
  const inputPlaceholder = (() => {
    const n = important.length;
    if (n === 0) return 'Type your own words here...';
    if (n === 3) return 'Anything else to add? Or hit send \u2191.';
    const remaining = 3 - n;
    return `${remaining} more to pick-or add your own words here.`;
  })();

  const handleChatSend = (text: string) => {
    const trimmed = text.trim();
    if (!canProceed && !trimmed) return;
    onComplete(important, [], trimmed || undefined);
  };

  const renderChip = (trait: string, from: Zone, removable = false) => {
    const inZone = from === 'important';
    return (
      <Chip
        key={`${from}-${trait}`}
        label={trait}
        active={inZone}
        draggable
        onDragStart={(e) => handleDragStart(e, trait, from)}
        onClick={() => handleChipClick(trait, from)}
        onRemove={removable ? () => handleChipClick(trait, from) : undefined}
      />
    );
  };

  return (
    <PageLayout
      title="Welcome to WorkPal"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      bgClass="app-bg"
      footer={
        <ChatInput
          onSend={handleChatSend}
          forceSendActive={canProceed}
          placeholder={inputPlaceholder}
        />
      }
    >
      {/* Scenario question — H2 / Regular (see .type-h2 in index.css) */}
      <p className="type-h2 text-text-primary">
        Think about the teammates you've admired most in your career — what qualities inspired you the most?
      </p>

      {/* Drop zone header */}
      <div className="mt-8 flex items-center gap-3">
        <p className="type-h2 text-text-primary">
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
          <p className="type-h2 text-text-tertiary text-center">
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

      {/* Helper detail text — .type-detail (14/22/400) */}
      <p className="mt-4 type-detail text-text-primary">
        All qualities help shape your agent — your top 3 just carry extra weight. Can't find the right word? Describe it in your own words below.
      </p>
    </PageLayout>
  );
}
