// Phase 5.4b — intent routing.
// Keyword heuristic, no classifier call. Covers English + Chinese (Beibei
// mixes both). Tweak the list here; keep it deterministic and cheap.

import { IS_CLAUDE_CODE_AVAILABLE } from './demoMode';

const CLAUDE_CODE_KEYWORDS = [
  // English
  'write', 'edit', 'create', 'file', 'code', 'rename',
  'refactor', 'save', 'delete', 'modify', 'update', 'generate',
  // Chinese
  '写', '写个', '创建', '新建', '修改', '改', '编辑',
  '删除', '重构', '生成', '保存', '代码', '文件',
];

export function shouldUseClaudeCode(text: string): boolean {
  // Claude Agent SDK needs a persistent cwd + native binary — neither Vercel
  // deployment can host it, only localhost dev. Short-circuit everywhere
  // else so code/file intents fall back to the OpenAI chat path instead of
  // trying to hit an endpoint that would 500.
  if (!IS_CLAUDE_CODE_AVAILABLE) return false;
  const lower = text.toLowerCase();
  return CLAUDE_CODE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}
