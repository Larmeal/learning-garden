import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type Lang, type StepInfo } from './stepper';

// A Delta table over time. The commit sequence is the one exercises/10_table_formats.py ran on Spark 4.2.0 with
// Delta 4.4.1: 100 rows in 4 files, then UPDATE, DELETE, MERGE, OPTIMIZE and VACUUM. Row counts (100, 100, 90, 90) and
// the "raw parquet read counts 125 rows" fact were asserted. File names are shortened (f1 stands for part-0000...parquet)
// and which file is rewritten by which commit follows from the id ranges: f1 holds ids 0 to 24, f4 holds 75 to 99.

interface F {
  id: string;
  rows: number;
  add: number;
  remove?: number;
}

const FILES: F[] = [
  { id: 'f1', rows: 25, add: 0, remove: 1 },
  { id: 'f2', rows: 25, add: 0, remove: 4 },
  { id: 'f3', rows: 25, add: 0, remove: 4 },
  { id: 'f4', rows: 25, add: 0, remove: 2 },
  { id: 'f5', rows: 25, add: 1, remove: 3 },
  { id: 'f6', rows: 15, add: 2, remove: 4 },
  { id: 'f7', rows: 25, add: 3, remove: 4 },
  { id: 'f8', rows: 90, add: 4 },
];

const COMMITS = [
  { v: 0, op: 'WRITE', note: 'add f1 f2 f3 f4' },
  { v: 1, op: 'UPDATE g = 99 WHERE id < 10', note: 'remove f1, add f5' },
  { v: 2, op: 'DELETE WHERE id >= 90', note: 'remove f4, add f6' },
  { v: 3, op: 'MERGE id = 5', note: 'remove f5, add f7' },
  { v: 4, op: 'OPTIMIZE', note: 'remove f2 f3 f6 f7, add f8' },
];

const STEPS_TH: StepInfo[] = [
  { name: 'v0 WRITE', title: 'เขียนครั้งแรก: 4 ไฟล์ 100 แถว', text: 'Commit 0 บันทึก add ของทั้งสี่ไฟล์พร้อมสถิติ (numRecords, min, max ของแต่ละ Column) ไฟล์ _delta_log/000...0.json คือ "ตาราง" จริง ๆ ส่วนไฟล์ Parquet เป็นแค่ข้อมูลที่ Log ชี้ไปหา' },
  { name: 'v1 UPDATE', title: 'UPDATE: ไม่แก้ไฟล์เดิม แต่เขียนไฟล์ใหม่', text: 'Parquet แก้ไขในที่เดิมไม่ได้ Delta จึงอ่าน f1 ทั้งไฟล์ เขียน f5 ที่ g = 99 แล้ว Commit เป็น remove f1 และ add f5 ส่วน f1 ยังอยู่บน Disk ถ้าอ่าน Parquet ตรง ๆ จะได้ 125 แถว (วัดจริง) แต่ถ้าอ่านผ่าน Log จะได้ 100' },
  { name: 'v2 DELETE', title: 'DELETE: เขียนไฟล์ที่เหลือใหม่', text: 'แถว id >= 90 อยู่ใน f4 ทั้งหมด Delta จึงเขียน f6 ที่เหลือ 15 แถว และ Commit remove f4 กับ add f6 (วัดจริง: 90 แถว)' },
  { name: 'v3 MERGE', title: 'MERGE: เขียนซ้ำอีกรอบ', text: 'แถว id = 5 ที่อยู่ใน f5 ถูกแก้ จึงเกิด f7 มาแทน f5 โดย Version ละหนึ่ง Commit และทุกครั้งที่ Log จะเพิ่มไฟล์ใหม่หนึ่งไฟล์ ไม่มีไฟล์ไหนถูกแก้ไขในที่เดิม (วัดจริง: Time Travel ที่ v0 เห็น g ของ id 5 เป็น 0 ส่วนปัจจุบันเป็น 7)' },
  { name: 'v4 OPTIMIZE', title: 'OPTIMIZE: รวมไฟล์เล็กเป็นไฟล์เดียว', text: 'รวม f2 f3 f6 f7 เป็น f8 ไฟล์เดียว ช่วยลดงานตอนอ่าน (วัดจริง: ตารางที่มี 7 ไฟล์เหลือ 1) แต่ไฟล์เก่ายังไม่ถูกลบ ทำให้บน Disk ในภาพมี 8 ไฟล์ โดยตารางอ้างถึงแค่ f8' },
  { name: 'VACUUM', title: 'VACUUM: ลบไฟล์ที่ Log ไม่อ้างถึงแล้ว', text: 'VACUUM จะลบไฟล์ที่ถูก remove และเก่าพอ (ที่นี่ตั้ง RETAIN 0 HOURS เพื่อสาธิต ค่าเริ่มต้นเก็บ 7 วัน) ทำให้ Disk เหลือไฟล์เดียวที่ตารางใช้ และได้ที่ว่างคืนมา แต่ Version เก่าที่ต้องอ่านไฟล์พวกนั้นก็หายไปด้วย' },
  { name: 'Time Travel', title: 'Time Travel ไป v0 หลัง VACUUM: ล้มเหลว', text: 'Log ยังบอกว่า v0 มี f1 ถึง f4 แต่ไฟล์ถูกลบไปแล้ว จึงอ่านได้แค่ Error FILE_NOT_EXIST (วัดจริง) นี่คือราคาของ Time Travel ซึ่งยิ่งเก็บ Version นานก็ยิ่งเปลืองที่ และเมื่อ VACUUM แล้วก็ย้อนกลับไม่ได้' },
];

