import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';

// Shows:      the orders of three customers as flat rows, and as one row per customer with a list in a cell, and what list() and unnest() do to move between the two.
// Because:    "many rows in one cell" is a shape, and the count of rows before and after is the point.
// Control:    flat or nested. Switching changes the picture from 590 rows (customers 1, 2, 3 have 184 + 222 + 184 orders) to 3 rows with lists.
// Conclusion: list() gathers the rows of a group into one cell, unnest() opens the list into rows again, and no value is lost either way.
//
// The counts and the first order ids are from exercises/05_nested_data.py (customers 1, 2 and 3). Only the first four ids of each customer are drawn.

const CUST = [
  { id: 1, n: 184, ids: [3395, 13180, 19946, 22614] },
  { id: 2, n: 222, ids: [3057, 5027, 6615, 21230] },
  { id: 3, n: 184, ids: [1085, 1485, 2046, 2776] },
];

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; flat: string; nested: string; view: string; rows: string; flatSql: string; nestedSql: string; more: string; cust: string; ids: string; readout: (nested: boolean) => string; caption: string }> = {
  th: {
    title: 'สลับระหว่างตารางแบนกับตารางที่เก็บ List ในเซลล์ แล้วดูว่าจำนวนแถวเปลี่ยนจากเท่าไรเป็นเท่าไร',
    legend: [{ kind: 'new', text: 'ค่าที่รวมไว้ในเซลล์เดียว' }, { kind: 'use', text: 'หนึ่งแถว' }],
    flat: 'แถวแบน (หลังใช้ unnest)', nested: 'List ในเซลล์ (หลังใช้ list)', view: 'รูปแบบ', rows: 'แถว',
    flatSql: 'select customer_id, unnest(ids) as order_id from ...', nestedSql: 'select customer_id, list(order_id order by order_id) as ids from orders group by customer_id',
    more: 'อีก', cust: 'customer_id', ids: 'order_id',
    readout: (n) => (n ? 'ลูกค้าสามคนเหลือสามแถว แต่ละแถวถือ List ของ Order ทั้งหมดของเขา (184, 222 และ 184 ค่า)' : 'เปิด List ออกเป็นหนึ่งแถวต่อหนึ่ง Order ได้ 184 + 222 + 184 = 590 แถว และค่า order_id เหมือนเดิมทุกตัว'),
    caption: 'จำนวน Order ของลูกค้า 1, 2, 3 และ order_id สี่ตัวแรกของแต่ละคนมาจากแบบฝึก 05 ในภาพแสดงแค่สี่ตัวแรก ที่เหลือไม่ได้วาด',
  },
  en: {
    title: 'Switch between the flat table and the table that keeps a list in a cell, and see how the number of rows changes',
    legend: [{ kind: 'new', text: 'values gathered into one cell' }, { kind: 'use', text: 'one row' }],
    flat: 'flat rows (after unnest)', nested: 'a list in a cell (after list)', view: 'form', rows: 'rows',
    flatSql: 'select customer_id, unnest(ids) as order_id from ...', nestedSql: 'select customer_id, list(order_id order by order_id) as ids from orders group by customer_id',
    more: 'more', cust: 'customer_id', ids: 'order_id',
    readout: (n) => (n ? 'The three customers are three rows, and each row holds a list of all their orders (184, 222 and 184 values).' : 'Opening the lists into one row per order gives 184 + 222 + 184 = 590 rows, and every order_id is the same as before.'),
    caption: 'The order counts of customers 1, 2, 3 and their first four order_id values come from exercise 05. The picture draws only the first four of each, the rest are not drawn.',
  },
};

export default function NestLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [nested, setNested] = useState(true);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.view}</span>
        <span className="seg" role="group" aria-label={T.view}>
          <button type="button" aria-pressed={nested} onClick={() => setNested(true)}>{T.nested}</button>
          <button type="button" aria-pressed={!nested} onClick={() => setNested(false)}>{T.flat}</button>
        </span>
      </div>
      <div className="ib-sql">{nested ? T.nestedSql : T.flatSql}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          <text x={14} y={26} className="ib-m">{T.cust}</text>
          <text x={150} y={26} className="ib-m">{nested ? 'ids' : T.ids}</text>
          {nested ? CUST.map((c, i) => (
            <g key={c.id}>
              <rect className="ib-use" x={14} y={44 + i * 92} width={110} height={76} rx={10} />
              <text x={69} y={88 + i * 92} textAnchor="middle" className="ib-big" style={{ fontSize: 30 }}>{c.id}</text>
              <rect className="ib-new" x={140} y={44 + i * 92} width={716} height={76} rx={10} />
              {c.ids.map((v, k) => (
                <g key={v}>
                  <rect className="ib-node" x={156 + k * 112} y={60 + i * 92} width={100} height={44} rx={8} />
                  <text x={206 + k * 112} y={89 + i * 92} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontSize: 16 }}>{v}</text>
                </g>
              ))}
              <text x={620} y={89 + i * 92} className="ib-n">{`... ${T.more} ${c.n - 4}  (${c.n})`}</text>
            </g>
          )) : CUST.flatMap((c, i) => c.ids.slice(0, 2).map((v, k) => (
            <g key={`${c.id}-${v}`}>
              <rect className="ib-use" x={14} y={40 + i * 100 + k * 40} width={110} height={34} rx={8} />
              <text x={69} y={63 + i * 100 + k * 40} textAnchor="middle" className="ib-n">{c.id}</text>
              <rect className="ib-new" x={140} y={40 + i * 100 + k * 40} width={160} height={34} rx={8} />
              <text x={220} y={63 + i * 100 + k * 40} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontSize: 16 }}>{v}</text>
            </g>
          ))).concat(CUST.map((c, i) => (
            <text key={`d${c.id}`} x={330} y={78 + i * 100} className="ib-n">{`⋮  ${c.n} ${T.rows}`}</text>
          )) as never)}
          <text x={866} y={326} textAnchor="end" className="ib-n">{nested ? `3 ${T.rows}` : `590 ${T.rows}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(nested)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
