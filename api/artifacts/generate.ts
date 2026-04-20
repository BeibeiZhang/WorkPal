import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateArtifact, listTemplateIds } from '../_lib/artifact-generate.js';

// Bay Area weekend digest runs Tavily ×8 queries + OpenAI ×2, commonly ~20-40s.
// Default Vercel function timeout is 10s — bump to the Pro-plan max so the
// synchronous pipeline completes without a cold 504.
export const config = { maxDuration: 60 };

// POST /api/artifacts/generate
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
    const { artifact, cached } = await generateArtifact({
      templateId: body.templateId, topic, weekKey, projectId, chatId,
    });
    res.json({ artifact, cached, url: `/artifact/${artifact.slug}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    console.error('POST /artifacts/generate failed', err);
    const code = msg.startsWith('weak-results') ? 502 : 500;
    res.status(code).json({ error: msg });
  }
}
