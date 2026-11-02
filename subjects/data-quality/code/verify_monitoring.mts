// Checks that the TypeScript detectors used by the monitoring lab give the same scores as 07_monitoring.py.
// Run from the repo root: node subjects/data-quality/code/verify_monitoring.mts   (Node 22.18 or newer)
import { readFileSync } from 'node:fs';
import {
  evaluate, evaluateFreshness, evaluationDays, loadedDays, naiveVolumeFlags, nullFixedFlags, nullRollingFlags, nullSpcFlags,
  weekdayVolumeFlags, type MonitorData, type Score,
} from '../../../site/src/components/labs/data-quality/monitorMath.ts';

const data = JSON.parse(readFileSync(new URL('../../../site/src/components/labs/data-quality/monitoring.json', import.meta.url), 'utf8')) as MonitorData;
let checked = 0;
let bad = 0;

function same(name: string, key: string, got: Score, want: Score) {
  checked++;
  const keys: (keyof Score)[] = ['tp', 'fp', 'fn', 'precision', 'recall', 'f1', 'f2'];
  const diff = keys.filter((k) => Math.abs(got[k] - want[k]) > 1e-9);
  if (diff.length) {
    bad++;
    console.log(`MISMATCH ${name} ${key}: ${diff.map((k) => `${k} ts=${got[k]} py=${want[k]}`).join(', ')}`);
  }
}

const loaded = loadedDays(data);
const all = evaluationDays(data);
for (const [x, want] of Object.entries(data.expected.freshness)) same('freshness', x, evaluateFreshness(data, Number(x)), want);
for (const [k, want] of Object.entries(data.expected.naive)) same('naive', k, evaluate(naiveVolumeFlags(data, Number(k)), data.volumeIncidentDays, loaded), want);
for (const [t, want] of Object.entries(data.expected.weekday)) same('weekday', t, evaluate(weekdayVolumeFlags(data, Number(t)), data.volumeIncidentDays, loaded), want);
for (const [t, want] of Object.entries(data.expected.nullFixed)) same('nullFixed', t, evaluate(nullFixedFlags(data, Number(t)), data.nullIncidentDays, all), want);
for (const [s, want] of Object.entries(data.expected.nullSpc)) same('nullSpc', s, evaluate(nullSpcFlags(data, Number(s)), data.nullIncidentDays, all), want);
for (const [j, want] of Object.entries(data.expected.nullRolling)) same('nullRolling', j, evaluate(nullRollingFlags(data, Number(j)), data.nullIncidentDays, all), want);

console.log(`${checked} parameter settings compared with the Python results, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
