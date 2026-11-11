import { useState } from 'react';
import type { Lang } from '../../../i18n';

type Dim = 'completeness' | 'validity' | 'uniqueness' | 'consistency' | 'integrity' | 'timeliness' | 'accuracy' | 'reasonability';

const DIMS: Dim[] = ['completeness', 'validity', 'uniqueness', 'consistency', 'integrity', 'timeliness', 'accuracy', 'reasonability'];

// The defect kinds are the ones planted in dqlab.py. The rows are made to look like those defects, they are not all real rows.
// Table names, columns, values and the expected dimension are the same in both languages; only the text differs.
interface Case {
  table?: string;
  cols: string[];
  rows: (string | null)[][];
  primary: Dim;
  also?: Dim;
}

const CASES: Case[] = [
  { table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['41', null, 'TH']], primary: 'completeness' },
  { table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['112', 'user112example.com', 'TH']], primary: 'validity' },
  { table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['3', 'user3@example.com', 'TH'], ['493', 'user3@example.com', 'SG']], primary: 'uniqueness' },
  { table: 'orders', cols: ['order_id', 'status', 'order_ts', 'shipped_ts'], rows: [['1207', 'SHIPPED', '2026-09-14 10:02', null]], primary: 'consistency', also: 'completeness' },
  { table: 'orders', cols: ['order_id', 'status', 'order_ts', 'shipped_ts'], rows: [['1930', 'SHIPPED', '2026-09-14 09:00', '2026-09-13 09:00']], primary: 'consistency' },
  { table: 'orders', cols: ['order_id', 'customer_id', 'total_amount'], rows: [['2218', '9007', '1830.00']], primary: 'integrity' },
  { table: 'orders', cols: ['order_id', 'order_ts', 'ingested_at'], rows: [['877', '2026-08-03 11:20', '2026-08-07 11:25']], primary: 'timeliness' },
  { cols: ['order_id', 'orders.total_amount', 'payments.amount'], rows: [['3340', '1200.00', '1250.00']], primary: 'accuracy', also: 'consistency' },
  { table: 'customers', cols: ['customer_id', 'email', 'birth_date'], rows: [['207', 'user207@example.com', '1850-01-01']], primary: 'validity', also: 'reasonability' },
  { table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['318', 'user318@example.com', 'ไทย']], primary: 'validity', also: 'consistency' },
];

interface CaseText { ask: string; why: string; alsoWhy?: string; table?: string }

