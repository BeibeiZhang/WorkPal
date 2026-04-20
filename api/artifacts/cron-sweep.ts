import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listEnabledSubscriptions, markSubscriptionRun } from '../_lib/artifact-store.js';
import { generateArtifact, currentWeekKey } from '../_lib/artifact-generate.js';

// Vercel Cron hits this once a week (see vercel.json). Generation runs
// serially over the enabled subscriptions; with one template it completes
// well under the 60s window.
export const config = { maxDuration: 60 };

function isAuthorizedCron(req: VercelRequest): boolean {
  // Vercel Cron sets this header automatically. See
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs#how-cron-jobs-are-protected
  if (req.headers['x-vercel-cron']) return true;
  // Manual trigger for planning live-test.
  if (req.headers['x-workpal-cron-local'] === '1') return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isAuthorizedCron(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
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
  } catch (err) {
    console.error('cron-sweep failed', err);
    res.status(500).json({ error: 'Sweep failed' });
  }
}
