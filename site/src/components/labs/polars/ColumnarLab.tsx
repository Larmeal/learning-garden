import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './columnar.json';

// Shows:      the 8-row table laid out in memory as one strip of 56 cells, two ways: row by row, or column by column (what Arrow and Polars do).
//             Choosing the column to read lights its cells in the strip; below the strip the chosen column is opened up into its values buffer and
//             its validity bitmap (one bit per row, 0 for a missing value).
// Because:    "a column is one contiguous block, and null is a bit and not a value" are statements about memory that a table on a page cannot make.
// Control:    the layout (row or column) and the column to read. The lit cells scatter across the strip in the row layout and sit in one block in
//             the column layout; the bitmap changes with the column.
// Conclusion: summing one column reads one block when each column is stored on its own; and a missing value is a 0 in the bitmap.
//
// Values and bits are read from the real columns with pyarrow (exercises/10_inside_polars.py --write).

type Layout = 'row' | 'col';
const NAMES: string[] = data.order;
const COLS = data.columns as Record<string, { dtype: string; values: (string | null)[]; validity: string | null; null_count: number }>;
const N = 8;
const CELL = 14;
const X0 = 20;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'node'; text: string }[]; layout: string; layouts: Record<Layout, string>; read: string;
  runs: (n: number) => string; values: string; bitmap: string; none: string; row: string; missing: string; strNote: string; caption: string;
  means: (l: Layout, c: string) => string; memory: string;
}> = {
  th: {
    title: 'ตารางออเดอร์ 8 แถว 7 คอลัมน์ วางเรียงในหน่วยความจำ เลือกวิธีวางและคอลัมน์ที่จะอ่าน',
    legend: [{ kind: 'new', text: 'เซลล์ของคอลัมน์ที่เลือก' }, { kind: 'node', text: 'เซลล์ของคอลัมน์อื่น' }],
    layout: 'วิธีวาง', layouts: { row: 'ทีละแถว', col: 'ทีละคอลัมน์ (แบบ Arrow)' }, read: 'คอลัมน์ที่จะอ่าน',
    runs: (n) => (n === 1 ? 'อ่านเป็นก้อนเดียวติดกัน' : `ต้องกระโดดอ่าน ${n} จุด`),
    memory: 'หน่วยความจำ (56 เซลล์)', values: 'Values Buffer (ค่าของแต่ละแถว)', bitmap: 'Validity Bitmap (1 = มีค่า, 0 = ค่าหาย)',
    none: 'คอลัมน์นี้ไม่มี null จึงไม่มี Bitmap เลย', row: 'แถว', missing: 'ค่าหาย', strNote: 'ข้อความถูกเก็บเป็น Offset กับไบต์ ที่นี่แสดงเป็นตัวอักษรเพื่อให้อ่านง่าย',
    means: (l, c) => l === 'col' ? `วางทีละคอลัมน์ ค่าของ ${c} ทั้ง 8 แถวอยู่ติดกันเป็นก้อนเดียว` : `วางทีละแถว ค่าของ ${c} กระจายอยู่ทุก ๆ 7 เซลล์`,
    caption: 'ค่าและบิตของ Bitmap อ่านจากคอลัมน์จริงของตารางด้วย pyarrow (แบบฝึก 10) เช่น qty ได้ 01111111 ซึ่งแถวที่ 8 เป็น 0 ภาพวางตำแหน่งเป็นภาพจำลอง ไม่ใช่ที่อยู่จริง',
  },
  en: {
    title: 'The 8-row, 7-column order table laid out in memory. Pick the layout and the column to read',
    legend: [{ kind: 'new', text: 'cells of the chosen column' }, { kind: 'node', text: 'cells of the other columns' }],
    layout: 'Layout', layouts: { row: 'row by row', col: 'column by column (Arrow)' }, read: 'Column to read',
    runs: (n) => (n === 1 ? 'one contiguous block to read' : `${n} separate places to jump to`),
    memory: 'memory (56 cells)', values: 'values buffer (one value per row)', bitmap: 'validity bitmap (1 = has a value, 0 = missing)',
    none: 'This column has no null, so it has no bitmap at all', row: 'row', missing: 'missing', strNote: 'Strings are stored as offsets and bytes; they are shown as text here to keep it readable',
    means: (l, c) => l === 'col' ? `Column by column: the 8 values of ${c} sit side by side in one block` : `Row by row: the values of ${c} are spread out, one in every 7 cells`,
    caption: 'The values and the bitmap bits are read from the real columns of the table with pyarrow (exercise 10); qty gives 01111111, so row 8 is 0. The layout is an illustration, not real addresses.',
  },
};

