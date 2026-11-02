import { useState } from 'react';

type Dim = 'completeness' | 'validity' | 'uniqueness' | 'consistency' | 'integrity' | 'timeliness' | 'accuracy' | 'reasonability';

const DIMS: { id: Dim; label: string }[] = [
  { id: 'completeness', label: 'completeness' },
  { id: 'validity', label: 'validity' },
  { id: 'uniqueness', label: 'uniqueness' },
  { id: 'consistency', label: 'consistency' },
  { id: 'integrity', label: 'integrity' },
  { id: 'timeliness', label: 'timeliness' },
  { id: 'accuracy', label: 'accuracy' },
  { id: 'reasonability', label: 'reasonability' },
];

interface Case {
  table: string;
  cols: string[];
  rows: (string | null)[][];
  ask: string;
  primary: Dim;
  also?: { dim: Dim; why: string }[];
  why: string;
}

// The defect kinds are the ones planted in dqlab.py. The rows are made to look like those defects, they are not all real rows.
const CASES: Case[] = [
  {
    table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['41', null, 'TH']],
    ask: 'ลูกค้าคนนี้ไม่มีอีเมล ซึ่งเป็นช่องที่การตลาดต้องใช้',
    primary: 'completeness',
    why: 'ค่าที่ต้องมีหายไป วัดเป็นสัดส่วนแถวที่ช่องนี้ถูกกรอก (ในชุดข้อมูล: 40 จาก 500)',
  },
  {
    table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['112', 'user112example.com', 'TH']],
    ask: 'มีค่าในช่องอีเมล แต่ไม่มีเครื่องหมาย @',
    primary: 'validity',
    why: 'ค่าไม่ตรงรูปแบบของโดเมนที่นิยามไว้ (15 จาก 460 แถวที่มีอีเมล) สังเกตว่าตัวหารไม่รวมแถวที่ว่าง เพราะแถวว่างถูกนับใน completeness แล้ว',
  },
  {
    table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['3', 'user3@example.com', 'TH'], ['493', 'user3@example.com', 'SG']],
    ask: 'สองแถวใช้อีเมลเดียวกัน ทั้งที่กติกาคือหนึ่งอีเมลต่อหนึ่งลูกค้า',
    primary: 'uniqueness',
    why: 'entity เดียวถูกบันทึกมากกว่าหนึ่งครั้ง วัดโดยทดสอบกับคีย์ (ในชุดข้อมูล: 10 แถวส่วนเกิน)',
  },
  {
    table: 'orders', cols: ['order_id', 'status', 'order_ts', 'shipped_ts'], rows: [['1207', 'SHIPPED', '2026-09-14 10:02', null]],
    ask: 'สถานะบอกว่าส่งแล้ว แต่ไม่มีเวลาส่ง',
    primary: 'consistency',
    also: [{ dim: 'completeness', why: 'นับเป็น completeness แบบมีเงื่อนไขได้ ถ้าทีมนิยามว่า shipped_ts บังคับเมื่อสถานะเป็น SHIPPED' }],
    why: 'สองช่องในแถวเดียวกันขัดกัน (record-level consistency) DMBOK2 ก็ยอมรับว่ากฎเงื่อนไขแบบนี้เป็น completeness ได้ ทีมต้องเลือกหนึ่งแล้วใช้เหมือนกันทุกที่ (ในชุดข้อมูล: 25 แถว)',
  },
  {
    table: 'orders', cols: ['order_id', 'status', 'order_ts', 'shipped_ts'], rows: [['1930', 'SHIPPED', '2026-09-14 09:00', '2026-09-13 09:00']],
    ask: 'ส่งของก่อนที่จะมีคำสั่งซื้อหนึ่งวัน',
    primary: 'consistency',
    why: 'แต่ละค่าเป็นวันที่ที่ถูกต้องเมื่อดูเดี่ยวๆ แต่ลำดับเวลาขัดกันเอง (ในชุดข้อมูล: 10 แถว)',
  },
  {
    table: 'orders', cols: ['order_id', 'customer_id', 'total_amount'], rows: [['2218', '9007', '1830.00']],
    ask: 'ไม่มีลูกค้าหมายเลข 9007 ในตาราง customers',
    primary: 'integrity',
    why: 'คีย์อ้างอิงชี้ไปหาตัวจริงที่ไม่มี เรียกว่า orphan (ในชุดข้อมูล: 30 จาก 3,005 แถวที่ไม่ใช่ NULL)',
  },
  {
    table: 'orders', cols: ['order_id', 'order_ts', 'ingested_at'], rows: [['877', '2026-08-03 11:20', '2026-08-07 11:25']],
    ask: 'ข้อมูลที่ตกลงกันว่าต้องเข้าคลังภายใน 24 ชั่วโมง มาถึงหลังสี่วัน',
    primary: 'timeliness',
    why: 'วัด latency ตั้งแต่ข้อมูลเกิดจนพร้อมใช้ เทียบกับเวลาที่ตกลงกัน (ในชุดข้อมูล: 40 แถว)',
  },
  {
    table: 'orders เทียบ payments', cols: ['order_id', 'orders.total_amount', 'payments.amount'], rows: [['3340', '1200.00', '1250.00']],
    ask: 'ยอดในสองระบบไม่ตรงกัน และระบบชำระเงินคือแหล่งอ้างอิงที่ยืนยันแล้ว',
    primary: 'accuracy',
    also: [{ dim: 'consistency', why: 'มองเป็น consistency ของข้อมูลซ้ำซ้อนข้ามระบบได้ ถ้าไม่ได้ถือว่าระบบใดถูกกว่า' }],
    why: 'accuracy วัดโดยเทียบกับแหล่งที่ยืนยันแล้วว่าถูก (system of record) ถ้าไม่มีแหล่งอ้างอิงแบบนี้ จะบอกได้แค่ว่า "ไม่ตรงกัน" (ในชุดข้อมูล: 35 จาก 2,533)',
  },
  {
    table: 'customers', cols: ['customer_id', 'email', 'birth_date'], rows: [['207', 'user207@example.com', '1850-01-01']],
    ask: 'ลูกค้าเกิดปี 1850',
    primary: 'validity',
    also: [{ dim: 'reasonability', why: 'ไม่สมเหตุสมผลกับสิ่งที่รู้เรื่องลูกค้า จึงนับเป็น reasonability ได้เช่นกัน' }],
    why: 'ค่าอยู่นอกช่วงที่นิยามไว้ (1900 ถึงวันนี้) ซึ่งเป็นกฎช่วงตรงๆ (ในชุดข้อมูล: 6 แถว รวมวันเกิดในอนาคต)',
  },
  {
    table: 'customers', cols: ['customer_id', 'email', 'country'], rows: [['318', 'user318@example.com', 'ไทย']],
    ask: 'ช่องประเทศเป็น "ไทย" ทั้งที่แถวอื่นใช้รหัสสองตัวอักษร',
    primary: 'validity',
    also: [{ dim: 'consistency', why: 'เขียนต่างจาก TH ที่แถวอื่นใช้ จึงนับเป็น consistency ของการแสดงผลได้' }],
    why: 'อยู่นอกรายการค่าที่ยอมรับ (ในชุดข้อมูล: 25 แถว เขียนห้าแบบ) DMBOK2 Figure 92 แสดงว่ามิติทับซ้อนกันแบบนี้ได้ ที่สำคัญคือทีมตกลงว่านับที่มิติไหน',
  },
];

