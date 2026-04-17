import { useMemo, useState } from 'react';
import { Brain, Plus, Trash2, Pencil, X } from 'lucide-react';
import { FilterChip, PageLayout, PrimaryButton, TertiaryButton } from './shared';
import type { MemoryEntry, MemoryKind } from '../types';
import { KIND_LABEL } from '../lib/memory';

interface MemoryPageProps {
  memories: MemoryEntry[];
  projects: { id: string; name: string }[];
  onAdd: (draft: { kind: MemoryKind; title: string; content: string; projectId?: string }) => void;
  onUpdate: (id: string, patch: { kind: MemoryKind; title: string; content: string; projectId?: string }) => void;
  onDelete: (id: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
}

type FilterKind = 'All' | MemoryKind;
const FILTER_ORDER: FilterKind[] = ['All', 'core', 'preference', 'project'];

function filterLabel(f: FilterKind): string {
  return f === 'All' ? 'All' : KIND_LABEL[f];
}

/* ── Inline add/edit form ── */
function MemoryForm({
  initial,
  projects,
  onCancel,
  onSave,
}: {
  initial?: Pick<MemoryEntry, 'kind' | 'title' | 'content' | 'projectId'>;
  projects: { id: string; name: string }[];
  onCancel: () => void;
  onSave: (draft: { kind: MemoryKind; title: string; content: string; projectId?: string }) => void;
}) {
  const [kind, setKind] = useState<MemoryKind>(initial?.kind ?? 'preference');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [projectId, setProjectId] = useState<string | undefined>(initial?.projectId);

  const canSave = title.trim().length > 0 && content.trim().length > 0 &&
    (kind !== 'project' || !!projectId);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      kind,
      title: title.trim(),
      content: content.trim(),
      projectId: kind === 'project' ? projectId : undefined,
    });
  };

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--color-bg-message)', border: '1px solid var(--color-stroke-outline)' }}
    >
      {/* Kind + (project picker when kind=project) */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['core', 'preference', 'project'] as MemoryKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors ${
              kind === k
                ? 'bg-[#3171ff] text-white border-[#3171ff]'
                : 'text-text-primary border-stroke-outline hover:bg-bg-hover'
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
        {kind === 'project' && (
          <select
            value={projectId ?? ''}
            onChange={e => setProjectId(e.target.value || undefined)}
            className="ml-1 px-3 py-1.5 rounded-full text-[13px] text-text-primary outline-none"
            style={{
              background: 'var(--color-bg-page)',
              border: '1px solid var(--color-stroke-outline)',
            }}
          >
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title (e.g. Response style)"
        className="px-3 py-2 rounded-lg text-[14px] text-text-primary placeholder-text-tertiary outline-none"
        style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-stroke-outline)' }}
      />

      {/* Content */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What should the AI remember? (e.g. Prefers short, direct answers. No filler.)"
        rows={3}
        className="px-3 py-2 rounded-lg text-[14px] text-text-primary placeholder-text-tertiary outline-none resize-none"
        style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-stroke-outline)' }}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <TertiaryButton onClick={onCancel}>Cancel</TertiaryButton>
        <PrimaryButton onClick={handleSave} disabled={!canSave}>Save</PrimaryButton>
      </div>
    </div>
  );
}

/* ── Row ── */
function MemoryRow({
  entry,
  projectName,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry;
  projectName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex items-start gap-3 p-4 rounded-xl transition-colors"
      style={{ border: '1px solid var(--color-stroke-outline)' }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'var(--color-bg-message)' }}>
        <Brain size={16} className="text-text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[14px] font-semibold text-text-primary">{entry.title}</span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--color-bg-message)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {KIND_LABEL[entry.kind]}{projectName ? ` · ${projectName}` : ''}
          </span>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap">{entry.content}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          aria-label={`Edit ${entry.title}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${entry.title}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function MemoryPage({
  memories,
  projects,
  onAdd,
  onUpdate,
  onDelete,
  sidebarOpen,
  onToggleSidebar,
  onNewChat,
}: MemoryPageProps) {
  const [filter, setFilter] = useState<FilterKind>('All');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const projectsById = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p.name])),
    [projects],
  );

  const filtered = memories.filter(m => filter === 'All' || m.kind === filter);

  const handleAddSave = (draft: { kind: MemoryKind; title: string; content: string; projectId?: string }) => {
    onAdd(draft);
    setAdding(false);
  };

  const handleUpdateSave = (id: string, draft: { kind: MemoryKind; title: string; content: string; projectId?: string }) => {
    onUpdate(id, draft);
    setEditingId(null);
  };

  return (
    <PageLayout
      title="Memory"
      bgClass="app-bg"
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onNewChat={onNewChat}
      headerRight={
        !adding ? (
          <button
            onClick={() => { setAdding(true); setEditingId(null); }}
            aria-label="Add memory"
            className="h-10 px-4 flex items-center gap-2 rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
            style={{ border: '1px solid var(--color-stroke-outline)' }}
          >
            <Plus size={16} />
            <span className="text-[14px]">Add memory</span>
          </button>
        ) : (
          <button
            onClick={() => setAdding(false)}
            aria-label="Close add form"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors text-text-primary"
          >
            <X size={18} />
          </button>
        )
      }
      filters={
        <div className="flex gap-2">
          {FILTER_ORDER.map(f => (
            <FilterChip
              key={f}
              label={filterLabel(f)}
              active={filter === f}
              onClick={() => setFilter(f)}
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Explainer — shown when no memories yet */}
        {memories.length === 0 && !adding && (
          <div
            className="p-8 rounded-xl flex flex-col items-center gap-3 text-center"
            style={{ border: '1px dashed var(--color-stroke-outline)' }}
          >
            <Brain size={32} className="text-text-secondary" />
            <div className="text-[15px] font-semibold text-text-primary">Teach your AI about you</div>
            <p className="text-[13px] text-text-secondary max-w-md">
              Memories apply to every chat — your name, preferences, project notes.
              They persist across sessions so you don't have to repeat yourself.
            </p>
            <div className="mt-1">
              <PrimaryButton onClick={() => setAdding(true)}>Add your first memory</PrimaryButton>
            </div>
          </div>
        )}

        {/* Inline add form */}
        {adding && (
          <MemoryForm
            projects={projects}
            onCancel={() => setAdding(false)}
            onSave={handleAddSave}
          />
        )}

        {/* Filter summary */}
        {memories.length > 0 && (
          <div className="text-[12px] text-text-secondary">
            {filtered.length} {filtered.length === 1 ? 'memory' : 'memories'}
            {filter !== 'All' ? ` in ${KIND_LABEL[filter]}` : ''}
          </div>
        )}

        {/* List */}
        <div className="flex flex-col gap-2">
          {filtered.map(m => editingId === m.id ? (
            <MemoryForm
              key={m.id}
              initial={m}
              projects={projects}
              onCancel={() => setEditingId(null)}
              onSave={(draft) => handleUpdateSave(m.id, draft)}
            />
          ) : (
            <MemoryRow
              key={m.id}
              entry={m}
              projectName={m.projectId ? projectsById[m.projectId] : undefined}
              onEdit={() => { setEditingId(m.id); setAdding(false); }}
              onDelete={() => onDelete(m.id)}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
