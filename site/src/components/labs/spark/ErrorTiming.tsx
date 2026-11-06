import { useState, type ReactNode } from 'react';

type Case = 'name' | 'data';
type Lang = 'th' | 'en';

const CASES: Record<Case, { label: Record<Lang, string>; code: Record<Lang, string>; err: string; at: 1 | 2 }> = {
  name: {
    label: { th: 'ชื่อคอลัมน์ผิด', en: 'Wrong column name' },
    code: { th: 'df.select("nope")', en: 'df.select("nope")' },
    err: 'AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `nope` cannot be resolved.',
    at: 1,
  },
  data: {
    label: { th: 'ข้อมูลผิดรูป', en: 'Malformed data' },
    code: {
      th: 'df.select(F.col("x").cast("int"))   # x มีค่า "abc" อยู่',
      en: 'df.select(F.col("x").cast("int"))   # x contains the value "abc"',
    },
    err: 'SparkNumberFormatException: [CAST_INVALID_INPUT] The value \'abc\' of the type "STRING" cannot be cast to "INT" because it is malformed.',
    at: 2,
  },
};

const TEXT: Record<Lang, {
  title: string;
  group: string;
  node1: string;
  node1Sub: string;
  run: string;
  node2: string;
  node2Sub: string;
  call: string;
  failedAt: (n: number) => string;
  prompt: string;
  passed: ReactNode;
  caption: string;
}> = {
  th: {
    title: 'ข้อผิดพลาดแบบไหนโผล่ตอนไหน',
    group: 'ชนิดข้อผิดพลาด',
    node1: '1. เขียนคำสั่ง',
    node1Sub: 'Spark ตรวจโครงสร้างตอนนี้',
    run: 'รันบรรทัดนี้',
    node2: '2. เรียก show()',
    node2Sub: 'Spark ประมวลผลข้อมูลจริงตอนนี้',
    call: 'เรียก show()',
    failedAt: (n) => `ล้มตั้งแต่ขั้น ${n}`,
    prompt: 'กด "รันบรรทัดนี้" เพื่อดูว่า Spark ตอบสนองอย่างไร',
    passed: <>บรรทัดนี้ผ่าน ไม่มี error ใดๆ ลองเรียก <code>show()</code> ต่อ</>,
    caption: 'ทดสอบจริงบน Spark 4.2.0 โหมดปกติ ข้อความ error ตัดมาจากผลที่ได้',
  },
  en: {
    title: 'Which error shows up when',
    group: 'Error type',
    node1: '1. Write the statement',
    node1Sub: 'Spark checks the structure now',
    run: 'Run this line',
    node2: '2. Call show()',
    node2Sub: 'Spark processes the real data now',
    call: 'Call show()',
    failedAt: (n) => `Failed at step ${n}`,
    prompt: 'Click "Run this line" to see how Spark reacts',
    passed: <>This line passed with no error. Now try calling <code>show()</code>.</>,
    caption: 'Tested for real on Spark 4.2.0 in the normal mode. The error text is shortened from the real output.',
  },
};

// 0 = nothing run, 1 = statement written, 2 = action called
export default function ErrorTiming({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [c, setC] = useState<Case>('name');
  const [step, setStep] = useState(0);
  const cur = CASES[c];

  const failed1 = step >= 1 && cur.at === 1;
  const failed2 = step >= 2 && cur.at === 2;
  const pick = (k: Case) => {
    setC(k);
    setStep(0);
  };

  const state = (n: 1 | 2) => {
    if ((n === 1 && failed1) || (n === 2 && failed2)) return 'err';
    if (step >= n && !(n === 2 && failed1)) return 'ok';
    return 'idle';
  };

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <div className="seg" role="group" aria-label={T.group}>
          {(Object.keys(CASES) as Case[]).map((k) => (
            <button key={k} type="button" aria-pressed={c === k} onClick={() => pick(k)}>{CASES[k].label[lang]}</button>
          ))}
        </div>
      </div>

      <pre className="codeline">{cur.code[lang]}</pre>

      <div className="timeline">
        <div className={`node ${state(1)}`}>
          <span className="dot" aria-hidden="true" />
          <strong>{T.node1}</strong>
          <span className="s">{T.node1Sub}</span>
          <button type="button" className="btn" disabled={step >= 1} onClick={() => setStep(1)}>{T.run}</button>
        </div>
        <div className="bar" aria-hidden="true" />
        <div className={`node ${state(2)}`}>
          <span className="dot" aria-hidden="true" />
          <strong>{T.node2}</strong>
          <span className="s">{T.node2Sub}</span>
          <button type="button" className="btn primary" disabled={step !== 1 || failed1} onClick={() => setStep(2)}>{T.call}</button>
        </div>
      </div>

      <div className="viz-now" aria-live="polite">
        {failed1 || failed2 ? (
          <>
            <strong>{T.failedAt(cur.at)}</strong>
            <span className="mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{cur.err}</span>
          </>
        ) : step === 0 ? (
          <span>{T.prompt}</span>
        ) : (
          <span>{T.passed}</span>
        )}
      </div>
      <p className="viz-caption">{T.caption}</p>
    </figure>
  );
}
