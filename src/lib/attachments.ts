import * as pdfjs from 'pdfjs-dist';
// Vite turns `?url` imports into asset URLs — this points the worker at the
// bundled pdf.worker.mjs so PDF parsing runs off the main thread.
// @ts-expect-error — Vite-specific import suffix
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Attachment } from '../types';
import { streamChat } from './api';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Cap per-file extracted text so one huge PDF can't blow up the prompt.
 *  ~30k chars ≈ 7-8k tokens — plenty for a resume or short doc, safe for context. */
const MAX_TEXT_PER_FILE = 30_000;

/** Convert a data URL into a Uint8Array for pdfjs. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Extract plain text from a PDF data URL. Returns empty string on failure
 *  so one broken attachment doesn't break the whole send. */
export async function extractPdfText(dataUrl: string): Promise<string> {
  try {
    const bytes = dataUrlToBytes(dataUrl);
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    const pageTexts: string[] = [];
    let totalLen = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText);
      totalLen += pageText.length;
      if (totalLen > MAX_TEXT_PER_FILE) break;
    }
    const joined = pageTexts.join('\n\n').slice(0, MAX_TEXT_PER_FILE);
    return joined.trim();
  } catch {
    return '';
  }
}

/** Plain-text MIME prefixes we can safely read straight from the data URL. */
const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml'];

function isTextMime(mime: string): boolean {
  return TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

async function extractTextFileContent(dataUrl: string): Promise<string> {
  try {
    const b64 = dataUrl.split(',')[1] || '';
    const decoded = atob(b64);
    // atob produces a binary string; decode as UTF-8
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes).slice(0, MAX_TEXT_PER_FILE).trim();
  } catch {
    return '';
  }
}

/** Extract readable text from a non-image attachment (PDFs, .txt, .md, .json, .csv).
 *  Returns null for attachments we can't read (binary blobs, images — images are
 *  handled separately via the multimodal image path). */
export async function extractAttachmentText(att: Attachment): Promise<string | null> {
  if (att.kind === 'image') return null;
  if (att.mimeType === 'application/pdf') {
    const text = await extractPdfText(att.dataUrl);
    return text || null;
  }
  if (isTextMime(att.mimeType)) {
    const text = await extractTextFileContent(att.dataUrl);
    return text || null;
  }
  return null;
}

/** Run extraction over a batch and format as a prompt-ready block.
 *  Returns null if nothing was extractable. The preamble is explicit so the
 *  model doesn't fall back on its prior of "I can't read PDFs" — several early
 *  tries confirmed the model would otherwise deny it had the content. */
export async function buildAttachmentContextBlock(attachments: Attachment[]): Promise<string | null> {
  const candidates = attachments.filter((a) => a.kind !== 'image');
  if (candidates.length === 0) return null;
  const results = await Promise.all(
    candidates.map(async (a) => {
      const text = await extractAttachmentText(a);
      return text ? { name: a.name, text } : null;
    }),
  );
  const blocks = results
    .filter((r): r is { name: string; text: string } => r !== null)
    .map((r) => `[FILE: ${r.name}]\n${r.text}\n[END FILE: ${r.name}]`);
  if (blocks.length === 0) return null;
  const preamble = blocks.length === 1
    ? 'The user attached a file. Its full text content is included below — treat this as readable file content you have access to, not an inability to open the file. Use it to answer the question that follows.'
    : `The user attached ${blocks.length} files. The full text content of each is included below — treat these as readable file contents you have access to, not an inability to open files. Use them to answer the question that follows.`;
  return `${preamble}\n\n${blocks.join('\n\n')}`;
}

/** Ask the vision model to describe one image, and return a promise of the
 *  text description. Used for voice mode, where the Realtime API does not
 *  accept image input — describing the image server-side and injecting the
 *  description as text keeps the voice agent aware of what the user shared. */
async function describeOneImage(att: Attachment): Promise<string> {
  const messages = [{
    role: 'user' as const,
    content: 'Describe this image in detail for a voice assistant that cannot see it. Include any visible text verbatim. Keep it under 200 words.',
    images: [att.dataUrl],
  }];
  let result = '';
  try {
    for await (const chunk of streamChat(messages)) {
      if (chunk.type === 'text') result += chunk.content;
      else if (chunk.type === 'error') return '';
    }
  } catch {
    return '';
  }
  return result.trim();
}

/** Batch-describe image attachments for voice-mode injection. Returns a single
 *  prompt-ready block or null if nothing could be described. */
export async function buildImageDescriptionBlock(attachments: Attachment[]): Promise<string | null> {
  const images = attachments.filter((a) => a.kind === 'image');
  if (images.length === 0) return null;
  const results = await Promise.all(
    images.map(async (a) => {
      const desc = await describeOneImage(a);
      return desc ? { name: a.name, desc } : null;
    }),
  );
  const blocks = results
    .filter((r): r is { name: string; desc: string } => r !== null)
    .map((r) => `[IMAGE: ${r.name}]\n${r.desc}\n[END IMAGE: ${r.name}]`);
  if (blocks.length === 0) return null;
  const preamble = blocks.length === 1
    ? 'The user attached an image. A vision model described it below — treat this as what you can see in the image. Use it to answer the question that follows.'
    : `The user attached ${blocks.length} images. A vision model described them below — treat these as what you can see. Use them to answer the question that follows.`;
  return `${preamble}\n\n${blocks.join('\n\n')}`;
}
