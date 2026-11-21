import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { CUSTOMERS, ORDERS, join, type How } from './data';

// Shows:      the 8 orders on the left, the 4 customers on the right, a line for every match, and the rows that each kind of join returns.
//             Dan has an order but no customer row; Eve has a customer row but no order. Those two are what separate the kinds of join.
// Because:    "which rows survive" is a question about matches and non-matches, and a sentence about the join kind does not show it.
// Control:    the six join kinds. The lines stay, the set of lit rows and the result list change, and so does the row count.
// Conclusion: inner keeps matches only, left keeps every order, right every customer, full both; semi and anti only ask whether a match exists.
//
// Rows come from data.ts; the counts are what exercise 05 asserts (inner 7, left 8, right 8, full 9, semi 7, anti 1).

const HOWS: How[] = ['inner', 'left', 'right', 'full', 'semi', 'anti'];
const RH = 34;
const Y0 = 70;
const CY = (i: number) => Y0 + 8 + i * 70;   // customers are spread over the same height as the orders

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; pick: string; orders: string; customers: string;
  result: string; rows: (n: number) => string; means: Record<How, string>; caption: string; noMatch: string; noOrder: string;
}> = {
  th: {
    title: 'ออเดอร์ 8 แถวกับลูกค้า 4 คน เลือกชนิดของ Join แล้วดูว่าแถวไหนอยู่รอด',
    legend: [{ kind: 'new', text: 'แถวที่อยู่ในผลลัพธ์' }, { kind: 'skip', text: 'แถวที่ไม่อยู่ในผลลัพธ์' }],
    pick: 'ชนิดของ Join',
    orders: 'orders (ซ้าย)', customers: 'customers (ขวา)', result: 'ผลลัพธ์', rows: (n) => `${n} แถว`,
    noMatch: 'ไม่มีลูกค้า', noOrder: 'ไม่มีออเดอร์',
    means: {
      inner: 'inner เก็บเฉพาะแถวที่เจอคู่ทั้งสองฝั่ง Dan กับ Eve หายไป',
      left: 'left เก็บทุกออเดอร์ Dan ได้ tier เป็น null',
      right: 'right เก็บทุกลูกค้า Eve อยู่ในผลทั้งที่ยังไม่เคยสั่ง',
      full: 'full เก็บทุกแถวของทั้งสองฝั่ง ได้ 9 แถว',
      semi: 'semi เก็บออเดอร์ที่มีลูกค้า โดยไม่เอาคอลัมน์ของลูกค้ามาด้วย',
      anti: 'anti เก็บออเดอร์ที่ไม่มีลูกค้า คือออเดอร์ 7 ของ Dan',
    },
    caption: 'จำนวนแถวของทั้งหกชนิด (7, 8, 8, 9, 7, 1) ตรงกับที่แบบฝึก 05 ตรวจไว้ ลูกค้าจับคู่กับออเดอร์ด้วยชื่อ (customer)',
  },
  en: {
    title: '8 orders and 4 customers. Pick a kind of join and see which rows survive',
    legend: [{ kind: 'new', text: 'rows in the result' }, { kind: 'skip', text: 'rows not in the result' }],
    pick: 'Kind of join',
    orders: 'orders (left)', customers: 'customers (right)', result: 'Result', rows: (n) => `${n} row${n === 1 ? '' : 's'}`,
    noMatch: 'no customer', noOrder: 'no order',
    means: {
      inner: 'inner keeps only rows that match on both sides. Dan and Eve are gone',
      left: 'left keeps every order. Dan gets a null tier',
      right: 'right keeps every customer. Eve is in the result although she never ordered',
      full: 'full keeps every row of both sides: 9 rows',
      semi: 'semi keeps orders that have a customer, without the customer columns',
      anti: 'anti keeps orders that have no customer: order 7, Dan',
    },
    caption: 'The row counts of the six kinds (7, 8, 8, 9, 7, 1) match what exercise 05 asserts. Customers match orders on the name (customer).',
  },
};

