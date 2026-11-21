import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './plans.json';

// Shows:      the first 12 rows of the Parquet file as a grid (7 columns), and which cells the scan reads for the query "total per product, north only"
//             under four plans: both pushdowns on, either off, both off. The real explain() lines for the scan are printed beside the grid.
// Because:    "pushdown" is a statement about what is read from the file, and a grid with a count of cells read says it better than the word does.
// Control:    two switches (predicate pushdown, projection pushdown). Cells change between "not read", "read then thrown away" and "kept".
// Conclusion: with both pushdowns the scan reads only the columns the query needs and only the rows that pass the filter.
//
// The plan lines are the output of explain() in exercises/06_lazy_and_optimizer.py --write; the 12 rows are the first rows of that exercise's data.

const USED = ['region', 'product', 'qty', 'price'];
const CW = 78;
const RH = 24;
const X0 = 16;
const Y0 = 92;

type Plans = Record<string, string[]>;
const PLANS = data.plans as Plans;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pred: string; proj: string; on: string; off: string;
  read: (n: number, of: number) => string; means: Record<string, string>; caption: string; scan: string; unused: string;
}> = {
  th: {
    title: 'ยอดขายรวมต่อสินค้าเฉพาะภาค north สลับ Pushdown แล้วดูว่า Scan อ่านเซลล์ไหนจากไฟล์',
    legend: [{ kind: 'new', text: 'อ่านและใช้ต่อ' }, { kind: 'use', text: 'อ่านแล้วทิ้งทีหลัง' }, { kind: 'skip', text: 'ไม่ได้อ่านเลย' }],
    pred: 'Predicate Pushdown (ดัน filter ลง Scan)', proj: 'Projection Pushdown (อ่านเฉพาะคอลัมน์ที่ใช้)', on: 'เปิด', off: 'ปิด',
    read: (n, of) => `Scan อ่าน ${n} จาก ${of} เซลล์ของตัวอย่างนี้`,
    scan: 'บรรทัดของ Scan จาก explain()',
    unused: 'คอลัมน์ที่คำถามนี้ไม่ใช้',
    means: {
      both: 'เปิดทั้งสอง Scan อ่านแค่ 4 คอลัมน์ และแถวที่ไม่ใช่ north ไม่ถูกส่งต่อ',
      no_predicate: 'ปิด Predicate Pushdown ทุกแถวถูกอ่านขึ้นมา แล้วค่อยกรองทีหลัง (FILTER อยู่เหนือ Scan)',
      no_projection: 'ปิด Projection Pushdown Scan อ่านทั้ง 7 คอลัมน์ (PROJECT */7) ทั้งที่ใช้แค่ 4',
      none: 'ปิดทั้งสอง อ่านทุกเซลล์ แล้วทิ้งส่วนใหญ่ทีหลัง คำตอบสุดท้ายยังเท่าเดิม',
    },
    caption: 'บรรทัดของ Scan เป็นผลของ explain() จริงใน exercises/06 (Parquet 200,000 แถว) ส่วนตารางเซลล์เป็นภาพจำลองจาก 12 แถวแรกของข้อมูลนั้น จำนวนเซลล์ในภาพไม่ใช่จำนวนจริงของไฟล์',
  },
  en: {
    title: 'Total per product, north only. Switch the pushdowns and see which cells the scan reads from the file',
    legend: [{ kind: 'new', text: 'read and used' }, { kind: 'use', text: 'read, thrown away later' }, { kind: 'skip', text: 'never read' }],
    pred: 'Predicate pushdown (filter moves into the scan)', proj: 'Projection pushdown (read only needed columns)', on: 'on', off: 'off',
    read: (n, of) => `The scan reads ${n} of ${of} cells of this sample`,
    scan: 'scan lines of explain()',
    unused: 'columns this query does not use',
    means: {
      both: 'Both on: the scan reads only 4 columns, and rows that are not north are not passed on',
      no_predicate: 'Predicate pushdown off: every row is read and filtered later (a FILTER above the scan)',
      no_projection: 'Projection pushdown off: the scan reads all 7 columns (PROJECT */7) though only 4 are used',
      none: 'Both off: every cell is read and most are thrown away later. The final answer is the same',
    },
    caption: 'The scan lines are real explain() output from exercises/06 (a 200,000-row Parquet file). The cell grid is an illustration made from the first 12 rows of that data; the number of cells is not the real size of the file.',
  },
};

