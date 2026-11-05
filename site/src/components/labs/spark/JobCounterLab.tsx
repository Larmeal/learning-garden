import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// Run statements one by one and watch the job counter. Every "jobs" number was measured with a job group on
// Spark 4.2.0 by subjects/spark/code/exercises/02_lazy_evaluation.py (AQE on, the default).

interface Stmt {
  id: string;
  code: string;
  jobs: number;
  tasks?: number;
  note: string;
  label?: string;
}

const STMTS: Stmt[] = [
  { id: 'range', code: 'df = spark.range(0, 3_000_000)', jobs: 0, note: 'แค่สร้างแผน ยังไม่มีข้อมูลถูกแตะ' },
  { id: 'agg', code: 'agg = df.groupBy((F.col("id") % 7).alias("k")).count()', jobs: 0, note: 'transformation: จดแผนเพิ่ม' },
  { id: 'explain', code: 'agg.explain()', jobs: 0, note: 'พิมพ์แผนที่มีอยู่ ไม่รันอะไร' },
  { id: 'c1', code: 'agg.collect()', jobs: 2, label: 'collect (ครั้งแรก)', note: 'action แรก: สอง job คือ stage ที่เขียน shuffle แล้วจึงเป็น stage ผลลัพธ์ (AQE ตัดเป็นสอง job)' },
  { id: 'c2', code: 'agg.collect()', jobs: 1, label: 'collect (DataFrame เดิมอีกครั้ง)', note: 'เรียกซ้ำบน DataFrame ตัวเดิม: ไฟล์ shuffle ของรอบแรกยังอยู่ stage แรกถูกข้าม เหลือ 1 job' },
  { id: 'c3', code: 'fresh().collect()  # สร้าง DataFrame ใหม่ด้วยโค้ดเดียวกัน', jobs: 2, label: 'collect (DataFrame ใหม่)', note: 'DataFrame ใหม่ไม่มีไฟล์ shuffle เก่า ทำงานตั้งแต่ต้นอีกครั้ง: 2 job' },
  { id: 'show', code: 'spark.range(0, 10**12, 1, 200).show(5)', jobs: 1, tasks: 1, label: 'show(5) บน 1 ล้านล้านแถว', note: 'ไม่ได้อ่านทั้งหมด: 1 job และ 1 task จาก 200 partition ใช้เวลา 0.1 วินาที เพราะ show(5) ต้องการแค่ 5 แถว' },
];

export default function JobCounterLab() {
  const [done, setDone] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const next = STMTS.find((s) => !done.includes(s.id));
  const ran = STMTS.filter((s) => done.includes(s.id));
  const total = ran.reduce((a, s) => a + s.jobs, 0);
  return (
    <figure className="viz">
      <div className="viz-title">รันทีละบรรทัด ดูว่าบรรทัดไหนเริ่ม job</div>
      <div className="jc-wrap viz-box">
        <ol className="jc-list">
          {STMTS.map((s) => {
            const isDone = done.includes(s.id);
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} data-done={isDone ? '' : undefined} data-next={isNext ? '' : undefined}>
                <code>{s.code}</code>
                {isDone && (
                  <span className="jc-jobs" data-zero={s.jobs === 0 ? '' : undefined}>
                    {s.jobs === 0 ? '0 job' : `+${s.jobs} job`}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="jc-side">
          <div className="jc-counter" aria-live="polite">
            <span>Jobs ใน Spark UI</span>
            <motion.strong key={total} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ duration: reduce ? 0 : 0.3 }}>
              {total}
            </motion.strong>
          </div>
          <div className="jc-log">
            <AnimatePresence initial={false}>
              {ran
                .filter((s) => s.jobs > 0)
                .map((s) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="jc-job">
                    <strong>{s.label}</strong>
                    <span>
                      {s.jobs} job{s.tasks ? `, ${s.tasks} task` : ''}
                    </span>
                  </motion.div>
                ))}
            </AnimatePresence>
            {ran.every((s) => s.jobs === 0) && <div className="jc-empty">ยังไม่มี job (แท็บ Jobs ว่าง)</div>}
          </div>
        </div>
      </div>
      <div className="viz-controls">
        <button type="button" className="btn primary" onClick={() => next && setDone((d) => [...d, next.id])} disabled={!next}>
          รันบรรทัดถัดไป
        </button>
        <button type="button" className="btn" onClick={() => setDone([])} disabled={done.length === 0}>
          เริ่มใหม่
        </button>
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{ran.length ? ran[ran.length - 1].code : 'ยังไม่ได้รันอะไร'}</strong>
        <span>{ran.length ? ran[ran.length - 1].note : 'กดรันทีละบรรทัด'}</span>
      </div>
    </figure>
  );
}
