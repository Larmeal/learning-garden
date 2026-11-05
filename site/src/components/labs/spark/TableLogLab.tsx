import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// A Delta table over time. The commit sequence is the one exercises/10_table_formats.py ran on Spark 4.2.0 with
// Delta 4.4.1: 100 rows in 4 files, then UPDATE, DELETE, MERGE, OPTIMIZE and VACUUM. Row counts (100, 100, 90, 90) and
// the "raw parquet read counts 125 rows" fact were asserted. File names are shortened (f1 stands for part-0000...parquet)
// and which file is rewritten by which commit follows from the id ranges: f1 holds ids 0 to 24, f4 holds 75 to 99.

interface F {
  id: string;
  range: string;
  rows: number;
  add: number;
  remove?: number;
}

const FILES: F[] = [
  { id: 'f1', range: 'id 0 ถึง 24', rows: 25, add: 0, remove: 1 },
  { id: 'f2', range: 'id 25 ถึง 49', rows: 25, add: 0, remove: 4 },
  { id: 'f3', range: 'id 50 ถึง 74', rows: 25, add: 0, remove: 4 },
  { id: 'f4', range: 'id 75 ถึง 99', rows: 25, add: 0, remove: 2 },
  { id: 'f5', range: 'id 0 ถึง 24 (g = 99)', rows: 25, add: 1, remove: 3 },
  { id: 'f6', range: 'id 75 ถึง 89', rows: 15, add: 2, remove: 4 },
  { id: 'f7', range: 'id 0 ถึง 24 (merge)', rows: 25, add: 3, remove: 4 },
  { id: 'f8', range: 'id 0 ถึง 89 (รวมไฟล์)', rows: 90, add: 4 },
];

const COMMITS = [
  { v: 0, op: 'WRITE', note: 'add f1 f2 f3 f4' },
  { v: 1, op: 'UPDATE g = 99 WHERE id < 10', note: 'remove f1, add f5' },
  { v: 2, op: 'DELETE WHERE id >= 90', note: 'remove f4, add f6' },
  { v: 3, op: 'MERGE id = 5', note: 'remove f5, add f7' },
  { v: 4, op: 'OPTIMIZE', note: 'remove f2 f3 f6 f7, add f8' },
];

const STEPS: StepInfo[] = [
  { name: 'v0 WRITE', title: 'เขียนครั้งแรก: 4 ไฟล์ 100 แถว', text: 'commit 0 บันทึก add ของทั้งสี่ไฟล์พร้อมสถิติ (numRecords, min, max ของแต่ละ column) ไฟล์ _delta_log/000...0.json คือ "ตาราง" จริงๆ ไฟล์ Parquet เป็นแค่ข้อมูลที่ log ชี้ไป' },
  { name: 'v1 UPDATE', title: 'UPDATE: ไม่แก้ไฟล์เดิม เขียนไฟล์ใหม่', text: 'Parquet แก้ไขที่ไม่ได้ Delta จึงอ่าน f1 ทั้งไฟล์ เขียน f5 ที่ g = 99 แล้ว commit เป็น remove f1 และ add f5 f1 ยังอยู่บน disk ผู้ที่อ่าน Parquet ตรงๆ จะได้ 125 แถว (วัดจริง) ผู้ที่อ่านผ่าน log ได้ 100' },
  { name: 'v2 DELETE', title: 'DELETE: เขียนไฟล์ที่เหลือใหม่', text: 'แถว id >= 90 อยู่ใน f4 ทั้งหมด Delta เขียน f6 ที่เหลือ 15 แถว และ commit remove f4 กับ add f6 (วัดจริง: 90 แถว)' },
  { name: 'v3 MERGE', title: 'MERGE: เขียนซ้ำอีกรอบ', text: 'แถว id = 5 ที่อยู่ใน f5 ถูกแก้ จึงเกิด f7 แทน f5 version ละหนึ่ง commit ทุกครั้งที่ log เพิ่มไฟล์ใหม่หนึ่งไฟล์ ไม่มีไฟล์ไหนถูกแก้ไขที่เดิม (วัดจริง: time travel ที่ v0 เห็น g ของ id 5 เป็น 0 ส่วนปัจจุบันเป็น 7)' },
  { name: 'v4 OPTIMIZE', title: 'OPTIMIZE: รวมไฟล์เล็กเป็นไฟล์เดียว', text: 'รวม f2 f3 f6 f7 เป็น f8 ไฟล์เดียว ลดงานตอนอ่าน (วัดจริง: ตารางที่มี 7 ไฟล์เหลือ 1) แต่ไฟล์เก่ายังไม่ถูกลบ บน disk ในภาพมี 8 ไฟล์ ตารางอ้างถึงแค่ f8' },
  { name: 'VACUUM', title: 'VACUUM: ลบไฟล์ที่ log ไม่อ้างถึงแล้ว', text: 'ลบไฟล์ที่ถูก remove และเก่าพอ (ที่นี่ตั้ง RETAIN 0 HOURS เพื่อสาธิต ค่าเริ่มต้นเก็บ 7 วัน) disk เหลือไฟล์เดียวที่ตารางใช้ ที่ว่างคืนมา แต่ version เก่าที่ต้องอ่านไฟล์พวกนั้นหายไปด้วย' },
  { name: 'time travel', title: 'time travel ไป v0 หลัง VACUUM: ล้มเหลว', text: 'log ยังบอกว่า v0 มี f1 ถึง f4 แต่ไฟล์ถูกลบไปแล้ว อ่านได้ error FILE_NOT_EXIST (วัดจริง) นี่คือราคาของ time travel: ยิ่งเก็บ version นานยิ่งเปลืองที่ เมื่อ VACUUM แล้วย้อนกลับไม่ได้' },
];

