import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// One micro-batch of a stateful query, with and without a crash. Order of events follows MicroBatchExecution
// (constructNextBatch writes offsets/N, runBatch runs and the sink writes, markMicroBatchEnd writes commits/N).
// The replay outcome (batch 1 run again with the same result, state carried over) is asserted by
// subjects/spark/code/exercises/09_streaming.py.

type Mode = 'normal' | 'crash';

interface S extends StepInfo {
  file: boolean; // f02 is visible in the source folder
  offsets: boolean; // offsets/1
  state: boolean; // state/.../1.delta
  sink: number; // times the sink has received batch 1
  commit: boolean; // commits/1
  crash?: boolean;
  engine: string;
}

const NORMAL: S[] = [
  { name: 'ไฟล์มาใหม่', title: 'Source เห็นข้อมูลใหม่', text: 'ไฟล์ f02.json เข้ามาในโฟลเดอร์ที่ source ดูอยู่ ตัวเลข checkpoint ตอนนี้: batch 0 เสร็จแล้ว (offsets/0 และ commits/0)', file: true, offsets: false, state: false, sink: 0, commit: false, engine: 'รอ trigger' },
  { name: 'เลือกช่วง', title: 'constructNextBatch: ตัดสินว่า batch 1 อ่านอะไร', text: 'engine ถาม source ว่ามีข้อมูลถึงไหน แล้วกำหนดช่วง offset ของ batch 1 (ที่นี่คือไฟล์ f02) จากนั้นยังไม่ได้ทำงานอะไรกับข้อมูล', file: true, offsets: false, state: false, sink: 0, commit: false, engine: 'กำหนดช่วง offset ของ batch 1' },
  { name: 'offsets/1', title: 'เขียน offsets/1 ก่อนประมวลผล (write-ahead log)', text: 'ช่วง offset ถูกเขียนลง checkpoint ก่อน เพื่อให้ถ้าล่มกลางทาง ครั้งหน้ารู้ว่า batch 1 ต้องอ่านช่วงเดิมเป๊ะ ไฟล์นี้ยังเขียน batchWatermarkMs และ conf ที่ใช้ด้วย', file: true, offsets: true, state: false, sink: 0, commit: false, engine: 'พร้อมรัน batch 1' },
  { name: 'runBatch', title: 'runBatch: อ่านข้อมูล อัปเดต state', text: 'query รันเป็น job ปกติ StateStoreRestore อ่านค่าเดิมจาก state เวอร์ชัน 0 StateStoreSave เขียนค่าใหม่เป็นเวอร์ชัน 1 (ไฟล์ 1.delta)', file: true, offsets: true, state: true, sink: 0, commit: false, engine: 'ประมวลผล + อัปเดต state' },
  { name: 'เขียน sink', title: 'ส่งผลของ batch 1 ให้ sink', text: 'sink รับผลลัพธ์ของ batch 1 พร้อม batchId = 1 เพื่อให้ sink แยกแยะได้ว่าเคยได้รับ batch นี้แล้วหรือยัง', file: true, offsets: true, state: true, sink: 1, commit: false, engine: 'เขียนผลลัพธ์' },
  { name: 'commits/1', title: 'เขียน commits/1: batch 1 เสร็จสมบูรณ์', text: 'markMicroBatchEnd เขียน commits/1 และอัปเดต watermark ของ batch ถัดไป หลังจุดนี้ batch 1 จะไม่ถูกรันซ้ำอีก', file: true, offsets: true, state: true, sink: 1, commit: true, engine: 'จบ batch 1 รอ batch 2' },
];

const CRASH: S[] = [
  NORMAL[0], NORMAL[1], NORMAL[2], NORMAL[3], NORMAL[4],
  { name: 'ล่ม', title: 'ล่มก่อนเขียน commits/1', text: 'โปรแกรมหยุดหลังเขียน sink แต่ก่อน commits/1 ใน checkpoint จึงมี offsets/1 แต่ไม่มี commits/1 ซึ่งแปลว่า batch 1 "เริ่มแล้วแต่ไม่ทราบว่าจบ"', file: true, offsets: true, state: true, sink: 1, commit: false, crash: true, engine: 'หยุดทำงาน' },
  { name: 'รีสตาร์ท', title: 'เริ่มใหม่: อ่าน checkpoint', text: 'populateStartOffsets เห็น offsets/1 โดยไม่มี commits/1 จึงรู้ว่า batch 1 ต้องรันอีกครั้งด้วยช่วง offset เดิม ไม่ใช่เลือกใหม่ (วัดจริง: batch id ที่รันหลังรีสตาร์ทเริ่มที่ 1)', file: true, offsets: true, state: true, sink: 1, commit: false, engine: 'อ่าน offsets/1 รัน batch 1 ซ้ำ' },
  { name: 'รันซ้ำ', title: 'รัน batch 1 อีกรอบ: ผลเหมือนเดิม', text: 'state กลับไปเวอร์ชัน 0 แล้วคำนวณใหม่ ได้ผลเท่าเดิม แต่ sink ได้รับ batch 1 เป็นครั้งที่สอง ถ้า sink เขียนซ้ำไม่ได้ เช่นเขียนต่อท้ายไฟล์ จะได้ข้อมูลซ้ำ ต้องใช้ batchId ทำให้การเขียนเป็น idempotent', file: true, offsets: true, state: true, sink: 2, commit: false, engine: 'รัน batch 1 ซ้ำ' },
  { name: 'commits/1', title: 'เขียน commits/1', text: 'รอบนี้ครบถ้วน จากนั้นต่อด้วย batch 2 ได้ตามปกติ state ต่อเนื่องไม่ถูกรีเซ็ต (วัดจริง: ค่านับของ a ยังเป็น 2 ไม่กลับเป็น 1)', file: true, offsets: true, state: true, sink: 2, commit: true, engine: 'จบ batch 1 รอ batch 2' },
];

