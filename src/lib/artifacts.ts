/**
 * Artifact helpers — tiny pure functions used by the streaming loop in App.tsx
 * and anywhere a file_path needs to become an `ArtifactRef`. Kept lib-side
 * (not in shared.tsx) because there's no JSX here.
 */
import type { ArtifactRef, OutputType } from '../types';

/** Last segment of a forward-slash path. Bare filename in, bare filename out.
 *  Not defensive against Windows separators — we only ever receive POSIX
 *  paths from the Agent SDK on macOS. */
export function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

const EXT_TO_OUTPUT: Record<string, OutputType> = {
  html: 'Web',
  htm: 'Web',
  css: 'Web',
  js: 'Web',
  jsx: 'Web',
  ts: 'Web',
  tsx: 'Web',
  pptx: 'Slides',
  ppt: 'Slides',
  key: 'Slides',
  pdf: 'Slides',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
  gif: 'Image',
  webp: 'Image',
  svg: 'Image',
  mp4: 'Video',
  mov: 'Video',
  webm: 'Video',
};

/** Derive the Output category tag from a filename's extension. Anything we
 *  don't have a specific bucket for falls through to 'File' — e.g. .md /
 *  .txt / .json / plain scripts render with the generic file icon. */
export function outputTypeFromPath(path: string): OutputType {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return 'File';
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_OUTPUT[ext] ?? 'File';
}

/** Build an `ArtifactRef` for a Claude-Code file_path. The card click is
 *  handled app-side (no href here) so the open-file endpoint can resolve the
 *  absolute path against WORKPAL_ROOT and spawn `open`. */
export function artifactFromClaudePath(absolutePath: string): ArtifactRef {
  return {
    name: basename(absolutePath),
    fileType: outputTypeFromPath(absolutePath),
    path: absolutePath,
    source: 'claude-code',
  };
}
