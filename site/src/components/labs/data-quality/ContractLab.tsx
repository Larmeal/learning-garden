import { useState } from 'react';

type Kind = 'breaking' | 'review' | 'safe';

const KINDS: { id: Kind; label: string }[] = [
  { id: 'breaking', label: 'ทำให้ผู้ใช้พัง' },
  { id: 'review', label: 'ต้องถามผู้ใช้ก่อน' },
  { id: 'safe', label: 'ปลอดภัย' },
];

interface Change { before: string; after: string; answer: Kind; why: string }

// The same six differences that dqcontract.diff() finds between contracts/orders.v1.yaml and orders.v2.yaml.
const CHANGES: Change[] = [
  { before: 'total_amount DOUBLE', after: 'amount_total DOUBLE', answer: 'breaking', why: 'ชื่อคอลัมน์เปลี่ยน ทุก query ที่เลือก total_amount ล้มทันที การเปลี่ยนชื่อคือการลบคอลัมน์เก่าและเพิ่มคอลัมน์ใหม่พร้อมกัน' },
  { before: 'customer_id BIGINT', after: 'customer_id VARCHAR', answer: 'breaking', why: 'การ join กับ customers.customer_id (BIGINT) ต้องเพิ่ม cast ชนิดที่เปลี่ยนแล้วเรียงลำดับและเปรียบเทียบผลต่างกันด้วย' },
  { before: 'order_ts TIMESTAMP, not null', after: 'order_ts TIMESTAMP, null ได้', answer: 'breaking', why: 'ผู้ใช้ที่กรอง จัดกลุ่ม หรือตรวจความสดจาก order_ts เคยพึ่งพาว่าไม่มี null การผ่อนคำสัญญาให้ null ได้จึงกระทบผู้ใช้' },
  { before: "status: PLACED, SHIPPED, CANCELLED", after: 'status: เพิ่ม RETURNED', answer: 'review', why: 'ผู้ใช้ที่เขียน CASE ครอบ 3 ค่าอาจให้ RETURNED ตกไปสาขา else โดยไม่มีใครรู้ ต้องถามผู้ใช้ว่ารับค่าใหม่ได้ไหม' },
  { before: '(ไม่มีคอลัมน์ channel)', after: 'channel VARCHAR, null ได้', answer: 'safe', why: 'การเพิ่มคอลัมน์ที่ไม่บังคับไม่กระทบ query ที่เลือกคอลัมน์ตามชื่อ (ข้อยกเว้น: ตัวโหลดที่ผูก schema ตายตัวหรือ SELECT * ที่ส่งต่อไปยังที่ที่คาดคอลัมน์ครบชุดเดิม)' },
  { before: '(ไม่มีคอลัมน์ currency)', after: 'currency VARCHAR, ห้าม null', answer: 'safe', why: 'ผู้ใช้ไม่ต้องทำอะไร เพราะเป็นคอลัมน์ใหม่ แต่ผู้ผลิตต้องกรอกให้ครบทุกแถว ซึ่งเป็นภาระของผู้ผลิตมากกว่าผู้ใช้' },
];

export default function ContractLab() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Kind | null>(null);
  const [right, setRight] = useState(0);
  const done = i >= CHANGES.length;
  const c = CHANGES[Math.min(i, CHANGES.length - 1)];

  const choose = (k: Kind) => {
    if (picked) return;
    setPicked(k);
    if (k === c.answer) setRight((n) => n + 1);
  };
  const next = () => {
    setPicked(null);
    setI(i + 1);
  };
  const restart = () => {
    setI(0);
    setPicked(null);
    setRight(0);
  };

  return (
    <figure className="viz">
      <div className="viz-title">สัญญาเวอร์ชัน 2 เปลี่ยนจากเวอร์ชัน 1 ผู้ใช้จะรู้สึกอย่างไร</div>
      {done ? (
        <div className="viz-now" aria-live="polite">
          <strong>จัดถูก {right} จาก {CHANGES.length} ข้อ</strong>
          <span>เกณฑ์ในที่นี้เขียนจากมุมของผู้ใช้ที่อ่านข้อมูล เป็นกฎของเส้นทางนี้ ไม่ใช่มาตรฐาน ทีมของคุณควรตกลงเกณฑ์ของตัวเองและเขียนไว้ในสัญญา</span>
          <div style={{ marginTop: 10 }}>
            <div className="seg"><button type="button" aria-pressed="false" onClick={restart}>เล่นใหม่</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="readout">
            <span>ข้อ <b>{i + 1}</b> จาก {CHANGES.length}</span>
            <span>ตาราง <b>orders</b></span>
          </div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr><th>เวอร์ชัน 1</th><th>เวอร์ชัน 2</th></tr></thead>
              <tbody><tr><td>{c.before}</td><td>{c.after}</td></tr></tbody>
            </table>
          </div>
          <div>
            <div className="lab-label">ผลต่อผู้ใช้</div>
            <div className="seg" role="group" aria-label="ประเภทของการเปลี่ยน">
              {KINDS.map((k) => (
                <button key={k.id} type="button" aria-pressed={picked === k.id} disabled={picked !== null && picked !== k.id} onClick={() => choose(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          {picked && (
            <div className="viz-now" aria-live="polite">
              <strong>{picked === c.answer ? 'ตรงกับเกณฑ์' : `ยังไม่ตรง: เกณฑ์จัดเป็น "${KINDS.find((k) => k.id === c.answer)?.label}"`}</strong>
              <span>{c.why}</span>
              <div style={{ marginTop: 10 }}>
                <div className="seg"><button type="button" aria-pressed="false" onClick={next}>{i + 1 < CHANGES.length ? 'ข้อต่อไป' : 'ดูผล'}</button></div>
              </div>
            </div>
          )}
        </>
      )}
      <p className="viz-caption">
        หกข้อนี้คือความต่างระหว่าง <code>contracts/orders.v1.yaml</code> กับ <code>orders.v2.yaml</code> ที่ <code>06_contract.py</code> จัดประเภทด้วยโค้ดและได้ผลเดียวกัน
      </p>
    </figure>
  );
}
