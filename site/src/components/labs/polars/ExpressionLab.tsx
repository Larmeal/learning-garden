import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { ORDERS, groupBy, total, fmt } from './data';

// Shows:      the same expression, qty * price, placed in four contexts. The input table stays on the left, and the table on the right changes
//             shape: one column (select), eight columns (with_columns), three rows (filter), four rows (group_by with sum).
// Because:    "an expression does nothing until a context runs it" is about where the result goes, which a sentence does not show.
// Control:    the four context buttons. Each one changes how many rows and columns come out and which input rows are lit.
// Conclusion: an expression only describes a calculation; select, with_columns, filter and group_by decide what shape the answer takes.
//
// Rows are the 8-row order table of the lessons (data.ts); the results are what exercise 02 asserts.

type Ctx = 'select' | 'with_columns' | 'filter' | 'group_by';
const CTXS: Ctx[] = ['select', 'with_columns', 'filter', 'group_by'];
const RH = 30;
const Y0 = 150;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; input: string; output: string;
  expr: string; means: Record<Ctx, string>; cols: (n: number) => string; rows: (n: number) => string; caption: string; nullRow: string;
}> = {
  th: {
    title: 'Expression ตัวเดียวกัน วางใน Context ต่างกัน เลือก Context แล้วดูว่าตารางที่ได้เปลี่ยนรูปอย่างไร',
    legend: [{ kind: 'new', text: 'ค่าหรือแถวที่ Context ส่งออก' }, { kind: 'use', text: 'คอลัมน์ที่ Expression อ่าน' }, { kind: 'skip', text: 'แถวที่ถูกทิ้ง' }],
    pick: 'Context',
    input: 'ตารางตั้งต้น (8 แถว)',
    output: 'ผลที่ได้',
    expr: 'Expression: qty * price',
    means: {
      select: 'select เก็บเฉพาะสิ่งที่ขอ ผลเหลือคอลัมน์เดียวและยังมี 8 แถว',
      with_columns: 'with_columns เก็บของเดิมไว้ทั้งหมดแล้วต่อคอลัมน์ใหม่ท้ายตาราง',
      filter: 'filter ใช้เงื่อนไข total > 10 เลือกแถว แถวที่ได้ null ไม่ถือว่าเป็นจริงจึงถูกทิ้ง',
      group_by: 'group_by รวม total ของแต่ละลูกค้า ผลเหลือหนึ่งแถวต่อหนึ่งลูกค้า',
    },
    cols: (n) => `${n} คอลัมน์`,
    rows: (n) => `${n} แถว`,
    nullRow: 'qty เป็น null จึงได้ null',
    caption: 'ตารางคือตารางออเดอร์ 8 แถวของบทเรียน ผลของทั้งสี่ Context ตรงกับที่แบบฝึก 02 ตรวจไว้ (เช่น filter เหลือออเดอร์ 4, 6, 7)',
  },
  en: {
    title: 'The same expression in different contexts. Pick a context and see the shape of the table that comes out',
    legend: [{ kind: 'new', text: 'values or rows the context outputs' }, { kind: 'use', text: 'columns the expression reads' }, { kind: 'skip', text: 'rows that are dropped' }],
    pick: 'Context',
    input: 'Input table (8 rows)',
    output: 'Result',
    expr: 'Expression: qty * price',
    means: {
      select: 'select keeps only what you ask for: one column, still 8 rows',
      with_columns: 'with_columns keeps everything and adds the new column at the end',
      filter: 'filter keeps rows where total > 10; a null is not true, so that row is dropped',
      group_by: 'group_by sums total per customer: one row per customer',
    },
    cols: (n) => `${n} column${n === 1 ? '' : 's'}`,
    rows: (n) => `${n} row${n === 1 ? '' : 's'}`,
    nullRow: 'qty is null, so the result is null',
    caption: 'The table is the 8-row order table of the lessons. The four results match what exercise 02 asserts (for example filter keeps orders 4, 6, 7).',
  },
};

