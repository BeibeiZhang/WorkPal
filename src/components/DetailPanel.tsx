import { useCallback, useEffect, useRef, useState } from 'react';
import { iconShorter, iconExtend, iconFormal, iconTranslate } from '../assets';
import { SidePanelHeader } from './shared';
import { streamEditArticle, type EditPreset } from '../lib/api';

interface DetailPanelProps {
  title: string;
  content: string;
  onClose: () => void;
  fullScreen?: boolean;
  /** Phase 7 #2: when true, the AI edit popover is shown. Only prose cards
   *  (research summary / meeting minutes) are editable — ticket / schedule /
   *  the demo fallback opt out because their data is structured, not prose. */
  editable?: boolean;
  /** Phase 7 #2: called when the user clicks "Save to card". Writes the
   *  current displayed text back to the owning message's card in chat state,
   *  so the card preview in the chat bubble reflects the edit immediately.
   *  Absent = card is not persistable (e.g. demo fallback) — Save button
   *  stays hidden in that case. */
  onSave?: (newText: string) => void;
}

const AI_OPTIONS: Array<{ icon: string; label: string; preset: EditPreset }> = [
  { icon: iconShorter, label: 'Shorter', preset: 'shorter' },
  { icon: iconExtend, label: 'Extend', preset: 'extend' },
  { icon: iconFormal, label: 'Formal', preset: 'formal' },
  { icon: iconTranslate, label: 'Translate', preset: 'translate' },
];

type EditState =
  | { kind: 'idle' }
  | { kind: 'streaming'; preset: EditPreset; controller: AbortController }
  | { kind: 'error'; preset: EditPreset; message: string };

