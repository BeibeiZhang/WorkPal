// Phase 5.4b — intent routing.
// Keyword heuristic, no classifier call. Covers English + Chinese (Beibei
// mixes both). Tweak the list here; keep it deterministic and cheap.

import { IS_AGENT_REACHABLE, IS_DEMO } from './demoMode';

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
  if (!IS_AGENT_REACHABLE) return false;
  const lower = text.toLowerCase();
  return CLAUDE_CODE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// Candidate #3 — artifact intent routing. Requires BOTH an artifact noun AND
// an action verb so "summarize this" / "总结一下" still flows to chat instead
// of spinning up a 10-30s Tavily + OpenAI pipeline. Keywords stay bilingual
// even in demo (principle #8 note — intent-routing is identification, not
// display). The function itself short-circuits false in demo because the
// demo Vercel project has no TAVILY/SUPABASE env.
const ARTIFACT_NOUNS = [
  // English
  'digest', 'newsletter', 'weekly', 'write-up', 'write up', 'guide', 'roundup',
  // Chinese
  '周报', '周刊', '月报', '指南', '合辑', '专辑',
];

const ARTIFACT_VERBS = [
  // English
  'write', 'make', 'create', 'generate', 'build',
  // Chinese
  '写', '做', '生成', '出一个', '出一份', '给我',
];

export function shouldGenerateArtifact(text: string): boolean {
  if (IS_DEMO) return false;
  const lower = text.toLowerCase();
  const hasNoun = ARTIFACT_NOUNS.some(n => lower.includes(n.toLowerCase()));
  if (!hasNoun) return false;
  const hasVerb = ARTIFACT_VERBS.some(v => lower.includes(v.toLowerCase()));
  return hasVerb;
}
