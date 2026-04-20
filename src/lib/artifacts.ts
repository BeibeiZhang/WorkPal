/**
 * Artifact library — two complementary concerns in one file, because both
 * revolve around the `ArtifactRef` / hosted-artifact shape users see:
 *
 *   1. Hosted-artifact primitive (candidate #3) — client API against
 *      /api/artifacts/*, plus localStorage-based unread tracking. Used by
 *      chat-initiated generation, the Library / Project Output / Overview
 *      surfaces, and the public /artifact/:slug page.
 *
 *   2. Claude-Code file-path helpers — tiny pure functions for turning an
 *      absolute file path (from the Agent SDK's Write/Edit tool calls) into
 *      an ArtifactRef + deriving the Output category by file extension.
 *      Consumed by App.tsx's streaming loop and by MessageCard's artifact
 *      row.
 *
 * Both sides just happened to land in the same file (originally from two
 * parallel PRs); keeping them together avoids two `src/lib/artifacts.*`
 * files and makes the unified ArtifactRef union obvious at a glance.
 */

import { IS_DEMO } from './demoMode';
import type { ArtifactRef, OutputType } from '../types';

/* ════════════════════════════════════════════════════════════════════
   1. Hosted-artifact primitive (candidate #3)
   ════════════════════════════════════════════════════════════════════ */

// Mirrors server/src/lib/artifactStore.ts `Artifact`. Duplicated rather than
// shared because server is ESM + NodeNext and the client can't import from
// /server/* without a bundler detour.
export type ArtifactKind =
  | 'report' | 'presentation' | 'image' | 'video'
  | 'document' | 'spreadsheet' | 'note' | 'webpage';

export type ArtifactStatus = 'generating' | 'ready' | 'failed';

export interface ArtifactContent {
  title: string;
  summary: string;
  body: unknown;
}

export interface Artifact {
  id: string;
  templateId: string;
  slug: string;
  kind: ArtifactKind;
  weekKey: string | null;
  topic: string | null;
  langPrimary: 'en' | 'zh';
  status: ArtifactStatus;
  contentEn: ArtifactContent | null;
  contentZh: ArtifactContent | null;
  coverImageUrl: string | null;
  projectId: string | null;
  chatId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateResponse {
  artifact: Artifact;
  cached: boolean;
  url: string;
}

/* ── Fetch helpers ─────────────────────────────────────────────────── */

/** In demo mode we never talk to the backend — the demo Vercel project has
 *  no TAVILY/SUPABASE env. Return empty so UI surfaces fall back to their
 *  static mock data (LibraryPage / ProjectPage) or empty state (Overview). */
export async function listArtifacts(params: {
  status?: ArtifactStatus;
  projectId?: string;
  kind?: ArtifactKind;
  limit?: number;
} = {}): Promise<Artifact[]> {
  if (IS_DEMO) return [];
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.projectId) q.set('projectId', params.projectId);
  if (params.kind) q.set('kind', params.kind);
  if (params.limit) q.set('limit', String(params.limit));
  const suffix = q.toString() ? `?${q}` : '';
  try {
    const res = await fetch(`/api/artifacts${suffix}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { artifacts: Artifact[] };
    return data.artifacts ?? [];
  } catch {
    return [];
  }
}

export async function fetchArtifactBySlug(slug: string): Promise<Artifact | null> {
  if (IS_DEMO) return null;
  try {
    const res = await fetch(`/api/artifacts/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { artifact: Artifact };
    return data.artifact ?? null;
  } catch {
    return null;
  }
}

export async function fetchLatestArtifact(templateId?: string): Promise<Artifact | null> {
  if (IS_DEMO) return null;
  try {
    const suffix = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
    const res = await fetch(`/api/artifacts/latest${suffix}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { artifact: Artifact | null };
    return data.artifact ?? null;
  } catch {
    return null;
  }
}

export async function generateArtifactRequest(body: {
  templateId: string;
  topic?: string;
  weekKey?: string;
  projectId?: string;
  chatId?: string;
}): Promise<GenerateResponse> {
  const res = await fetch('/api/artifacts/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as GenerateResponse;
}

/* ── Unread tracking (localStorage-only, per-device) ───────────────── */

const VIEWED_KEY = 'workpal-viewed-artifact-slugs-v1';

function readViewed(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((s): s is string => typeof s === 'string'));
    return new Set();
  } catch {
    return new Set();
  }
}

function writeViewed(slugs: Set<string>): void {
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify(Array.from(slugs)));
  } catch { /* quota — drop silently */ }
}

export function markArtifactViewed(slug: string): void {
  const v = readViewed();
  if (v.has(slug)) return;
  v.add(slug);
  writeViewed(v);
}

export function isArtifactViewed(slug: string): boolean {
  return readViewed().has(slug);
}

/** Used by OverviewPage — "latest N ready that the user hasn't opened yet". */
export async function fetchUnreadArtifacts(limit = 3): Promise<Artifact[]> {
  const all = await listArtifacts({ status: 'ready', limit: limit + 10 });
  const viewed = readViewed();
  return all.filter((a) => !viewed.has(a.slug)).slice(0, limit);
}

/* ── Render helpers ────────────────────────────────────────────────── */

/** Count items across all categories — used on cards + Overview. */
export function artifactItemCount(artifact: Artifact, lang: 'en' | 'zh' = 'en'): number {
  const content = lang === 'zh' ? artifact.contentZh : artifact.contentEn;
  if (!content) return 0;
  const body = content.body as { categories?: Array<{ items?: unknown[] }> };
  return (body.categories ?? []).reduce((n, c) => n + (c.items?.length ?? 0), 0);
}

/* ════════════════════════════════════════════════════════════════════
   2. Claude-Code file-path helpers (PR #93)
   ════════════════════════════════════════════════════════════════════ */

/** Last segment of a forward-slash path. Bare filename in, bare filename out.
 *  Not defensive against Windows separators — we only ever receive POSIX
 *  paths from the Agent SDK on macOS. */
export function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

const EXT_TO_OUTPUT: Record<string, OutputType> = {
  html: 'Web',
  htm: 'Web',
  css: 'Web',
  js: 'Web',
  jsx: 'Web',
  ts: 'Web',
  tsx: 'Web',
  pptx: 'Slides',
  ppt: 'Slides',
  key: 'Slides',
  pdf: 'Slides',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
  gif: 'Image',
  webp: 'Image',
  svg: 'Image',
  mp4: 'Video',
  mov: 'Video',
  webm: 'Video',
};

/** Derive the Output category tag from a filename's extension. Anything we
 *  don't have a specific bucket for falls through to 'File' — e.g. .md /
 *  .txt / .json / plain scripts render with the generic file icon. */
export function outputTypeFromPath(path: string): OutputType {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return 'File';
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_OUTPUT[ext] ?? 'File';
}

/** Build an `ArtifactRef` for a Claude-Code file_path. The card click is
 *  handled app-side (no href here) so the open-file endpoint can resolve the
 *  absolute path against WORKPAL_ROOT and spawn `open`. */
export function artifactFromClaudePath(absolutePath: string): ArtifactRef {
  return {
    name: basename(absolutePath),
    fileType: outputTypeFromPath(absolutePath),
    path: absolutePath,
    source: 'claude-code',
  };
}
