import { useState } from 'react';

interface Q {
  code: string;
  answer: number;
  why: string;
}

const QUESTIONS: Q[] = [
  {
    code: 'df.filter(df.id > 1).select("v").write.parquet("out")',
    answer: 1,
    why: 'filter และ select ทำกับข้อมูลในแต่ละ partition ได้เลย ไม่ต้องย้ายข้อมูลข้ามเครื่อง จึงไม่มี shuffle และรันจบใน stage เดียว',
  },
  {
    code: 'df.groupBy("k").count().write.parquet("out")',
    answer: 2,
    why: 'groupBy ต้องรวม key เดียวกันมาไว้ที่เดียวกัน เกิด shuffle 1 ครั้ง ตัดงานเป็น 2 stage (ก่อนและหลัง shuffle)',
  },
  {
    code: 'df.groupBy("a").count()\n  .groupBy("count").count()\n  .write.parquet("out")',
    answer: 3,
    why: 'groupBy สองครั้งบน key คนละตัว เกิด shuffle 2 ครั้ง ตัดงานเป็น 3 stage หลักนับคือ shuffle 1 ครั้ง ตัด 1 รอย',
  },
];

export default function StageQuiz() {
  const [picked, setPicked] = useState<(number | null)[]>(QUESTIONS.map(() => null));

  return (
    <div className="quiz viz">
      <div className="viz-title">ทายก่อนเฉลย: โค้ดนี้มีกี่ stage?</div>
      {QUESTIONS.map((q, i) => {
        const p = picked[i];
        return (
          <div className="q" key={q.code}>
            <pre>{q.code}</pre>
            <div className="opts" role="group" aria-label={`ตัวเลือกข้อ ${i + 1}`}>
              {[1, 2, 3].map((n) => {
                const state = p === null ? undefined : n === q.answer ? 'right' : n === p ? 'wrong' : undefined;
                return (
                  <button key={n} type="button" data-state={state} onClick={() => setPicked((s) => s.map((v, j) => (j === i ? n : v)))}>
                    {n} stage
                  </button>
                );
              })}
            </div>
            {p !== null && (
              <p className="why" aria-live="polite">
                {p === q.answer ? 'ถูก ' : `ยังไม่ใช่ คำตอบคือ ${q.answer} stage `}
                {q.why}
              </p>
            )}
          </div>
        );
      })}
      <p className="viz-caption">นี่คือหลักการนับ ในโปรแกรมจริงให้ยืนยันด้วย <code>explain()</code> และ Spark UI เพราะ optimizer อาจปรับแผนให้ต่างจากที่คิด</p>
    </div>
  );
}
