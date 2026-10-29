import { useState } from 'react';

// Mirrors column_condition_partial + ColumnMapExpectation._validate (GX 1.24.1, pandas):
//   1. nulls are removed before the condition runs (filter_column_isnull, default True)
//   2. the condition says which rows are fine; the wrapper negates it to find the unexpected ones
//   3. nonnull_count = total - null_count, and success compares unexpected against nonnull_count
const PRESETS: Record<string, (number | null)[]> = {
  'ไม่มี null': [2, 4, 6, 7, 10, 11],
  'มี null สองแถว': [2, 4, null, 7, null, 11],
};
const CONDITIONS: Record<string, { label: string; ok: (n: number) => boolean }> = {
  even: { label: 'เป็นเลขคู่ (n % 2 == 0)', ok: (n) => n % 2 === 0 },
  big: { label: 'มากกว่า 5 (n > 5)', ok: (n) => n > 5 },
};

export default function RowJourney() {
  const [preset, setPreset] = useState('มี null สองแถว');
  const [cond, setCond] = useState('even');
  const [filterNull, setFilterNull] = useState(true);

  const values = PRESETS[preset];
  const { ok, label } = CONDITIONS[cond];

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
      <div className="viz-title">ตามดูแถวหนึ่งๆ ว่าเงื่อนไขของคุณเห็นอะไร</div>

      <div className="viz-controls">
        <div className="viz-steps" role="group" aria-label="ข้อมูล">
          {Object.keys(PRESETS).map((k) => (
            <button key={k} type="button" aria-pressed={preset === k} onClick={() => setPreset(k)}>{k}</button>
          ))}
        </div>
        <div className="viz-steps" role="group" aria-label="เงื่อนไข">
          {Object.entries(CONDITIONS).map(([k, c]) => (
            <button key={k} type="button" aria-pressed={cond === k} onClick={() => setCond(k)}>{c.label}</button>
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
              {r.stage === 'skip' && 'ถูกตัดออกก่อน เงื่อนไขของคุณไม่เคยเห็นแถวนี้'}
              {r.stage === 'ok' && `เงื่อนไขตอบ True: ${label}`}
              {r.stage === 'bad' && (r.v === null ? 'เงื่อนไขเห็น null และตอบ False จึงนับเป็น unexpected' : 'เงื่อนไขตอบ False จึงนับเป็น unexpected')}
            </span>
          </li>
        ))}
      </ul>

      <div className="gx-status" aria-live="polite">
        <div><span>element_count</span><b data-on="true">{total}</b></div>
        <div><span>missing_count</span><b data-on="true">{missing}</b></div>
        <div><span>ใช้คิดสัดส่วน (nonnull)</span><b data-on="true">{nonnull}</b></div>
        <div><span>unexpected_count</span><b data-on={impossible ? 'false' : 'true'}>{unexpected}</b></div>
        <div><span>unexpected_percent_nonmissing</span><b data-on={impossible ? 'false' : 'true'}>{pct.toFixed(1)}</b></div>
      </div>

      <div className="viz-now" data-bad={impossible || !success ? '' : undefined}>
        <strong>{impossible ? 'GX ผ่านผลนี้ไม่ได้' : success ? 'success = True' : 'success = False'}</strong>
        <span>
          {impossible
            ? `นับ unexpected ได้ ${unexpected} จากแถวที่ไม่ใช่ null เพียง ${nonnull} แถว (${pct.toFixed(0)}%) GX 1.24.1 สร้างผลไม่ได้และจับเป็น exception_info ที่ขึ้นต้นว่า "Invalid result values were found" ทดลองแล้วด้วยข้อมูลชุดมี null`
            : success
              ? 'ไม่มีแถวที่ผิด'
              : 'มีแถวที่ผิด และ mostly ค่าเริ่มต้นคือ 1 จึงไม่ผ่าน'}
        </span>
      </div>
      <p className="viz-caption">ถ้าอยากให้ null นับเป็นความผิดด้วย ให้เพิ่ม ExpectColumnValuesToNotBeNull ไว้ข้างๆ แทนการปิด filter_column_isnull</p>
    </figure>
  );
}
