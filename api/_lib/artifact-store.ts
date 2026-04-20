// Serverless mirror of server/src/lib/artifactStore.ts. Duplicated rather than
// shared because Vercel Functions can't resolve imports out of /server — same
// pattern as api/_lib/memory-store.ts. Keep the two in sync.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export interface ArtifactSubscription {
  id: string;
  templateId: string;
  scheduleCron: string;
  tz: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastWeekKey: string | null;
  createdAt: string;
}

interface ArtifactRow {
  id: string;
  template_id: string;
  slug: string;
  kind: ArtifactKind;
  week_key: string | null;
  topic: string | null;
  lang_primary: 'en' | 'zh';
  status: ArtifactStatus;
  content_en: ArtifactContent | null;
  content_zh: ArtifactContent | null;
  cover_image_url: string | null;
  project_id: string | null;
  chat_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface SubscriptionRow {
  id: string;
  template_id: string;
  schedule_cron: string;
  tz: string;
  enabled: boolean;
  last_run_at: string | null;
  last_week_key: string | null;
  created_at: string;
}

let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

function fromRow(r: ArtifactRow): Artifact {
  return {
    id: r.id, templateId: r.template_id, slug: r.slug, kind: r.kind,
    weekKey: r.week_key, topic: r.topic, langPrimary: r.lang_primary,
    status: r.status, contentEn: r.content_en, contentZh: r.content_zh,
    coverImageUrl: r.cover_image_url, projectId: r.project_id, chatId: r.chat_id,
    error: r.error, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function fromSubRow(r: SubscriptionRow): ArtifactSubscription {
  return {
    id: r.id, templateId: r.template_id, scheduleCron: r.schedule_cron,
    tz: r.tz, enabled: r.enabled, lastRunAt: r.last_run_at,
    lastWeekKey: r.last_week_key, createdAt: r.created_at,
  };
}

export async function getArtifactBySlug(slug: string): Promise<Artifact | null> {
  const { data, error } = await client().from('artifacts').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ArtifactRow) : null;
}

export async function findArtifactByWeek(templateId: string, weekKey: string): Promise<Artifact | null> {
  const { data, error } = await client().from('artifacts').select('*')
    .eq('template_id', templateId).eq('week_key', weekKey).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ArtifactRow) : null;
}

export async function getLatestArtifact(templateId?: string): Promise<Artifact | null> {
  let q = client().from('artifacts').select('*').eq('status', 'ready')
    .order('created_at', { ascending: false }).limit(1);
  if (templateId) q = q.eq('template_id', templateId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ArtifactRow) : null;
}

export interface ListArtifactsOptions {
  status?: ArtifactStatus;
  projectId?: string;
  kind?: ArtifactKind;
  limit?: number;
}

export async function listArtifacts(opts: ListArtifactsOptions = {}): Promise<Artifact[]> {
  let q = client().from('artifacts').select('*').order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.projectId) q = q.eq('project_id', opts.projectId);
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as ArtifactRow));
}

export interface CreateArtifactInput {
  templateId: string;
  slug: string;
  kind: ArtifactKind;
  weekKey?: string | null;
  topic?: string | null;
  projectId?: string | null;
  chatId?: string | null;
}

export async function createGeneratingArtifact(input: CreateArtifactInput): Promise<Artifact> {
  const { data, error } = await client().from('artifacts').insert({
    template_id: input.templateId, slug: input.slug, kind: input.kind,
    week_key: input.weekKey ?? null, topic: input.topic ?? null,
    project_id: input.projectId ?? null, chat_id: input.chatId ?? null,
    status: 'generating',
  }).select('*').single();
  if (error) throw error;
  return fromRow(data as ArtifactRow);
}

export interface ArtifactReadyPatch {
  contentEn: ArtifactContent;
  contentZh: ArtifactContent;
  coverImageUrl?: string | null;
}

export async function markArtifactReady(id: string, patch: ArtifactReadyPatch): Promise<Artifact> {
  const { data, error } = await client().from('artifacts').update({
    status: 'ready', content_en: patch.contentEn, content_zh: patch.contentZh,
    cover_image_url: patch.coverImageUrl ?? null, updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').single();
  if (error) throw error;
  return fromRow(data as ArtifactRow);
}

export async function markArtifactFailed(id: string, message: string): Promise<void> {
  const { error } = await client().from('artifacts').update({
    status: 'failed', error: message, updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function listEnabledSubscriptions(): Promise<ArtifactSubscription[]> {
  const { data, error } = await client().from('artifact_subscriptions').select('*').eq('enabled', true);
  if (error) throw error;
  return (data ?? []).map((r) => fromSubRow(r as SubscriptionRow));
}

export async function markSubscriptionRun(id: string, weekKey: string): Promise<void> {
  const { error } = await client().from('artifact_subscriptions').update({
    last_run_at: new Date().toISOString(), last_week_key: weekKey,
  }).eq('id', id);
  if (error) throw error;
}