const EASE = { duration: 0.5, ease: 'easeInOut' as const };

function Chip({ x, y, w = 130, label, on, danger }: { x: number; y: number; w?: number; label: string; on: boolean; danger?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.g initial={false} animate={{ opacity: on ? 1 : 0.2, scale: on ? 1 : 0.96 }} transition={reduce ? { duration: 0 } : EASE} style={{ transformOrigin: `${x + w / 2}px ${y + 14}px` }}>
      <rect className={on ? (danger ? 'box on' : 'box on') : 'box'} x={x} y={y} width={w} height={28} rx="6" strokeDasharray={on ? undefined : '4 4'} />
      <text className="m s" x={x + 10} y={y + 18}>{label}</text>
    </motion.g>
  );
}

export default function MicroBatchLab() {
  const [mode, setMode] = useState<Mode>('normal');
  const steps = mode === 'normal' ? NORMAL : CRASH;
  const { step, go, playing, toggle, reset } = useStepper(steps.length, 3600);
  const s = steps[Math.min(step, steps.length - 1)];
  return (
    <figure className="viz">
      <div className="viz-title">หนึ่ง micro-batch: เขียนอะไรลง checkpoint และเมื่อไร</div>
      <div className="viz-steps" role="group" aria-label="เลือกสถานการณ์">
        <button type="button" aria-pressed={mode === 'normal'} onClick={() => { setMode('normal'); reset(); }}>ทำงานปกติ</button>
        <button type="button" aria-pressed={mode === 'crash'} onClick={() => { setMode('crash'); reset(); }}>ล่มก่อน commit</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={`ขั้นที่ ${step + 1}: ${s.title}`}>
          <rect className="band" x="10" y="10" width="860" height="320" rx="12" />

          <text className="b" x="30" y="40">Source (โฟลเดอร์ไฟล์)</text>
          <Chip x={30} y={56} label="f01.json (batch 0)" on={true} />
          <Chip x={30} y={92} label="f02.json" on={s.file} />

          <motion.g initial={false} animate={{ opacity: 1 }}>
            <rect className={`box ${s.crash ? '' : 'on'}`} x="250" y="60" width="210" height="110" rx="10" />
            <text className="b" x="266" y="86">Engine</text>
            <text className="s" x="266" y="108">{s.engine}</text>
            <motion.text className="b acc" x="266" y="140" initial={false} animate={{ opacity: s.crash ? 1 : 0 }} transition={EASE} style={{ fontSize: 18 }}>X ล่ม</motion.text>
          </motion.g>
          <line className="ln" x1="170" y1="106" x2="248" y2="106" />

          <text className="b" x="500" y="40">Checkpoint</text>
          <Chip x={500} y={56} label="offsets/0   commits/0" on={true} w={170} />
          <Chip x={500} y={92} label="offsets/1" on={s.offsets} w={120} />
          <Chip x={630} y={92} label="commits/1" on={s.commit} w={120} />
          <Chip x={500} y={128} label="state/0/0/1.delta" on={s.state} w={170} />

          <text className="b" x="250" y="214">Sink (เก็บผลลัพธ์)</text>
          <rect className="box" x="250" y="228" width="300" height="76" rx="10" />
          <text className="s" x="266" y="252">ได้รับ batch 1 แล้ว</text>
          <motion.text className="b acc m" x="266" y="284" initial={false} animate={{ opacity: s.sink > 0 ? 1 : 0.3 }} transition={EASE} style={{ fontSize: 20 }}>
            {s.sink} ครั้ง
          </motion.text>

          <motion.g initial={false} animate={{ opacity: s.sink >= 2 ? 1 : 0 }} transition={EASE}>
            <text className="s b acc" x="580" y="262">ซ้ำ! sink ต้องแยกแยะด้วย batchId</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: s.commit ? 1 : 0 }} transition={EASE}>
            <text className="s b" x="580" y="290">batch 1 จบสมบูรณ์ ไม่ถูกรันซ้ำอีก</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={steps} step={Math.min(step, steps.length - 1)} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">
        ลำดับเขียนไฟล์มาจาก MicroBatchExecution ใน Spark 4.2.0 ส่วนผลของการรันซ้ำมาจาก exercises/09_streaming.py ที่ลบ commits/1 เองแล้วรีสตาร์ท
      </figcaption>
    </figure>
  );
}
