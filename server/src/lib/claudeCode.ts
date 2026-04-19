import { query, type CanUseTool, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeCodeRequest {
  prompt: string;
  cwd: string;
  /** WorkPal chat id. NOT forwarded to the SDK (which requires a UUID) —
   *  kept here for the 5.4d permission-resolver Map keyed by chat. */
  sessionId?: string;
  /** 5.4d permission bridge. When set, the SDK calls this for every tool that
   *  isn't pre-approved by allow rules; the route's implementation forwards
   *  the request to the frontend PermissionPrompt modal over SSE and awaits
   *  the user's decision. Omit during tests / dev to fall back to the SDK's
   *  default `default` mode (which denies anything that would normally prompt
   *  on the CLI). */
  canUseTool?: CanUseTool;
}

export async function* runClaudeCode(
  req: ClaudeCodeRequest,
): AsyncGenerator<SDKMessage, void> {
  yield* query({
    prompt: req.prompt,
    options: {
      cwd: req.cwd,
      // 5.4d: no permissionMode override — runs in `default` so every tool not
      // pre-approved by allow rules falls through to canUseTool, which the
      // route bridges to the frontend modal.
      canUseTool: req.canUseTool,
    },
  });
}

/** Slim shape forwarded over SSE for Claude Agent SDK tool_use blocks. */
export interface ToolUseShape {
  id: string;
  name: string;
  input: unknown;
}

/** Slim shape forwarded over SSE for Claude Agent SDK tool_result blocks. */
export interface ToolResultShape {
  toolUseId: string;
  isError: boolean;
  summary: string;
}

const SUMMARY_MAX = 400;

/** Pick the fields the frontend needs from an assistant.content[] tool_use
 *  block. Returns null for anything that isn't a well-formed tool_use. */
export function shapeToolUse(block: unknown): ToolUseShape | null {
  if (!block || typeof block !== 'object') return null;
  const b = block as { type?: unknown; id?: unknown; name?: unknown; input?: unknown };
  if (b.type !== 'tool_use') return null;
  if (typeof b.id !== 'string' || typeof b.name !== 'string') return null;
  return { id: b.id, name: b.name, input: b.input };
}

/** Pick the fields the frontend needs from a user.content[] tool_result block.
 *  Flattens the possibly-structured `content` into a short plain-text summary.
 *  Returns null for anything that isn't a well-formed tool_result. */
export function shapeToolResult(block: unknown): ToolResultShape | null {
  if (!block || typeof block !== 'object') return null;
  const b = block as {
    type?: unknown;
    tool_use_id?: unknown;
    content?: unknown;
    is_error?: unknown;
  };
  if (b.type !== 'tool_result') return null;
  if (typeof b.tool_use_id !== 'string') return null;

  let summary = '';
  if (typeof b.content === 'string') {
    summary = b.content;
  } else if (Array.isArray(b.content)) {
    summary = b.content
      .filter(
        (c): c is { type: string; text: string } =>
          !!c &&
          typeof c === 'object' &&
          (c as { type?: unknown }).type === 'text' &&
          typeof (c as { text?: unknown }).text === 'string',
      )
      .map((c) => c.text)
      .join('\n');
  }
  if (summary.length > SUMMARY_MAX) {
    summary = summary.slice(0, SUMMARY_MAX) + '…';
  }

  return {
    toolUseId: b.tool_use_id,
    isError: Boolean(b.is_error),
    summary,
  };
}