export default function ColumnarLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [layout, setLayout] = useState<Layout>('col');
  const [name, setName] = useState('qty');
  const colIdx = NAMES.indexOf(name);
  const cell = (r: number, c: number) => (layout === 'col' ? c * N + r : r * NAMES.length + c);
  const lit = Array.from({ length: N }, (_, r) => cell(r, colIdx)).sort((a, b) => a - b);
  const runs = lit.reduce((n, v, i) => (i === 0 || v !== lit[i - 1] + 1 ? n + 1 : n), 0);
  const col = COLS[name];
  const total = N * NAMES.length;
  const cellX = (i: number) => X0 + i * CELL + Math.floor(i / (layout === 'col' ? N : NAMES.length)) * 8;
  const groups = layout === 'col' ? NAMES.length : N;
  const gsize = layout === 'col' ? N : NAMES.length;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.layout}</span>
        <div className="seg" role="group" aria-label={T.layout}>
          {(['row', 'col'] as Layout[]).map((l) => (
            <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}>{T.layouts[l]}</button>
          ))}
        </div>
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.read}</span>
        <div className="seg" role="group" aria-label={T.read} style={{ flexWrap: 'wrap' }}>
          {NAMES.map((n) => (
            <button key={n} type="button" aria-pressed={name === n} onClick={() => setName(n)} style={{ fontFamily: 'var(--mono)' }}>{n}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={20} y={30} className="ib-n">{T.memory}</text>
          {Array.from({ length: total }, (_, i) => {
            const on = lit.includes(i);
            return <rect key={i} className={on ? 'ib-new' : 'ib-node'} x={cellX(i)} y={44} width={CELL - 2} height={44} rx={3} />;
          })}
          {Array.from({ length: groups }, (_, g) => (
            <text key={g} x={cellX(g * gsize) + (gsize * CELL) / 2 - 4} y={110} textAnchor="middle" className="ib-m" style={{ fontSize: 13 }}>
              {layout === 'col' ? NAMES[g].replace('ordered_at', 'date').replace('order_id', 'id').replace('customer', 'cust').replace('product', 'prod') : `${T.row} ${g + 1}`}
            </text>
          ))}
          <text x={20} y={140} className="ib-s">{T.runs(runs)} ({name})</text>

          {/* the chosen column opened up */}
          <text x={20} y={190} className="ib-n">{name} · {col.dtype}</text>
          <text x={20} y={218} className="ib-s">{T.values}</text>
          {col.values.map((v, i) => (
            <g key={i}>
              <rect className={v === null ? 'ib-skip' : 'ib-new'} x={20 + i * 104} y={228} width={96} height={46} rx={8} />
              <text x={20 + i * 104 + 48} y={257} textAnchor="middle" className="ib-n" style={{ fill: v === null ? 'var(--ib-bad)' : undefined }}>{v === null ? '—' : v.length > 8 ? v.slice(0, 7) + '…' : v}</text>
            </g>
          ))}
          <text x={20} y={310} className="ib-s">{T.bitmap}</text>
          {col.validity ? (
            <g>
              {col.validity.split('').map((b, i) => (
                <g key={i}>
                  <rect className={b === '1' ? 'ib-use' : 'ib-skip'} x={20 + i * 104} y={320} width={96} height={42} rx={8} />
                  <text x={20 + i * 104 + 48} y={349} textAnchor="middle" className="ib-n" style={{ fontSize: 22, fill: b === '0' ? 'var(--ib-bad)' : undefined }}>{b}</text>
                  <text x={20 + i * 104 + 48} y={380} textAnchor="middle" className="ib-m" style={{ fontSize: 12 }}>{T.row} {i + 1}{b === '0' ? ` · ${T.missing}` : ''}</text>
                </g>
              ))}
            </g>
          ) : (
            <text x={20} y={346} className="ib-n" style={{ fill: 'var(--muted)' }}>{T.none}</text>
          )}
          {col.dtype === 'String' && <text x={20} y={398} className="ib-s">{T.strNote}</text>}
          <g>
            <rect className="ib-banner" x={12} y={416} width={856} height={44} rx={10} />
            <text x={26} y={444} className="ib-n">{T.means(layout, name)}</text>
          </g>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