const EASE = { duration: 0.5, ease: 'easeInOut' as const };

export default function TableLogLab() {
  const { step, go, playing, toggle } = useStepper(STEPS.length, 4200);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : EASE;
  const version = Math.min(step, 4);
  const vacuumed = step >= 5;
  const failed = step === 6;
  const onDisk = FILES.filter((f) => f.add <= version && !(vacuumed && f.remove !== undefined && f.remove <= version));
  const live = FILES.filter((f) => f.add <= version && (f.remove === undefined || f.remove > version));
  const rawRows = onDisk.reduce((a, f) => a + f.rows, 0);
  const deltaRows = live.reduce((a, f) => a + f.rows, 0);
  const shown = COMMITS.filter((c) => c.v <= version);

  return (
    <figure className="viz">
      <div className="viz-title">Transaction log: ตาราง Delta คือ log ที่ชี้ไปหาไฟล์ Parquet</div>
      <div className="viz-box tl-wrap">
        <div className="tl-col">
          <strong className="tl-h">ไฟล์ Parquet บน disk</strong>
          <AnimatePresence initial={false}>
            {onDisk.map((f) => {
              const isLive = f.remove === undefined || f.remove > version;
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: isLive ? 1 : 0.55, x: 0 }}
                  exit={{ opacity: 0, x: 24, height: 0 }}
                  transition={t}
                  className="tl-file"
                  data-live={isLive ? '' : undefined}
                >
                  <code>{f.id}</code>
                  <span>{f.range}</span>
                  <span className="tl-rows">{f.rows} แถว</span>
                  <em>{isLive ? 'อยู่ใน log' : `ถูก remove ที่ v${f.remove}`}</em>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="tl-col">
          <strong className="tl-h">_delta_log/</strong>
          <AnimatePresence initial={false}>
            {shown.map((c) => (
              <motion.div key={c.v} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={t} className="tl-commit">
                <code>{String(c.v).padStart(20, '0')}.json</code>
                <span>{c.op}</span>
                <span className="tl-note">{c.note}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="tl-readers">
            <div>
              <code>spark.read.parquet(path).count()</code>
              <strong>{rawRows} แถว</strong>
            </div>
            <div>
              <code>spark.read.format("delta").load(path).count()</code>
              <strong>{deltaRows} แถว</strong>
            </div>
            {failed && (
              <div className="tl-fail">
                <code>.option("versionAsOf", 0)</code>
                <strong>FILE_NOT_EXIST</strong>
              </div>
            )}
          </div>
        </div>
      </div>
      <StepControls steps={STEPS} step={step} playing={playing} go={go} toggle={toggle} />
    </figure>
  );
}
