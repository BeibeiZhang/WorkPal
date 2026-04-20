import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listArtifacts, getLatestArtifact, getArtifactBySlug,
  listEnabledSubscriptions, markSubscriptionRun,
  type ArtifactKind, type ArtifactStatus,
} from './_lib/artifact-store.js';
import { generateArtifact, currentWeekKey, listTemplateIds } from './_lib/artifact-generate.js';

// One serverless function handling every /api/artifacts* route. Collapsed
// from the Express-style 5-file layout because Vercel Hobby caps a single
// deployment at 12 functions, and splitting these out pushed us over.
// `vercel.json` rewrites the pretty URLs (/api/artifacts/latest,
// /api/artifacts/<slug>, etc.) onto query params so the client never sees
// this detail. Mirrors the pattern used by api/connectors.ts.
export const config = { maxDuration: 60 };

type Endpoint = 'list' | 'latest' | 'slug' | 'generate' | 'cron-sweep';

function parseEndpoint(req: VercelRequest): Endpoint {
  const raw = typeof req.query.endpoint === 'string' ? req.query.endpoint : '';
  switch (raw) {
    case 'latest':
    case 'slug':
    case 'generate':
    case 'cron-sweep':
      return raw;
    default:
      return 'list';
  }
}

function isAuthorizedCron(req: VercelRequest): boolean {
  if (req.headers['x-vercel-cron']) return true;
  if (req.headers['x-workpal-cron-local'] === '1') return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const endpoint = parseEndpoint(req);

  try {
    // ── GET /api/artifacts ─────────────────────────────────────────
    if (endpoint === 'list' && req.method === 'GET') {
      const status = typeof req.query.status === 'string' ? (req.query.status as ArtifactStatus) : undefined;
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      const kind = typeof req.query.kind === 'string' ? (req.query.kind as ArtifactKind) : undefined;
      const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
      const limit = rawLimit && rawLimit > 0 && rawLimit <= 100 ? rawLimit : undefined;
      const artifacts = await listArtifacts({ status, projectId, kind, limit });
      res.json({ artifacts });
      return;
    }

    // ── GET /api/artifacts/latest ──────────────────────────────────
    if (endpoint === 'latest' && req.method === 'GET') {
      const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : undefined;
      const artifact = await getLatestArtifact(templateId);
      res.json({ artifact });
      return;
    }

    // ── GET /api/artifacts/:slug ───────────────────────────────────
    if (endpoint === 'slug' && req.method === 'GET') {
      const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
      if (!slug) {
        res.status(400).json({ error: 'slug required' });
        return;
      }
      const artifact = await getArtifactBySlug(slug);
      if (!artifact) {
        res.status(404).json({ error: 'Artifact not found' });
        return;
      }
      if (artifact.status !== 'ready') {
        res.status(404).json({ error: 'Artifact not ready' });
        return;
      }
      res.json({ artifact });
      return;
    }

    // ── POST /api/artifacts/generate ───────────────────────────────
    if (endpoint === 'generate' && req.method === 'POST') {
      const body = req.body as {
        templateId?: unknown; topic?: unknown; weekKey?: unknown;
        projectId?: unknown; chatId?: unknown;
      };
      if (typeof body.templateId !== 'string' || body.templateId.length === 0) {
        res.status(400).json({ error: 'templateId (string) is required' });
        return;
      }
      if (!listTemplateIds().includes(body.templateId)) {
        res.status(400).json({ error: `Unknown templateId; known: ${listTemplateIds().join(', ')}` });
        return;
      }
      const topic = typeof body.topic === 'string' && body.topic.trim().length > 0 ? body.topic.trim() : null;
      const weekKey = typeof body.weekKey === 'string' && body.weekKey.trim().length > 0 ? body.weekKey.trim() : null;
      const projectId = typeof body.projectId === 'string' && body.projectId.length > 0 ? body.projectId : null;
      const chatId = typeof body.chatId === 'string' && body.chatId.length > 0 ? body.chatId : null;
      try {
        const { artifact, cached } = await generateArtifact({ templateId: body.templateId, topic, weekKey, projectId, chatId });
        res.json({ artifact, cached, url: `/artifact/${artifact.slug}` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        console.error('generate failed', err);
        res.status(msg.startsWith('weak-results') ? 502 : 500).json({ error: msg });
      }
      return;
    }

    // ── POST /api/artifacts/cron-sweep ─────────────────────────────
    if (endpoint === 'cron-sweep') {
      if (!(req.method === 'POST' || req.method === 'GET')) {
        res.setHeader('Allow', 'POST, GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      if (!isAuthorizedCron(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const subs = await listEnabledSubscriptions();
      const weekKey = currentWeekKey();
      const results: Array<{ templateId: string; slug?: string; cached?: boolean; error?: string }> = [];
      for (const sub of subs) {
        try {
          if (sub.lastWeekKey === weekKey) {
            results.push({ templateId: sub.templateId, cached: true });
            continue;
          }
          const { artifact, cached } = await generateArtifact({ templateId: sub.templateId, weekKey });
          await markSubscriptionRun(sub.id, weekKey);
          results.push({ templateId: sub.templateId, slug: artifact.slug, cached });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          results.push({ templateId: sub.templateId, error: msg });
          console.error(`cron-sweep: ${sub.templateId} failed`, err);
        }
      }
      res.json({ weekKey, results });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: `Method ${req.method} not allowed for endpoint=${endpoint}` });
  } catch (err) {
    console.error('/api/artifacts failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
