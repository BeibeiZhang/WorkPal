// Phase 5.4b — intent routing.
// Keyword heuristic, no classifier call. Covers English + Chinese (Beibei
// mixes both). Tweak the list here; keep it deterministic and cheap.

const CLAUDE_CODE_KEYWORDS = [
  // English
  'write', 'edit', 'create', 'file', 'code', 'rename',
  'refactor', 'save', 'delete', 'modify', 'update', 'generate',
  // Chinese
  '写', '写个', '创建', '新建', '修改', '改', '编辑',
  '删除', '重构', '生成', '保存', '代码', '文件',
];

export function shouldUseClaudeCode(text: string): boolean {
  const lower = text.toLowerCase();
  return CLAUDE_CODE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}
