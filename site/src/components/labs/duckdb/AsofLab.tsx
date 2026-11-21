import type { Lang } from '../spark/timeline';
import { StepControls, useStepper } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import data from './analysis.json';

// Shows:      a time line with the announced prices on top and the trades below, and for the trade we stand on, an arrow back to the latest price that is not later than the trade.
// Because:    "the latest one that is not after me" is a direction on a line, not a condition we can see in a table of rows.
// Control:    the four trades (one step each). The arrow and the price card change to the one DuckDB's ASOF JOIN picked.
// Conclusion: an ASOF JOIN gives each trade one price, the latest one at or before it, and a trade with nothing before it gets NULL with a left join.
//
// The prices and trades are a small table we made up, and the picked price of each trade comes from exercises/04_analysis.py --write (analysis.json): DuckDB's own answer.

const A = data.asof;
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const X0 = 60, X1 = 840, T0 = 8 * 60 + 30, T1 = 11 * 60 + 30;
const px = (hhmm: string) => X0 + ((mins(hhmm) - T0) / (T1 - T0)) * (X1 - X0);

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; price: string; trade: string; none: string; noneNote: string; found: (t: string, p: string, v: string) => string; caption: string; stepTitle: (t: string, q: number) => string }> = {
  th: {
    title: 'กดดูทีละรายการซื้อขาย แล้วดูว่า ASOF JOIN เลือกราคาที่ประกาศล่าสุดตัวไหน',
    legend: [{ kind: 'new', text: 'รายการซื้อขายที่ดูอยู่' }, { kind: 'use', text: 'ราคาที่ถูกเลือก' }, { kind: 'skip', text: 'ราคาอื่น' }],
    price: 'ราคาที่ประกาศ', trade: 'ซื้อ', none: 'ไม่มี', noneNote: 'ยังไม่มีราคาประกาศก่อนเวลานี้ ASOF JOIN ธรรมดาจะทิ้งรายการนี้ ส่วน ASOF LEFT JOIN เก็บไว้และให้ราคาเป็น NULL',
    found: (t, p, v) => `รายการเวลา ${t} ได้ราคาที่ประกาศเมื่อ ${p} คือ ${v} เพราะเป็นราคาล่าสุดที่ไม่เกินเวลาซื้อ`,
    stepTitle: (t, q) => `รายการเวลา ${t} จำนวน ${q}`,
    caption: 'ตารางราคากับรายการซื้อขายเป็นข้อมูลเล็กที่สร้างเอง ราคาที่ถูกเลือกของแต่ละรายการเป็นคำตอบจริงของ DuckDB จากแบบฝึก 04 ที่ใช้ asof left join ด้วย t.ts >= p.ts',
  },
  en: {
    title: 'Step through the trades and see which latest announced price an ASOF JOIN picks',
    legend: [{ kind: 'new', text: 'the trade we look at' }, { kind: 'use', text: 'the price that was picked' }, { kind: 'skip', text: 'other prices' }],
    price: 'announced price', trade: 'trade', none: 'none', noneNote: 'There is no announced price before this time. A plain ASOF JOIN drops this trade, while ASOF LEFT JOIN keeps it and gives a NULL price.',
    found: (t, p, v) => `The trade at ${t} gets the price announced at ${p}, which is ${v}, because it is the latest one not after the trade.`,
    stepTitle: (t, q) => `Trade at ${t}, quantity ${q}`,
    caption: 'The price table and the trades are a small table we made up. The price picked for each trade is DuckDB\'s real answer from exercise 04, which used asof left join with t.ts >= p.ts.',
  },
};

export default function AsofLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const trades = A.trades;
  const steps = trades.map((t) => ({
    name: t.at,
    title: T.stepTitle(t.at, t.qty),
    text: t.price === null ? T.noneNote : T.found(t.at, A.prices.filter((p) => mins(p[0] as string) <= mins(t.at)).slice(-1)[0][0] as string, (t.price as number).toFixed(2)),
  }));
  const s = useStepper(steps.length);
  const tr = trades[s.step];
  const chosen = tr.price === null ? -1 : A.prices.reduce((acc, p, i) => (mins(p[0] as string) <= mins(tr.at) ? i : acc), -1);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <text x={14} y={28} className="ib-t">{T.price}</text>
          <line className="ib-line" x1={X0} y1={150} x2={X1} y2={150} />
          {['09:00', '10:00', '11:00'].map((h) => (
            <g key={h}>
              <line className="ib-line" x1={px(h)} y1={144} x2={px(h)} y2={156} />
              <text x={px(h)} y={176} textAnchor="middle" className="ib-s">{h}</text>
            </g>
          ))}
          {A.prices.map((p, i) => {
            const x = px(p[0] as string);
            const on = i === chosen;
            return (
              <g key={i}>
                <rect className={on ? 'ib-use' : 'ib-skip'} x={x - 52} y={44} width={104} height={56} rx={10} />
                <text x={x} y={68} textAnchor="middle" className="ib-n">{(p[1] as number).toFixed(2)}</text>
                <text x={x} y={90} textAnchor="middle" className="ib-s">{p[0] as string}</text>
                <line className={on ? 'ib-arrow' : 'ib-line'} x1={x} y1={100} x2={x} y2={150} />
              </g>
            );
          })}
          {trades.map((t, i) => {
            const x = px(t.at);
            const cx = 110 + i * 220;
            const me = i === s.step;
            return (
              <g key={i}>
                <circle cx={x} cy={150} r={me ? 11 : 7} className={me ? 'ib-new' : 'ib-node'} />
                <path className={me ? 'ib-arrow' : 'ib-line'} d={`M${x},${me ? 161 : 157} L${cx},212`} />
                <rect className={me ? 'ib-new' : 'ib-node'} x={cx - 90} y={212} width={180} height={56} rx={10} />
                <text x={cx} y={235} textAnchor="middle" className="ib-n">{`${T.trade} ${t.at}`}</text>
                <text x={cx} y={257} textAnchor="middle" className="ib-s">{t.price === null ? 'NULL' : t.price.toFixed(2)}</text>
              </g>
            );
          })}
          {chosen >= 0 && (
            <path className="ib-arrow" d={`M${px(tr.at)},150 L${px(A.prices[chosen][0] as string)},150`} />
          )}
          {chosen < 0 && <text x={px(tr.at) + 24} y={136} className="ib-n ib-bad">{`✗ ${T.none}`}</text>}
        </svg>
      </div>
      <StepControls steps={steps} step={s.step} playing={s.playing} go={s.go} toggle={s.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
