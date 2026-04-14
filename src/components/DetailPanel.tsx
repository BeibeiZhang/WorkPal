import { useState } from 'react';
import { iconShorter, iconExtend, iconFormal, iconTranslate } from '../assets';
import { SidePanelHeader } from './shared';

interface DetailPanelProps {
  title: string;
  content: string;
  onClose: () => void;
  fullScreen?: boolean;
}

const AI_OPTIONS = [
  { icon: iconShorter, label: 'Shorter' },
  { icon: iconExtend, label: 'Extend' },
  { icon: iconFormal, label: 'Formal' },
  { icon: iconTranslate, label: 'Translate' },
];

export default function DetailPanel({ title, content, onClose, fullScreen = false }: DetailPanelProps) {
  const [optionsOpen, setOptionsOpen] = useState(true);

  return (
    <div
      className={`flex flex-col h-full shrink-0 relative w-[504px] max-w-full ${fullScreen ? '' : ''}`}
      style={{
        background: 'var(--color-bg-page)',
        boxShadow: '0px 4px 50px 0px var(--color-stroke-outline)',
      }}
    >
      {/* Header */}
      <SidePanelHeader title={title} onClose={onClose} className="pl-10 pr-[32px]" />

      {/* Document content */}
      <div className="flex-1 overflow-y-auto pl-10 pr-[32px] relative">
        {/* Highlighted text indicator */}
        <div
          className="absolute left-8 right-8 top-3 h-[248px] rounded"
          style={{ background: 'rgba(49, 113, 255, 0.1)' }}
        />

        <div className="relative text-base leading-[22px] text-text-primary pt-4 pb-4">
          {content.split('\n\n').map((paragraph, i) => {
            // Check for bold header pattern
            const boldMatch = paragraph.match(/^\*\*(.+?)\*\*\n?([\s\S]*)$/);
            if (boldMatch) {
              return (
                <div key={i} className="mb-4">
                  <p className="font-bold">{boldMatch[1]}</p>
                  {boldMatch[2] && <p>{boldMatch[2]}</p>}
                </div>
              );
            }

            // Check for bullet list
            if (paragraph.startsWith('• ')) {
              const items = paragraph.split('\n').filter(Boolean);
              return (
                <ul key={i} className="list-disc ml-5 mb-4 space-y-4">
                  {items.map((item, j) => {
                    const text = item.replace(/^• /, '');
                    const parts = text.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <li key={j}>
                        {parts.map((part, k) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <span key={k} className="font-bold">{part.slice(2, -2)}</span>;
                          }
                          return <span key={k}>{part}</span>;
                        })}
                      </li>
                    );
                  })}
                </ul>
              );
            }

            return <p key={i} className="mb-4">{paragraph}</p>;
          })}
        </div>

        {/* Options popover */}
        {optionsOpen && (
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[220px] w-[440px] max-w-[calc(100%-32px)] flex flex-col gap-1 p-4 rounded-[20px] border border-stroke-outline z-10"
            style={{
              background: 'var(--color-bg-page)',
              boxShadow: '0px 5px 15px 0px rgba(1, 44, 197, 0.2)',
            }}
          >
            {/* Input field */}
            <div
              className="flex items-center p-4 rounded-lg w-full"
              style={{ background: 'var(--color-bg-message)' }}
            >
              <p className="text-base leading-[22px]" style={{ color: 'var(--color-text-secondary)' }}>
                Message WorkPal with your edits.
              </p>
            </div>

            {/* Action items */}
            {AI_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setOptionsOpen(false)}
                className="flex items-center gap-4 p-4 h-14 w-full rounded hover:bg-bg-hover transition-colors text-left"
              >
                <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                  <img src={opt.icon} alt="" className="max-w-full max-h-full object-contain icon-theme" />
                </div>
                <span className="text-base leading-[22px] text-text-primary">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
