import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type Lang, type StepInfo } from './stepper';

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

const NORMAL_TH: S[] = [
  { name: 'ไฟล์มาใหม่', title: 'Source เห็นข้อมูลใหม่', text: 'ไฟล์ f02.json เข้ามาในโฟลเดอร์ที่ Source เฝ้าดูอยู่ ส่วนใน Checkpoint ตอนนี้ Batch 0 เสร็จเรียบร้อยแล้ว (มี offsets/0 และ commits/0)', file: true, offsets: false, state: false, sink: 0, commit: false, engine: 'รอ Trigger' },
  { name: 'เลือกช่วง', title: 'constructNextBatch: ตัดสินว่า Batch 1 จะอ่านอะไร', text: 'Engine จะถาม Source ว่ามีข้อมูลมาถึงไหนแล้ว จากนั้นกำหนดช่วง Offset ของ Batch 1 (ในที่นี้คือไฟล์ f02) ซึ่งตอนนี้ยังไม่ได้ทำอะไรกับข้อมูลเลย', file: true, offsets: false, state: false, sink: 0, commit: false, engine: 'กำหนดช่วง Offset ของ Batch 1' },
  { name: 'offsets/1', title: 'เขียน offsets/1 ก่อนประมวลผล (write-ahead log)', text: 'ช่วง Offset จะถูกเขียนลง Checkpoint ก่อน เพื่อให้ถ้าโปรแกรมล่มกลางทาง ครั้งหน้าจะรู้ว่า Batch 1 ต้องอ่านช่วงเดิมเป๊ะ ๆ นอกจากนี้ไฟล์นี้ยังเก็บ batchWatermarkMs และ conf ที่ใช้อยู่ด้วย', file: true, offsets: true, state: false, sink: 0, commit: false, engine: 'พร้อมรัน Batch 1' },
  { name: 'runBatch', title: 'runBatch: อ่านข้อมูลและอัปเดต State', text: 'Query จะรันเป็น Job ปกติ โดย StateStoreRestore จะอ่านค่าเดิมจาก State เวอร์ชัน 0 แล้ว StateStoreSave จะเขียนค่าใหม่ลงเป็นเวอร์ชัน 1 (ไฟล์ 1.delta)', file: true, offsets: true, state: true, sink: 0, commit: false, engine: 'ประมวลผล + อัปเดต State' },
  { name: 'เขียน Sink', title: 'ส่งผลของ Batch 1 ให้ Sink', text: 'Sink จะรับผลลัพธ์ของ Batch 1 มาพร้อมกับ batchId = 1 เพื่อให้ Sink แยกแยะได้ว่าเคยได้รับ Batch นี้ไปแล้วหรือยัง', file: true, offsets: true, state: true, sink: 1, commit: false, engine: 'เขียนผลลัพธ์' },
  { name: 'commits/1', title: 'เขียน commits/1: Batch 1 เสร็จสมบูรณ์', text: 'markMicroBatchEnd จะเขียน commits/1 และอัปเดต Watermark สำหรับ Batch ถัดไป หลังจากจุดนี้ Batch 1 จะไม่ถูกรันซ้ำอีก', file: true, offsets: true, state: true, sink: 1, commit: true, engine: 'จบ Batch 1 รอ Batch 2' },
];

const CRASH_TH: S[] = [
  NORMAL_TH[0], NORMAL_TH[1], NORMAL_TH[2], NORMAL_TH[3], NORMAL_TH[4],
  { name: 'ล่ม', title: 'ล่มก่อนเขียน commits/1', text: 'โปรแกรมหยุดทำงานหลังเขียน Sink แต่ก่อนจะเขียน commits/1 ใน Checkpoint จึงมี offsets/1 แต่ไม่มี commits/1 ซึ่งแปลว่า Batch 1 "เริ่มแล้วแต่ไม่ทราบว่าจบหรือยัง"', file: true, offsets: true, state: true, sink: 1, commit: false, crash: true, engine: 'หยุดทำงาน' },
  { name: 'รีสตาร์ท', title: 'เริ่มใหม่และอ่าน Checkpoint', text: 'populateStartOffsets เห็นว่ามี offsets/1 แต่ไม่มี commits/1 จึงรู้ว่า Batch 1 ต้องรันอีกครั้งด้วยช่วง Offset เดิม โดยจะไม่เลือกช่วงใหม่ (ตอนวัดจริง batch id ที่รันหลังรีสตาร์ทเริ่มที่ 1)', file: true, offsets: true, state: true, sink: 1, commit: false, engine: 'อ่าน offsets/1 รัน Batch 1 ซ้ำ' },
  { name: 'รันซ้ำ', title: 'รัน Batch 1 อีกรอบและได้ผลเหมือนเดิม', text: 'State จะกลับไปเป็นเวอร์ชัน 0 แล้วคำนวณใหม่ ซึ่งได้ผลเท่าเดิม แต่ Sink จะได้รับ Batch 1 เป็นครั้งที่สอง ถ้า Sink เขียนซ้ำอย่างปลอดภัยไม่ได้ เช่นเขียนต่อท้ายไฟล์ ข้อมูลก็จะซ้ำกัน เราจึงต้องใช้ batchId ช่วยให้การเขียนเป็น Idempotent', file: true, offsets: true, state: true, sink: 2, commit: false, engine: 'รัน Batch 1 ซ้ำ' },
  { name: 'commits/1', title: 'เขียน commits/1', text: 'รอบนี้ Batch ทำงานครบถ้วนแล้ว จึงต่อด้วย Batch 2 ได้ตามปกติ และ State ก็ต่อเนื่องกันไป ไม่ได้ถูกรีเซ็ต (ตอนวัดจริง ค่านับของ a ยังเป็น 2 ไม่ได้กลับไปเป็น 1)', file: true, offsets: true, state: true, sink: 2, commit: true, engine: 'จบ Batch 1 รอ Batch 2' },
];

