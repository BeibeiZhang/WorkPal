import { openai } from './llm.js';

export type EditPreset = 'shorter' | 'extend' | 'formal' | 'translate';

export function isEditPreset(v: unknown): v is EditPreset {
  return v === 'shorter' || v === 'extend' || v === 'formal' || v === 'translate';
}

export type EditChunk =
  | { type: 'text'; content: string }
  | { type: 'done' }
  | { type: 'error'; content: string };

const SYSTEM_PROMPT =
  'You are an article editor. Transform the article per the instruction. ' +
  'Return ONLY the rewritten article body as plain text. ' +
  'DO NOT wrap your output in <article> tags, XML, markdown code fences, or any delimiter — ' +
  'the input is wrapped in <article> tags only so you know where the content begins and ends; ' +
  'your response must be bare text. Do not add preamble or commentary. ' +
  'Preserve the existing structure: paragraphs (blank line between), bullet lines starting with "• ", ' +
  'and bold markers like **heading**. Do not add or remove sections unless the instruction explicitly says so.';

const INSTRUCTIONS: Record<EditPreset, string> = {
  shorter:
    'Make this more concise. Preserve key points and structure. Aim for ~60-70% of the original length.',
  extend:
    'Expand with more detail, examples, and context. Keep the original tone and structure.',
  formal:
    'Rewrite in a more formal, professional tone. Keep content and structure unchanged.',
  translate:
    'Detect the dominant language of the article. ' +
    'If it is mostly English, translate the whole article to 中文 (Simplified Chinese). ' +
    'If it is mostly Chinese, translate the whole article to English. ' +
    'Preserve paragraphs, bullets, and **bold** markers exactly.',
};

/** Yields text chunks as the rewrite streams from OpenAI, ending with `done`.
 *  Pass `signal` so the caller (Express route) can abort the OpenAI stream when
 *  the client disconnects mid-rewrite. */
export async function* streamEditArticle(
  articleText: string,
  preset: EditPreset,
  signal?: AbortSignal,
): AsyncGenerator<EditChunk> {
  const userPrompt = `<article>\n${articleText}\n</article>\n\nInstruction: ${INSTRUCTIONS[preset]}`;

  try {
    const stream = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      },
      signal ? { signal } : undefined,
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { type: 'text', content: delta.content };
      }
    }
    yield { type: 'done' };
  } catch (err) {
    // AbortError surfaces when the client disconnects — swallow quietly, the
    // route handler has already closed the SSE stream.
    if (err instanceof Error && err.name === 'AbortError') return;
    const message = err instanceof Error ? err.message : 'Edit failed';
    yield { type: 'error', content: message };
  }
}
