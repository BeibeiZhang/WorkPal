import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PrimaryButton, TertiaryButton } from './shared';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  /** `description` is the third arg so existing callers keep working;
   *  `folder` is only passed through for the `promote` mode. */
  onCreate: (name: string, description: string, folder?: string) => void;
  /** 'create' (default): blank "New Project" dialog triggered from the
   *  sidebar's "New Project" button. 'promote': pre-filled from a session
   *  that's being upgraded into a project — the header, CTA, and fields
   *  adapt to that context. */
  mode?: 'create' | 'promote';
  /** Pre-fill for the name field. In promote mode this is the session title. */
  suggestedName?: string;
  /** Pre-fill for the folder field (promote mode only). */
  suggestedFolder?: string;
}

export default function NewProjectDialog({
  open,
  onClose,
  onCreate,
  mode = 'create',
  suggestedName,
  suggestedFolder,
}: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(suggestedName ?? '');
      setDescription('');
      setFolder(suggestedFolder ?? '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, suggestedName, suggestedFolder]);

  if (!open) return null;

  const canCreate = name.trim().length > 0;
  const isPromote = mode === 'promote';

  const handleCreate = () => {
    if (canCreate) {
      onCreate(name.trim(), description.trim(), folder.trim() || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) {
      handleCreate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div
        className="panel-border relative w-[480px] max-w-[90vw] rounded-[8px] p-8 shadow-2xl"
        style={{ background: 'var(--color-bg-page)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-hover transition-colors"
        >
          <X size={18} className="text-text-primary" />
        </button>

        {/* Header */}
        <h2
          className="text-[22px] font-bold text-text-primary tracking-[-0.43px] mb-2"
          style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          {isPromote ? 'Promote to Project' : 'New Project'}
        </h2>
        {isPromote && (
          <p className="text-[13px] text-text-secondary mb-6 leading-[18px]">
            Turn this session into a project — future sessions can share its folder and context.
          </p>
        )}
        {!isPromote && <div className="mb-4" />}

        {/* Project Name */}
        <div className="mb-5">
          <label
            className="block text-[14px] font-medium text-text-primary mb-2 tracking-[-0.2px]"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            Project name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Q2 Design Sprint"
            className="w-full px-4 py-3 rounded-[4px] text-[16px] leading-[22px] text-text-primary placeholder-text-tertiary outline-none transition-colors"
            style={{
              background: 'var(--color-bg-hover)',
              fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            }}
          />
        </div>

        {/* Description */}
        <div className={isPromote ? 'mb-5' : 'mb-8'}>
          <label
            className="block text-[14px] font-medium text-text-primary mb-2 tracking-[-0.2px]"
            style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            Description
            <span className="text-text-tertiary font-normal ml-1">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder="What's this project about?"
            rows={3}
            className="w-full px-4 py-3 rounded-[4px] text-[16px] leading-[22px] text-text-primary placeholder-text-tertiary outline-none resize-none transition-colors"
            style={{
              background: 'var(--color-bg-hover)',
              fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            }}
          />
        </div>

        {/* Folder (promote mode only) — cosmetic path, not validated or mkdir'd */}
        {isPromote && (
          <div className="mb-8">
            <label
              className="block text-[14px] font-medium text-text-primary mb-2 tracking-[-0.2px]"
              style={{ fontFamily: 'SF Pro, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
            >
              Folder
              <span className="text-text-tertiary font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={folder}
              onChange={e => setFolder(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="~/WorkPal/my-project/"
              className="w-full px-4 py-3 rounded-[4px] font-mono text-[14px] leading-[22px] text-text-primary placeholder-text-tertiary outline-none transition-colors"
              style={{
                background: 'var(--color-bg-hover)',
                }}
            />
            <p className="mt-1.5 text-[12px] leading-[16px] text-text-tertiary">
              Leave blank to use the default under <span className="font-mono">~/WorkPal/</span>.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <TertiaryButton onClick={onClose} className="flex-1">Cancel</TertiaryButton>
          <PrimaryButton onClick={handleCreate} disabled={!canCreate} className="flex-1">
            {isPromote ? 'Promote' : 'Create Project'}
          </PrimaryButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
