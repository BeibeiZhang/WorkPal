/**
 * Project persistence — same pattern as chatStore.ts but no metadata/full
 * split (projects are <10 typical, fields are small enough to ship in one
 * list response). Projects.files are base64 data URLs inline.
 *
 * The seed `proj-1` (Agent Design with Instructions.md) is uploaded like any
 * other project — bulk-upsert with ignoreDuplicates means a second device
 * uploading its identical seed is a no-op. If the user customizes proj-1 on
 * one device, the regular upsert path overwrites the server copy and the
 * other devices pick it up on next reconcile.
 */

import type { Project } from '../components/Sidebar';
import type { Attachment, OutputItem } from '../types';
import { IS_DEMO } from './demoMode';

const PROJECTS_CACHE_KEY = 'workpal-projects-v1';
const PROJECTS_UPDATED_AT_KEY = 'workpal-projects-updated-at-v1';
const PROJECTS_MIGRATED_KEY = 'workpal-projects-cloud-migrated-v1';

interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  files: Attachment[];
  outputs: OutputItem[];
  /** §17: external knowledge folders, validated server-side. */
  referenceDirectories?: string[];
  updatedAt: string;
}

function projectToRecord(project: Project, updatedAt: string): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    files: project.files ?? [],
    outputs: project.outputs ?? [],
    referenceDirectories: project.referenceDirectories ?? [],
    updatedAt,
  };
}

function recordToProject(record: ProjectRecord): Project {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    files: record.files ?? [],
    outputs: record.outputs ?? [],
    referenceDirectories: record.referenceDirectories ?? [],
  };
}

/* ── localStorage cache ───────────────────────────────────────────── */

/** Caller is responsible for seeding the default project (Agent Design)
 *  when the cache is empty AND no cloud data exists yet — that decision
 *  needs the cloud-fetch result so the store stays out of it. */
export function loadProjectsCache(): Project[] | null {
  if (IS_DEMO) return null;
  try {
    const raw = localStorage.getItem(PROJECTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProjectsCache(projects: Project[]): void {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects));
  } catch {
    /* ignore */
  }
}

export function loadProjectsUpdatedAtMap(): Record<string, string> {
  if (IS_DEMO) return {};
  try {
    const raw = localStorage.getItem(PROJECTS_UPDATED_AT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProjectsUpdatedAtMap(map: Record<string, string>): void {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(PROJECTS_UPDATED_AT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function isProjectsMigrationDone(): boolean {
  if (IS_DEMO) return true;
  try {
    return localStorage.getItem(PROJECTS_MIGRATED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markProjectsMigrationDone(): void {
  if (IS_DEMO) return;
  try {
    localStorage.setItem(PROJECTS_MIGRATED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/* ── Backend API client ───────────────────────────────────────────── */

export class ProjectAuthError extends Error {
  constructor(msg = 'Invalid project password') {
    super(msg);
    this.name = 'ProjectAuthError';
  }
}

/** §17: server returns 400 with a bilingual `error` field when reference
 *  directory validation fails. Surfacing the literal server message lets
 *  the UI show "System directory not allowed / 系统目录不允许" inline rather
 *  than a generic "Project API 400". */
export class ProjectValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ProjectValidationError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new ProjectAuthError();
  if (res.status === 400) {
    let detail = '';
    try {
      const body = await res.json() as { error?: unknown };
      if (typeof body?.error === 'string') detail = body.error;
    } catch {
      /* body wasn't JSON; fall through to generic */
    }
    throw new ProjectValidationError(detail || 'Project API 400');
  }
  if (!res.ok) throw new Error(`Project API ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ProjectFromServer {
  project: Project;
  updatedAt: string;
}

export async function fetchProjects(password: string): Promise<ProjectFromServer[]> {
  if (IS_DEMO) return [];
  const res = await fetch('/api/projects', {
    headers: { 'x-memory-password': password },
  });
  const data = await handleResponse<{ projects: ProjectRecord[] }>(res);
  return data.projects.map((r) => ({ project: recordToProject(r), updatedAt: r.updatedAt }));
}

export async function upsertProjectOnServer(
  project: Project,
  updatedAt: string,
  password: string,
): Promise<string> {
  if (IS_DEMO) throw new Error('Projects are read-only in demo mode');
  const record = projectToRecord(project, updatedAt);
  const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-memory-password': password },
    body: JSON.stringify(record),
  });
  const data = await handleResponse<{ project: ProjectRecord }>(res);
  return data.project.updatedAt;
}

export async function deleteProjectOnServer(id: string, password: string): Promise<void> {
  if (IS_DEMO) throw new Error('Projects are read-only in demo mode');
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-memory-password': password },
  });
  if (res.status === 404) return;
  await handleResponse<{ ok: true }>(res);
}

export async function bulkUploadProjects(
  projects: Project[],
  updatedAtMap: Record<string, string>,
  password: string,
): Promise<number> {
  if (IS_DEMO) return 0;
  const records = projects.map((p) =>
    projectToRecord(p, updatedAtMap[p.id] ?? new Date().toISOString()),
  );
  if (records.length === 0) return 0;
  const res = await fetch('/api/projects/bulk-upsert', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-memory-password': password },
    body: JSON.stringify({ projects: records }),
  });
  const data = await handleResponse<{ inserted: number }>(res);
  return data.inserted;
}
