// Detectors and scores for the monitoring lab. Pure functions, no DOM, so node can check them against the
// numbers that subjects/data-quality/code/07_monitoring.py computed (see verify_monitoring.mts there).

export interface Gap { start: number; length: number; incident: boolean }

export interface MonitorData {
  start: string;
  days: number;
  calibrationDays: number;
  weekday: number[];
  rows: number[];
  nullRate: number[];
  volumeIncidentDays: number[];
  nullIncidentDays: number[];
  gaps: Gap[];
  expected: Record<string, Record<string, Score>>;
}

export interface Score { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number; f2: number }

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pstdev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const round4 = (x: number) => Math.round(x * 10000) / 10000;

export function score(tp: number, fp: number, fn: number): Score {
  const p = tp + fp ? tp / (tp + fp) : 0;
  const r = tp + fn ? tp / (tp + fn) : 0;
  const f = (b: number) => (p + r ? ((1 + b * b) * p * r) / (b * b * p + r) : 0);
  return { tp, fp, fn, precision: round4(p), recall: round4(r), f1: round4(f(1)), f2: round4(f(2)) };
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

export function freshnessFlags(d: MonitorData, minDays: number): Set<number> {
  return new Set(d.gaps.flatMap((g, i) => (g.length >= minDays ? [i] : [])));
}

export function naiveVolumeFlags(d: MonitorData, k: number): Set<number> {
  const cal = d.rows.slice(0, d.calibrationDays);
  const mu = mean(cal);
  const sd = pstdev(cal);
  return new Set(range(d.calibrationDays, d.days).filter((i) => d.rows[i] > 0 && (d.rows[i] - mu) / sd < -k));
}

export function weekdayVolumeFlags(d: MonitorData, ratio: number): Set<number> {
  const out = new Set<number>();
  for (const i of range(d.calibrationDays, d.days)) {
    if (d.rows[i] === 0) continue;
    const prev: number[] = [];
    for (let e = i - 7; e >= 0 && prev.length < 4; e -= 7) if (d.rows[e] > 0) prev.push(d.rows[e]);
    if (prev.length && d.rows[i] / median(prev) < ratio) out.add(i);
  }
  return out;
}

export function nullFixedFlags(d: MonitorData, threshold: number): Set<number> {
  return new Set(range(d.calibrationDays, d.days).filter((i) => d.nullRate[i] > threshold));
}

export function nullSpcFlags(d: MonitorData, sigmas: number): Set<number> {
  const cal = d.nullRate.slice(0, d.calibrationDays);
  const limit = mean(cal) + sigmas * pstdev(cal);
  return new Set(range(d.calibrationDays, d.days).filter((i) => d.nullRate[i] > limit));
}

export function nullRollingFlags(d: MonitorData, jump: number): Set<number> {
  return new Set(range(d.calibrationDays, d.days).filter((i) => d.nullRate[i] - median(d.nullRate.slice(i - 14, i)) > jump));
}

export function evaluate(flags: Set<number>, truth: number[], universe: Set<number>): Score {
  const t = new Set(truth.filter((x) => universe.has(x)));
  const tp = [...flags].filter((x) => t.has(x)).length;
  return score(tp, flags.size - tp, t.size - tp);
}

export function loadedDays(d: MonitorData): Set<number> {
  return new Set(range(d.calibrationDays, d.days).filter((i) => d.rows[i] > 0));
}

export function evaluationDays(d: MonitorData): Set<number> {
  return new Set(range(d.calibrationDays, d.days));
}

export function evaluateFreshness(d: MonitorData, minDays: number): Score {
  const flagged = freshnessFlags(d, minDays);
  const truth = d.gaps.flatMap((g, i) => (g.incident ? [i] : []));
  const tp = truth.filter((i) => flagged.has(i)).length;
  return score(tp, flagged.size - tp, truth.length - tp);
}
