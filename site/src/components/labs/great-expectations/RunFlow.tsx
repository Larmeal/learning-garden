import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface S {
  title: string;
  where: string;
  text: string;
}

const STEPS: S[] = [
  { title: 'Checkpoint.run() เริ่ม', where: 'checkpoint/checkpoint.py', text: 'ตรวจว่ามี validation definition อย่างน้อยหนึ่งตัว ถ้าไม่มีจะ raise แล้วเช็กว่าทุกอย่างถูก add เข้า context แล้ว (ถ้าเฉพาะตัว checkpoint เองยังไม่ได้ add GX add ให้ แต่ถ้า suite หรือ data source ยังไม่ได้ add จะ raise error)' },
  { title: 'ValidationDefinition.run() ทีละตัว', where: 'core/validation_definition.py', text: 'แต่ละตัวได้ batch_parameters และ result_format เดียวกับ checkpoint ตัวเองก็ถูก add เข้า context ถ้ายังไม่ได้ add' },
  { title: 'สร้าง Validator และ batch', where: 'validator/v1_validator.py', text: 'จนถึงตรงนี้ยังไม่ได้แตะข้อมูล Validator สร้างตอนถูกใช้ครั้งแรก แล้วขอ batch จาก batch definition ตามพารามิเตอร์' },
  { title: 'รวม metric เป็นกราฟ คำนวณเป็นรอบ', where: 'validator/validator.py → validation_graph.py', text: 'ทุก expectation ประกาศ metric ที่ต้องใช้ GX รวมเป็นกราฟเดียว metric ซ้ำกันคำนวณครั้งเดียว แล้ว execution engine คำนวณทีละรอบ' },
  { title: 'Expectation ตัดสินผล', where: 'expectations/expectation.py', text: 'แต่ละ expectation อ่านค่า metric แล้วตัดสิน success ได้ผลต่อ expectation ถ้าตัวไหนพังจะได้ success=False พร้อม exception_info ไม่ raise' },
  { title: 'เก็บผลลง validation results store', where: 'core/validation_definition.py', text: 'ผลของแต่ละ validation ถูกบันทึกก่อนที่ action จะเริ่ม' },
  { title: 'สร้าง CheckpointResult', where: 'checkpoint/checkpoint.py', text: 'success เป็น True เมื่อผลทุก validation เป็น True' },
  { title: 'รัน Action ตามลำดับ', where: 'checkpoint/actions.py', text: 'UpdateDataDocsAction ถูกย้ายไปรันก่อน action อื่น ถ้า action ใด raise การรันหยุดตรงนั้นและ checkpoint raise ออกมา' },
  { title: 'คืน CheckpointResult', where: 'checkpoint/checkpoint.py', text: 'ถ้าข้อมูลไม่ผ่านก็ไม่มี exception คืนผลที่ success=False pipeline ต้องอ่าน .success เอง' },
];

export default function RunFlow() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [bad, setBad] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!playing) return;
    if (step >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), reduce ? 0 : 1700);
    return () => clearTimeout(t);
  }, [playing, step, reduce]);

  const success = step < 4 ? null : !bad;
  const touched = step >= 2;

  return (
    <figure className="viz">
      <div className="viz-title">ตาม <code>Checkpoint.run()</code> ไปทีละขั้น</div>
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={() => { if (step >= STEPS.length - 1) setStep(0); setPlaying((p) => !p); }}>
          {playing ? 'หยุด' : 'เล่น'}
        </button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}>ก่อนหน้า</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setStep((s) => Math.min(STEPS.length - 1, s + 1)); }}>ถัดไป</button>
        <label className="check">
          <input type="checkbox" checked={bad} onChange={(e) => setBad(e.target.checked)} />
          ข้อมูลมีปัญหา
        </label>
      </div>

      <div className="gx-split">
        <ol className="gx-steps">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              data-state={i === step ? 'now' : i < step ? 'done' : 'todo'}
              animate={{ x: i === step && !reduce ? 6 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <button type="button" onClick={() => { setPlaying(false); setStep(i); }}>
                <span className="mono">{i + 1}</span> {s.title}
              </button>
            </motion.li>
          ))}
        </ol>

        <div className="gx-pane gx-grow">
          <div className="viz-now" aria-live="polite">
            <strong>{STEPS[step].title}</strong>
            <span>{STEPS[step].text}</span>
            <code className="gx-where">{STEPS[step].where}</code>
          </div>
          <div className="gx-status">
            <div><span className="lab-label">แตะข้อมูลแล้วไหม</span><b data-on={touched}>{touched ? 'ใช่' : 'ยัง'}</b></div>
            <div><span className="lab-label">ผล success</span><b data-on={success === null ? undefined : success}>{success === null ? 'ยังไม่รู้' : String(success)}</b></div>
            <div><span className="lab-label">raise exception</span><b data-on={false}>ไม่ (ถ้า action ไม่ error)</b></div>
          </div>
        </div>
      </div>

      <p className="viz-caption">
        ลำดับนี้อ่านจากซอร์ส GX 1.24.1 และพฤติกรรม (ไม่ raise เมื่อข้อมูลไม่ผ่าน, ผลถูกเก็บก่อน action, Data Docs มาก่อน) ยืนยันด้วย <code>03_traps.py</code> และ <code>06_actions_docs.py</code>
      </p>
    </figure>
  );
}