const NORMAL_EN: S[] = [
  { name: 'New file', title: 'The source sees new data', text: 'The file f02.json arrives in the folder that the source watches. The checkpoint now shows that batch 0 is done (offsets/0 and commits/0).', file: true, offsets: false, state: false, sink: 0, commit: false, engine: 'Waiting for trigger' },
  { name: 'Pick range', title: 'constructNextBatch: decides what batch 1 reads', text: 'The engine asks the source how far the data goes, then fixes the offset range of batch 1 (here it is the file f02). Nothing has been done with the data yet.', file: true, offsets: false, state: false, sink: 0, commit: false, engine: 'Fix offset range of batch 1' },
  { name: 'offsets/1', title: 'Write offsets/1 before processing (write-ahead log)', text: 'The offset range is written to the checkpoint first. If the query crashes midway, the next start knows that batch 1 must read exactly the same range. This file also records batchWatermarkMs and the conf that was used.', file: true, offsets: true, state: false, sink: 0, commit: false, engine: 'Ready to run batch 1' },
  { name: 'runBatch', title: 'runBatch: read the data and update the state', text: 'The query runs as a normal job. StateStoreRestore reads the old values from state version 0. StateStoreSave writes the new values as version 1 (the file 1.delta).', file: true, offsets: true, state: true, sink: 0, commit: false, engine: 'Process + update state' },
  { name: 'Write sink', title: 'Send the result of batch 1 to the sink', text: 'The sink receives the result of batch 1 together with batchId = 1, so that the sink can tell whether it has already received this batch.', file: true, offsets: true, state: true, sink: 1, commit: false, engine: 'Write the result' },
  { name: 'commits/1', title: 'Write commits/1: batch 1 is complete', text: 'markMicroBatchEnd writes commits/1 and updates the watermark for the next batch. After this point batch 1 will never run again.', file: true, offsets: true, state: true, sink: 1, commit: true, engine: 'Batch 1 done, wait for batch 2' },
];

const CRASH_EN: S[] = [
  NORMAL_EN[0], NORMAL_EN[1], NORMAL_EN[2], NORMAL_EN[3], NORMAL_EN[4],
  { name: 'Crash', title: 'Crash before commits/1 is written', text: 'The program stops after writing to the sink but before commits/1. So the checkpoint has offsets/1 but no commits/1, which means batch 1 "started but we do not know if it finished".', file: true, offsets: true, state: true, sink: 1, commit: false, crash: true, engine: 'Stopped' },
  { name: 'Restart', title: 'Restart: read the checkpoint', text: 'populateStartOffsets sees offsets/1 without commits/1. So it knows that batch 1 must run again with the same offset range, not a newly chosen one (measured: the batch id that runs after the restart starts at 1).', file: true, offsets: true, state: true, sink: 1, commit: false, engine: 'Read offsets/1, rerun batch 1' },
  { name: 'Replay', title: 'Run batch 1 again: the same result', text: 'The state goes back to version 0 and is computed again, with the same result. But the sink receives batch 1 for the second time. If the sink cannot write twice safely, for example it appends to a file, the data is duplicated. You need to use batchId to make the write idempotent.', file: true, offsets: true, state: true, sink: 2, commit: false, engine: 'Rerun batch 1' },
  { name: 'commits/1', title: 'Write commits/1', text: 'This time the batch is complete. Batch 2 can follow as usual. The state continues and is not reset (measured: the count of a is still 2, it does not go back to 1).', file: true, offsets: true, state: true, sink: 2, commit: true, engine: 'Batch 1 done, wait for batch 2' },
];

const STEPS: Record<Lang, { normal: S[]; crash: S[] }> = {
  th: { normal: NORMAL_TH, crash: CRASH_TH },
  en: { normal: NORMAL_EN, crash: CRASH_EN },
};