export default function DimensionLab() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Dim | null>(null);
  const [score, setScore] = useState({ exact: 0, overlap: 0, miss: 0 });
  const done = i >= CASES.length;
  const c = CASES[Math.min(i, CASES.length - 1)];

  const choose = (d: Dim) => {
    if (picked) return;
    setPicked(d);
    const kind = d === c.primary ? 'exact' : c.also?.some((a) => a.dim === d) ? 'overlap' : 'miss';
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

  const alt = picked ? c.also?.find((a) => a.dim === picked) : undefined;
  const verdict = !picked ? '' : picked === c.primary ? 'ตรงกับที่ใช้ในแบบฝึก' : alt ? 'ได้เหมือนกัน' : 'ยังไม่ใช่';

  return (
    <figure className="viz">
      <div className="viz-title">ข้อมูลเสียแถวนี้เป็นปัญหาของมิติไหน</div>

      {done ? (
        <div className="viz-now" aria-live="polite">
          <strong>จบแล้ว: ตรงกับแบบฝึก {score.exact}, ใช้ได้เหมือนกัน {score.overlap}, ยังไม่ใช่ {score.miss} (จาก {CASES.length} ข้อ)</strong>
          <span>ข้อที่ "ใช้ได้เหมือนกัน" คือจุดที่มิติทับซ้อนกัน ทีมต้องตกลงเกณฑ์ไว้ล่วงหน้า</span>
          <div style={{ marginTop: 10 }}>
            <div className="seg"><button type="button" aria-pressed="false" onClick={restart}>เล่นใหม่</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="readout">
            <span>ข้อ <b>{i + 1}</b> จาก {CASES.length}</span>
            <span>ตาราง <b>{c.table}</b></span>
          </div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr>{c.cols.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {c.rows.map((r, n) => (
                  <tr key={n}>
                    {r.map((v, k) => <td key={k} className={v === null ? 'is-null' : undefined}>{v === null ? 'null' : v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{c.ask}</p>
          <div>
            <div className="lab-label">เลือกมิติ</div>
            <div className="seg" role="group" aria-label="มิติ">
              {DIMS.map((d) => (
                <button key={d.id} type="button" aria-pressed={picked === d.id} disabled={picked !== null && picked !== d.id} onClick={() => choose(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {picked && (
            <div className="viz-now" aria-live="polite">
              <strong>{verdict}{picked !== c.primary && `: แบบฝึกนับเป็น ${c.primary}`}</strong>
              <span>{alt ? alt.why : c.why}</span>
              {alt && <span> {c.why}</span>}
              <div style={{ marginTop: 10 }}>
                <div className="seg"><button type="button" aria-pressed="false" onClick={next}>{i + 1 < CASES.length ? 'ข้อต่อไป' : 'ดูผล'}</button></div>
              </div>
            </div>
          )}
        </>
      )}

      <p className="viz-caption">
        แถวในการ์ดสร้างให้ตรงกับชนิดข้อมูลเสียที่ฝังไว้ใน <code>dqlab.py</code> ตัวเลข "ในชุดข้อมูล" คือจำนวนที่ฝังไว้และ <code>02_dimensions.py</code> หาเจอครบ
      </p>
    </figure>
  );
}
