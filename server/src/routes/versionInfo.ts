import { Router } from 'express';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSemver, compareSemver } from '../lib/semver.js';

const router = Router();

const FETCH_TIMEOUT_MS = 5000;
const GITHUB_API_LATEST = 'https://api.github.com/repos/BeibeiZhang/WorkPal/releases/latest';

const CLAUDE_MODELS = [
  'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-5', 'claude-opus-4',
  'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4',
  'claude-haiku-4-5', 'claude-haiku-4',
];
const OPENAI_TEXT_MODELS = ['gpt-4o', 'gpt-4o-mini'];
const OPENAI_VOICE_MODELS = ['gpt-4o-realtime-preview', 'whisper-1'];

interface VersionRow {
  id: string;
  label: string;
  current: string;
  latest: string | null;
  status: 'up-to-date' | 'update-available' | 'unknown';
  error?: string;
}

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const merged: RequestInit = { ...init, signal: ctrl.signal };
  return fetch(url, merged).finally(() => clearTimeout(timer));
}

function readPkgVersion(require: NodeRequire, pkg: string): string {
  const json = require(`${pkg}/package.json`) as { version: string };
  return json.version;
}

async function checkAgent(): Promise<VersionRow> {
  const row: VersionRow = { id: 'workpal-agent', label: 'WorkPal Agent', current: '', latest: null, status: 'unknown' };
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const agentPkg = path.resolve(dir, '..', '..', '..', 'agent', 'package.json');
    const raw = await fs.readFile(agentPkg, 'utf-8');
    row.current = (JSON.parse(raw) as { version: string }).version;
  } catch {
    row.error = 'Could not read agent/package.json';
    return row;
  }

  try {
    const res = await timedFetch(GITHUB_API_LATEST, {
      headers: { 'User-Agent': 'WorkPal-Server', Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      row.error = `GitHub API returned ${res.status}`;
      return row;
    }
    const json = (await res.json()) as { tag_name?: string };
    if (typeof json.tag_name !== 'string') { row.error = 'Missing tag_name'; return row; }

    row.latest = json.tag_name.replace(/^v/, '');
    const cur = parseSemver(row.current);
    const lat = parseSemver(json.tag_name);
    if (!cur || !lat) { row.status = 'unknown'; return row; }
    row.status = compareSemver(lat, cur) > 0 ? 'update-available' : 'up-to-date';
  } catch (err) {
    row.error = err instanceof Error ? err.message : 'GitHub fetch failed';
  }
  return row;
}

async function checkNpmPackage(
  id: string, label: string, require: NodeRequire, pkg: string,
): Promise<VersionRow> {
  const row: VersionRow = { id, label, current: '', latest: null, status: 'unknown' };
  try {
    row.current = readPkgVersion(require, pkg);
  } catch {
    row.error = `Could not read installed ${pkg} version`;
    return row;
  }

  try {
    const res = await timedFetch(`https://registry.npmjs.org/${pkg}/latest`);
    if (!res.ok) { row.error = `npm registry returned ${res.status}`; return row; }
    const json = (await res.json()) as { version?: string };
    if (typeof json.version !== 'string') { row.error = 'Missing version in registry response'; return row; }

    row.latest = json.version;
    const cur = parseSemver(row.current);
    const lat = parseSemver(json.version);
    if (!cur || !lat) { row.status = 'unknown'; return row; }
    row.status = compareSemver(lat, cur) > 0 ? 'update-available' : 'up-to-date';
  } catch (err) {
    row.error = err instanceof Error ? err.message : 'npm fetch failed';
  }
  return row;
}

async function fetchOpenAIModels(apiKey: string): Promise<Set<string>> {
  const res = await timedFetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models API returned ${res.status}`);
  const json = (await res.json()) as { data?: { id: string }[] };
  return new Set((json.data ?? []).map((m) => m.id));
}

function checkModelsAgainstSet(
  id: string, label: string, knownIds: string[], available: Set<string>,
): VersionRow {
  const missing = knownIds.filter((m) => !available.has(m));
  return {
    id,
    label,
    current: knownIds.join(', '),
    latest: missing.length === 0
      ? `All ${knownIds.length} verified`
      : `Missing: ${missing.join(', ')}`,
    status: missing.length === 0 ? 'up-to-date' : 'update-available',
  };
}

async function checkClaudeModels(): Promise<VersionRow> {
  const row: VersionRow = {
    id: 'claude-models', label: 'Claude Models',
    current: CLAUDE_MODELS.join(', '), latest: null, status: 'unknown',
  };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { row.error = 'ANTHROPIC_API_KEY not configured'; return row; }

  try {
    const res = await timedFetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (!res.ok) { row.error = `Anthropic models API returned ${res.status}`; return row; }
    const json = (await res.json()) as { data?: { id: string }[] };
    const available = new Set((json.data ?? []).map((m) => m.id));
    const missing = CLAUDE_MODELS.filter((m) => !available.has(m));
    row.latest = missing.length === 0
      ? `All ${CLAUDE_MODELS.length} verified`
      : `Missing: ${missing.join(', ')}`;
    row.status = missing.length === 0 ? 'up-to-date' : 'update-available';
  } catch (err) {
    row.error = err instanceof Error ? err.message : 'Anthropic fetch failed';
  }
  return row;
}

async function checkOpenAIGroup(
  id: string, label: string, knownIds: string[],
  modelsPromise: Promise<Set<string>>,
): Promise<VersionRow> {
  const row: VersionRow = {
    id, label, current: knownIds.join(', '), latest: null, status: 'unknown',
  };
  try {
    const available = await modelsPromise;
    const result = checkModelsAgainstSet(id, label, knownIds, available);
    return result;
  } catch (err) {
    row.error = err instanceof Error ? err.message : 'OpenAI fetch failed';
    return row;
  }
}

router.get('/version-info', async (_req, res) => {
  const require = createRequire(import.meta.url);

  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiModelsPromise = openaiKey
    ? fetchOpenAIModels(openaiKey)
    : Promise.reject(new Error('OPENAI_API_KEY not configured'));

  const results = await Promise.allSettled([
    checkAgent(),
    checkNpmPackage('claude-sdk', 'Claude SDK', require, '@anthropic-ai/claude-agent-sdk'),
    checkNpmPackage('openai-sdk', 'OpenAI SDK', require, 'openai'),
    checkClaudeModels(),
    checkOpenAIGroup('openai-text', 'OpenAI Text / Chat', OPENAI_TEXT_MODELS, openaiModelsPromise),
    checkOpenAIGroup('openai-voice', 'OpenAI Voice', OPENAI_VOICE_MODELS, openaiModelsPromise),
  ]);

  const rows: VersionRow[] = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: 'unknown', label: 'Unknown', current: '', latest: null, status: 'unknown' as const, error: String(r.reason) },
  );

  res.json({ rows, checkedAt: new Date().toISOString() });
});

export default router;
