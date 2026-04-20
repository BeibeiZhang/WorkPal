/**
 * Lightweight markdown block renderer shared by chat bubbles and the
 * DetailPanel article view. Hand-rolled (no lib) because the surface is small
 * and styled against WorkPal's tokens directly — importing react-markdown +
 * typography plugin would be heavier than the feature warrants.
 *
 * Supported: paragraphs (blank-line separated) · bold **word** · inline
 * `code` · fenced ```code``` blocks · bullet lists (`• ` / `- ` / `* `) ·
 * numbered lists (`1. ` / `2. ` …).
 *
 * Not supported v1: headings, links, italic, tables, blockquotes, nested
 * lists. The model rarely emits these in chat; add when a real case shows up.
 */
import type { ReactNode } from 'react';

const LIST_BULLET = /^(\u2022|\*|-)\s+/;
const LIST_NUMBERED = /^\d+\.\s+/;
const INLINE_TOKENS = /(`[^`]+`|\*\*[^*]+\*\*)/g;

function renderInline(text: string): ReactNode[] {
  // Split by inline-code OR bold in one pass. Backtick spans win because the
  // regex hits them first per token; any `*` inside a code span stays literal.
  const parts = text.split(INLINE_TOKENS);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-bg-hover text-[0.9em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function renderMarkdownBlocks(text: string): ReactNode[] {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block — slurp until the closing fence (or EOF as a fallback
    // so a half-streamed code block still renders as code rather than collapsing
    // into plain paragraphs).
    if (line.startsWith('```')) {
      const start = i + 1;
      let end = start;
      while (end < lines.length && !lines[end].startsWith('```')) end++;
      const code = lines.slice(start, end).join('\n');
      blocks.push(
        <pre
          key={key++}
          className="mb-4 p-3 rounded-lg bg-bg-hover border border-stroke-outline overflow-x-auto text-[13px] font-mono leading-[1.5]"
        >
          <code>{code}</code>
        </pre>,
      );
      i = end < lines.length ? end + 1 : end;
      continue;
    }

    // Bullet list — consumes all consecutive bullet lines.
    if (LIST_BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && LIST_BULLET.test(lines[i])) {
        items.push(lines[i].replace(LIST_BULLET, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc ml-5 mb-4 space-y-1.5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Numbered list — consumes all consecutive `1. ` / `2. ` lines.
    if (LIST_NUMBERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && LIST_NUMBERED.test(lines[i])) {
        items.push(lines[i].replace(LIST_NUMBERED, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal ml-5 mb-4 space-y-1.5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line — paragraph separator, skip.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — consecutive non-blank, non-list, non-code-fence lines.
    // `whitespace-pre-wrap` preserves single-newline soft breaks inside a
    // paragraph (chat messages often use them as hard line breaks).
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !LIST_BULLET.test(lines[i]) &&
      !LIST_NUMBERED.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="mb-4 whitespace-pre-wrap last:mb-0">
        {renderInline(paraLines.join('\n'))}
      </p>,
    );
  }

  return blocks;
}
