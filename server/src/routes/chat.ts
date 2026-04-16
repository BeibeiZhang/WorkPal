import { Router } from 'express';
import { streamChat, getAvailableModels } from '../lib/llm.js';
import type { ChatMessage } from '../lib/llm.js';

const router = Router();

// POST /api/chat — streaming LLM response via SSE
router.post('/chat', async (req, res) => {
  const { messages, model } = req.body as {
    messages?: ChatMessage[];
    model?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    for await (const chunk of streamChat(messages, model)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream failed' })}\n\n`);
  }

  res.end();
});

// GET /api/models — available models
router.get('/models', (_req, res) => {
  res.json(getAvailableModels());
});

// POST /api/browse — fetch a webpage and return text content
router.post('/browse', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      res.json({ content: `Failed to fetch: HTTP ${response.status}`, title: '' });
      return;
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';

    // Strip HTML to plain text (simple but effective)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // Limit to ~8k chars to keep context reasonable

    res.json({ content: text, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.json({ content: `Could not fetch URL: ${message}`, title: '' });
  }
});

// GET /api/realtime/token — ephemeral token for OpenAI Realtime WebRTC
const ALLOWED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const;
type Voice = (typeof ALLOWED_VOICES)[number];

router.get('/realtime/token', async (req, res) => {
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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice,
        instructions: 'You are WorkPal, an AI workplace assistant. Be concise and helpful. Respond in the same language the user speaks. Support Chinese, English, and mixed language conversations. When a user gives you a URL, use the browse_url tool to read the page content before responding. When the user attaches an image, describe what you see and answer any questions about it.',
        input_audio_transcription: { model: 'whisper-1' },
        tools: [
          {
            type: 'function',
            name: 'browse_url',
            description: 'Fetch and read the content of a webpage URL. Use this when the user shares a URL or asks about a website.',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The full URL to fetch (must start with http:// or https://)' },
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
});

export default router;
