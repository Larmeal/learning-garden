import type { Lang } from '../spark/timeline';
import { StepControls, useStepper } from '../spark/stepper';
import { Legend, Node } from '../iceberg/ib';
import data from './pipeline.json';

// Shows:      the rows of ten daily files flowing through the stages of the load (read, remove duplicates, judge, split into clean and quarantine), with the row count at each stage.
// Because:    the promise "every row ends in exactly one place" is a conservation law, and it reads best as numbers that add up from one stage to the next.
// Control:    the five steps of the load. Each lights its stage and shows the numbers it produced. Reasons of the quarantine appear when the rows are split.
// Conclusion: 27,566 rows in, 137 removed as duplicates, 27,429 judged, 27,310 clean and 119 in quarantine, and 27,310 + 119 = 27,429, so nothing was lost.
//
// All counts come from exercises/12_capstone_pipeline.py --write (pipeline.json). The data is synthetic and the faults were planted by order_id.

const S = data.stages;
const Q = data.quarantine as Record<string, number>;
const REASONS = ['missing_customer', 'negative_qty', 'unknown_status', 'future_date', 'bad_price'];

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; steps: { name: string; title: string; text: string }[]; files: string; raw: string; dup: string; judged: string; clean: string; quar: string; rows: string; reasons: Record<string, string>; sum: string; caption: string }> = {
  th: {
    title: 'กดถัดไปทีละขั้นของการโหลด ดูจำนวนแถวที่เหลือในแต่ละขั้น และว่าแถวที่เสียไปจบที่ไหน',
    legend: [{ kind: 'new', text: 'ขั้นที่กำลังทำ' }, { kind: 'use', text: 'ขั้นที่เสร็จแล้ว' }, { kind: 'skip', text: 'ยังไม่ถึง' }],
    steps: [
      { name: 'อ่าน', title: '1. อ่านทุกไฟล์เป็นข้อความ', text: 'read_csv แบบ all_varchar อ่านสิบไฟล์เข้ามาเป็นข้อความทั้งหมด ได้ 27,566 แถว' },
      { name: 'ตัดซ้ำ', title: '2. ตัดแถวซ้ำ', text: 'QUALIFY row_number() เก็บแถวแรกของแต่ละ order_id ทิ้ง 137 แถวที่ส่งซ้ำ' },
      { name: 'ตัดสิน', title: '3. แปลงชนิดและตัดสินทีละแถว', text: 'try_cast แปลงชนิด แล้ว CASE เรียงกฎให้เหตุผลแก่แถวที่เสีย กฎแรกที่ไม่ผ่านเป็นฝ่ายชนะ' },
      { name: 'แยก', title: '4. แยกเป็นตารางดีกับ Quarantine', text: 'แถวที่ไม่มีเหตุผลเข้า clean ส่วนที่มีเหตุผลเข้า quarantine พร้อมชื่อไฟล์ต้นทาง' },
      { name: 'เขียนออก', title: '5. เขียน Parquet และทำรายงาน', text: 'clean ถูกเขียนเป็น Parquet แยกเดือนและอ่านกลับได้เท่าเดิม การรันซ้ำไม่เพิ่มแถว' },
    ],
    files: 'ไฟล์ CSV', raw: 'แถวที่อ่าน', dup: 'ซ้ำ (ตัดทิ้ง)', judged: 'แถวที่ตัดสิน', clean: 'clean', quar: 'quarantine', rows: 'แถว',
    reasons: { missing_customer: 'ไม่มีลูกค้า', negative_qty: 'qty ติดลบ', unknown_status: 'status แปลก', future_date: 'วันที่อนาคต', bad_price: 'ราคาเป็น N/A' },
    sum: 'clean + quarantine = judged', caption: 'จำนวนทุกตัวมาจากแบบฝึก 12 ข้อมูลเป็นข้อมูลสังเคราะห์ และข้อเสียถูกวางตามเลข order_id',
  },
  en: {
    title: 'Press next through the stages of the load and see the rows left at each stage, and where the bad rows end up',
    legend: [{ kind: 'new', text: 'stage being done' }, { kind: 'use', text: 'stage done' }, { kind: 'skip', text: 'not yet' }],
    steps: [
      { name: 'Read', title: '1. Read every file as text', text: 'read_csv with all_varchar reads the ten files as text and gives 27,566 rows.' },
      { name: 'Dedupe', title: '2. Remove repeated rows', text: 'QUALIFY row_number() keeps the first row of each order_id and drops the 137 rows that were sent twice.' },
      { name: 'Judge', title: '3. Convert types and judge each row', text: 'try_cast converts the types, then a CASE of rules in order gives a reason to a bad row. The first rule that fails wins.' },
      { name: 'Split', title: '4. Split into the good table and quarantine', text: 'Rows with no reason go to clean, and rows with a reason go to quarantine with the name of the source file.' },
      { name: 'Write out', title: '5. Write Parquet and report', text: 'clean is written as Parquet by month and reads back the same. A rerun adds no rows.' },
    ],
    files: 'CSV files', raw: 'rows read', dup: 'duplicates (dropped)', judged: 'rows judged', clean: 'clean', quar: 'quarantine', rows: 'rows',
    reasons: { missing_customer: 'no customer', negative_qty: 'negative qty', unknown_status: 'odd status', future_date: 'future date', bad_price: 'price is N/A' },
    sum: 'clean + quarantine = judged', caption: 'Every number comes from exercise 12. The data is synthetic and the faults were planted by order_id.',
  },
};

