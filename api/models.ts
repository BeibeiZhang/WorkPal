import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const models: { id: string; name: string; provider: string }[] = [];

  if (process.env.OPENAI_API_KEY) {
    models.push(
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    );
  }

  res.json(models);
}