const TEXT: Record<Lang, {
  title: string;
  done: (exact: number, overlap: number, miss: number, total: number) => string;
  doneNote: string;
  restart: string;
  question: (i: number, total: number) => string;
  table: string;
  pick: string;
  group: string;
  exact: string;
  overlap: string;
  miss: string;
  filedUnder: (dim: string) => string;
  next: string;
  result: string;
  caption: [string, string, string];
  cases: CaseText[];
}> = {
  th: {
    title: 'Defect ของ Row นี้เป็นปัญหาของ Dimension ไหน',
    done: (e, o, m, n) => `จบแล้ว ตรงกับแบบฝึก ${e} ข้อ, ใช้ได้เหมือนกัน ${o} ข้อ, ยังไม่ใช่ ${m} ข้อ (จาก ${n} ข้อ)`,
    doneNote: 'ข้อที่ "ใช้ได้เหมือนกัน" คือจุดที่ Dimension ทับซ้อนกัน ทีมจึงต้องตกลงเกณฑ์ไว้ล่วงหน้า',
    restart: 'เล่นใหม่',
    question: (i, n) => `ข้อ ${i} จาก ${n}`,
    table: 'ตาราง',
    pick: 'เลือก Dimension',
    group: 'dimension',
    exact: 'ตรงกับที่ใช้ในแบบฝึก',
    overlap: 'ได้เหมือนกัน',
    miss: 'ยังไม่ใช่',
    filedUnder: (d) => `: แบบฝึกนับเป็น ${d}`,
    next: 'ข้อต่อไป',
    result: 'ดูผล',
    caption: ['Row ในการ์ดสร้างให้ตรงกับชนิด Defect ที่ฝังไว้ใน ', ' ตัวเลข "ใน Dataset" คือจำนวนที่ฝังไว้ และ ', ' หาเจอครบ'],
    cases: [
      { ask: 'Customer คนนี้ไม่มี Email ซึ่งเป็นช่องที่ฝ่าย Marketing ต้องใช้', why: 'ค่าที่ต้องมีหายไป วัดเป็นสัดส่วน Row ที่ช่องนี้ถูกกรอก (ใน Dataset: 40 จาก 500)' },
      { ask: 'ช่อง Email มีค่า แต่ไม่มีเครื่องหมาย @', why: 'ค่าไม่ตรง Format ของ Domain ที่นิยามไว้ (15 จาก 460 Row ที่มี Email) ให้สังเกตว่าตัวหารไม่รวม Row ที่ว่าง เพราะ Row ที่ว่างถูกนับใน Completeness ไปแล้ว' },
      { ask: 'สอง Row ใช้ Email เดียวกัน ทั้งที่กติกาคือหนึ่ง Email ต่อหนึ่ง Customer', why: 'Entity เดียวถูกบันทึกมากกว่าหนึ่งครั้ง ซึ่งวัดโดยทดสอบกับ Key (ใน Dataset: 10 Row ส่วนเกิน)' },
      { ask: 'status บอกว่าส่งแล้ว (SHIPPED) แต่ไม่มีเวลาส่ง', alsoWhy: 'นับเป็น Completeness แบบมีเงื่อนไขได้ ถ้าทีมนิยามว่า shipped_ts บังคับเมื่อ status เป็น SHIPPED', why: 'สองช่องใน Row เดียวกันขัดกัน (record-level consistency) ซึ่ง DMBOK2 ก็ยอมรับว่า Rule แบบมีเงื่อนไขนี้เป็น Completeness ได้ ทีมต้องเลือกหนึ่งแบบแล้วใช้เหมือนกันทุกที่ (ใน Dataset: 25 Row)' },
      { ask: 'ส่งของก่อนที่จะมี Order หนึ่งวัน', why: 'แต่ละค่าเป็นวันที่ที่ถูกต้องเมื่อดูเดี่ยว ๆ แต่ลำดับเวลาขัดกันเอง (ใน Dataset: 10 Row)' },
      { ask: 'ไม่มี Customer หมายเลข 9007 ในตาราง customers', why: 'Foreign Key ชี้ไปหาตัวจริงที่ไม่มี ซึ่งเรียกว่า Orphan (ใน Dataset: 30 จาก 3,005 Row ที่ไม่ใช่ NULL)' },
      { ask: 'ข้อมูลที่ตกลงกันว่าต้องเข้า Warehouse ภายใน 24 ชั่วโมง มาถึงหลังสี่วัน', why: 'วัด Latency ตั้งแต่ข้อมูลเกิดจนพร้อมใช้ เทียบกับเวลาที่ตกลงกัน (ใน Dataset: 40 Row)' },
      { table: 'orders เทียบ payments', ask: 'ยอดใน 2 ระบบไม่ตรงกัน และระบบ Payment คือแหล่งอ้างอิงที่ยืนยันแล้ว', alsoWhy: 'มองเป็น Consistency ของข้อมูลซ้ำซ้อนข้ามระบบได้ ถ้าไม่ได้ถือว่าระบบใดถูกกว่า', why: 'Accuracy วัดโดยเทียบกับแหล่งที่ยืนยันแล้วว่าถูก (System of Record) ถ้าไม่มีแหล่งอ้างอิงแบบนี้ เราจะบอกได้แค่ว่า "ไม่ตรงกัน" (ใน Dataset: 35 จาก 2,533)' },
      { ask: 'Customer เกิดปี 1850', alsoWhy: 'ไม่สมเหตุสมผลกับสิ่งที่รู้เรื่อง Customer จึงนับเป็น Reasonability ได้เช่นกัน', why: 'ค่าอยู่นอกช่วงที่นิยามไว้ (1900 ถึงวันนี้) ซึ่งเป็น Range Rule ตรง ๆ (ใน Dataset: 6 Row รวมวันเกิดในอนาคต)' },
      { ask: 'ช่อง country เป็น "ไทย" ทั้งที่ Row อื่นใช้รหัสสองตัวอักษร', alsoWhy: 'เขียนต่างจาก TH ที่ Row อื่นใช้ จึงนับเป็น Consistency ของการแสดงผลได้', why: 'อยู่นอกรายการค่าที่ยอมรับ (ใน Dataset: 25 Row เขียนห้าแบบ) DMBOK2 Figure 92 แสดงว่า Dimension ทับซ้อนกันแบบนี้ได้ ที่สำคัญคือทีมต้องตกลงกันว่าจะนับที่ Dimension ไหน' },
    ],
  },
  en: {
    title: 'Which dimension does this defect belong to?',
    done: (e, o, m, n) => `Done: ${e} match the exercise, ${o} also acceptable, ${m} not quite (out of ${n})`,
    doneNote: 'The "also acceptable" answers are where dimensions overlap. A team has to agree its criteria in advance.',
    restart: 'Play again',
    question: (i, n) => `Question ${i} of ${n}`,
    table: 'Table',
    pick: 'Choose a dimension',
    group: 'Dimension',
    exact: 'Matches the exercise',
    overlap: 'Also acceptable',
    miss: 'Not quite',
    filedUnder: (d) => `: the exercise files it under ${d}`,
    next: 'Next',
    result: 'See the result',
    caption: ['The rows on the cards are made to look like the defect kinds planted in ', '. The "in the dataset" numbers are the planted counts, and ', ' finds all of them.'],
    cases: [
      { ask: 'This customer has no email, a field that marketing needs.', why: 'A required value is missing. It is measured as the share of rows where the field is filled in (in the dataset: 40 of 500).' },
      { ask: 'The email field has a value, but no @ sign.', why: 'The value does not match the format of the defined domain (15 of the 460 rows that have an email). The denominator leaves out the empty rows because completeness already counts those.' },
      { ask: 'Two rows use the same email, although the rule is one email per customer.', why: 'One entity is recorded more than once. It is measured by testing against the key (in the dataset: 10 surplus rows).' },
      { ask: 'The status says shipped (SHIPPED), but there is no shipping time.', alsoWhy: 'It can count as conditional completeness if the team defines shipped_ts as required when the status is SHIPPED.', why: 'Two fields in the same row contradict each other (record-level consistency). DMBOK2 also accepts that a conditional rule like this can be filed under completeness. The team has to pick one and use it everywhere (in the dataset: 25 rows).' },
      { ask: 'The order shipped a day before it was placed.', why: 'Each value is a valid date on its own, but the order in time contradicts itself (in the dataset: 10 rows).' },
      { ask: 'There is no customer 9007 in the customers table.', why: 'A foreign key points at something that does not exist. This is called an orphan (in the dataset: 30 of 3,005 non-NULL rows).' },
      { ask: 'Data that was agreed to reach the warehouse within 24 hours arrived after four days.', why: 'This measures latency, from the moment the data is created until it is ready to use, against the agreed time (in the dataset: 40 rows).' },
      { table: 'orders vs payments', ask: 'The amount differs between the two systems, and the payment system is the confirmed reference.', alsoWhy: 'It can be seen as consistency of redundant data across systems, if neither system is treated as the more correct one.', why: 'Accuracy is measured against a source confirmed to be correct (a system of record). Without such a reference you can only say the values "do not match" (in the dataset: 35 of 2,533).' },
      { ask: 'A customer was born in 1850.', alsoWhy: 'It makes no sense given what is known about customers, so it can count as reasonability too.', why: 'The value is outside the defined range (1900 to today), which is a plain range rule (in the dataset: 6 rows, including birth dates in the future).' },
      { ask: 'The country field says "ไทย" while the other rows use a two-letter code.', alsoWhy: 'It is written differently from the TH used in other rows, so it can count as consistency of representation.', why: 'It is outside the list of accepted values (in the dataset: 25 rows, written five different ways). DMBOK2 Figure 92 shows that dimensions can overlap like this. What matters is that the team agrees where to count it.' },
    ],
  },
};