export default function PipelineLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const s = useStepper(T.steps.length);
  const k = s.step;
  const st = (i: number) => (i === k ? 'new' : i < k ? 'use' : 'skip') as 'new' | 'use' | 'skip';
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          <Node x={14} y={20} w={170} h={80} title={T.files} sub={String(data.files)} state={st(0)} mono={false} />
          <Node x={214} y={20} w={200} h={80} title={T.raw} sub={S.raw.toLocaleString()} state={st(0)} mono={false} />
          <Node x={444} y={20} w={200} h={80} title={T.dup} sub={`− ${S.duplicate}`} state={st(1)} mono={false} />
          <Node x={674} y={20} w={190} h={80} title={T.judged} sub={S.judged.toLocaleString()} state={st(2)} mono={false} />
          <path className={k >= 1 ? 'ib-arrow' : 'ib-line'} d="M184,60 L214,60" />
          <path className={k >= 1 ? 'ib-arrow' : 'ib-line'} d="M414,60 L444,60" />
          <path className={k >= 2 ? 'ib-arrow' : 'ib-line'} d="M644,60 L674,60" />
          <path className={k >= 3 ? 'ib-arrow' : 'ib-line'} d="M769,100 L769,130 L230,130 L230,160" />
          <path className={k >= 3 ? 'ib-arrow-bad' : 'ib-line'} d="M769,130 L769,160" />
          <Node x={14} y={160} w={430} h={90} title={T.clean} sub={`${S.clean.toLocaleString()} ${T.rows}`} state={st(3)} mono={false} />
          <Node x={474} y={160} w={390} h={90} title={T.quar} sub={`${S.quarantine.toLocaleString()} ${T.rows}`} state={st(3)} mono={false} />
          {k >= 3 && REASONS.map((r, i) => (
            <g key={r}>
              <text x={474} y={276 + i * 20} className="ib-s">{T.reasons[r]}</text>
              <rect className="ib-new" x={640} y={264 + i * 20} width={Math.max(6, Q[r] * 4)} height={14} rx={4} />
              <text x={650 + Q[r] * 4} y={276 + i * 20} className="ib-m">{Q[r]}</text>
            </g>
          ))}
          <text x={14} y={290} className="ib-n">{k >= 3 ? `${S.clean.toLocaleString()} + ${S.quarantine} = ${(S.clean + S.quarantine).toLocaleString()}` : ' '}</text>
          <text x={14} y={316} className="ib-s">{k >= 3 ? T.sum : ' '}</text>
          {k >= 4 && <text x={14} y={352} className="ib-n ib-ok">✓ Parquet · ✓ report</text>}
        </svg>
      </div>
      <StepControls steps={T.steps} step={s.step} playing={s.playing} go={s.go} toggle={s.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
