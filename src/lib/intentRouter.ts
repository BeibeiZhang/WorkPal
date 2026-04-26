// Phase 5.4b — intent routing.
// Keyword heuristic, no classifier call. Covers English + Chinese (Beibei
// mixes both). Tweak the list here; keep it deterministic and cheap.

import { IS_DEMO } from './demoMode';
import { isAgentCurrentlyReachable } from './agent';

const CLAUDE_CODE_KEYWORDS = [
  // English
  'write', 'edit', 'create', 'file', 'code', 'rename',
  'refactor', 'save', 'delete', 'modify', 'update', 'generate',
  // Chinese
  '写', '写个', '创建', '新建', '修改', '改', '编辑',
  '删除', '重构', '生成', '保存', '代码', '文件',
];

function matchesClaudeCodeKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return CLAUDE_CODE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

/** Candidate #15 — mobile-aware 3-state intent. Caller passes `isMobile`
 *  rather than this module sniffing it, so the source of truth stays in the
 *  shared `useIsMobile` hook (matchMedia, not userAgent). Decision tree:
 *    - demo URL                               → 'fallback-cloud' (mocked)
 *    - no code-keyword match                  → 'fallback-cloud'
 *    - keyword match + agent reachable        → 'use-claude'
 *    - keyword match + unreachable + mobile   → 'mac-only-on-mobile'
 *      (mobile users get an inline AgentRequiredHint instead of a silent
 *       OpenAI fallback that would pretend to do file work)
 *    - keyword match + unreachable + Mac      → 'fallback-cloud'
 *      (Mac with agent restarting / probe-in-flight — keep today's quiet
 *       degrade since the OnboardingSurface still covers truly-uninstalled) */
export type AgentRouteIntent = 'use-claude' | 'fallback-cloud' | 'mac-only-on-mobile';

export function getAgentRouteIntent(text: string, isMobile: boolean): AgentRouteIntent {
  if (IS_DEMO) return 'fallback-cloud';
  if (!matchesClaudeCodeKeyword(text)) return 'fallback-cloud';
  if (isAgentCurrentlyReachable()) return 'use-claude';
  if (isMobile) return 'mac-only-on-mobile';
  return 'fallback-cloud';
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
