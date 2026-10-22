import { useRef, useState } from 'react';
import { questionKey, recordAnswer } from './useProgress';

interface Props {
  q: string;
  code?: string;
  options: string[];
  answer: number; // index into options
  why: string;
}

const KEYS = ['A', 'B', 'C', 'D'];

// One multiple-choice question. Announces the answer with a bubbling "garden:answered" event so the lesson player can unlock "next".
export default function Question({ q, code, options, answer, why }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const done = pick !== null;
  const right = pick === answer;
  const key = questionKey(q);

  const choose = (n: number) => {
    if (done) return;
    setPick(n);
    const lesson = root.current?.closest<HTMLElement>('[data-lesson-id]')?.dataset.lessonId;
    if (lesson) recordAnswer(lesson, key);
    root.current?.dispatchEvent(new CustomEvent('garden:answered', { bubbles: true, detail: { correct: n === answer } }));
  };

  return (
    <div className="qcard" ref={root} data-q={key}>
      <p className="q-text">{q}</p>
      {code && <pre className="q-code">{code}</pre>}
      <div className="q-opts" role="group" aria-label="ตัวเลือก">
        {options.map((o, n) => {
          const state = !done ? undefined : n === answer ? 'right' : n === pick ? 'wrong' : 'idle';
          return (
            <button key={o} type="button" className="q-opt" data-state={state} aria-disabled={done} onClick={() => choose(n)}>
              <span className="q-key" aria-hidden="true">{KEYS[n]}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {done && (
        <div className={`q-feedback ${right ? 'right' : 'wrong'}`} role="status">
          <strong>{right ? 'ถูกต้อง' : 'ยังไม่ใช่'}</strong>
          <p>{why}</p>
        </div>
      )}
    </div>
  );
}
