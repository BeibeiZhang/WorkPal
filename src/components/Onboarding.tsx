import { useState } from 'react';
import ChatInput from './ChatInput';

interface OnboardingProps {
  onComplete: (description: string, traits: string[]) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TRAIT_CHIPS = [
  '\u{1F6DF} Stable',
  '\u{1F9E0} Organized',
  '\u{1F917} Kind',
  '\u{1F9D8} Calm',
  '\u{1F331} Open-minded',
  '\u{1FAF6} People-first',
  '\u{1F60A} Always smiling',
  '\u{1F3AD} Has a sense of humor',
  '\u26A1Energetic',
  '\u2728 Minimal',
  '\u{1F454} Formal',
  '\u{1F648} Not sure yet',
];

export default function Onboarding({ onComplete, sidebarOpen, onToggleSidebar }: OnboardingProps) {
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);

  const toggleTrait = (trait: string) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
    );
  };

  const handleSend = (text: string) => {
    onComplete(text, selectedTraits);
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
              <rect width="22" height="2" rx="1" fill="currentColor"/>
              <rect width="15" height="2" rx="1" y="7" fill="currentColor"/>
            </svg>
          </button>
        )}
        <div className="flex-1" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
        <div className="max-w-[863px] mx-auto">
          {/* Title — 40px bold, left-aligned, NOT gradient */}
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

          {/* Description — two paragraphs */}
          <div className="mt-6 flex flex-col gap-4">
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
              Select the traits that matter to you, and we'll build your ideal partner.
            </p>
          </div>

          {/* Trait chips — flex-wrap, gap 8px */}
          <div className="mt-6 flex flex-wrap gap-2">
            {TRAIT_CHIPS.map(chip => {
              const isSelected = selectedTraits.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleTrait(chip)}
                  className={`flex items-center gap-1 rounded-full transition-all cursor-pointer ${
                    isSelected ? '' : 'chip-gradient-hover'
                  }`}
                  style={{
                    padding: '4px 12px',
                    border: isSelected ? '1px solid transparent' : '1px solid var(--color-stroke-outline)',
                    background: isSelected ? 'var(--color-selected-bg)' : 'transparent',
                    color: isSelected ? 'var(--color-selected-text)' : 'var(--color-text-primary)',
                    fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: '22px',
                    letterSpacing: '0px',
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: ChatInput */}
      <div className="px-4 pb-[40px] shrink-0">
        <div className="max-w-[863px] mx-auto">
          <ChatInput onSend={handleSend} chatOnly />
        </div>
      </div>
    </div>
  );
}
