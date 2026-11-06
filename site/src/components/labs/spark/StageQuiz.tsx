import { useState, type ReactNode } from 'react';

interface Q {
  code: string;
  answer: number;
  why: string;
}

type Lang = 'th' | 'en';

const QUESTIONS: Record<Lang, Q[]> = {
  th: [
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
  ],
  en: [
    {
      code: 'df.filter(df.id > 1).select("v").write.parquet("out")',
      answer: 1,
      why: 'filter and select work on the data inside each partition. No data has to move between machines, so there is no shuffle and the job finishes in one stage.',
    },
    {
      code: 'df.groupBy("k").count().write.parquet("out")',
      answer: 2,
      why: 'groupBy has to bring rows with the same key to the same place. That is 1 shuffle, which cuts the job into 2 stages (before and after the shuffle).',
    },
    {
      code: 'df.groupBy("a").count()\n  .groupBy("count").count()\n  .write.parquet("out")',
      answer: 3,
      why: 'Two groupBy calls on different keys cause 2 shuffles, which cut the job into 3 stages. The counting rule is: 1 shuffle makes 1 cut.',
    },
  ],
};

const TEXT: Record<Lang, { title: string; group: (n: number) => string; right: string; wrong: (a: number) => string; stage: (n: number) => string; caption: ReactNode }> = {
  th: {
    title: 'ทายก่อนเฉลย: โค้ดนี้มีกี่ stage?',
    group: (n) => `ตัวเลือกข้อ ${n}`,
    right: 'ถูก ',
    wrong: (a) => `ยังไม่ใช่ คำตอบคือ ${a} stage `,
    stage: () => 'stage',
    caption: <>นี่คือหลักการนับ ในโปรแกรมจริงให้ยืนยันด้วย <code>explain()</code> และ Spark UI เพราะ optimizer อาจปรับแผนให้ต่างจากที่คิด</>,
  },
  en: {
    title: 'Guess before the answer: how many stages does this code have?',
    group: (n) => `Options for question ${n}`,
    right: 'Correct. ',
    wrong: (a) => `Not quite. The answer is ${a} stage${a > 1 ? 's' : ''}. `,
    stage: (n) => (n > 1 ? 'stages' : 'stage'),
    caption: <>This is the counting rule. In a real program, confirm it with <code>explain()</code> and the Spark UI, because the optimizer may change the plan from what you expect.</>,
  },
};

export default function StageQuiz({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const QS = QUESTIONS[lang];
  const [picked, setPicked] = useState<(number | null)[]>(QS.map(() => null));

  return (
    <div className="quiz viz">
      <div className="viz-title">{T.title}</div>
      {QS.map((q, i) => {
        const p = picked[i];
        return (
          <div className="q" key={q.code}>
            <pre>{q.code}</pre>
            <div className="opts" role="group" aria-label={T.group(i + 1)}>
              {[1, 2, 3].map((n) => {
                const state = p === null ? undefined : n === q.answer ? 'right' : n === p ? 'wrong' : undefined;
                return (
                  <button key={n} type="button" data-state={state} onClick={() => setPicked((s) => s.map((v, j) => (j === i ? n : v)))}>
                    {n} {T.stage(n)}
                  </button>
                );
              })}
            </div>
            {p !== null && (
              <p className="why" aria-live="polite">
                {p === q.answer ? T.right : T.wrong(q.answer)}
                {q.why}
              </p>
            )}
          </div>
        );
      })}
      <p className="viz-caption">{T.caption}</p>
    </div>
  );
}
