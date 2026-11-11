import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface S {
  title: string;
  where: string;
  text: string;
}

type Lang = 'th' | 'en';

const TEXT: Record<
  Lang,
  {
    steps: S[];
    titleBefore: string;
    titleAfter: string;
    stop: string;
    play: string;
    prev: string;
    next: string;
    bad: string;
    touchedQ: string;
    yes: string;
    notYet: string;
    successLabel: string;
    unknown: string;
    raiseLabel: string;
    raiseNo: string;
    captionBefore: string;
    captionAnd: string;
  }
> = {
  th: {
    steps: [
  { title: 'Checkpoint.run() เริ่ม', where: 'checkpoint/checkpoint.py', text: 'ตรวจว่ามี Validation Definition อย่างน้อยหนึ่งตัว ถ้าไม่มีจะ raise จากนั้นเช็กว่าทุกอย่างถูก add เข้า Context แล้ว (ถ้ามีแค่ตัว Checkpoint เองที่ยังไม่ได้ add GX จะ add ให้ แต่ถ้า Suite หรือ Data Source ยังไม่ได้ add จะ raise Error)' },
  { title: 'ValidationDefinition.run() ทีละตัว', where: 'core/validation_definition.py', text: 'แต่ละตัวจะได้ batch_parameters และ result_format เดียวกับ Checkpoint และตัวมันเองก็ถูก add เข้า Context ถ้ายังไม่ได้ add' },
  { title: 'สร้าง Validator และ Batch', where: 'validator/v1_validator.py', text: 'จนถึงตรงนี้ยังไม่ได้แตะข้อมูลเลย Validator จะถูกสร้างตอนใช้ครั้งแรก แล้วขอ Batch จาก Batch Definition ตามพารามิเตอร์' },
  { title: 'รวม Metric เป็นกราฟ แล้วคำนวณเป็นรอบ', where: 'validator/validator.py → validation_graph.py', text: 'ทุก Expectation ประกาศ Metric ที่ต้องใช้ แล้ว GX รวมเป็นกราฟเดียว โดย Metric ที่ซ้ำกันจะคำนวณครั้งเดียว จากนั้น Execution Engine จะคำนวณทีละรอบ' },
  { title: 'Expectation ตัดสินผล', where: 'expectations/expectation.py', text: 'แต่ละ Expectation อ่านค่า Metric แล้วตัดสิน success จึงได้ผลแยกกันต่อ Expectation ถ้าตัวไหนพังจะได้ success=False พร้อม exception_info และไม่ raise' },
  { title: 'เก็บผลลง Validation Results Store', where: 'core/validation_definition.py', text: 'ผลของแต่ละ Validation ถูกบันทึกก่อนที่ Action จะเริ่มทำงาน' },
  { title: 'สร้าง CheckpointResult', where: 'checkpoint/checkpoint.py', text: 'success จะเป็น True เมื่อผลของทุก Validation เป็น True' },
  { title: 'รัน Action ตามลำดับ', where: 'checkpoint/actions.py', text: 'UpdateDataDocsAction จะถูกย้ายไปรันก่อน Action อื่น ถ้า Action ใด raise การรันจะหยุดตรงนั้น และ Checkpoint จะ raise ออกมา' },
  { title: 'คืน CheckpointResult', where: 'checkpoint/checkpoint.py', text: 'ถ้าข้อมูลไม่ผ่านก็ไม่มี Exception แต่จะคืนผลที่ success=False ซึ่ง Pipeline ต้องอ่าน .success เอง' },
],
    titleBefore: 'ตาม ',
    titleAfter: ' ไปทีละขั้น',
    stop: 'หยุด',
    play: 'เล่น',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    bad: 'ข้อมูลมีปัญหา',
    touchedQ: 'แตะข้อมูลแล้วไหม',
    yes: 'ใช่',
    notYet: 'ยัง',
    successLabel: 'ผล success',
    unknown: 'ยังไม่รู้',
    raiseLabel: 'raise exception',
    raiseNo: 'ไม่ (ถ้า Action ไม่ Error)',
    captionBefore: 'ลำดับนี้อ่านจากซอร์ส GX 1.24.1 ส่วนพฤติกรรม (ไม่ raise เมื่อข้อมูลไม่ผ่าน, ผลถูกเก็บก่อน Action, Data Docs มาก่อน) เรายืนยันด้วย ',
    captionAnd: ' และ ',
  },
  en: {
    steps: [
  { title: 'Checkpoint.run() starts', where: 'checkpoint/checkpoint.py', text: 'Checks that there is at least one validation definition (it raises if there is none). Then it checks that everything was added to the context. If only the checkpoint itself was not added, GX adds it. If the suite or the data source was not added, it raises an error.' },
  { title: 'ValidationDefinition.run() one by one', where: 'core/validation_definition.py', text: 'Each one gets the same batch_parameters and result_format as the checkpoint. It is also added to the context if it was not added yet.' },
  { title: 'Build the Validator and the batch', where: 'validator/v1_validator.py', text: 'So far the data has not been touched. The Validator is built when it is first used, then it asks the batch definition for a batch with the given parameters.' },
  { title: 'Put the metrics in a graph, compute in rounds', where: 'validator/validator.py → validation_graph.py', text: 'Every expectation declares the metrics it needs. GX puts them in one graph, and a metric that appears twice is computed once. Then the execution engine computes them round by round.' },
  { title: 'Expectations decide the result', where: 'expectations/expectation.py', text: 'Each expectation reads its metric values and decides success. You get one result per expectation. If one of them breaks, it gets success=False with exception_info, and nothing is raised.' },
  { title: 'Store the result in the validation results store', where: 'core/validation_definition.py', text: 'The result of each validation is saved before the actions start.' },
  { title: 'Build the CheckpointResult', where: 'checkpoint/checkpoint.py', text: 'success is True when the results of all validations are True.' },
  { title: 'Run the Actions in order', where: 'checkpoint/actions.py', text: 'UpdateDataDocsAction is moved to run before the other actions. If any action raises, the run stops there and the checkpoint raises.' },
  { title: 'Return the CheckpointResult', where: 'checkpoint/checkpoint.py', text: 'If the data does not pass, there is no exception. It returns a result with success=False. The pipeline has to read .success itself.' },
],
    titleBefore: 'Follow ',
    titleAfter: ' step by step',
    stop: 'Pause',
    play: 'Play',
    prev: 'Previous',
    next: 'Next',
    bad: 'The data has a problem',
    touchedQ: 'Touched the data yet?',
    yes: 'Yes',
    notYet: 'Not yet',
    successLabel: 'success result',
    unknown: 'Not known yet',
    raiseLabel: 'raise exception',
    raiseNo: 'No (if no action errors)',
    captionBefore: 'This order is read from the GX 1.24.1 source. The behavior (no raise when the data fails, the result is stored before the actions, Data Docs first) is confirmed by ',
    captionAnd: ' and ',
  },
};

export default function RunFlow({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const STEPS = t.steps;
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
      <div className="viz-title">{t.titleBefore}<code>Checkpoint.run()</code>{t.titleAfter}</div>
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={() => { if (step >= STEPS.length - 1) setStep(0); setPlaying((p) => !p); }}>
          {playing ? t.stop : t.play}
        </button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}>{t.prev}</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setStep((s) => Math.min(STEPS.length - 1, s + 1)); }}>{t.next}</button>
        <label className="check">
          <input type="checkbox" checked={bad} onChange={(e) => setBad(e.target.checked)} />
          {t.bad}
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
            <div><span className="lab-label">{t.touchedQ}</span><b data-on={touched}>{touched ? t.yes : t.notYet}</b></div>
            <div><span className="lab-label">{t.successLabel}</span><b data-on={success === null ? undefined : success}>{success === null ? t.unknown : String(success)}</b></div>
            <div><span className="lab-label">{t.raiseLabel}</span><b data-on={false}>{t.raiseNo}</b></div>
          </div>
        </div>
      </div>

      <p className="viz-caption">
        {t.captionBefore}<code>03_traps.py</code>{t.captionAnd}<code>06_actions_docs.py</code>
      </p>
    </figure>
  );
}
