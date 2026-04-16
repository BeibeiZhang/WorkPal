import OpenAI from 'openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60 };

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

const SYSTEM_PROMPT = `You are WorkPal, an AI workplace assistant. You help users with meeting summaries, task management, research, scheduling, and general work productivity. Be concise, helpful, and professional. Respond in the same language the user uses.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages, model = 'gpt-4o-mini' } = (req.body ?? {}) as {
    messages?: ChatMessage[];
    model?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`);
  }

  res.end();
}
