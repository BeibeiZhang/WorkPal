import { formatUsd, type UsageSummary } from './usage';

/* ── Subscription Health Check ──
   Published subscription quotas (soft approximations — OpenAI/Anthropic
   adjust these periodically). Each dimension maps to one capability bucket
   in the usage summary. `null` means the plan doesn't support that dimension
   at all (different from "0 used"), which the verdict logic treats as "API
   is the only option for this kind of work". */

export type DimensionKey = 'chat' | 'voice_minutes' | 'web_query' | 'images' | 'agent';

export interface Plan {
  name: string;
  price: number;
  /** null = capability not offered. number = monthly quota. */
  quotas: Record<DimensionKey, number | null>;
}

export const SUBSCRIPTION_PLANS: Plan[] = [
  {
    name: 'ChatGPT Plus',
    price: 20,
    quotas: {
      chat: 2400,          // ~80 msg / 3h → ~640/day, heavily underused
      voice_minutes: 1800, // ~30h/mo Advanced Voice
      web_query: 25,       // Deep Research
      images: 2400,        // shares chat limit
      agent: null,         // no Claude-style agent / code mode
    },
  },
  {
    name: 'Claude Pro',
    price: 20,
    quotas: {
      chat: 1000,          // ~45 msg / 5h shared
      voice_minutes: null, // no voice product
      web_query: null,     // no Deep Research product
      images: 1000,
      agent: 1000,         // Cowork / Code shares chat quota
    },
  },
];

export interface HealthDimension {
  key: DimensionKey;
  label: string;
  used: number;
  unit: string;
  /** Per-plan quotas, aligned to SUBSCRIPTION_PLANS order. */
  quotas: (number | null)[];
}

export interface HealthReport {
  monthlyApiCost: number;
  verdict: string;
  verdictTone: 'win' | 'even' | 'sub-better';
  dimensions: HealthDimension[];
  planFitStatus: Array<{ plan: Plan; fits: boolean; blockers: string[] }>;
}

export function scaleToMonth(value: number, rangeDays: number): number {
  if (rangeDays <= 0) return 0;
  return (value / rangeDays) * 30;
}

export function computeHealth(spend: UsageSummary | null, rangeDays: number): HealthReport | null {
  if (!spend) return null;

  // Normalize all counts to "per 30 days" so we can compare against monthly
  // subscription quotas regardless of the 1/7/30 tab selection.
  const capMap = new Map(spend.by_capability.map(c => [c.capability, c]));
  const chatTurns = Math.round(scaleToMonth(capMap.get('chat')?.call_count ?? 0, rangeDays));
  const voiceMin = Math.round(scaleToMonth(capMap.get('voice')?.voice_minutes ?? 0, rangeDays));
  const webQueries = Math.round(scaleToMonth(capMap.get('web_query')?.call_count ?? 0, rangeDays));
  const agentRuns = Math.round(scaleToMonth(capMap.get('agent')?.call_count ?? 0, rangeDays));
  const images = Math.round(scaleToMonth(spend.total_images_uploaded, rangeDays));
  const monthlyApiCost = scaleToMonth(spend.total_cost_usd, rangeDays);

  const dimensions: HealthDimension[] = [
    {
      key: 'chat',
      label: 'Text chat',
      used: chatTurns,
      unit: 'msgs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.chat),
    },
    {
      key: 'voice_minutes',
      label: 'Voice mode',
      used: voiceMin,
      unit: 'min/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.voice_minutes),
    },
    {
      key: 'web_query',
      label: 'Deep research',
      used: webQueries,
      unit: 'runs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.web_query),
    },
    {
      key: 'images',
      label: 'Image uploads',
      used: images,
      unit: 'imgs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.images),
    },
    {
      key: 'agent',
      label: 'Claude Agent (write / edit files)',
      used: agentRuns,
      unit: 'runs/mo',
      quotas: SUBSCRIPTION_PLANS.map(p => p.quotas.agent),
    },
  ];

  // For each plan (solo + combo), can the usage fit inside quotas? A quota
  // of `null` means the plan doesn't offer that capability — if usage > 0
  // there, the plan fails (user would need API or a different plan).
  const evalPlan = (plans: Plan[]): { fits: boolean; blockers: string[] } => {
    const blockers: string[] = [];
    const combined: Record<DimensionKey, number | null> = {
      chat: 0, voice_minutes: 0, web_query: 0, images: 0, agent: 0,
    };
    for (const p of plans) {
      for (const k of Object.keys(p.quotas) as DimensionKey[]) {
        const q = p.quotas[k];
        if (q === null) continue;
        const cur = combined[k];
        combined[k] = (cur ?? 0) + q;
      }
    }
    for (const d of dimensions) {
      const q = combined[d.key];
      if (d.used === 0) continue;
      if (q === null || q === 0) {
        blockers.push(`${d.label} (not supported)`);
      } else if (d.used > q) {
        blockers.push(`${d.label} (${d.used.toLocaleString()} > ${q.toLocaleString()} ${d.unit})`);
      }
    }
    return { fits: blockers.length === 0, blockers };
  };

  const planFitStatus = [
    { plan: SUBSCRIPTION_PLANS[0], ...evalPlan([SUBSCRIPTION_PLANS[0]]) },
    { plan: SUBSCRIPTION_PLANS[1], ...evalPlan([SUBSCRIPTION_PLANS[1]]) },
    {
      plan: { name: 'Plus + Claude Pro', price: 40, quotas: SUBSCRIPTION_PLANS[0].quotas },
      ...evalPlan(SUBSCRIPTION_PLANS),
    },
  ];

  // Verdict logic: pick the cheapest plan that fits your usage; compare its
  // price to your normalized monthly API cost. Three possible outcomes.
  const fittingPlan = planFitStatus.find(p => p.fits);
  let verdict: string;
  let verdictTone: HealthReport['verdictTone'];
  if (!fittingPlan) {
    verdict = `No $20–$40 subscription covers your usage pattern (${planFitStatus[2].blockers.slice(0, 2).join(', ')}). API direct at ${formatUsd(monthlyApiCost)}/mo is effectively the only option.`;
    verdictTone = 'win';
  } else if (monthlyApiCost < fittingPlan.plan.price) {
    const savings = fittingPlan.plan.price - monthlyApiCost;
    verdict = `API direct costs ${formatUsd(monthlyApiCost)}/mo — cheaper than ${fittingPlan.plan.name} ($${fittingPlan.plan.price}/mo). You save ~${formatUsd(savings)}/mo.`;
    verdictTone = 'win';
  } else {
    const extra = monthlyApiCost - fittingPlan.plan.price;
    verdict = `${fittingPlan.plan.name} ($${fittingPlan.plan.price}/mo) would cover your usage. API direct at ${formatUsd(monthlyApiCost)}/mo costs ~${formatUsd(extra)}/mo more.`;
    verdictTone = 'sub-better';
  }

  return { monthlyApiCost, verdict, verdictTone, dimensions, planFitStatus };
}
