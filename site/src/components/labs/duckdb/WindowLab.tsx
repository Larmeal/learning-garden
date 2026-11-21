import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './analysis.json';

// Shows:      six days of sales as cards, the card we stand on, and which cards the window frame collects into the sum.
// Because:    ROWS and RANGE differ only when two rows share a day, and a table of numbers hides which rows are inside the frame.
// Control:    the kind of frame (ROWS 1 before to 1 after, RANGE 1 day back, running total) and the row we stand on. Both change which cards are lit.
// Conclusion: ROWS counts neighbours, RANGE counts by the value of the day (peers of the same day count together), a running total counts everything up to us.
//
// The sums come from exercises/04_analysis.py --write (analysis.json, real DuckDB results). The membership of the frame is worked out here from the rule of each frame,
// and the lab prints DuckDB's own number next to the sum of the lit cards so the two can be compared.

type Kind = 'rows' | 'range' | 'run';
const KINDS: Kind[] = ['rows', 'range', 'run'];
const DAYS = data.daily.map((d) => ({ ...d, n: Math.round(Date.parse(d.day) / 86400000) }));

function members(kind: Kind, i: number): number[] {
  if (kind === 'rows') return [i - 1, i, i + 1].filter((j) => j >= 0 && j < DAYS.length);
  if (kind === 'range') return DAYS.map((_, j) => j).filter((j) => DAYS[j].n <= DAYS[i].n && DAYS[j].n >= DAYS[i].n - 1);
  return DAYS.map((_, j) => j).filter((j) => j <= i);
}

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; kind: string; kinds: Record<Kind, string>; stand: string; sum: string; duck: string; same: string; day: string; amount: string; sql: Record<Kind, string>; note: Record<Kind, string>; caption: string }> = {
  th: {
    title: 'เลือกชนิด Frame แล้วเลือกแถวที่เรายืนอยู่ ดูว่าการ์ดไหนถูกรวมเข้าผลรวม',
    legend: [{ kind: 'new', text: 'แถวที่เรายืนอยู่' }, { kind: 'use', text: 'อยู่ใน Frame' }, { kind: 'skip', text: 'ไม่อยู่ใน Frame' }],
    kind: 'Frame', kinds: { rows: 'ROWS: ก่อน 1 หลัง 1', range: 'RANGE: ย้อน 1 วัน', run: 'ยอดสะสม' }, stand: 'แถวที่ยืน', sum: 'ผลรวมของการ์ดที่ติดสี', duck: 'DuckDB ตอบ', same: 'ตรงกัน', day: 'วัน', amount: 'ยอด',
    sql: { rows: 'sum(amount) over (order by day, amount rows between 1 preceding and 1 following)', range: 'sum(amount) over (order by day range between interval 1 day preceding and current row)', run: 'sum(amount) over (order by day, amount)' },
    note: { rows: 'ROWS นับเป็นแถว ได้เพื่อนทางซ้ายหนึ่งแถวกับทางขวาหนึ่งแถว ไม่ว่าจะเป็นวันไหน', range: 'RANGE นับตามวัน แถวที่อยู่ในวันเดียวกันเป็น Peer ต้องนับด้วยกันทั้งคู่ และเห็นวันก่อนหน้าหนึ่งวัน', run: 'ยอดสะสมรวมทุกแถวตั้งแต่แถวแรกจนถึงแถวที่ยืน' },
    caption: 'ผลรวมของ DuckDB มาจากแบบฝึก 04 ตารางหกแถวเป็นข้อมูลเล็กที่สร้างเอง โดยวันที่ 3 มีสองแถว (5 กับ 30) ส่วนผลรวมของการ์ดที่ติดสีคำนวณในหน้านี้จากกฎของแต่ละ Frame เพื่อเทียบกับของ DuckDB',
  },
  en: {
    title: 'Pick a kind of frame and the row we stand on, and see which cards are added into the sum',
    legend: [{ kind: 'new', text: 'the row we stand on' }, { kind: 'use', text: 'inside the frame' }, { kind: 'skip', text: 'outside the frame' }],
    kind: 'frame', kinds: { rows: 'ROWS: 1 before, 1 after', range: 'RANGE: 1 day back', run: 'running total' }, stand: 'row we stand on', sum: 'sum of the lit cards', duck: 'DuckDB says', same: 'match', day: 'day', amount: 'amount',
    sql: { rows: 'sum(amount) over (order by day, amount rows between 1 preceding and 1 following)', range: 'sum(amount) over (order by day range between interval 1 day preceding and current row)', run: 'sum(amount) over (order by day, amount)' },
    note: { rows: 'ROWS counts rows, so we get one neighbour on the left and one on the right, whatever the day.', range: 'RANGE counts by day. Rows on the same day are peers and are counted together, and we also see the one day before.', run: 'A running total adds every row from the first one up to the row we stand on.' },
    caption: 'The DuckDB sums come from exercise 04. The six-row table is a small one we made up, where day 3 has two rows (5 and 30). The sum of the lit cards is worked out on this page from the rule of each frame, to compare with DuckDB.',
  },
};

export default function WindowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [kind, setKind] = useState<Kind>('range');
  const [at, setAt] = useState(3);
  const inFrame = members(kind, at);
  const sum = inFrame.reduce((a, j) => a + DAYS[j].amount, 0);
  const duck = DAYS[at][kind === 'rows' ? 'rows' : kind === 'range' ? 'range' : 'running'];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.kind}</span>
        <span className="seg" role="group" aria-label={T.kind}>
          {KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{T.kinds[k]}</button>
          ))}
        </span>
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.stand}</span>
        <span className="seg" role="group" aria-label={T.stand}>
          {DAYS.map((d, i) => (
            <button key={i} type="button" aria-pressed={at === i} onClick={() => setAt(i)}>{`${d.day.slice(5)} · ${d.amount}`}</button>
          ))}
        </span>
      </div>
      <div className="ib-sql">{T.sql[kind]}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 280" role="img" aria-label={T.title}>
          {DAYS.map((d, i) => {
            const x = 14 + i * 144;
            const on = inFrame.includes(i);
            const me = i === at;
            const h = 20 + d.amount * 2.2;
            return (
              <g key={i} onClick={() => setAt(i)} style={{ cursor: 'pointer' }}>
                <rect className={me ? 'ib-new' : on ? 'ib-use' : 'ib-skip'} x={x} y={200 - h} width={128} height={h} rx={10} />
                <text x={x + 64} y={200 - h / 2 + 8} textAnchor="middle" className="ib-big" style={{ fontSize: 30 }}>{d.amount}</text>
                <text x={x + 64} y={228} textAnchor="middle" className="ib-n">{d.day.slice(5)}</text>
                <text x={x + 64} y={250} textAnchor="middle" className="ib-s">{`${T.day} ${i + 1}`}</text>
              </g>
            );
          })}
          <text x={866} y={30} className="ib-n" textAnchor="end">{`${T.sum} = ${sum}`}</text>
          <text x={866} y={56} className="ib-n ib-ok" textAnchor="end">{`${T.duck} ${duck}${duck === sum ? ' ✓ ' + T.same : ' ✗'}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.note[kind]}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
