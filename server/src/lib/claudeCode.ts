import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeCodeRequest {
  prompt: string;
  cwd: string;
  /** WorkPal chat id. NOT forwarded to the SDK (which requires a UUID) —
   *  kept here for the 5.4d permission-resolver Map keyed by chat. */
  sessionId?: string;
}

export async function* runClaudeCode(
  req: ClaudeCodeRequest,
): AsyncGenerator<SDKMessage, void> {
  yield* query({
    prompt: req.prompt,
    options: {
      cwd: req.cwd,
    },
  });
}
