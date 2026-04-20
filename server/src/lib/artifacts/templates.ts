import type { ArtifactKind } from '../artifactStore.js';

/** Machine-friendly slug for a section inside a template. Templates are free
 *  to pick any key set; the ArtifactPage renders them generically. */
export interface TemplateCategory {
  key: string;
  /** Display labels — both languages stored so the page toggle has a title too. */
  labelEn: string;
  labelZh: string;
  /** Tavily query templates, one per category. Substitutions: `{topic}` → user
   *  topic (ad-hoc) or implicit template topic (e.g. "Bay Area this weekend"). */
  queries: string[];
}

export interface TemplateDef {
  id: string;
  kind: ArtifactKind;
  /** Used when the user didn't supply an ad-hoc topic (recurring runs). */
  defaultTopic: string;
  titleEn: string;
  titleZh: string;
  /** Short per-item shape guide baked into the OpenAI system prompt so the
   *  output JSON lines up with whatever the page renderer expects. */
  itemSchemaHint: string;
  /** Per-template min items before we flip to status='failed'. bay-area-weekend
   *  needs at least 3 to feel useful. */
  minItems: number;
  categories: TemplateCategory[];
}

const bayAreaWeekend: TemplateDef = {
  id: 'bay-area-weekend',
  kind: 'webpage',
  defaultTopic: 'Bay Area this weekend',
  titleEn: 'Bay Area Weekend Digest',
  titleZh: '湾区周末指南',
  itemSchemaHint:
    'Each item must have: title, location (neighborhood or venue), price (string — "$20", "Free", or "$15-$40"), ' +
    'date (date or date-range string for this weekend), url (official/source link), imageUrl (absolute https:// URL from the search results).',
  minItems: 8,
  categories: [
    {
      key: 'festivals',
      labelEn: 'Festivals',
      labelZh: '节日',
      queries: [
        'Bay Area festivals this weekend {weekLabel}',
        'San Francisco festival events {weekLabel}',
      ],
    },
    {
      key: 'events',
      labelEn: 'Events',
      labelZh: '活动',
      queries: [
        'Bay Area events this weekend {weekLabel}',
        'things to do San Francisco Oakland {weekLabel}',
      ],
    },
    {
      key: 'exhibitions',
      labelEn: 'Exhibitions',
      labelZh: '展览',
      queries: [
        'Bay Area art exhibitions this weekend {weekLabel}',
        'San Francisco museum shows {weekLabel}',
      ],
    },
    {
      key: 'markets',
      labelEn: 'Markets & Fairs',
      labelZh: '集市',
      queries: [
        'Bay Area farmers market fair this weekend {weekLabel}',
        'San Francisco flea market craft fair {weekLabel}',
      ],
    },
  ],
};

const REGISTRY: Record<string, TemplateDef> = {
  [bayAreaWeekend.id]: bayAreaWeekend,
};

export function getTemplate(id: string): TemplateDef | null {
  return REGISTRY[id] ?? null;
}

export function listTemplateIds(): string[] {
  return Object.keys(REGISTRY);
}

/** ISO week key (e.g. "2026-W16"). Used as part of the recurring slug and as
 *  the idempotency guard for cron reruns. */
export function currentWeekKey(now: Date = new Date()): string {
  // ISO 8601 week: Thursday of the week defines the year.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Human week label for Tavily queries — "weekend of April 25, 2026". */
export function weekLabelFor(now: Date = new Date()): string {
  // Next Saturday (upcoming weekend). If today is Sun–Fri, Saturday is this week;
  // if today is Sat, return today.
  const d = new Date(now);
  const dow = d.getDay();
  const daysUntilSat = (6 - dow + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Slug builder. Recurring = deterministic, idempotent. Ad-hoc = random short id. */
export function buildSlug(templateId: string, weekKey: string | null): string {
  if (weekKey) return `${templateId}-${weekKey}`;
  // nanoid-lite: 6 chars, URL-safe, collision-free enough for our volume.
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${templateId}-${s}`;
}
