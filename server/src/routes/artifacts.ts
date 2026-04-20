import { Router, type Request, type Response } from 'express';
import {
  getArtifactBySlug,
  getLatestArtifact,
  listArtifacts,
  type ArtifactKind,
  type ArtifactStatus,
} from '../lib/artifactStore.js';
import { generateArtifact, currentWeekKey } from '../lib/artifacts/generate.js';
import { listEnabledSubscriptions, markSubscriptionRun } from '../lib/artifactStore.js';
import { listTemplateIds } from '../lib/artifacts/templates.js';

const router = Router();

/**
 * GET /api/artifacts
 * Query: status?, projectId?, kind?, limit?
 * Used by LibraryPage (status=ready), ProjectPage Output (projectId=X), and
 * OverviewPage unread card (status=ready, limit=3).
 */
router.get('/artifacts', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? (req.query.status as ArtifactStatus) : undefined;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const kind = typeof req.query.kind === 'string' ? (req.query.kind as ArtifactKind) : undefined;
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const limit = rawLimit && rawLimit > 0 && rawLimit <= 100 ? rawLimit : undefined;

    const artifacts = await listArtifacts({ status, projectId, kind, limit });
    res.json({ artifacts });
  } catch (err) {
    console.error('GET /artifacts failed', err);
    res.status(500).json({ error: 'Failed to list artifacts' });
  }
});

/**
 * GET /api/artifacts/latest
 * Query: templateId?
 * Returns a single artifact or null. Used by LatestArtifactCard on Overview.
 */
router.get('/artifacts/latest', async (req, res) => {
  try {
    const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : undefined;
    const artifact = await getLatestArtifact(templateId);
    res.json({ artifact });
  } catch (err) {
    console.error('GET /artifacts/latest failed', err);
    res.status(500).json({ error: 'Failed to fetch latest artifact' });
  }
});

/**
 * GET /api/artifacts/:slug
 * Public read for the /artifact/:slug page. No auth — this is a shareable URL.
 */
router.get('/artifacts/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const artifact = await getArtifactBySlug(slug);
    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }
    // Hide not-yet-ready rows from public — the UI would show blank content
    // and confuse shared-link visitors.
    if (artifact.status !== 'ready') {
      res.status(404).json({ error: 'Artifact not ready' });
      return;
    }
    res.json({ artifact });
  } catch (err) {
    console.error('GET /artifacts/:slug failed', err);
    res.status(500).json({ error: 'Failed to fetch artifact' });
  }
});

/**
 * POST /api/artifacts/generate
 * Body: { templateId, topic?, weekKey?, projectId?, chatId? }
 *
 * The primitive. Used by BOTH chat-initiated ("写个 SF 美食周刊" → intentRouter →
 * here) and cron-initiated (sweep endpoint loops over enabled subscriptions →
 * POSTs here). Synchronous: blocks while Tavily + OpenAI run (~10-30s) then
 * returns the ready row. Client shows a "generating…" skeleton in the chat
 * card until this resolves, at which point it swaps to the ready card with
 * the /artifact/:slug URL.
 */
router.post('/artifacts/generate', async (req, res) => {
  const body = req.body as {
    templateId?: unknown;
    topic?: unknown;
    weekKey?: unknown;
    projectId?: unknown;
    chatId?: unknown;
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
    const { artifact, cached } = await generateArtifact({
      templateId: body.templateId,
      topic,
      weekKey,
      projectId,
      chatId,
    });
    res.json({
      artifact,
      cached,
      url: `/artifact/${artifact.slug}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    console.error('POST /artifacts/generate failed', err);
    const code = msg.startsWith('weak-results') ? 502 : 500;
    res.status(code).json({ error: msg });
  }
});

/**
 * POST /api/artifacts/cron-sweep
 * Called by Vercel Cron (schedule in vercel.json). Loops over enabled
 * subscriptions and generates the current-week artifact for each. Dedupes via
 * generateArtifact's (templateId, weekKey) idempotency check — reruns in the
 * same week are no-ops. Per #6 v1 does not retry on weak-results; the next
 * week's run self-heals.
 */
function isAuthorizedCron(req: Request): boolean {
  // Vercel Cron sets this header automatically — see
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs#how-cron-jobs-are-protected
  if (req.header('x-vercel-cron')) return true;
  // Local dev: allow an explicit header so planning can live-test manually.
  if (req.header('x-workpal-cron-local') === '1') return true;
  // Allow direct localhost calls for dev convenience.
  const host = req.header('host') || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

router.post('/artifacts/cron-sweep', async (req, res) => {
  if (!isAuthorizedCron(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const subs = await listEnabledSubscriptions();
    const weekKey = currentWeekKey();
    const results: Array<{ templateId: string; slug?: string; cached?: boolean; error?: string }> = [];

    // Serial, not parallel — one Tavily + OpenAI storm at a time so we don't
    // trip rate limits. v1 has exactly one subscription so it doesn't matter.
    for (const sub of subs) {
      try {
        if (sub.lastWeekKey === weekKey) {
          // Already handled this week — skip to avoid a redundant regenerate
          // even though the pipeline itself is idempotent, because cron-safe
          // means "fast and cheap on a no-op retry".
          results.push({ templateId: sub.templateId, cached: true });
          continue;
        }
        const { artifact, cached } = await generateArtifact({
          templateId: sub.templateId,
          weekKey,
        });
        await markSubscriptionRun(sub.id, weekKey);
        results.push({ templateId: sub.templateId, slug: artifact.slug, cached });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        results.push({ templateId: sub.templateId, error: msg });
        console.error(`cron-sweep: ${sub.templateId} failed`, err);
      }
    }
    res.json({ weekKey, results });
  } catch (err) {
    console.error('cron-sweep failed', err);
    res.status(500).json({ error: 'Sweep failed' });
  }
});

export default router;
