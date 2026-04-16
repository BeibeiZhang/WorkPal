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
          'You are WorkPal, an AI workplace assistant. Be concise and helpful. Respond in the same language the user speaks. Support Chinese, English, and mixed language conversations. When a user gives you a URL, use the browse_url tool to read the page content before responding. Use the search_images tool proactively to add real photos whenever visual examples would make your answer clearer — when the user asks to see pictures of something, when you are explaining a concrete thing (an animal, a place, a product), or when a few illustrative photos would enrich the reply. Before calling search_images, speak a short one-sentence lead-in like "Let me pull up some photos of X." Keep queries short and in English for best results (e.g. "golden retriever puppy").',
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
          {
            type: 'function',
            name: 'search_images',
            description:
              'Search the web for real photographs and display them in the chat. Call this proactively when the user asks to see pictures of something, or when a few illustrative photos would make your spoken explanation clearer (animals, places, products, etc.). Speak a short one-sentence intro BEFORE calling so the user knows photos are coming.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Short English search query, e.g. "golden retriever puppy" or "tokyo street at night".',
                },
                count: {
                  type: 'number',
                  description: 'How many photos to return (1–8). Default 4.',
                },
              },
              required: ['query'],
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
