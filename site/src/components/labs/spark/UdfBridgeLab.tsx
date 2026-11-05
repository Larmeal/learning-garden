import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// What crosses the socket between an executor (JVM) and its Python worker, for the three kinds of Python function.
// 8 rows and a batch of 4 keep the picture small. Real defaults: 100 rows per pickle batch (python.udf.maxRecordsPerBatch),
// 10,000 rows per Arrow batch (arrow.maxRecordsPerBatch). Source: PythonRunner, BatchEvalPythonExec, PythonArrowInput,
// worker.py (Spark 4.2.0). Call counts per kind were asserted by subjects/spark/code/exercises/08_udf.py.

type Kind = 'pickle' | 'arrow' | 'pandas';

const KINDS: { id: Kind; label: string; sub: string }[] = [
  { id: 'pickle', label: 'Python UDF (useArrow=False)', sub: 'evalType 100, BatchEvalPython' },
  { id: 'arrow', label: 'Python UDF แบบ Arrow (ค่าเริ่มต้น)', sub: 'evalType 101, ArrowEvalPython' },
  { id: 'pandas', label: 'pandas_udf', sub: 'evalType 200, ArrowEvalPython' },
];

const STEPS: Record<Kind, StepInfo[]> = {
  pickle: [
    { name: 'แถวใน JVM', title: 'แถวอยู่ในรูป InternalRow ของ JVM', text: 'executor อ่าน partition ของตัวเอง แต่ละแถวต้องแปลงเป็น object ที่ Python เข้าใจ' },
    { name: 'pickle', title: 'จัดเป็นชุดละ 100 แถว แล้ว pickle', text: 'BatchEvalPythonExec แปลงแถวเป็น Java object แล้ว pickle ทีละ batch (ภาพใช้ 4 แถวต่อ batch) ค่าเริ่มต้นคือ 100 แถว' },
    { name: 'socket', title: 'ส่งผ่าน socket ไปที่ Python worker', text: 'ทุก task มี Python worker process ของตัวเอง JVM ส่ง handshake (version, ไฟล์, broadcast, ตัวฟังก์ชันที่ pickle แล้ว) ตามด้วยข้อมูล' },
    { name: 'เรียกฟังก์ชัน', title: 'worker เรียกฟังก์ชัน 1 ครั้งต่อ 1 แถว', text: 'unpickle แล้ววนทีละแถวเรียก f(x) ภาพนับ 8 ครั้งสำหรับ 8 แถว' },
    { name: 'ส่งกลับ', title: 'pickle ผลกลับ แล้ว JVM แปลงเป็นแถว', text: 'ผลถูก pickle เป็น batch ส่งกลับ JVM unpickle แล้วแปลงเป็น InternalRow ตามชนิดที่ประกาศ ถ้าชนิดไม่ตรง ผลคือ NULL แบบเงียบๆ' },
  ],
  arrow: [
    { name: 'แถวใน JVM', title: 'แถวอยู่ในรูป InternalRow ของ JVM', text: 'ขั้นเดียวกับเส้นทาง pickle' },
    { name: 'Arrow batch', title: 'จัดเป็น Arrow batch สูงสุด 10,000 แถว', text: 'แถวถูกเขียนเป็น column (Arrow) ได้ทีละก้อนใหญ่ ถูกกว่าการ pickle แถวต่อแถว (ภาพใช้ 4 แถวต่อ batch)' },
    { name: 'socket', title: 'ส่งผ่าน socket เป็น Arrow stream', text: 'ใช้ socket แบบเดียวกัน ต่างที่ข้อมูลเป็น Arrow ซึ่งอ่านเข้า memory ของ Python ได้โดยไม่ต้อง unpickle ทีละแถว' },
    { name: 'เรียกฟังก์ชัน', title: 'worker ยังเรียกฟังก์ชันทีละแถว', text: 'worker แปลง column เป็น list แล้ว [f(*row) for row in rows] ดังนั้นฟังก์ชันของคุณถูกเรียก 8 ครั้ง เร็วขึ้นเพราะการขนส่ง ไม่ใช่เพราะฟังก์ชันเป็น vectorized' },
    { name: 'ส่งกลับ', title: 'แปลงผลกลับเป็น Arrow แล้วส่ง', text: 'ผลถูกแปลงด้วยชนิดที่ประกาศ ถ้าไม่ตรงอาจถูก cast (1.5 เป็น int ได้ 1) หรือ error' },
  ],
  pandas: [
    { name: 'แถวใน JVM', title: 'แถวอยู่ในรูป InternalRow ของ JVM', text: 'ขั้นเดียวกับสองเส้นทางแรก' },
    { name: 'Arrow batch', title: 'จัดเป็น Arrow batch', text: 'เหมือน Arrow UDF: ส่งทีละ batch ใหญ่' },
    { name: 'socket', title: 'ส่งผ่าน socket เป็น Arrow stream', text: 'ใช้เส้นทางเดียวกับ Arrow UDF' },
    { name: 'เรียกฟังก์ชัน', title: 'worker เรียกฟังก์ชัน 1 ครั้งต่อ 1 batch', text: 'แต่ละ batch กลายเป็น pandas Series ฟังก์ชันของคุณรับทั้ง Series แล้วคำนวณแบบ vectorized ในครั้งเดียว ภาพนับ 2 ครั้ง สำหรับ 2 batch' },
    { name: 'ส่งกลับ', title: 'ส่ง Series กลับเป็น Arrow', text: 'ต้องได้ Series ความยาวเท่าเดิม ชนิดที่คืนต้อง cast เข้ากับชนิดที่ประกาศได้ ไม่งั้น PythonException' },
  ],
};

