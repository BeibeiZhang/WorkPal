import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const;
type Voice = (typeof ALLOWED_VOICES)[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    return;
  }

  const requested = typeof req.query.voice === 'string' ? req.query.voice : '';
  const voice: Voice = (ALLOWED_VOICES as readonly string[]).includes(requested) ? (requested as Voice) : 'alloy';

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice,
        instructions:
          'You are WorkPal, an AI workplace assistant. Be concise and helpful. Respond in the same language the user speaks. Support Chinese, English, and mixed language conversations. When a user gives you a URL, use the browse_url tool to read the page content before responding.',
        input_audio_transcription: { model: 'whisper-1' },
        tools: [
          {
            type: 'function',
            name: 'browse_url',
            description:
              'Fetch and read the content of a webpage URL. Use this when the user shares a URL or asks about a website.',
            parameters: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The full URL to fetch (must start with http:// or https://)',
                },
              },
              required: ['url'],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({ error: err });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
