import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { ORDERS, groupBy, total, fmt } from './data';

// Shows:      the eight order rows with their customers colour-coded, and where each row goes. With group_by().agg() the rows gather into four boxes
//             and each box becomes one row; with over() the same four boxes are computed but every row keeps its place and receives its box's sum.
// Because:    "one row per group" against "the group's answer on every row" is a question about the number of rows that come out.
// Control:    the two buttons. Eight rows out against four rows out is the only thing that changes, and the lines show why.
// Conclusion: group_by shrinks the table to one row per group; over keeps all rows and writes the group value next to each.
//
// Rows are the order table of the lessons (data.ts); the sums are what exercise 04 asserts (Ann 34.5, Bob 12.5, Cat 12.0, Dan 32.0).

type Mode = 'agg' | 'over';
const COL: Record<string, string> = { Ann: 'var(--accent)', Bob: 'var(--k1)', Cat: 'var(--k2)', Dan: 'var(--k3)' };
const RH = 38;
const Y0 = 74;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; pick: string; modes: Record<Mode, string>;
  means: Record<Mode, string>; input: string; outAgg: string; outOver: string; rows: (n: number) => string; caption: string; nullNote: string;
}> = {
  th: {
    title: 'ออเดอร์ 8 แถว สีคือลูกค้า เลือก group_by หรือ over แล้วดูว่าแต่ละแถวไปอยู่ที่ไหน',
    legend: [{ kind: 'node', text: 'สีของเส้นขอบ = ลูกค้าคนเดียวกัน' }, { kind: 'new', text: 'แถวผลลัพธ์' }],
    pick: 'วิธีรวม',
    modes: { agg: 'group_by().agg(sum)', over: 'sum().over(customer)' },
    means: {
      agg: 'group_by ยุบแถวของลูกค้าคนเดียวกันเป็นแถวเดียว 8 แถวเหลือ 4 แถว',
      over: 'over คำนวณยอดรวมของแต่ละลูกค้าแล้วเขียนไว้ข้างทุกแถว ยังมี 8 แถวเท่าเดิม',
    },
    input: 'ตารางตั้งต้น', outAgg: 'ผลของ group_by', outOver: 'ผลของ over', rows: (n) => `${n} แถว`,
    nullNote: 'ออเดอร์ 8 ไม่มี qty (null) จึงไม่เพิ่มยอด แต่ยังได้ยอดรวมของ Cat',
    caption: 'ยอดรวมต่อลูกค้า (Ann 34.5, Bob 12.5, Cat 12.0, Dan 32.0) ตรงกับที่แบบฝึก 04 ตรวจไว้ ยอดของแต่ละออเดอร์คือ qty คูณ price',
  },
  en: {
    title: '8 order rows, colour is the customer. Pick group_by or over and see where each row goes',
    legend: [{ kind: 'node', text: 'border colour = the same customer' }, { kind: 'new', text: 'a result row' }],
    pick: 'How to sum',
    modes: { agg: 'group_by().agg(sum)', over: 'sum().over(customer)' },
    means: {
      agg: 'group_by folds the rows of one customer into one row: 8 rows become 4',
      over: 'over computes each customer\'s total and writes it beside every row: still 8 rows',
    },
    input: 'Input table', outAgg: 'result of group_by', outOver: 'result of over', rows: (n) => `${n} rows`,
    nullNote: 'Order 8 has no qty (null) so it adds nothing, yet it still gets Cat\'s total',
    caption: 'The totals per customer (Ann 34.5, Bob 12.5, Cat 12.0, Dan 32.0) match what exercise 04 asserts. An order\'s amount is qty times price.',
  },
};

export default function GroupByLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('agg');
  const groups = groupBy(ORDERS);
  const idx = (c: string) => groups.findIndex((g) => g.customer === c);
  const gy = (gi: number) => Y0 + gi * 66;
  const nOut = mode === 'agg' ? groups.length : ORDERS.length;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick}>
          {(['agg', 'over'] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={{ fontFamily: 'var(--mono)' }}>{T.modes[m]}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 450" role="img" aria-label={T.title}>
          <text x={20} y={34} className="ib-n">{T.input} · {T.rows(ORDERS.length)}</text>
          <text x={500} y={34} className="ib-n">{mode === 'agg' ? T.outAgg : T.outOver} · {T.rows(nOut)}</text>

          {/* lines first, so that the boxes sit on top of them */}
          {ORDERS.map((o, i) => {
            const y = Y0 + i * RH + 15;
            const c = COL[o.customer];
            if (mode === 'agg') {
              const ty = gy(idx(o.customer)) + 24;
              return <path key={o.id} d={`M270,${y} C390,${y} 390,${ty} 500,${ty}`} fill="none" style={{ stroke: c, strokeWidth: 3, opacity: 0.85 }} />;
            }
            return <path key={o.id} d={`M270,${y} L500,${y}`} fill="none" style={{ stroke: c, strokeWidth: 3, opacity: 0.85 }} />;
          })}

          {ORDERS.map((o, i) => (
            <g key={o.id}>
              <rect className="ib-node" x={14} y={Y0 + i * RH} width={256} height={RH - 8} rx={8} style={{ stroke: COL[o.customer], strokeWidth: 3 }} />
              <text x={34} y={Y0 + i * RH + 20} className="ib-n">{o.id}</text>
              <text x={74} y={Y0 + i * RH + 20} className="ib-n">{o.customer}</text>
              <text x={256} y={Y0 + i * RH + 20} textAnchor="end" className="ib-m" style={{ fontSize: 15, fill: total(o) === null ? 'var(--ib-bad)' : undefined }}>total {fmt(total(o))}</text>
            </g>
          ))}

          {mode === 'agg' && groups.map((g, gi) => (
            <g key={g.customer}>
              <rect className="ib-new" x={500} y={gy(gi)} width={300} height={48} rx={10} style={{ stroke: COL[g.customer] }} />
              <text x={520} y={gy(gi) + 30} className="ib-n">{g.customer}</text>
              <text x={640} y={gy(gi) + 30} className="ib-m" style={{ fontSize: 15 }}>{g.orders} {lang === 'th' ? 'ออเดอร์' : 'orders'}</text>
              <text x={784} y={gy(gi) + 30} textAnchor="end" className="ib-n" style={{ fontSize: 20 }}>{g.spent.toFixed(1)}</text>
            </g>
          ))}

          {mode === 'over' && ORDERS.map((o, i) => {
            const g = groups[idx(o.customer)];
            return (
              <g key={o.id}>
                <rect className="ib-new" x={500} y={Y0 + i * RH} width={300} height={RH - 8} rx={8} style={{ stroke: COL[o.customer] }} />
                <text x={520} y={Y0 + i * RH + 20} className="ib-n">{o.id}</text>
                <text x={560} y={Y0 + i * RH + 20} className="ib-n">{o.customer}</text>
                <text x={784} y={Y0 + i * RH + 20} textAnchor="end" className="ib-n">{g.spent.toFixed(1)}</text>
              </g>
            );
          })}
          {mode === 'over' && <text x={784} y={Y0 - 10} textAnchor="end" className="ib-m">customer_total</text>}
          {mode === 'over' && <text x={500} y={Y0 + 8 * RH + 14} className="ib-s">{T.nullNote}</text>}

          <g>
            <rect className="ib-banner" x={12} y={402} width={856} height={36} rx={10} />
            <text x={26} y={426} className="ib-n">{T.means[mode]}</text>
          </g>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