const ROWS = 8;
const BATCH = 4;
const EASE = { duration: 0.7, ease: 'easeInOut' as const };

export default function UdfBridgeLab() {
  const [kind, setKind] = useState<Kind>('pickle');
  const { step, go, playing, toggle, reset } = useStepper(5, 3000);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : EASE;
  const perRow = kind !== 'pandas';
  const calls = step >= 3 ? (perRow ? ROWS : ROWS / BATCH) : 0;
  const pos = (i: number) => {
    const b = Math.floor(i / BATCH);
    const k = i % BATCH;
    if (step === 1) return { x: 76 + b * 110 + k * 22, y: 150 };
    if (step === 2) return { x: 362 + b * 90 + k * 20, y: 170 };
    if (step === 3) return { x: 592 + k * 28, y: 120 + b * 36 };
    return { x: 50 + i * 34, y: 150 };
  };
  const framed = kind === 'pickle' ? 'pickle' : 'Arrow';

  return (
    <figure className="viz">
      <div className="viz-title">ข้อมูลเดินทางระหว่าง JVM กับ Python worker อย่างไร</div>
      <div className="viz-steps" role="group" aria-label="เลือกชนิดของฟังก์ชัน">
        {KINDS.map((k) => (
          <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => { setKind(k.id); reset(); }}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={`ขั้นที่ ${step + 1} ของเส้นทางข้อมูล`}>
          <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
          <rect className="box" x="26" y="50" width="300" height="240" rx="10" />
          <text className="b" x="42" y="76">Executor (JVM)</text>
          <rect className="box" x="554" y="50" width="300" height="240" rx="10" />
          <text className="b" x="570" y="76">Python worker (process แยก)</text>
          <motion.rect className="zone" x="340" y="104" width="200" height="130" rx="8" initial={false} animate={{ opacity: step === 2 ? 1 : 0.35 }} transition={t} />
          <text className="s b" x="440" y="124" textAnchor="middle">socket</text>
          <text className="s" x="440" y="222" textAnchor="middle">{KINDS.find((k) => k.id === kind)!.sub}</text>

          {/* batch frames */}
          {[0, 1].map((b) => (
            <motion.rect
              key={b}
              rx="8"
              width={96}
              height={34}
              className="box on"
              initial={false}
              animate={{
                x: step === 2 ? 346 + b * 90 : 62 + b * 110,
                y: step === 2 ? 153 : 133,
                opacity: step === 1 || step === 2 ? 1 : 0,
              }}
              transition={t}
              style={{ fill: 'none' }}
            />
          ))}

          {Array.from({ length: ROWS }, (_, i) => {
            const { x, y } = pos(i);
            return (
              <motion.g key={i} initial={false} animate={{ x, y }} transition={{ ...t, delay: reduce ? 0 : i * 0.03 }}>
                <circle r="9" className={step === 4 ? 'k2' : 'k1'} />
                <text className="dl" y="4">{i + 1}</text>
                {step === 3 && <circle r="12" fill="none" stroke="var(--accent)" strokeWidth="2" />}
              </motion.g>
            );
          })}

          <text className="s" x="42" y="262">{step <= 1 ? 'InternalRow ในหน่วยความจำของ JVM' : step === 4 ? 'รับผลกลับเป็น InternalRow' : ''}</text>
          <text className="s" x="570" y="262">{step >= 3 ? `รูปแบบข้อมูล: ${framed}` : ''}</text>

          <motion.g initial={false} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={t}>
            <rect className="box on" x="570" y="190" width="268" height="46" rx="8" />
            <text className="b m" x="584" y="209" style={{ fontSize: 13 }}>{perRow ? '[f(*row) for row in rows]' : 'f(series)  # ทั้ง batch'}</text>
            <text className="m b acc" x="584" y="227">เรียกฟังก์ชัน {calls} ครั้ง</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={STEPS[kind]} step={step} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">ภาพใช้ 8 แถวและ 4 แถวต่อ batch เพื่อให้อ่านง่าย ค่าจริงคือ 100 แถวต่อ batch ของ pickle และ 10,000 แถวต่อ batch ของ Arrow</figcaption>
    </figure>
  );
}
