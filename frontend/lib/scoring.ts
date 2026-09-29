// Pure scoring logic — no imports so it can be checked with `node scripts/check-scoring.ts`.

export type Criterion = { id: string; weight: number };

/** Weighted mean over the criteria that have been scored. */
export function weightedScore(scores: Record<string, number | undefined>, criteria: Criterion[]) {
  let total = 0;
  let weight = 0;
  for (const c of criteria) {
    const v = scores[c.id];
    if (v == null) continue;
    total += v * c.weight;
    weight += c.weight;
  }
  return weight ? total / weight : 0;
}

function meanSd(xs: number[]) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
}

export type RawScore = { judge: string; project: number; raw: number };

/**
 * Z-score normalization per judge, rescaled to the global distribution.
 * Removes "harsh judge / generous judge" bias. Judges with fewer than
 * two scores (or zero variance) pass through unchanged.
 */
export function normalize(entries: RawScore[]) {
  const out = new Map<string, number>();
  if (!entries.length) return out;
  const global = meanSd(entries.map((e) => e.raw));
  const byJudge = new Map<string, RawScore[]>();
  for (const e of entries) byJudge.set(e.judge, [...(byJudge.get(e.judge) ?? []), e]);
  for (const [judge, list] of byJudge) {
    const { mean, sd } = meanSd(list.map((e) => e.raw));
    for (const e of list) {
      const n = list.length < 2 || sd === 0 ? e.raw : global.mean + ((e.raw - mean) / sd) * global.sd;
      out.set(`${judge}:${e.project}`, Math.min(10, Math.max(0, n)));
    }
  }
  return out;
}

/** Mean normalized score per project. */
export function projectAverages(entries: RawScore[]) {
  const norm = normalize(entries);
  const acc = new Map<number, { raw: number[]; norm: number[] }>();
  for (const e of entries) {
    const a = acc.get(e.project) ?? { raw: [], norm: [] };
    a.raw.push(e.raw);
    a.norm.push(norm.get(`${e.judge}:${e.project}`)!);
    acc.set(e.project, a);
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return new Map([...acc].map(([p, a]) => [p, { raw: avg(a.raw), normalized: avg(a.norm), count: a.raw.length }]));
}
