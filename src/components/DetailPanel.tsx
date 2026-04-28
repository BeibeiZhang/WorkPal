import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, FolderOpen, FileQuestion } from 'lucide-react';
import { iconShorter, iconExtend, iconFormal, iconTranslate } from '../assets';
import { SidePanelHeader } from './shared';
import { streamEditArticle, postRevealInFinder, postOpenFile, type EditPreset } from '../lib/api';
import { renderMarkdownBlocks } from '../lib/markdown';
import { useIsMobile } from '../lib/useIsMobile';

interface DetailPanelProps {
  title: string;
  content: string;
  onClose: () => void;
  fullScreen?: boolean;
  /** Phase 7 #2: when true, the AI edit popover is available. Only prose cards
   *  (research summary / meeting minutes) are editable — ticket / schedule /
   *  the demo fallback opt out because their data is structured, not prose. */
  editable?: boolean;
  /** Phase 7 #2: called with the current displayed text when the panel
   *  unmounts (e.g. user closes it, or it remounts across viewport flips).
   *  Writes the latest text back to the owning message's card in chat state.
   *  Absent = card is not persistable (e.g. demo fallback). */
  onSave?: (newText: string) => void;
  /** 6.4: how to render `content`. 'markdown' (default) runs it through the
   *  markdown block renderer — the old research/meeting case. 'html' renders
   *  it inside a sandboxed iframe via srcdoc — used when an ArtifactCard
   *  previews an AI-generated .html file. 'plaintext' wraps in <pre> for
   *  .txt / unknown types. */
  renderAs?: 'markdown' | 'html' | 'plaintext';
  /** Called during a left-edge drag with the clamped new width in px. Absent
   *  = panel is non-resizable (also true in `fullScreen` overlay mode). */
  onResize?: (newWidth: number) => void;
  /** §23: absolute file path of the previewed artifact. When present, the
   *  header gains a Finder-reveal button (hidden on mobile per graceful
   *  degrade). Also used by `mode: 'unsupported'` placeholder body for the
   *  Reveal / Open-with-default actions. */
  filePath?: string;
  /** §23: 'preview' (default) renders `content` in the chosen `renderAs`;
   *  'unsupported' replaces the body with a "Cannot preview this file type"
   *  placeholder + Reveal in Finder / Open with default app buttons. */
  mode?: 'preview' | 'unsupported';
}

