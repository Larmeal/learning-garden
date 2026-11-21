import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { ORDERS, testQty, type Test, type Tri } from './data';

// Shows:      the eight values of the qty column, one comparison applied to each, and which rows a filter keeps. The row with a missing qty answers
//             "null" to a normal comparison (neither true nor false) and a filter drops it; ne_missing and is_null are the ways to ask about it.
// Because:    "null is not false" is the rule that surprises people, and the way to see it is to watch the eighth card refuse to be either.
// Control:    the five tests. The eighth card changes (null, null, null, true, true) while the other seven follow ordinary arithmetic.
// Conclusion: a comparison with a missing value is null, a filter keeps only true, so the missing row needs its own question.
//
// qty values are the table of the lessons (data.ts); the outcomes are what exercise 03 asserts (3 rows for qty > 2, 6 rows for ne_missing(2)).

const TESTS: Test[] = ['gt2', 'eq2', 'ne2', 'ne_missing', 'is_null'];
const LABEL: Record<Test, string> = {
  gt2: 'qty > 2', eq2: 'qty == 2', ne2: 'qty != 2', ne_missing: 'qty.ne_missing(2)', is_null: 'qty.is_null()',
};

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; kept: (n: number, of: number) => string;
  tri: Record<'true' | 'false' | 'null', string>; means: Record<Test, string>; qtyRow: string; resultRow: string; filterRow: string; caption: string;
  keepTag: string; dropTag: string; missing: string;
}> = {
  th: {
    title: 'เลือกการเปรียบเทียบ แล้วดูว่าแต่ละแถวของ qty ได้ผลอะไร และ filter เก็บแถวไหนไว้',
    legend: [{ kind: 'new', text: 'แถวที่ filter เก็บไว้ (ผลเป็น True)' }, { kind: 'skip', text: 'แถวที่ถูกทิ้ง' }],
    pick: 'การเปรียบเทียบ',
    kept: (n, of) => `filter เก็บ ${n} จาก ${of} แถว`,
    tri: { true: 'True', false: 'False', null: 'null' },
    means: {
      gt2: 'เทียบกับ null ได้ null (ไม่ใช่ False) filter จึงทิ้งแถวที่ 8 ไปพร้อมกับแถวที่เป็น False',
      eq2: 'qty == 2 ก็เหมือนกัน แถวที่ 8 ได้ null และไม่ถูกเก็บ',
      ne2: 'qty != 2 ไม่ได้เก็บแถวที่ 8 ด้วย ทั้งที่ null ไม่ใช่ 2 เพราะคำตอบคือ null ไม่ใช่ True',
      ne_missing: 'ne_missing นับ null เป็นค่าหนึ่ง จึงตอบ True ให้แถวที่ 8 ได้ 6 แถวรวมกัน',
      is_null: 'is_null เป็นคำถามตรง ๆ ว่าหายไปหรือไม่ ได้ True เฉพาะแถวที่ 8',
    },
    qtyRow: 'ค่าของ qty', resultRow: 'ผลเปรียบเทียบ', filterRow: 'filter',
    keepTag: 'เก็บ', dropTag: 'ทิ้ง', missing: 'หาย',
    caption: 'ค่า qty ของ 8 ออเดอร์เป็นตารางของบทเรียน ผลตรงกับที่แบบฝึก 03 ตรวจไว้ (qty > 2 เหลือ 3 แถว ส่วน ne_missing(2) เหลือ 6 แถว)',
  },
  en: {
    title: 'Pick a comparison and see what each row of qty answers, and which rows a filter keeps',
    legend: [{ kind: 'new', text: 'rows the filter keeps (the answer is True)' }, { kind: 'skip', text: 'rows that are dropped' }],
    pick: 'Comparison',
    kept: (n, of) => `filter keeps ${n} of ${of} rows`,
    tri: { true: 'True', false: 'False', null: 'null' },
    means: {
      gt2: 'A comparison with null gives null (not False), so the filter drops row 8 together with the False rows',
      eq2: 'qty == 2 is the same: row 8 gives null and is not kept',
      ne2: 'qty != 2 does not keep row 8 either, although null is not 2, because the answer is null, not True',
      ne_missing: 'ne_missing counts null as a value, so row 8 answers True and 6 rows are kept',
      is_null: 'is_null asks directly whether the value is missing: True only for row 8',
    },
    qtyRow: 'qty value', resultRow: 'comparison', filterRow: 'filter',
    keepTag: 'keep', dropTag: 'drop', missing: 'missing',
    caption: 'The qty values of the 8 orders are the lesson table. The outcomes match what exercise 03 asserts (qty > 2 keeps 3 rows, ne_missing(2) keeps 6).',
  },
};

const W = 104;

export default function NullLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [test, setTest] = useState<Test>('gt2');
  const res: Tri[] = ORDERS.map((o) => testQty(test, o.qty));
  const kept = res.filter((r) => r === true).length;
  const style = (r: Tri) => (r === true ? 'ib-new' : r === false ? 'ib-node' : 'ib-skip');

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {TESTS.map((k) => (
            <button key={k} type="button" aria-pressed={test === k} onClick={() => setTest(k)} style={{ fontFamily: 'var(--mono)' }}>{LABEL[k]}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {ORDERS.map((o, i) => {
            const x = 18 + i * W;
            const r = res[i];
            const missing = o.qty === null;
            return (
              <g key={o.id} style={{ opacity: r === true ? 1 : 0.8 }}>
                <text x={x + 40} y={34} textAnchor="middle" className="ib-s">#{o.id}</text>
                <rect className={missing ? 'ib-skip' : 'ib-node'} x={x} y={46} width={80} height={60} rx={10} />
                <text x={x + 40} y={86} textAnchor="middle" className="ib-n" style={{ fontSize: 28, fill: missing ? 'var(--ib-bad)' : undefined }}>{o.qty === null ? 'null' : o.qty}</text>
                <path className="ib-line" d={`M${x + 40},108 L${x + 40},128`} style={{ stroke: 'var(--accent)', strokeWidth: 2.5 }} />
                <rect className={style(r)} x={x} y={130} width={80} height={52} rx={26} style={r === null ? { stroke: 'var(--ib-bad)' } : undefined} />
                <text x={x + 40} y={162} textAnchor="middle" className="ib-n" style={{ fontSize: 18, fill: r === null ? 'var(--ib-bad)' : undefined }}>{r === null ? 'null' : r ? 'True' : 'False'}</text>
                <path className="ib-line" d={`M${x + 40},184 L${x + 40},204`} style={{ stroke: 'var(--accent)', strokeWidth: 2.5 }} />
                <rect className={r === true ? 'ib-new' : 'ib-skip'} x={x} y={206} width={80} height={36} rx={9} />
                <text x={x + 40} y={230} textAnchor="middle" className="ib-n">{r === true ? `✓ ${T.keepTag}` : `✗ ${T.dropTag}`}</text>
              </g>
            );
          })}
          <text x={18} y={266} className="ib-s">{T.qtyRow} → {T.resultRow} → {T.filterRow}</text>
          <g>
            <rect className="ib-banner" x={12} y={278} width={856} height={44} rx={10} />
            <text x={26} y={306} className="ib-n">{T.means[test]}</text>
          </g>
        </svg>
      </div>
      <div className="readout"><span><b style={{ fontFamily: 'var(--mono)' }}>{LABEL[test]}</b>: {T.kept(kept, ORDERS.length)}</span></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
