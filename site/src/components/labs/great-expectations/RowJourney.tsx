import { useState } from 'react';

type Lang = 'th' | 'en';

// Mirrors column_condition_partial + ColumnMapExpectation._validate (GX 1.24.1, pandas):
//   1. nulls are removed before the condition runs (filter_column_isnull, default True)
//   2. the condition says which rows are fine; the wrapper negates it to find the unexpected ones
//   3. nonnull_count = total - null_count, and success compares unexpected against nonnull_count
const PRESETS: Record<string, (number | null)[]> = {
  none: [2, 4, 6, 7, 10, 11],
  two: [2, 4, null, 7, null, 11],
};
const CONDITIONS: Record<string, { ok: (n: number) => boolean }> = {
  even: { ok: (n) => n % 2 === 0 },
  big: { ok: (n) => n > 5 },
};

const TEXT: Record<
  Lang,
  {
    presets: Record<string, string>;
    conds: Record<string, string>;
    title: string;
    dataLabel: string;
    condLabel: string;
    skipped: string;
    condTrue: (label: string) => string;
    nullBad: string;
    valueBad: string;
    nonnull: string;
    impossibleTitle: string;
    impossible: (unexpected: number, nonnull: number, pct: string) => string;
    noBad: string;
    someBad: string;
    caption: string;
  }
> = {
  th: {
    presets: { none: 'ไม่มี null', two: 'มี null สองแถว' },
    conds: { even: 'เป็นเลขคู่ (n % 2 == 0)', big: 'มากกว่า 5 (n > 5)' },
    title: 'ตามดูแถวหนึ่งๆ ว่าเงื่อนไขของคุณเห็นอะไร',
    dataLabel: 'ข้อมูล',
    condLabel: 'เงื่อนไข',
    skipped: 'ถูกตัดออกก่อน เงื่อนไขของคุณไม่เคยเห็นแถวนี้',
    condTrue: (label) => `เงื่อนไขตอบ True: ${label}`,
    nullBad: 'เงื่อนไขเห็น null และตอบ False จึงนับเป็น unexpected',
    valueBad: 'เงื่อนไขตอบ False จึงนับเป็น unexpected',
    nonnull: 'ใช้คิดสัดส่วน (nonnull)',
    impossibleTitle: 'GX ผ่านผลนี้ไม่ได้',
    impossible: (u, n, pct) => `นับ unexpected ได้ ${u} จากแถวที่ไม่ใช่ null เพียง ${n} แถว (${pct}%) GX 1.24.1 สร้างผลไม่ได้และจับเป็น exception_info ที่ขึ้นต้นว่า "Invalid result values were found" ทดลองแล้วด้วยข้อมูลชุดมี null`,
    noBad: 'ไม่มีแถวที่ผิด',
    someBad: 'มีแถวที่ผิด และ mostly ค่าเริ่มต้นคือ 1 จึงไม่ผ่าน',
    caption: 'ถ้าอยากให้ null นับเป็นความผิดด้วย ให้เพิ่ม ExpectColumnValuesToNotBeNull ไว้ข้างๆ แทนการปิด filter_column_isnull',
  },
  en: {
    presets: { none: 'No null', two: 'Two null rows' },
    conds: { even: 'is even (n % 2 == 0)', big: 'is greater than 5 (n > 5)' },
    title: 'Follow one row at a time and see what your condition sees',
    dataLabel: 'Data',
    condLabel: 'Condition',
    skipped: 'Removed first. Your condition never sees this row.',
    condTrue: (label) => `The condition says True: ${label}`,
    nullBad: 'The condition sees null and says False, so it counts as unexpected',
    valueBad: 'The condition says False, so it counts as unexpected',
    nonnull: 'Used for the percent (nonnull)',
    impossibleTitle: 'GX cannot accept this result',
    impossible: (u, n, pct) => `unexpected is ${u}, but only ${n} rows are not null (${pct}%). GX 1.24.1 cannot build the result and catches it as an exception_info that starts with "Invalid result values were found". Checked with the data set that has null.`,
    noBad: 'No row is wrong',
    someBad: 'Some rows are wrong, and the default of mostly is 1, so it does not pass',
    caption: 'If you also want null to count as a fault, add ExpectColumnValuesToNotBeNull next to it instead of turning off filter_column_isnull.',
  },
};

export default function RowJourney({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [preset, setPreset] = useState('two');
  const [cond, setCond] = useState('even');
  const [filterNull, setFilterNull] = useState(true);

  const values = PRESETS[preset];
  const { ok } = CONDITIONS[cond];
  const label = t.conds[cond];

  const rows = values.map((v) => {
    if (v === null && filterNull) return { v, stage: 'skip' as const };
    const passes = v !== null && ok(v); // a null never satisfies a comparison
    return { v, stage: passes ? ('ok' as const) : ('bad' as const) };
  });

  const total = values.length;
  const missing = values.filter((v) => v === null).length;
  const nonnull = total - missing;
  const unexpected = rows.filter((r) => r.stage === 'bad').length;
  const impossible = unexpected > nonnull;
  const pct = nonnull === 0 ? 0 : (unexpected / nonnull) * 100;
  const success = !impossible && unexpected === 0;

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>

      <div className="viz-controls">
        <div className="viz-steps" role="group" aria-label={t.dataLabel}>
          {Object.keys(PRESETS).map((k) => (
            <button key={k} type="button" aria-pressed={preset === k} onClick={() => setPreset(k)}>{t.presets[k]}</button>
          ))}
        </div>
        <div className="viz-steps" role="group" aria-label={t.condLabel}>
          {Object.keys(CONDITIONS).map((k) => (
            <button key={k} type="button" aria-pressed={cond === k} onClick={() => setCond(k)}>{t.conds[k]}</button>
          ))}
        </div>
        <div className="viz-steps" role="group" aria-label="filter_column_isnull">
          <button type="button" aria-pressed={filterNull} onClick={() => setFilterNull(true)}>filter_column_isnull = True</button>
          <button type="button" aria-pressed={!filterNull} onClick={() => setFilterNull(false)}>= False</button>
        </div>
      </div>

      <ul className="gx-results">
        {rows.map((r, i) => (
          <li key={i} data-ok={r.stage === 'bad' ? 'false' : 'true'}>
            <span className="gx-badge">{r.v === null ? 'null' : r.v}</span>
            <span className="gx-detail">
              {r.stage === 'skip' && t.skipped}
              {r.stage === 'ok' && t.condTrue(label)}
              {r.stage === 'bad' && (r.v === null ? t.nullBad : t.valueBad)}
            </span>
          </li>
        ))}
      </ul>

      <div className="gx-status" aria-live="polite">
        <div><span>element_count</span><b data-on="true">{total}</b></div>
        <div><span>missing_count</span><b data-on="true">{missing}</b></div>
        <div><span>{t.nonnull}</span><b data-on="true">{nonnull}</b></div>
        <div><span>unexpected_count</span><b data-on={impossible ? 'false' : 'true'}>{unexpected}</b></div>
        <div><span>unexpected_percent_nonmissing</span><b data-on={impossible ? 'false' : 'true'}>{pct.toFixed(1)}</b></div>
      </div>

      <div className="viz-now" data-bad={impossible || !success ? '' : undefined}>
        <strong>{impossible ? t.impossibleTitle : success ? 'success = True' : 'success = False'}</strong>
        <span>
          {impossible
            ? t.impossible(unexpected, nonnull, pct.toFixed(0))
            : success
              ? t.noBad
              : t.someBad}
        </span>
      </div>
      <p className="viz-caption">{t.caption}</p>
    </figure>
  );
}