export default function JoinLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [how, setHow] = useState<How>('left');
  const out = join(how);
  const leftIn = new Set(out.filter((r) => r.left).map((r) => r.left!.id));
  const rightIn = new Set(out.filter((r) => r.right).map((r) => r.right!.customer));
  const showsRight = how !== 'semi' && how !== 'anti';
  const nameIdx = (c: string) => CUSTOMERS.findIndex((x) => x.customer === c);

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick}>
          {HOWS.map((h) => (
            <button key={h} type="button" aria-pressed={how === h} onClick={() => setHow(h)} style={{ fontFamily: 'var(--mono)' }}>{h}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 450" role="img" aria-label={T.title}>
          <text x={14} y={34} className="ib-n">{T.orders}</text>
          <text x={330} y={34} className="ib-n">{T.customers}</text>
          <text x={560} y={34} className="ib-n">{T.result} · {T.rows(out.length)}</text>

          {/* match lines */}
          {ORDERS.map((o, i) => {
            const ci = nameIdx(o.customer);
            if (ci < 0) return null;
            const on = leftIn.has(o.id) && (rightIn.has(o.customer) || how === 'semi');
            return <path key={o.id} d={`M200,${Y0 + i * RH + 13} C260,${Y0 + i * RH + 13} 260,${CY(ci) + 22} 330,${CY(ci) + 22}`} fill="none" style={{ stroke: on ? 'var(--accent)' : 'var(--line-strong)', strokeWidth: on ? 3 : 1.5, opacity: on ? 1 : 0.55 }} />;
          })}

          {ORDERS.map((o, i) => {
            const on = leftIn.has(o.id);
            const missing = nameIdx(o.customer) < 0;
            return (
              <g key={o.id} style={{ opacity: on ? 1 : 0.5 }}>
                <rect className={on ? 'ib-new' : 'ib-skip'} x={14} y={Y0 + i * RH} width={186} height={RH - 6} rx={8} />
                <text x={34} y={Y0 + i * RH + 21} className="ib-n">{o.id}</text>
                <text x={74} y={Y0 + i * RH + 21} className="ib-n">{o.customer}</text>
                {missing && <text x={196} y={Y0 + i * RH + 21} textAnchor="end" className="ib-m" style={{ fill: 'var(--ib-bad)', fontSize: 12 }}>{T.noMatch}</text>}
              </g>
            );
          })}

          {CUSTOMERS.map((c, i) => {
            const on = rightIn.has(c.customer) || (how === 'semi' && ORDERS.some((o) => o.customer === c.customer && leftIn.has(o.id)));
            const hasOrder = ORDERS.some((o) => o.customer === c.customer);
            return (
              <g key={c.customer} style={{ opacity: on ? 1 : 0.5 }}>
                <rect className={on ? 'ib-new' : 'ib-skip'} x={330} y={CY(i)} width={190} height={44} rx={8} />
                <text x={350} y={CY(i) + 28} className="ib-n">{c.customer}</text>
                <text x={440} y={CY(i) + 28} className="ib-m">{c.tier}</text>
                {!hasOrder && <text x={516} y={CY(i) + 60} textAnchor="end" className="ib-m" style={{ fill: 'var(--ib-bad)', fontSize: 12 }}>{T.noOrder}</text>}
              </g>
            );
          })}

          {out.slice(0, 9).map((r, i) => (
            <g key={i}>
              <rect className="ib-new" x={560} y={Y0 + i * RH} width={300} height={RH - 6} rx={8} />
              <text x={578} y={Y0 + i * RH + 21} className="ib-n">{r.left ? r.left.id : '—'}</text>
              <text x={618} y={Y0 + i * RH + 21} className="ib-n">{r.left ? r.left.customer : r.right?.customer}</text>
              {showsRight && (
                <text x={846} y={Y0 + i * RH + 21} textAnchor="end" className="ib-m" style={{ fill: r.right ? undefined : 'var(--ib-bad)' }}>{r.right ? r.right.tier : 'null'}</text>
              )}
            </g>
          ))}

          <g>
            <rect className="ib-banner" x={12} y={400} width={856} height={36} rx={10} />
            <text x={26} y={424} className="ib-n">{T.means[how]}</text>
          </g>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