export default function DetailPanel({
  title,
  content,
  onClose,
  fullScreen = false,
  editable = false,
  onSave,
}: DetailPanelProps) {
  // The text currently shown in the panel. Starts as the incoming content and
  // is replaced as the user applies AI edits. Kept separate from the prop so
  // a parent re-render doesn't wipe in-flight edits.
  const [displayContent, setDisplayContent] = useState(content);
  // The "clean" version the user has committed — either the original content,
  // or whatever they last clicked Save on. Drives the unsaved-dot indicator.
  const [savedBaseline, setSavedBaseline] = useState(content);
  // Pre-edit snapshot for one-level Undo. Null = nothing to undo (initial
  // state, after Undo, or after Save which "commits" and clears the buffer).
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ kind: 'idle' });
  // Transient "Saved ✓" flash on the Save button — cleared by a timer, or
  // immediately on unmount / next edit to avoid a dangling label.
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  // Clear the Saved timer on unmount so the setTimeout callback can't fire
  // into a stale closure (React StrictMode + fast panel close).
  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const hasUnsaved = displayContent !== savedBaseline;
  const canUndo = previousContent !== null && editState.kind === 'idle';
  const canSave = !!onSave && hasUnsaved && editState.kind === 'idle';
  const isStreaming = editState.kind === 'streaming';

  const runEdit = useCallback(
    async (preset: EditPreset) => {
      if (editState.kind === 'streaming') return;
      const controller = new AbortController();
      const snapshot = displayContent;
      setPreviousContent(snapshot);
      setEditState({ kind: 'streaming', preset, controller });

      let partial = '';
      let gotAnyText = false;
      let hadError: string | null = null;
      let cleanFinish = false;
      try {
        for await (const chunk of streamEditArticle(
          snapshot,
          preset,
          controller.signal,
        )) {
          if (chunk.type === 'text') {
            partial += chunk.content;
            gotAnyText = true;
            setDisplayContent(partial);
          } else if (chunk.type === 'done') {
            cleanFinish = true;
          } else if (chunk.type === 'error') {
            hadError = chunk.content;
          }
        }
      } catch (err) {
        // streamEditArticle swallows AbortError, so anything that lands here
        // is a genuine runtime failure — surface it like a server error.
        hadError = err instanceof Error ? err.message : 'Edit failed';
      }

      if (controller.signal.aborted) {
        // User cancelled — revert to the pre-edit snapshot. No Undo target
        // (nothing was committed), so clear previousContent.
        setDisplayContent(snapshot);
        setPreviousContent(null);
        setEditState({ kind: 'idle' });
        return;
      }

      if (hadError) {
        // Roll back any partial text so the user isn't left staring at half a
        // rewrite. `previousContent` stays null (no Undo after a failed edit).
        setDisplayContent(snapshot);
        setPreviousContent(null);
        setEditState({ kind: 'error', preset, message: hadError });
        return;
      }

      if (!gotAnyText || !cleanFinish) {
        // Stream closed without emitting any text and without a `done` marker
        // — treat as an error so the user gets Retry rather than a silent no-op.
        setDisplayContent(snapshot);
        setPreviousContent(null);
        setEditState({
          kind: 'error',
          preset,
          message: 'No response from the editor. Try again?',
        });
        return;
      }

      // Success: partial is now the full rewrite. Leave it as displayContent,
      // keep previousContent so Undo reverts to the pre-edit snapshot.
      setEditState({ kind: 'idle' });
    },
    [displayContent, editState.kind],
  );

  const handleCancel = useCallback(() => {
    if (editState.kind !== 'streaming') return;
    editState.controller.abort();
  }, [editState]);

  const handleUndo = useCallback(() => {
    if (previousContent === null) return;
    setDisplayContent(previousContent);
    setPreviousContent(null);
  }, [previousContent]);

  const handleSave = useCallback(() => {
    if (!onSave || !hasUnsaved) return;
    onSave(displayContent);
    setSavedBaseline(displayContent);
    setPreviousContent(null);
    setJustSaved(true);
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 1500);
  }, [onSave, displayContent, hasUnsaved]);

  const dismissError = useCallback(() => {
    if (editState.kind === 'error') setEditState({ kind: 'idle' });
  }, [editState.kind]);

  return (
    <div
      className={`flex flex-col h-full shrink-0 relative w-[504px] max-w-full ${fullScreen ? '' : ''}`}
      style={{
        background: 'var(--color-bg-page)',
        boxShadow: '0px 4px 50px 0px var(--color-stroke-outline)',
      }}
    >
      {/* Header — small unsaved dot appears after the title when there are
          uncommitted edits, mirroring the macOS document-modified indicator. */}
      <SidePanelHeader
        title={hasUnsaved ? `${title} ●` : title}
        onClose={onClose}
        className="pl-10 pr-[32px]"
      />

      {/* Document content */}
      <div className="flex-1 overflow-y-auto pl-10 pr-[32px] relative">
        {/* Highlighted text indicator — kept from the mockup for the demo
            fallback. It's a static visual cue, not interactive. */}
        <div
          className="absolute left-8 right-8 top-3 h-[248px] rounded"
          style={{ background: 'rgba(49, 113, 255, 0.1)' }}
        />

        <div className="relative text-base leading-[22px] text-text-primary pt-4 pb-4">
          {displayContent.split('\n\n').map((paragraph, i) => {
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

        {/* Options popover — only shown for editable cards. Ticket/schedule
            and the demo fallback open DetailPanel without this surface. */}
        {editable && (
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[220px] w-[440px] max-w-[calc(100%-32px)] flex flex-col gap-1 p-4 rounded-[20px] border border-stroke-outline z-10"
            style={{
              background: 'var(--color-bg-page)',
              boxShadow: '0px 5px 15px 0px rgba(1, 44, 197, 0.2)',
            }}
          >
            {/* Status row — error or streaming feedback, rendered above the
                preset list so users see what's happening without scrolling. */}
            {editState.kind === 'error' && (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm"
                style={{
                  background: 'rgba(220, 38, 38, 0.08)',
                  color: '#B91C1C',
                }}
              >
                <span className="flex-1 leading-snug">{editState.message}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runEdit(editState.preset)}
                    className="text-xs font-medium px-2 py-1 rounded hover:bg-white/40 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={dismissError}
                    className="text-xs px-2 py-1 rounded hover:bg-white/40 transition-colors"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {isStreaming && (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'var(--color-bg-message)' }}
              >
                <span className="text-text-secondary">
                  Rewriting ({editState.preset})…
                </span>
                <button
                  onClick={handleCancel}
                  className="text-xs font-medium px-3 py-1 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors text-text-primary"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Action items — 4 preset buttons, disabled while a stream is in
                flight so the user can't stack edits. */}
            {AI_OPTIONS.map(opt => {
              const disabled = isStreaming;
              return (
                <button
                  key={opt.label}
                  onClick={() => runEdit(opt.preset)}
                  disabled={disabled}
                  className={`flex items-center gap-4 p-4 h-14 w-full rounded text-left transition-colors ${
                    disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-bg-hover'
                  }`}
                >
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    <img src={opt.icon} alt="" className="max-w-full max-h-full object-contain icon-theme" />
                  </div>
                  <span className="text-base leading-[22px] text-text-primary">{opt.label}</span>
                </button>
              );
            })}

            {/* Undo + Save row — appears only when the user has something to
                undo or save. Hidden entirely in the clean-baseline state to
                match the subtract-first principle. */}
            {(canUndo || canSave || justSaved) && (
              <div className="flex items-center gap-2 pt-1">
                {canUndo && (
                  <button
                    onClick={handleUndo}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors text-text-primary"
                  >
                    ↶ Undo
                  </button>
                )}
                {canSave && !justSaved && (
                  <button
                    onClick={handleSave}
                    className="text-xs font-medium px-3 py-1.5 rounded-full gradient-btn text-white hover:opacity-90 transition-opacity"
                  >
                    Save to card
                  </button>
                )}
                {justSaved && (
                  <span
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(2,137,1,0.1)', color: '#028901' }}
                  >
                    Saved ✓
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