export default function DimensionLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Dim | null>(null);
  const [score, setScore] = useState({ exact: 0, overlap: 0, miss: 0 });
  const done = i >= CASES.length;
  const n = Math.min(i, CASES.length - 1);
  const c = CASES[n];
  const text = t.cases[n];

  const choose = (d: Dim) => {
    if (picked) return;
    setPicked(d);
    const kind = d === c.primary ? 'exact' : d === c.also ? 'overlap' : 'miss';
    setScore((s) => ({ ...s, [kind]: s[kind] + 1 }));
  };
  const next = () => {
    setPicked(null);
    setI(i + 1);
  };
  const restart = () => {
    setI(0);
    setPicked(null);
    setScore({ exact: 0, overlap: 0, miss: 0 });
  };

  const isAlt = picked !== null && picked === c.also;
  const verdict = !picked ? '' : picked === c.primary ? t.exact : isAlt ? t.overlap : t.miss;

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>

      {done ? (
        <div className="viz-now" aria-live="polite">
          <strong>{t.done(score.exact, score.overlap, score.miss, CASES.length)}</strong>
          <span>{t.doneNote}</span>
          <div style={{ marginTop: 10 }}>
            <div className="seg"><button type="button" aria-pressed="false" onClick={restart}>{t.restart}</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="readout">
            <span>{t.question(i + 1, CASES.length)}</span>
            <span>{t.table} <b>{text.table ?? c.table}</b></span>
          </div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr>{c.cols.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {c.rows.map((r, k) => (
                  <tr key={k}>
                    {r.map((v, m) => <td key={m} className={v === null ? 'is-null' : undefined}>{v === null ? 'null' : v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{text.ask}</p>
          <div>
            <div className="lab-label">{t.pick}</div>
            <div className="seg" role="group" aria-label={t.group}>
              {DIMS.map((d) => (
                <button key={d} type="button" aria-pressed={picked === d} disabled={picked !== null && picked !== d} onClick={() => choose(d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {picked && (
            <div className="viz-now" aria-live="polite">
              <strong>{verdict}{picked !== c.primary && t.filedUnder(c.primary)}</strong>
              <span>{isAlt ? text.alsoWhy : text.why}</span>
              {isAlt && <span> {text.why}</span>}
              <div style={{ marginTop: 10 }}>
                <div className="seg"><button type="button" aria-pressed="false" onClick={next}>{i + 1 < CASES.length ? t.next : t.result}</button></div>
              </div>
            </div>
          )}
        </>
      )}

      <p className="viz-caption">
        {t.caption[0]}<code>dqlab.py</code>{t.caption[1]}<code>02_dimensions.py</code>{t.caption[2]}
      </p>
    </figure>
  );
}