const TEXT: Record<Lang, {
  title: string; pick: string; normal: string; crash: string; stepAria: (n: number, title: string) => string;
  source: string; engine: string; crashed: string; checkpoint: string; sink: string; got: string; times: (n: number) => string;
  dup: string; done: string; caption: string;
}> = {
  th: {
    title: 'หนึ่ง Micro-batch: เขียนอะไรลง Checkpoint และเมื่อไร',
    pick: 'เลือกสถานการณ์',
    normal: 'ทำงานปกติ',
    crash: 'ล่มก่อน commit',
    stepAria: (n, title) => `ขั้นที่ ${n}: ${title}`,
    source: 'Source (โฟลเดอร์ไฟล์)',
    engine: 'Engine',
    crashed: 'X ล่ม',
    checkpoint: 'Checkpoint',
    sink: 'Sink (เก็บผลลัพธ์)',
    got: 'ได้รับ Batch 1 แล้ว',
    times: (n) => `${n} ครั้ง`,
    dup: 'ซ้ำ! Sink ต้องแยกแยะด้วย batchId',
    done: 'Batch 1 จบสมบูรณ์ ไม่ถูกรันซ้ำอีก',
    caption: 'ลำดับการเขียนไฟล์มาจาก MicroBatchExecution ใน Spark 4.2.0 ส่วนผลของการรันซ้ำมาจาก exercises/09_streaming.py ซึ่งลบ commits/1 ทิ้งเองแล้วรีสตาร์ท',
  },
  en: {
    title: 'One micro-batch: what is written to the checkpoint, and when',
    pick: 'Choose a scenario',
    normal: 'Normal run',
    crash: 'Crash before commit',
    stepAria: (n, title) => `Step ${n}: ${title}`,
    source: 'Source (folder of files)',
    engine: 'Engine',
    crashed: 'X crashed',
    checkpoint: 'Checkpoint',
    sink: 'Sink (stores the result)',
    got: 'Received batch 1',
    times: (n) => (n === 1 ? '1 time' : `${n} times`),
    dup: 'Duplicate! The sink must use batchId',
    done: 'Batch 1 is complete, never runs again',
    caption: 'The order of the file writes comes from MicroBatchExecution in Spark 4.2.0. The result of the replay comes from exercises/09_streaming.py, which deletes commits/1 on purpose and then restarts.',
  },
};

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

export default function MicroBatchLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('normal');
  const steps = mode === 'normal' ? STEPS[lang].normal : STEPS[lang].crash;
  const { step, go, playing, toggle, reset } = useStepper(steps.length, 3600);
  const s = steps[Math.min(step, steps.length - 1)];
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.pick}>
        <button type="button" aria-pressed={mode === 'normal'} onClick={() => { setMode('normal'); reset(); }}>{T.normal}</button>
        <button type="button" aria-pressed={mode === 'crash'} onClick={() => { setMode('crash'); reset(); }}>{T.crash}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.stepAria(step + 1, s.title)}>
          <rect className="band" x="10" y="10" width="860" height="320" rx="12" />

          <text className="b" x="30" y="40">{T.source}</text>
          <Chip x={30} y={56} label="f01.json (batch 0)" on={true} />
          <Chip x={30} y={92} label="f02.json" on={s.file} />

          <motion.g initial={false} animate={{ opacity: 1 }}>
            <rect className={`box ${s.crash ? '' : 'on'}`} x="250" y="60" width="210" height="110" rx="10" />
            <text className="b" x="266" y="86">{T.engine}</text>
            <text className="s" x="266" y="108">{s.engine}</text>
            <motion.text className="b acc" x="266" y="140" initial={false} animate={{ opacity: s.crash ? 1 : 0 }} transition={EASE} style={{ fontSize: 18 }}>{T.crashed}</motion.text>
          </motion.g>
          <line className="ln" x1="170" y1="106" x2="248" y2="106" />

          <text className="b" x="500" y="40">{T.checkpoint}</text>
          <Chip x={500} y={56} label="offsets/0   commits/0" on={true} w={170} />
          <Chip x={500} y={92} label="offsets/1" on={s.offsets} w={120} />
          <Chip x={630} y={92} label="commits/1" on={s.commit} w={120} />
          <Chip x={500} y={128} label="state/0/0/1.delta" on={s.state} w={170} />

          <text className="b" x="250" y="214">{T.sink}</text>
          <rect className="box" x="250" y="228" width="300" height="76" rx="10" />
          <text className="s" x="266" y="252">{T.got}</text>
          <motion.text className="b acc m" x="266" y="284" initial={false} animate={{ opacity: s.sink > 0 ? 1 : 0.3 }} transition={EASE} style={{ fontSize: 20 }}>
            {T.times(s.sink)}
          </motion.text>

          <motion.g initial={false} animate={{ opacity: s.sink >= 2 ? 1 : 0 }} transition={EASE}>
            <text className="s b acc" x="580" y="262">{T.dup}</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: s.commit ? 1 : 0 }} transition={EASE}>
            <text className="s b" x="580" y="290">{T.done}</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={steps} step={Math.min(step, steps.length - 1)} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">
        {T.caption}
      </figcaption>
    </figure>
  );
}