const STEPS_EN: StepInfo[] = [
  { name: 'v0 WRITE', title: 'First write: 4 files, 100 rows', text: 'Commit 0 records an add for all four files, with statistics (numRecords, min and max of each column). The file _delta_log/000...0.json is the real "table". The Parquet files are only data that the log points to.' },
  { name: 'v1 UPDATE', title: 'UPDATE: the old file is not changed, a new file is written', text: 'Parquet cannot be edited in place, so Delta reads all of f1, writes f5 with g = 99, and commits remove f1 and add f5. f1 is still on disk. Someone who reads the Parquet directly gets 125 rows (measured). Someone who reads through the log gets 100.' },
  { name: 'v2 DELETE', title: 'DELETE: the remaining rows are written again', text: 'The rows with id >= 90 are all in f4. Delta writes f6 with the 15 rows that remain, and commits remove f4 and add f6 (measured: 90 rows).' },
  { name: 'v3 MERGE', title: 'MERGE: another rewrite', text: 'The row with id = 5, which is in f5, is changed, so f7 replaces f5. Each version is one commit. Every time, the log adds one new file, and no file is changed in place (measured: time travel to v0 shows g of id 5 as 0, and the current value is 7).' },
  { name: 'v4 OPTIMIZE', title: 'OPTIMIZE: small files are compacted into one file', text: 'f2, f3, f6 and f7 are merged into one file, f8. This reduces the work at read time (measured: a table with 7 files is left with 1). But the old files are not deleted. On disk in the picture there are 8 files, and the table refers only to f8.' },
  { name: 'VACUUM', title: 'VACUUM: delete the files that the log no longer refers to', text: 'It deletes the files that were removed and are old enough (here RETAIN 0 HOURS is set for the demo; the default keeps 7 days). Only the one file that the table uses is left on disk. Space is given back, but the old versions that need those files are gone too.' },
  { name: 'time travel', title: 'Time travel to v0 after VACUUM: it fails', text: 'The log still says that v0 has f1 to f4, but the files were deleted. Reading gives the error FILE_NOT_EXIST (measured). This is the price of time travel: the longer you keep versions, the more space you use. After VACUUM you cannot go back.' },
];

const STEPS: Record<Lang, StepInfo[]> = { th: STEPS_TH, en: STEPS_EN };

const TEXT: Record<Lang, {
  title: string; disk: string; rows: (n: number) => string; inLog: string; removedAt: (v: number | undefined) => string;
  ranges: Record<string, string>;
}> = {
  th: {
    title: 'Transaction Log: ตาราง Delta คือ Log ที่ชี้ไปหาไฟล์ Parquet',
    disk: 'ไฟล์ Parquet บน Disk',
    rows: (n) => `${n} แถว`,
    inLog: 'อยู่ใน Log',
    removedAt: (v) => `ถูก remove ที่ v${v}`,
    ranges: {
      f1: 'id 0 ถึง 24',
      f2: 'id 25 ถึง 49',
      f3: 'id 50 ถึง 74',
      f4: 'id 75 ถึง 99',
      f5: 'id 0 ถึง 24 (g = 99)',
      f6: 'id 75 ถึง 89',
      f7: 'id 0 ถึง 24 (Merge)',
      f8: 'id 0 ถึง 89 (รวมไฟล์)',
    },
  },
  en: {
    title: 'Transaction log: a Delta table is a log that points to Parquet files',
    disk: 'Parquet files on disk',
    rows: (n) => `${n} rows`,
    inLog: 'in the log',
    removedAt: (v) => `removed at v${v}`,
    ranges: {
      f1: 'id 0 to 24',
      f2: 'id 25 to 49',
      f3: 'id 50 to 74',
      f4: 'id 75 to 99',
      f5: 'id 0 to 24 (g = 99)',
      f6: 'id 75 to 89',
      f7: 'id 0 to 24 (merge)',
      f8: 'id 0 to 89 (compacted)',
    },
  },
};

const EASE = { duration: 0.5, ease: 'easeInOut' as const };

export default function TableLogLab({ lang = 'th' }: { lang?: Lang }) {
  const steps = STEPS[lang];
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 4200);
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
      <div className="viz-title">{T.title}</div>
      <div className="viz-box tl-wrap">
        <div className="tl-col">
          <strong className="tl-h">{T.disk}</strong>
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
                  <span>{T.ranges[f.id]}</span>
                  <span className="tl-rows">{T.rows(f.rows)}</span>
                  <em>{isLive ? T.inLog : T.removedAt(f.remove)}</em>
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
              <strong>{T.rows(rawRows)}</strong>
            </div>
            <div>
              <code>spark.read.format("delta").load(path).count()</code>
              <strong>{T.rows(deltaRows)}</strong>
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
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
    </figure>
  );
}
