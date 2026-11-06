import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// Run statements one by one and watch the job counter. Every "jobs" number was measured with a job group on
// Spark 4.2.0 by subjects/spark/code/exercises/02_lazy_evaluation.py (AQE on, the default).

type Lang = 'th' | 'en';

interface Stmt {
  id: string;
  code: Record<Lang, string>;
  jobs: number;
  tasks?: number;
  note: Record<Lang, string>;
  label?: Record<Lang, string>;
}

const same = (s: string): Record<Lang, string> => ({ th: s, en: s });

const STMTS: Stmt[] = [
  { id: 'range', code: same('df = spark.range(0, 3_000_000)'), jobs: 0, note: { th: 'แค่สร้างแผน ยังไม่มีข้อมูลถูกแตะ', en: 'This only builds a plan. No data has been touched yet' } },
  { id: 'agg', code: same('agg = df.groupBy((F.col("id") % 7).alias("k")).count()'), jobs: 0, note: { th: 'transformation: จดแผนเพิ่ม', en: 'A transformation: it only adds to the plan' } },
  { id: 'explain', code: same('agg.explain()'), jobs: 0, note: { th: 'พิมพ์แผนที่มีอยู่ ไม่รันอะไร', en: 'It prints the plan that exists and runs nothing' } },
  {
    id: 'c1',
    code: same('agg.collect()'),
    jobs: 2,
    label: { th: 'collect (ครั้งแรก)', en: 'collect (first time)' },
    note: {
      th: 'action แรก: สอง job คือ stage ที่เขียน shuffle แล้วจึงเป็น stage ผลลัพธ์ (AQE ตัดเป็นสอง job)',
      en: 'The first action: two jobs, first the stage that writes the shuffle and then the result stage (AQE cuts it into two jobs)',
    },
  },
  {
    id: 'c2',
    code: same('agg.collect()'),
    jobs: 1,
    label: { th: 'collect (DataFrame เดิมอีกครั้ง)', en: 'collect (same DataFrame again)' },
    note: {
      th: 'เรียกซ้ำบน DataFrame ตัวเดิม: ไฟล์ shuffle ของรอบแรกยังอยู่ stage แรกถูกข้าม เหลือ 1 job',
      en: 'Called again on the same DataFrame: the shuffle files of the first run are still there, so the first stage is skipped and only 1 job is left',
    },
  },
  {
    id: 'c3',
    code: { th: 'fresh().collect()  # สร้าง DataFrame ใหม่ด้วยโค้ดเดียวกัน', en: 'fresh().collect()  # builds a new DataFrame with the same code' },
    jobs: 2,
    label: { th: 'collect (DataFrame ใหม่)', en: 'collect (new DataFrame)' },
    note: {
      th: 'DataFrame ใหม่ไม่มีไฟล์ shuffle เก่า ทำงานตั้งแต่ต้นอีกครั้ง: 2 job',
      en: 'A new DataFrame has no old shuffle files, so the work starts from the beginning again: 2 jobs',
    },
  },
  {
    id: 'show',
    code: same('spark.range(0, 10**12, 1, 200).show(5)'),
    jobs: 1,
    tasks: 1,
    label: { th: 'show(5) บน 1 ล้านล้านแถว', en: 'show(5) on 1 trillion rows' },
    note: {
      th: 'ไม่ได้อ่านทั้งหมด: 1 job และ 1 task จาก 200 partition ใช้เวลา 0.1 วินาที เพราะ show(5) ต้องการแค่ 5 แถว',
      en: 'It does not read everything: 1 job and 1 task out of 200 partitions, taking 0.1 seconds, because show(5) needs only 5 rows',
    },
  },
];

const TEXT: Record<Lang, { title: string; zero: string; plus: (n: number) => string; counter: string; job: (n: number, t?: number) => string; empty: string; run: string; reset: string; none: string; press: string }> = {
  th: {
    title: 'รันทีละบรรทัด ดูว่าบรรทัดไหนเริ่ม job',
    zero: '0 job',
    plus: (n) => `+${n} job`,
    counter: 'Jobs ใน Spark UI',
    job: (n, t) => `${n} job${t ? `, ${t} task` : ''}`,
    empty: 'ยังไม่มี job (แท็บ Jobs ว่าง)',
    run: 'รันบรรทัดถัดไป',
    reset: 'เริ่มใหม่',
    none: 'ยังไม่ได้รันอะไร',
    press: 'กดรันทีละบรรทัด',
  },
  en: {
    title: 'Run one line at a time and see which line starts a job',
    zero: '0 jobs',
    plus: (n) => `+${n} job${n > 1 ? 's' : ''}`,
    counter: 'Jobs in the Spark UI',
    job: (n, t) => `${n} job${n > 1 ? 's' : ''}${t ? `, ${t} task${t > 1 ? 's' : ''}` : ''}`,
    empty: 'No job yet (the Jobs tab is empty)',
    run: 'Run next line',
    reset: 'Start over',
    none: 'Nothing has run yet',
    press: 'Run the lines one at a time',
  },
};

export default function JobCounterLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [done, setDone] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const next = STMTS.find((s) => !done.includes(s.id));
  const ran = STMTS.filter((s) => done.includes(s.id));
  const total = ran.reduce((a, s) => a + s.jobs, 0);
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="jc-wrap viz-box">
        <ol className="jc-list">
          {STMTS.map((s) => {
            const isDone = done.includes(s.id);
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} data-done={isDone ? '' : undefined} data-up={isNext ? '' : undefined}>
                <code>{s.code[lang]}</code>
                {isDone && (
                  <span className="jc-jobs" data-zero={s.jobs === 0 ? '' : undefined}>
                    {s.jobs === 0 ? T.zero : T.plus(s.jobs)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="jc-side">
          <div className="jc-counter" aria-live="polite">
            <span>{T.counter}</span>
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
                    <strong>{s.label?.[lang]}</strong>
                    <span>
                      {T.job(s.jobs, s.tasks)}
                    </span>
                  </motion.div>
                ))}
            </AnimatePresence>
            {ran.every((s) => s.jobs === 0) && <div className="jc-empty">{T.empty}</div>}
          </div>
        </div>
      </div>
      <div className="viz-controls">
        <button type="button" className="btn primary" onClick={() => next && setDone((d) => [...d, next.id])} disabled={!next}>
          {T.run}
        </button>
        <button type="button" className="btn" onClick={() => setDone([])} disabled={done.length === 0}>
          {T.reset}
        </button>
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{ran.length ? ran[ran.length - 1].code[lang] : T.none}</strong>
        <span>{ran.length ? ran[ran.length - 1].note[lang] : T.press}</span>
      </div>
    </figure>
  );
}
