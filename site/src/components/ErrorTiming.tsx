import { useState } from 'react';

type Case = 'name' | 'data';

const CASES: Record<Case, { label: string; code: string; err: string; at: 1 | 2 }> = {
  name: {
    label: 'ชื่อคอลัมน์ผิด',
    code: 'df.select("nope")',
    err: 'AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `nope` cannot be resolved.',
    at: 1,
  },
  data: {
    label: 'ข้อมูลผิดรูป',
    code: 'df.select(F.col("x").cast("int"))   # x มีค่า "abc" อยู่',
    err: 'SparkNumberFormatException: [CAST_INVALID_INPUT] The value \'abc\' of the type "STRING" cannot be cast to "INT" because it is malformed.',
    at: 2,
  },
};

// 0 = nothing run, 1 = statement written, 2 = action called
export default function ErrorTiming() {
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
      <div className="viz-title">ข้อผิดพลาดแบบไหนโผล่ตอนไหน</div>
      <div className="lab-controls">
        <div className="seg" role="group" aria-label="ชนิดข้อผิดพลาด">
          {(Object.keys(CASES) as Case[]).map((k) => (
            <button key={k} type="button" aria-pressed={c === k} onClick={() => pick(k)}>{CASES[k].label}</button>
          ))}
        </div>
      </div>

      <pre className="codeline">{cur.code}</pre>

      <div className="timeline">
        <div className={`node ${state(1)}`}>
          <span className="dot" aria-hidden="true" />
          <strong>1. เขียนคำสั่ง</strong>
          <span className="s">Spark ตรวจโครงสร้างตอนนี้</span>
          <button type="button" className="btn" disabled={step >= 1} onClick={() => setStep(1)}>รันบรรทัดนี้</button>
        </div>
        <div className="bar" aria-hidden="true" />
        <div className={`node ${state(2)}`}>
          <span className="dot" aria-hidden="true" />
          <strong>2. เรียก show()</strong>
          <span className="s">Spark ประมวลผลข้อมูลจริงตอนนี้</span>
          <button type="button" className="btn primary" disabled={step !== 1 || failed1} onClick={() => setStep(2)}>เรียก show()</button>
        </div>
      </div>

      <div className="viz-now" aria-live="polite">
        {failed1 || failed2 ? (
          <>
            <strong>ล้มตั้งแต่ขั้น {cur.at}</strong>
            <span className="mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{cur.err}</span>
          </>
        ) : step === 0 ? (
          <span>กด "รันบรรทัดนี้" เพื่อดูว่า Spark ตอบสนองอย่างไร</span>
        ) : (
          <span>บรรทัดนี้ผ่าน ไม่มี error ใดๆ ลองเรียก <code>show()</code> ต่อ</span>
        )}
      </div>
      <p className="viz-caption">ทดสอบจริงบน Spark 4.2.0 โหมดปกติ ข้อความ error ตัดมาจากผลที่ได้</p>
    </figure>
  );
}
