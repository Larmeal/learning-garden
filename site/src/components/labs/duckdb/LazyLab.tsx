import type { Lang } from '../spark/timeline';
import { StepControls, useStepper } from '../spark/stepper';
import { Legend, Node } from '../iceberg/ib';

// Shows:      a chain of method calls growing into a plan (a stack of boxes) while the number of rows read stays at zero, until the last call (fetch) makes the table be read.
// Because:    "a relation is a plan and not a result" is about when work happens, which is visible as a counter that stays at 0 for five steps and then jumps.
// Control:    the five steps of the chain. Each adds a box to the plan. The counter "rows read so far" changes only at the last step.
// Conclusion: filter, aggregate, order and limit only extend the plan. Nothing is read until we ask for the result with fetchall(), df() or count().
//
// The result at the last step is the real one of exercises/06_python.py (the three best customers by revenue of paid orders).

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; steps: { name: string; title: string; text: string; code: string }[]; plan: string; read: string; none: string; rows: string; caption: string }> = {
  th: {
    title: 'กดถัดไปทีละเมธอด ดูว่าแผนโตขึ้นอย่างไร และตัวนับแถวที่อ่านเปลี่ยนเมื่อไร',
    legend: [{ kind: 'new', text: 'เมธอดที่เพิ่งเรียก' }, { kind: 'use', text: 'อยู่ในแผนแล้ว' }, { kind: 'skip', text: 'ยังไม่ถึง' }],
    steps: [
      { name: 'table', title: '1. con.table("orders")', text: 'สร้าง Relation ที่ชี้ไปที่ตาราง orders ยังไม่มีการอ่านข้อมูลสักแถว', code: 'rel = con.table("orders")' },
      { name: 'filter', title: '2. .filter("status = \'paid\'")', text: 'เพิ่มเงื่อนไขเข้าไปในแผน ยังไม่ได้กรองจริง', code: '.filter("status = \'paid\'")' },
      { name: 'aggregate', title: '3. .aggregate(...)', text: 'เพิ่มการรวมรายได้ต่อลูกค้าเข้าไปในแผน ยังไม่ได้คำนวณ', code: '.aggregate("customer_id, round(sum(qty * unit_price), 2) as revenue", "customer_id")' },
      { name: 'order+limit', title: '4. .order(...).limit(3)', text: 'เพิ่มการเรียงและตัดเหลือสามอันดับ แผนครบแล้วแต่ตัวนับยังเป็น 0', code: '.order("revenue desc, customer_id").limit(3)' },
      { name: 'fetch', title: '5. .fetchall()', text: 'ตอนนี้เองที่ DuckDB อ่านตาราง ทำตามแผนทั้งหมด และคืนสามแถว', code: '.fetchall()' },
    ],
    plan: 'แผนของ Relation', read: 'แถวที่อ่านจากตารางจนถึงตอนนี้', none: '0', rows: 'แถว',
    caption: 'ผลสามแถวท้ายสุดมาจากแบบฝึก 06 (ลูกค้า 1044, 144 และ 4109 ตามรายได้ของ Order ที่จ่ายแล้ว) ส่วนตัวนับแถวที่อ่านเป็นภาพประกอบว่าเมื่อไรที่งานเกิดขึ้น ไม่ได้วัดจาก Profile',
  },
  en: {
    title: 'Press next one method at a time and see how the plan grows and when the counter of rows read changes',
    legend: [{ kind: 'new', text: 'the method just called' }, { kind: 'use', text: 'already in the plan' }, { kind: 'skip', text: 'not yet' }],
    steps: [
      { name: 'table', title: '1. con.table("orders")', text: 'This makes a relation that points at the orders table. Not one row has been read.', code: 'rel = con.table("orders")' },
      { name: 'filter', title: '2. .filter("status = \'paid\'")', text: 'This adds a condition to the plan. Nothing has really been filtered.', code: '.filter("status = \'paid\'")' },
      { name: 'aggregate', title: '3. .aggregate(...)', text: 'This adds the revenue per customer to the plan. Nothing has been computed.', code: '.aggregate("customer_id, round(sum(qty * unit_price), 2) as revenue", "customer_id")' },
      { name: 'order+limit', title: '4. .order(...).limit(3)', text: 'This adds the sort and the cut to three. The plan is complete but the counter is still 0.', code: '.order("revenue desc, customer_id").limit(3)' },
      { name: 'fetch', title: '5. .fetchall()', text: 'Only now does DuckDB read the table, follow the whole plan, and return three rows.', code: '.fetchall()' },
    ],
    plan: 'plan of the relation', read: 'rows read from the table so far', none: '0', rows: 'rows',
    caption: 'The three rows at the end come from exercise 06 (customers 1044, 144 and 4109 by revenue of paid orders). The counter of rows read is an illustration of when the work happens and was not read from a profile.',
  },
};

const RESULT = [['1044', '27,468.37'], ['144', '27,222.07'], ['4109', '27,213.03']];

export default function LazyLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const s = useStepper(T.steps.length);
  const last = s.step === T.steps.length - 1;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          <text x={14} y={26} className="ib-t">{T.plan}</text>
          {T.steps.map((st, i) => {
            const y = 40 + i * 62;
            const state = i === s.step ? 'new' : i < s.step ? 'use' : 'skip';
            return (
              <Node key={st.name} x={14} y={y} w={560} h={50} title={st.code.length > 58 ? st.code.slice(0, 55) + '...' : st.code} state={state} mono />
            );
          })}
          <rect className={last ? 'ib-new' : 'ib-node'} x={620} y={40} width={236} height={110} rx={12} />
          <text x={636} y={68} className="ib-s">{T.read}</text>
          <text x={636} y={124} className="ib-big">{last ? '1,000,000' : T.none}</text>
          {last && RESULT.map((r, i) => (
            <g key={r[0]}>
              <rect className="ib-use" x={620} y={176 + i * 52} width={236} height={42} rx={8} />
              <text x={636} y={203 + i * 52} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 16 }}>{`${r[0]}  ·  ${r[1]}`}</text>
            </g>
          ))}
        </svg>
      </div>
      <StepControls steps={T.steps} step={s.step} playing={s.playing} go={s.go} toggle={s.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
