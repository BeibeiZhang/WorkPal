import OpenAI from 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are WorkPal, an AI workplace assistant. You help users with meeting summaries, task management, research, scheduling, and general work productivity. Be concise, helpful, and professional. Respond in the same language the user uses.`;

export async function* streamChat(
  messages: ChatMessage[],
  model = 'gpt-4o-mini',
): AsyncGenerator<StreamChunk> {
  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: 'text', content };
      }
    }

    yield { type: 'done', content: '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    yield { type: 'error', content: message };
  }
}

export function getAvailableModels(): { id: string; name: string; provider: string }[] {
  const models: { id: string; name: string; provider: string }[] = [];

  if (process.env.OPENAI_API_KEY) {
    models.push(
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    );
  }

  // Future: add Claude, Gemini, DeepSeek here

  return models;
}
