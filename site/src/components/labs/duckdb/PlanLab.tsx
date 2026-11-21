import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './optimizer.json';

// Shows:      the plan of one join query as a tree of operators with the rows each one returned, with the optimizer on and off, side by side in one picture that we flip.
// Because:    "the filter moved down" is a change of position in a tree and a change of the number on the join, which a sentence cannot show at a glance.
// Control:    the optimizer (on or off). Flipping it moves the filter from its own FILTER box above the join into the scan of customers, and the join's rows fall from 1,000,000 to 128,403.
// Conclusion: the answer is the same, but with the optimizer the join receives 642 customers instead of 5,000 and returns 128,403 rows instead of a million.
//
// The trees and the row counts come from exercises/09_optimizer.py --write (optimizer.json), read from the profile the engine writes.

type Op = { depth: number; name: string; table: string; rows: number; filter: string | null };

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; opt: string; on: string; off: string; rows: string; readout: (on: boolean) => string; caption: string }> = {
  th: {
    title: 'สลับ Optimizer เปิดและปิด แล้วดูว่า Filter ย้ายไปอยู่ที่ไหนและ Join คืนกี่แถว',
    legend: [{ kind: 'new', text: 'Operator ที่มี Filter' }, { kind: 'use', text: 'Operator อื่น' }],
    opt: 'Optimizer', on: 'เปิด', off: 'ปิด', rows: 'แถว',
    readout: (on) => (on
      ? 'เงื่อนไข country = TH อยู่ข้างใน Scan ของ customers จึงคืนแค่ 642 แถวจาก 5,000 แล้ว Join คืน 128,403 แถวตั้งแต่แรก'
      : 'ไม่มีอะไรถูกย้าย Join จับคู่ทั้ง 5,000 customers กับ Order หนึ่งล้านแถว ได้หนึ่งล้านแถว แล้ว FILTER ค่อยตัดเหลือ 128,403 แถว คำตอบเท่ากัน'),
    caption: 'โครงของแผนและจำนวนแถวมาจากแบบฝึก 09 (Profile ที่ Engine เขียนเอง กับ pragma disable_optimizer) Query คือ Join ระหว่าง orders กับ customers ที่กรอง country = TH หลัง Join',
  },
  en: {
    title: 'Switch the optimizer on and off and see where the filter moves and how many rows the join returns',
    legend: [{ kind: 'new', text: 'operator that has the filter' }, { kind: 'use', text: 'other operators' }],
    opt: 'optimizer', on: 'on', off: 'off', rows: 'rows',
    readout: (on) => (on
      ? 'The condition country = TH is inside the scan of customers, which returns only 642 of 5,000 rows, and so the join returns 128,403 rows from the start.'
      : 'Nothing was moved. The join matches all 5,000 customers against one million orders and gives a million rows, and only then does FILTER cut it to 128,403. The answer is the same.'),
    caption: 'The shape of the plan and the row counts come from exercise 09 (the profile that the engine writes, with pragma disable_optimizer). The query is a join of orders and customers that filters country = TH after the join.',
  },
};

function layout(ops: Op[]) {
  // every operator has at most two children and the list is in pre-order: place each row of the tree on its own line
  return ops.map((o, i) => ({ ...o, i }));
}

export default function PlanLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [on, setOn] = useState(true);
  const ops = layout((on ? data.on : data.off) as Op[]);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.opt}</span>
        <span className="seg" role="group" aria-label={T.opt}>
          <button type="button" aria-pressed={on} onClick={() => setOn(true)}>{T.on}</button>
          <button type="button" aria-pressed={!on} onClick={() => setOn(false)}>{T.off}</button>
        </span>
      </div>
      <div className="ib-sql">{data.sql}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          {ops.map((o) => {
            const y = 10 + o.i * 66;
            const x = 14 + o.depth * 44;
            const hasFilter = !!o.filter || o.name === 'FILTER';
            return (
              <g key={o.i}>
                <rect className={hasFilter ? 'ib-new' : 'ib-node'} x={x} y={y} width={560} height={54} rx={10} />
                <text x={x + 14} y={y + 24} className="ib-n">{o.name}{o.table ? `  ·  ${o.table}` : ''}</text>
                <text x={x + 14} y={y + 45} className="ib-m">{o.filter ?? (o.name === 'FILTER' ? "country='TH'" : ' ')}</text>
                <text x={x + 548} y={y + 36} textAnchor="end" className="ib-big" style={{ fontSize: 24 }}>{o.rows.toLocaleString()}<tspan className="ib-s" style={{ fontSize: 14 }}>{` ${T.rows}`}</tspan></text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(on)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
