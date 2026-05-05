import { Router } from 'express';
import { streamChat, getAvailableModels, type ChatMode } from '../lib/llm.js';
import type { ChatMessage } from '../lib/llm.js';
import { searchImages } from '../lib/imageSearch.js';
import { searchVideos } from '../lib/youtubeSearch.js';
import { searchWeb } from '../lib/webSearch.js';
import { detectSourceFromRequest } from '../lib/usageLog.js';

const router = Router();

function isChatMode(v: unknown): v is ChatMode {
  return v === 'Chat' || v === 'Tasks' || v === 'Code';
}

// POST /api/chat — streaming LLM response via SSE
router.post('/chat', async (req, res) => {
  const { messages, model, mode } = req.body as {
    messages?: ChatMessage[];
    model?: string;
    mode?: ChatMode;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const chatMode: ChatMode = isChatMode(mode) ? mode : 'Chat';

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const source = detectSourceFromRequest(req);
    for await (const chunk of streamChat(messages, model, chatMode, source)) {
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

// POST /api/search-images — called by voice mode when AI invokes the search_images tool
router.post('/search-images', async (req, res) => {
  const { query, count } = req.body as { query?: string; count?: number };
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  const images = await searchImages(query, typeof count === 'number' ? count : 4);
  res.json({ images });
});

// POST /api/search-videos — called by voice mode when AI invokes the search_videos tool
router.post('/search-videos', async (req, res) => {
  const { query, count } = req.body as { query?: string; count?: number };
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  const videos = await searchVideos(query, typeof count === 'number' ? count : 5);
  res.json({ videos });
});

// POST /api/search-web — called by voice mode when the AI invokes web_search
router.post('/search-web', async (req, res) => {
  const { query, max_results } = req.body as { query?: string; max_results?: number };
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  const source = detectSourceFromRequest(req);
  const resp = await searchWeb(query, typeof max_results === 'number' ? max_results : 5, source);
  res.json({ results: resp.results, images: resp.images });
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
        instructions: 'You are WorkPal, an AI workplace assistant. Be concise and helpful. Respond in the same language the user speaks. Support Chinese, English, and mixed language conversations. When a user gives you a URL, use the browse_url tool to read the page content before responding. When the user attaches an image, describe what you see and answer any questions about it. Use the search_images tool proactively to add real photos whenever visual examples would make your answer clearer — when the user asks to see pictures of something, when you are explaining a concrete thing (an animal, a place, a product), or when a few illustrative photos would enrich the reply. Before calling search_images, speak a short one-sentence lead-in like "Let me pull up some photos of X." Keep queries short and in English for best results (e.g. "golden retriever puppy"). For any question about current prices, product specs, news, live statistics, or official-website content, you MUST call the web_search tool — never refuse with "I cannot browse" and never guess numbers. Speak a short one-sentence lead-in like "Let me look that up for you" before calling web_search, then after the tool returns, speak a concise synthesized answer in the user\'s language; the UI will render source chips and product images automatically, so you do not need to read URLs aloud.',
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
          {
            type: 'function',
            name: 'search_images',
            description: 'Search the web for real photographs and display them in the chat. Call this proactively when the user asks to see pictures of something, or when a few illustrative photos would make your spoken explanation clearer (animals, places, products, etc.). Speak a short one-sentence intro BEFORE calling so the user knows photos are coming.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Short English search query, e.g. "golden retriever puppy" or "tokyo street at night".' },
                count: { type: 'number', description: 'How many photos to return (1–8). Default 4.' },
              },
              required: ['query'],
            },
          },
          {
            type: 'function',
            name: 'search_videos',
            description: 'Search YouTube for real videos and display them in the chat. Call this whenever the user asks for video tutorials, how-to guides, lectures, talks, reviews, or demos. Speak a short one-sentence lead-in BEFORE calling so the user knows videos are on the way, and never invent YouTube URLs.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search phrase — match the user\'s language. Include specifics like skill level or tool name, e.g. "react hooks tutorial beginner", "日语五十音教学".' },
                count: { type: 'number', description: 'How many videos to return (1–8). Default 5.' },
              },
              required: ['query'],
            },
          },
          {
            type: 'function',
            name: 'web_search',
            description: 'Search the live web for current facts — prices, news, product specs, official-site content, anything that may have changed since training. ALWAYS call this for price/fact questions; do not refuse. Speak a short one-sentence lead-in BEFORE calling so the user hears that you are looking it up, then speak a concise synthesized answer after the tool returns. The UI shows source chips and product images automatically.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Specific search query. Include product name, brand, and market/country, and match the language appropriate to the target site (Chinese for chanel.cn, English for chanel.com).' },
                max_results: { type: 'number', description: 'How many source results to fetch (3–8). Default 5.' },
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
});

export default router;