export default function ExpressionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [ctx, setCtx] = useState<Ctx>('select');
  const keep = ORDERS.filter((o) => (total(o) ?? 0) > 10).map((o) => o.id);
  const groups = groupBy(ORDERS);
  const nCols = ctx === 'select' ? 1 : ctx === 'with_columns' ? 8 : ctx === 'filter' ? 7 : 2;
  const nRows = ctx === 'filter' ? keep.length : ctx === 'group_by' ? groups.length : 8;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick}>
          {CTXS.map((c) => (
            <button key={c} type="button" aria-pressed={ctx === c} onClick={() => setCtx(c)} style={{ fontFamily: 'var(--mono)' }}>{c}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          {/* input */}
          <text x={20} y={34} className="ib-n">{T.input}</text>
          <g>
            {['id', 'customer', 'qty', 'price'].map((h, i) => (
              <text key={h} x={[42, 100, 214, 280][i]} y={Y0 - 10} className="ib-m" textAnchor="middle" style={{ fontSize: 15 }}>{h}</text>
            ))}
            {ORDERS.map((o, i) => {
              const dropped = ctx === 'filter' && !keep.includes(o.id);
              const lit = ctx === 'filter' && keep.includes(o.id);
              return (
                <g key={o.id} style={{ opacity: dropped ? 0.45 : 1 }}>
                  <rect className={dropped ? 'ib-skip' : lit ? 'ib-new' : 'ib-node'} x={14} y={Y0 + i * RH} width={310} height={RH - 4} rx={6} />
                  <text x={42} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-n">{o.id}</text>
                  <text x={100} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-s" style={{ fill: 'var(--fg)', fontSize: 15 }}>{o.customer}</text>
                  <text x={214} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-n" style={{ fill: o.qty === null ? 'var(--ib-bad)' : undefined }}>{fmt(o.qty, 0)}</text>
                  <text x={280} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-n">{o.price.toFixed(1)}</text>
                </g>
              );
            })}
            <rect className="ib-use" x={176} y={Y0 - 4} width={140} height={8 * RH + 2} rx={8} style={{ fill: 'none' }} />
          </g>

          {/* expression chip */}
          <g>
            <path className="ib-line" d={`M330,${Y0 + 4 * RH} L420,${Y0 + 4 * RH}`} style={{ stroke: 'var(--accent)', strokeWidth: 3 }} />
            <rect className="ib-badge" x={332} y={Y0 + 4 * RH - 58} width={104} height={44} rx={12} />
            <text x={384} y={Y0 + 4 * RH - 42} className="ib-white">qty ×</text>
            <text x={384} y={Y0 + 4 * RH - 24} className="ib-white">price</text>
            <text x={384} y={Y0 + 4 * RH + 34} textAnchor="middle" className="ib-m">{ctx}</text>
          </g>

          {/* output */}
          <text x={460} y={34} className="ib-n">{T.output}</text>
          <text x={460} y={58} className="ib-s">{T.cols(nCols)} · {T.rows(nRows)}</text>
          <g>
            {ctx === 'select' && (
              <g>
                <text x={560} y={Y0 - 10} className="ib-m" textAnchor="middle" style={{ fontSize: 15 }}>total</text>
                {ORDERS.map((o, i) => (
                  <g key={o.id}>
                    <rect className="ib-new" x={480} y={Y0 + i * RH} width={160} height={RH - 4} rx={6} />
                    <text x={560} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-n" style={{ fill: total(o) === null ? 'var(--ib-bad)' : undefined }}>{fmt(total(o))}</text>
                  </g>
                ))}
              </g>
            )}
            {ctx === 'with_columns' && (
              <g>
                {['id', 'customer', 'region', 'product', 'qty', 'price', 'date'].map((h, i) => (
                  <text key={h} x={474 + i * 40 + 18} y={Y0 - 10} className="ib-m" textAnchor="middle" style={{ fontSize: 11 }}>{h.slice(0, 4)}</text>
                ))}
                <text x={474 + 7 * 40 + 52} y={Y0 - 10} className="ib-m" textAnchor="middle" style={{ fontSize: 15 }}>total</text>
                {ORDERS.map((o, i) => (
                  <g key={o.id}>
                    <rect className="ib-node" x={474} y={Y0 + i * RH} width={280} height={RH - 4} rx={6} />
                    <text x={474 + 140} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-s">{o.id} · {o.customer} · … · {fmt(o.qty, 0)} · {o.price.toFixed(1)}</text>
                    <rect className="ib-new" x={764} y={Y0 + i * RH} width={90} height={RH - 4} rx={6} />
                    <text x={809} y={Y0 + i * RH + 19} textAnchor="middle" className="ib-n" style={{ fill: total(o) === null ? 'var(--ib-bad)' : undefined }}>{fmt(total(o))}</text>
                  </g>
                ))}
              </g>
            )}
            {ctx === 'filter' && (
              <g>
                {ORDERS.filter((o) => keep.includes(o.id)).map((o, i) => (
                  <g key={o.id}>
                    <rect className="ib-new" x={480} y={Y0 + i * RH} width={320} height={RH - 4} rx={6} />
                    <text x={500} y={Y0 + i * RH + 19} className="ib-n">{o.id}</text>
                    <text x={560} y={Y0 + i * RH + 19} className="ib-s" style={{ fill: 'var(--fg)', fontSize: 15 }}>{o.customer} · qty {o.qty} · price {o.price.toFixed(1)}</text>
                    <text x={790} y={Y0 + i * RH + 19} textAnchor="end" className="ib-m">total {fmt(total(o))}</text>
                  </g>
                ))}
                <text x={480} y={Y0 + 4 * RH + 20} className="ib-s">{T.nullRow}</text>
              </g>
            )}
            {ctx === 'group_by' && (
              <g>
                <text x={540} y={Y0 - 10} className="ib-m" textAnchor="middle" style={{ fontSize: 15 }}>customer</text>
                <text x={700} y={Y0 - 10} className="ib-m" textAnchor="middle" style={{ fontSize: 15 }}>spent</text>
                {groups.map((g, i) => (
                  <g key={g.customer}>
                    <rect className="ib-new" x={480} y={Y0 + i * (RH + 6)} width={280} height={RH + 2} rx={6} />
                    <text x={540} y={Y0 + i * (RH + 6) + 21} textAnchor="middle" className="ib-n">{g.customer}</text>
                    <text x={700} y={Y0 + i * (RH + 6) + 21} textAnchor="middle" className="ib-n">{g.spent.toFixed(1)}</text>
                  </g>
                ))}
                <text x={480} y={Y0 + 4 * (RH + 6) + 14} className="ib-s">Ann = 3.0 + 7.5 + 24.0</text>
              </g>
            )}
          </g>
          <g>
            <rect className="ib-banner" x={12} y={398} width={856} height={36} rx={10} />
            <text x={26} y={422} className="ib-n">{T.means[ctx]}</text>
          </g>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
