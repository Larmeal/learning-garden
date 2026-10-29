import { useState } from 'react';

type Scenario = 'good' | 'bad' | 'empty' | 'broken' | 'late';
type Policy = 'ignore' | 'gate' | 'gate-rows';

const SCENARIOS: { id: Scenario; label: string; note: string }[] = [
  { id: 'good', label: 'ข้อมูลดี', note: 'ทุก expectation ผ่าน' },
  { id: 'bad', label: 'ข้อมูลเสีย', note: 'มีค่านอกช่วงและ null' },
  { id: 'empty', label: 'ตารางว่าง', note: 'upstream ส่งไฟล์ว่างมา' },
  { id: 'broken', label: 'expectation พัง', note: 'คอลัมน์ที่อ้างถึงหายไป' },
  { id: 'late', label: 'action ล้ม', note: 'ข้อมูลเสีย แต่ Slack webhook ใช้ไม่ได้' },
];

const POLICIES: { id: Policy; label: string; code: string }[] = [
  { id: 'ignore', label: 'เรียกแล้วไม่เช็กผล', code: 'checkpoint.run(...)\npublish()' },
  { id: 'gate', label: 'หยุดเมื่อ success เป็น False', code: 'result = checkpoint.run(...)\nif not result.success:\n    raise ...\npublish()' },
  { id: 'gate-rows', label: 'หยุด + มี expectation จำนวนแถว', code: '# suite มี ExpectTableRowCountToBeBetween(min_value=1)\nresult = checkpoint.run(...)\nif not result.success:\n    raise ...\npublish()' },
];

interface Out {
  published: boolean;
  headline: string;
  text: string;
  bad: boolean;
}

function simulate(s: Scenario, p: Policy): Out {
  const gated = p !== 'ignore';
  // Whether the suite itself reports failure for the scenario (verified: an empty table passes unless a row-count expectation exists).
  const reportsFail = s === 'bad' || s === 'broken' || s === 'late' || (s === 'empty' && p === 'gate-rows');
  if (s === 'late') {
    return {
      published: false,
      bad: true,
      headline: 'งานล้มด้วย exception จาก action',
      text: 'Checkpoint.run() raise ก่อนจะถึงบรรทัดถัดไป จึงไม่มี publish ผลการตรวจถูกเก็บไว้แล้ว และถ้าเขียน gate ไว้ก็ไม่ได้ใช้ เพราะไม่มีโอกาสอ่าน result ลองดักด้วย try/except ถ้าต้องการแยก "ข้อมูลเสีย" ออกจาก "แจ้งเตือนล้ม"',
    };
  }
  if (!gated) {
    return {
      published: true,
      bad: s !== 'good',
      headline: 'publish ทุกครั้ง',
      text: s === 'good' ? 'ข้อมูลดี จึงไม่มีผลเสีย' : 'Checkpoint.run() ไม่ raise เมื่อข้อมูลไม่ผ่าน pipeline จึงเดินต่อและ publish ข้อมูลที่เสียออกไป',
    };
  }
  if (reportsFail) {
    return {
      published: false,
      bad: false,
      headline: 'หยุดก่อน publish',
      text:
        s === 'broken'
          ? 'หยุดถูก แต่สาเหตุคือ expectation พัง (ดู exception_info ของผล) ไม่ใช่ข้อมูลเสีย ควรแยกสองกรณีนี้ในข้อความเตือน'
          : s === 'empty'
            ? 'ตารางว่างล้มเพราะ suite มี expectation จำนวนแถว'
            : 'result.success เป็น False จึงหยุด',
    };
  }
  if (s === 'empty') {
    return {
      published: true,
      bad: true,
      headline: 'publish ตารางว่าง',
      text: 'expectation แบบ column map ผ่านโดยปริยายเมื่อไม่มีแถว result.success เป็น True ทั้งที่ไม่มีข้อมูลเลย ต้องมี expectation จำนวนแถว',
    };
  }
  return { published: true, bad: false, headline: 'publish', text: 'ทุกข้อผ่าน' };
}

export default function PipelineGate() {
  const [s, setS] = useState<Scenario>('empty');
  const [p, setP] = useState<Policy>('gate');
  const out = simulate(s, p);
  const pol = POLICIES.find((x) => x.id === p)!;

  return (
    <figure className="viz">
      <div className="viz-title">pipeline ที่เรียก checkpoint: จะเกิดอะไรกับข้อมูลที่ตามมา</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">สถานการณ์</div>
          <div className="seg" role="group" aria-label="สถานการณ์">
            {SCENARIOS.map((x) => (
              <button key={x.id} type="button" aria-pressed={s === x.id} onClick={() => setS(x.id)}>{x.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="lab-label">โค้ดใน pipeline</div>
          <div className="seg" role="group" aria-label="โค้ดใน pipeline">
            {POLICIES.map((x) => (
              <button key={x.id} type="button" aria-pressed={p === x.id} onClick={() => setP(x.id)}>{x.label}</button>
            ))}
          </div>
        </div>
      </div>

      <pre className="codeline">{pol.code}</pre>

      <div className="gx-pipe" aria-hidden="true">
        <span data-on>โหลดเข้า staging</span>
        <i />
        <span data-on>checkpoint</span>
        <i />
        <span data-on={out.published} data-bad={out.published && out.bad ? true : undefined}>publish</span>
      </div>

      <div className="viz-now" aria-live="polite" data-bad={out.bad || undefined}>
        <strong>{out.headline}</strong>
        <span>{SCENARIOS.find((x) => x.id === s)!.note}. {out.text}</span>
      </div>
    </figure>
  );
}