const RESIZE_MIN_PX = 400;
const RESIZE_MAX_PX = 960;
const RESIZE_MAX_VW = 0.6;

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
  renderAs = 'markdown',
  onResize,
  filePath,
  mode = 'preview',
}: DetailPanelProps) {
  const isMobile = useIsMobile();
  const showRevealButton = !!filePath && !isMobile;
  const panelRef = useRef<HTMLDivElement>(null);
  const startResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (fullScreen || !onResize) return;
    e.preventDefault();
    // Drag directly against the SplitView wrapper's inline width via DOM — no
    // React re-renders during the drag, so iframe content / chat column don't
    // reflow per mousemove. We commit the final width to state only on mouseup
    // so the React tree ends up consistent for future renders.
    const wrapper = panelRef.current?.parentElement;
    if (!wrapper) return;
    const startX = e.clientX;
    const startWidth = wrapper.getBoundingClientRect().width;
    const maxW = Math.min(RESIZE_MAX_PX, window.innerWidth * RESIZE_MAX_VW);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    let latest = startWidth;
    const onMove = (ev: MouseEvent) => {
      // Panel is on the right edge — dragging the handle LEFT increases width.
      latest = Math.min(maxW, Math.max(RESIZE_MIN_PX, startWidth + (startX - ev.clientX)));
      wrapper.style.width = `${latest}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Single commit — React tree syncs to whatever the DOM ended at.
      if (latest !== startWidth) onResize(latest);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [fullScreen, onResize]);
  // Kept separate from the `content` prop so a parent re-render doesn't wipe
  // in-flight edits (see PR #87).
  const [displayContent, setDisplayContent] = useState(content);
  // Pre-edit snapshot for one-level Undo. Null = nothing to undo.
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ kind: 'idle' });
  // Whether the AI-edit popover is expanded. Default hidden — opens on FAB
  // click or when the user text-selects inside the article.
  const [isEditOpen, setIsEditOpen] = useState(false);

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

  const hasUnsaved = displayContent !== content;
  const canUndo = previousContent !== null && editState.kind === 'idle';
  const isStreaming = editState.kind === 'streaming';

  // Auto-commit on unmount so edits survive the panel closing AND unexpected
  // remounts (e.g. SplitView flipping between inline/overlay on viewport
  // resize). A latest-ref dodges stale-closure issues in the empty-deps
  // cleanup, and the identity check avoids writing when nothing changed.
  const latestRef = useRef({ displayContent, content, onSave });
  latestRef.current = { displayContent, content, onSave };
  useEffect(() => {
    return () => {
      const { displayContent: latest, content: original, onSave: save } = latestRef.current;
      if (save && latest !== original) save(latest);
    };
  }, []);

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

  const dismissError = useCallback(() => {
    if (editState.kind === 'error') setEditState({ kind: 'idle' });
  }, [editState.kind]);

  // Native text-selection inside the article opens the popover, mirroring
  // Notion / Gmail selection toolbars. Fires on mouseup (post drag-selection).
  useEffect(() => {
    if (!editable) return;
    const handler = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || !sel?.anchorNode) return;
      if (contentAreaRef.current?.contains(sel.anchorNode)) {
        setIsEditOpen(true);
      }
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [editable]);

  // Click-outside closes the popover. Streaming is protected — a stray click
  // mid-edit shouldn't dismiss the UI showing progress + Cancel.
  useEffect(() => {
    if (!isEditOpen) return;
    const handler = (e: MouseEvent) => {
      if (editState.kind === 'streaming') return;
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setIsEditOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditOpen, editState.kind]);

  return (
    <div
      ref={panelRef}
      className={`flex flex-col h-full shrink-0 relative ${fullScreen ? 'w-[504px] max-w-full' : 'w-full'}`}
      style={{ background: 'var(--color-bg-page)' }}
    >
      {/* Vertical divider on the left edge — solid through the middle with
          short fades at top/bottom, matching the `.side-card-divider` pattern
          used between stacked side-card rows. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, var(--color-stroke-outline) 20%, var(--color-stroke-outline) 80%, transparent 100%)',
        }}
      />
      {/* Resize hit-zone overlaid on the left edge. 6px wide, transparent —
          the visible 1px divider above stays as the only visual cue. Hidden
          in fullScreen overlay mode (no room to resize anyway). */}
      {!fullScreen && onResize && (
        <div
          aria-hidden
          onMouseDown={startResize}
          className="absolute inset-y-0 left-0 w-[6px] z-10 cursor-col-resize"
        />
      )}
      {/* Unsaved dot hints that edits will be committed on close. */}
      <SidePanelHeader
        title={hasUnsaved ? `${title} ●` : title}
        onClose={onClose}
        className="pl-10 pr-[32px]"
      >
        {showRevealButton && (
          <button
            onClick={() => { void postRevealInFinder(filePath!); }}
            aria-label="Reveal in Finder"
            title="Reveal in Finder"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors shrink-0 text-text-primary"
          >
            <FolderOpen size={20} />
          </button>
        )}
      </SidePanelHeader>

      <div
        ref={contentAreaRef}
        className={`flex-1 overflow-y-auto relative ${mode === 'unsupported' || renderAs !== 'html' ? 'pl-10 pr-[32px]' : ''}`}
      >
        {mode === 'unsupported' ? (
          // §23: client-side binary preflight (or read-file failure) lands
          // here — the file exists but we can't render its bytes inline.
          // Two-button escape: Reveal pops Finder, Open hands off to the
          // registered default app.
          <div className="flex flex-col items-center justify-center text-center pt-16 pb-24 gap-4">
            <FileQuestion size={48} className="text-text-tertiary" strokeWidth={1.2} />
            <p className="type-h2 text-text-primary">Cannot preview this file type</p>
            <p className="type-detail text-text-secondary max-w-[320px]">
              WorkPal can only preview text-based files inline. Use Finder or the default app to open this one.
            </p>
            {filePath && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {!isMobile && (
                  <button
                    onClick={() => { void postRevealInFinder(filePath); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors type-detail-emphasized text-text-primary"
                  >
                    <FolderOpen size={16} />
                    Reveal in Finder
                  </button>
                )}
                <button
                  onClick={() => { void postOpenFile(filePath); }}
                  className="px-4 py-2 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors type-detail-emphasized text-text-primary"
                >
                  Open with default app
                </button>
              </div>
            )}
          </div>
        ) : renderAs === 'html' ? (
          // 6.4: sandbox=" " (empty tokens) denies everything — no same-origin,
          // no scripts, no forms. Enough to show HTML layout + CSS for a
          // preview without letting a malicious artifact exfiltrate data or
          // script into the parent window.
          <iframe
            title={title}
            srcDoc={displayContent}
            sandbox=""
            className="w-full h-full border-0"
            style={{ background: 'var(--color-bg-page)' }}
          />
        ) : renderAs === 'plaintext' ? (
          <pre className="relative type-detail text-text-primary pt-4 pb-24 whitespace-pre-wrap font-mono">
            {displayContent}
          </pre>
        ) : (
          <div className="relative type-h2 text-text-primary pt-4 pb-24">
            {renderMarkdownBlocks(displayContent)}
          </div>
        )}
      </div>

      {editable && (
        <>
          {/* Floating action button — opens the preset popover. Parked at the
              panel's bottom-right (not inside the scroll container) so it
              stays visible while the article scrolls. */}
          <button
            ref={fabRef}
            type="button"
            onClick={() => setIsEditOpen(v => !v)}
            aria-label="AI edit"
            aria-expanded={isEditOpen}
            className="absolute bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center border border-stroke-outline hover:bg-bg-hover transition-colors z-20 text-text-primary"
            style={{
              background: 'var(--color-bg-page)',
              boxShadow: '0px 5px 15px 0px rgba(1, 44, 197, 0.2)',
            }}
          >
            <Pencil size={20} />
          </button>

          {isEditOpen && (
            <div
              ref={popoverRef}
              className="absolute bottom-24 right-6 w-[440px] max-w-[calc(100%-48px)] flex flex-col gap-1 p-4 rounded-[20px] border border-stroke-outline z-10"
              style={{
                background: 'var(--color-bg-page)',
                boxShadow: '0px 5px 15px 0px rgba(1, 44, 197, 0.2)',
              }}
            >
              {/* Status row — error or streaming feedback, rendered above the
                  preset list so users see what's happening without scrolling. */}
              {editState.kind === 'error' && (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg type-detail text-error"
                  style={{
                    background: 'rgba(220, 38, 38, 0.08)',
                  }}
                >
                  <span className="flex-1 leading-snug">{editState.message}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => runEdit(editState.preset)}
                      className="type-detail-emphasized px-2 py-1 rounded hover:bg-white/40 transition-colors"
                    >
                      Retry
                    </button>
                    <button
                      onClick={dismissError}
                      className="type-detail px-2 py-1 rounded hover:bg-white/40 transition-colors"
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {isStreaming && (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg type-detail"
                  style={{ background: 'var(--color-bg-message)' }}
                >
                  <span className="text-text-secondary">
                    Rewriting ({editState.preset})…
                  </span>
                  <button
                    onClick={handleCancel}
                    className="type-detail-emphasized px-3 py-1 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors text-text-primary"
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
                    <span className="type-h2 text-text-primary">{opt.label}</span>
                  </button>
                );
              })}

              {canUndo && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleUndo}
                    className="type-detail-emphasized px-3 py-1.5 rounded-full border border-stroke-outline hover:bg-bg-hover transition-colors text-text-primary"
                  >
                    ↶ Undo
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
