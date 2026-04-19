import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeCodeRequest {
  prompt: string;
  cwd: string;
  sessionId?: string;
}

export async function* runClaudeCode(
  req: ClaudeCodeRequest,
): AsyncGenerator<SDKMessage, void> {
  yield* query({
    prompt: req.prompt,
    options: {
      cwd: req.cwd,
      ...(req.sessionId ? { sessionId: req.sessionId } : {}),
    },
  });
}