function scanLines(plan: string[]): string[] {
  return plan
    .filter((l) => /SCAN|PROJECT|SELECTION|FILTER/.test(l) && !/WITH_COLUMNS/.test(l))
    .map((l) => l.trim().replace(/\[.*\]/, '[…/o.parquet]'));
}

export default function PlanLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [pred, setPred] = useState(true);
  const [proj, setProj] = useState(true);
  const key = pred && proj ? 'both' : !pred && proj ? 'no_predicate' : pred && !proj ? 'no_projection' : 'none';
  const cols: string[] = data.columns;
  const rows: string[][] = data.rows;
  const regionIdx = cols.indexOf('region');
  const north = rows.map((r) => r[regionIdx] === 'north');

  // state of every cell: 'new' = read and used, 'use' = read then thrown away, 'skip' = not read
  const cell = (r: number, c: number): 'new' | 'use' | 'skip' => {
    const used = USED.includes(cols[c]);
    const isNorth = north[r];
    if (proj && !used) return 'skip';
    if (pred) {
      if (isNorth) return used ? 'new' : 'use';
      return cols[c] === 'region' ? 'use' : 'skip';
    }
    return isNorth && used ? 'new' : 'use';
  };
  let readCount = 0;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols.length; c++) if (cell(r, c) !== 'skip') readCount++;

  const lines = scanLines(PLANS[key]);
  const sw = (label: string, v: boolean, set: (b: boolean) => void) => (
    <div className="ib-controls">
      <span className="ib-lbl">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        <button type="button" aria-pressed={v} onClick={() => set(true)}>{T.on}</button>
        <button type="button" aria-pressed={!v} onClick={() => set(false)}>{T.off}</button>
      </div>
    </div>
  );

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      {sw(T.pred, pred, setPred)}
      {sw(T.proj, proj, setProj)}
      <div className="viz-box">
        <svg viewBox="0 0 880 460" role="img" aria-label={T.title}>
          {cols.map((c, i) => (
            <g key={c}>
              <text x={X0 + i * CW + CW / 2 - 3} y={Y0 - 30} textAnchor="middle" className="ib-m" style={{ fontSize: 13 }}>{c.replace('customer_id', 'cust_id').replace('ordered_at', 'date')}</text>
              {!USED.includes(c) && <text x={X0 + i * CW + CW / 2 - 3} y={Y0 - 12} textAnchor="middle" className="ib-s" style={{ fontSize: 12, fill: 'var(--ib-bad)' }}>✗</text>}
            </g>
          ))}
          {rows.map((r, ri) => (
            <g key={ri}>
              {cols.map((c, ci) => {
                const s = cell(ri, ci);
                return (
                  <g key={c} style={{ opacity: s === 'skip' ? 0.55 : 1 }}>
                    <rect className={s === 'new' ? 'ib-new' : s === 'use' ? 'ib-use' : 'ib-skip'} x={X0 + ci * CW} y={Y0 + ri * RH} width={CW - 6} height={RH - 4} rx={5} style={s === 'use' ? { strokeDasharray: '3 3' } : undefined} />
                    <text x={X0 + ci * CW + (CW - 6) / 2} y={Y0 + ri * RH + 16} textAnchor="middle" className="ib-m" style={{ fontSize: 12, fill: 'var(--fg)' }}>{r[ci].length > 8 ? r[ci].slice(0, 7) + '…' : r[ci]}</text>
                  </g>
                );
              })}
            </g>
          ))}
          <text x={X0} y={Y0 + rows.length * RH + 22} className="ib-s">{T.unused}: ✗</text>

          <text x={580} y={44} className="ib-n">{T.scan}</text>
          {lines.map((l, i) => (
            <text key={i} x={580} y={Y0 + i * 26} className="ib-m" style={{ fill: 'var(--fg)' }}>{l.length > 38 ? l.slice(0, 37) + '…' : l}</text>
          ))}
          <g>
            <rect className="ib-banner" x={12} y={414} width={856} height={40} rx={10} />
            <text x={26} y={439} className="ib-n">{T.means[key]}</text>
          </g>
        </svg>
      </div>
      <div className="readout"><span>{T.read(readCount, rows.length * cols.length)}</span></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
