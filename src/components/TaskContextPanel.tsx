import { useState, useEffect } from 'react';
import { ChevronDown, FileText, Code, StickyNote, Link2, Check, X } from 'lucide-react';
import { iconAsana } from '../assets';

interface TaskStep {
  label: string;
  done: boolean;
}

/** Map user message keywords to simulated progress steps */
function generateSteps(userMessage: string): TaskStep[] {
  const msg = userMessage.toLowerCase();

  if (msg.includes('compliance') || msg.includes('checklist')) {
    return [
      { label: 'Retrieve compliance checklist from Asana', done: false },
      { label: 'Cross-reference regulatory requirements', done: false },
      { label: 'Compile review summary', done: false },
    ];
  }
  if (msg.includes('report') || msg.includes('metric')) {
    return [
      { label: 'Gather data from connected sources', done: false },
      { label: 'Analyze key metrics and trends', done: false },
      { label: 'Generate report draft', done: false },
      { label: 'Format and finalize output', done: false },
    ];
  }
  if (msg.includes('meeting') || msg.includes('schedule')) {
    return [
      { label: 'Check calendar availability', done: false },
      { label: 'Draft meeting agenda', done: false },
      { label: 'Send invites to attendees', done: false },
    ];
  }
  if (msg.includes('design') || msg.includes('figma') || msg.includes('review')) {
    return [
      { label: 'Fetch Figma design files', done: false },
      { label: 'Identify key screens and components', done: false },
      { label: 'Compile review notes', done: false },
    ];
  }
  // Default generic steps
  return [
    { label: 'Analyzing your request', done: false },
    { label: 'Gathering relevant context', done: false },
    { label: 'Processing and generating response', done: false },
  ];
}

interface TaskContextPanelProps {
  userMessage: string;
  onClose?: () => void;
  fullscreen?: boolean;
}

export default function TaskContextPanel({ userMessage, onClose, fullscreen }: TaskContextPanelProps) {
  const [steps, setSteps] = useState<TaskStep[]>(() => generateSteps(userMessage));
  const [progressOpen, setProgressOpen] = useState(true);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  // Re-generate steps when userMessage changes
  useEffect(() => {
    setSteps(generateSteps(userMessage));
  }, [userMessage]);

  // Auto-complete steps one by one
  useEffect(() => {
    const firstIncomplete = steps.findIndex(s => !s.done);
    if (firstIncomplete === -1) return;

    const delay = 1500 + Math.random() * 1000;
    const timer = setTimeout(() => {
      setSteps(prev => prev.map((s, i) => i === firstIncomplete ? { ...s, done: true } : s));
    }, delay);

    return () => clearTimeout(timer);
  }, [steps]);

  const completedCount = steps.filter(s => s.done).length;

  return (
    <div
      className={`flex flex-col h-full overflow-y-auto ${
        fullscreen
          ? 'w-full'
          : 'shrink-0 min-w-[260px] w-[280px] border-l border-stroke-outline'
      }`}
      style={{ background: 'var(--color-bg-page)' }}
    >
      {/* Close header */}
      {onClose && (
        <div className="flex items-center justify-between px-5 pt-4 pb-0 shrink-0">
          <h3
            className="text-text-primary font-bold text-[17px] leading-[22px] tracking-[-0.43px]"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            Task Context
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Progress Section */}
      <div className="px-5 pt-5 pb-4">
        <button
          onClick={() => setProgressOpen(!progressOpen)}
          className="flex items-center justify-between w-full"
        >
          <h3
            className="text-text-primary font-bold text-[15px] leading-[20px] tracking-[-0.3px]"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            Progress
          </h3>
          <ChevronDown
            className={`w-4 h-4 text-text-secondary transition-transform ${progressOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {progressOpen && (
          <div className="mt-4 flex flex-col gap-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                {/* Step indicator */}
                {step.done ? (
                  <div
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
                    style={{ background: '#3171FF' }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border-2"
                    style={{ borderColor: 'var(--color-stroke-outline)' }}
                  >
                    <span className="text-xs font-medium text-text-secondary">{i + 1}</span>
                  </div>
                )}
                {/* Step label */}
                <span
                  className={`text-sm leading-[22px] ${
                    step.done
                      ? 'line-through text-text-tertiary'
                      : 'text-text-primary'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}

            {/* Summary */}
            <p className="text-xs text-text-secondary mt-1">
              {completedCount} of {steps.length} completed
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-stroke-outline" />

      {/* WorkPal Section */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--color-bg-hover)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" className="text-text-secondary" />
              <path d="M3.5 6L5.5 8L8.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" />
            </svg>
          </div>
          <h3
            className="text-text-primary font-bold text-[15px] leading-[20px] tracking-[-0.3px]"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            WorkPal
          </h3>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors cursor-pointer">
            <FileText className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="text-sm text-text-primary truncate">Instructions · CLAUDE.md</span>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors cursor-pointer">
            <Code className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="text-sm text-text-primary truncate">WorkPal.html</span>
          </div>

          <button
            onClick={() => setScratchpadOpen(!scratchpadOpen)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors w-full text-left"
          >
            {scratchpadOpen ? (
              <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-secondary shrink-0 -rotate-90" />
            )}
            <StickyNote className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="text-sm text-text-primary">Scratchpad</span>
          </button>

          {scratchpadOpen && (
            <div className="ml-9 px-2 py-2">
              <textarea
                className="w-full h-20 text-sm text-text-primary rounded-md border border-stroke-outline p-2 resize-none focus:outline-none focus:border-[#7652B9]"
                style={{ background: 'var(--color-bg-hover)' }}
                placeholder="Quick notes..."
              />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-stroke-outline" />

      {/* Context Section */}
      <div className="px-5 py-4">
        <h3
          className="text-text-primary font-bold text-[15px] leading-[20px] tracking-[-0.3px] mb-3"
          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          Context
        </h3>

        <p className="text-xs text-text-secondary uppercase tracking-wider mb-2 px-2">
          Connectors
        </p>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <path d="M5.333 16A2.667 2.667 0 0 0 8 13.333v-2.666H5.333a2.667 2.667 0 0 0 0 5.333Z" fill="#0ACF83" />
              <path d="M2.667 8A2.667 2.667 0 0 1 5.333 5.333H8v5.334H5.333A2.667 2.667 0 0 1 2.667 8Z" fill="#A259FF" />
              <path d="M2.667 2.667A2.667 2.667 0 0 1 5.333 0H8v5.333H5.333a2.667 2.667 0 0 1-2.666-2.666Z" fill="#F24E1E" />
              <path d="M8 0h2.667a2.667 2.667 0 0 1 0 5.333H8V0Z" fill="#FF7262" />
              <path d="M13.333 8A2.667 2.667 0 0 1 8 8a2.667 2.667 0 0 1 5.333 0Z" fill="#1ABCFE" />
            </svg>
            <span className="text-sm text-text-primary">Figma</span>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors cursor-pointer">
            <img src={iconAsana} alt="" className="w-4 h-4 object-contain icon-theme shrink-0" />
            <span className="text-sm text-text-primary">Asana</span>
          </div>

          <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors w-full text-left">
            <Link2 className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="text-sm text-text-secondary">Add connector...</span>
          </button>
        </div>
      </div>
    </div>
  );
}
