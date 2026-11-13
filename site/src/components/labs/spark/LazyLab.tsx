import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Lang } from './stepper';

interface Step {
  id: number;
  label: string;
}

const TRANSFORMS = ['filter(...)', 'select(...)', 'groupBy(...).agg(...)'];
const ACTIONS = ['show()', 'count()'];
const READ: Step = { id: 0, label: 'read.csv(...)' };

const TEXT = {
  th: {
    start: 'เริ่มจากอ่านไฟล์ (ยังไม่ได้อ่านจริง)',
    noted: (label: string) => `จดลงแผนว่า ${label} (ยังไม่ประมวลผลอะไร)`,
    called: (action: string, n: number) => `เรียก ${action} ทำให้เริ่มรันทั้งแผน ${n} ขั้น`,
    cacheHit: 'ข้อมูลอยู่ใน Cache แล้ว เลยไม่ต้องอ่านไฟล์ซ้ำ',
    readDisk: 'อ่านไฟล์จาก Disk',
    result: (action: string) => `${action} ส่งผลลัพธ์กลับมาแล้ว`,
    title: 'เพิ่มคำสั่งลงแผน แล้วดูว่า Spark เริ่มทำงานเมื่อไร',
    transformation: 'Transformation (แค่จดแผน)',
    action: 'Action (เริ่มทำงานจริง)',
    cacheBefore: 'เรียก ',
    cacheAfter: ' ไว้หลังอ่านไฟล์',
    reset: 'เริ่มใหม่',
    plan: 'แผนที่ Spark จดไว้',
    busy: 'Executor กำลังประมวลผล',
    idle: 'Executor ว่างอยู่',
    readsBefore: 'อ่านไฟล์จาก Disk แล้ว ',
    readsAfter: ' ครั้ง',
    events: 'บันทึกเหตุการณ์',
    caption: 'ลองเพิ่มคำสั่งหลายตัว แล้วสังเกตว่าไฟสถานะไม่ติดเลย พอเรากด Action ไฟถึงจะติด และ Spark จะไล่ทำทุกขั้นในแผน ถ้ากด Action ซ้ำ Spark ก็จะอ่านไฟล์ใหม่ทุกครั้ง ยกเว้นว่าเราเปิด Cache ไว้',
  },
  en: {
    start: 'Start by reading the file (not actually read yet)',
    noted: (label: string) => `Noted in the plan: ${label} (nothing is processed yet)`,
    called: (action: string, n: number) => `Called ${action}: run the whole plan of ${n} steps`,
    cacheHit: 'The data is already in the cache, so the file is not read again',
    readDisk: 'Read the file from disk',
    result: (action: string) => `${action} returned a result`,
    title: 'Add commands to the plan and see when Spark starts working',
    transformation: 'transformation (only noted in the plan)',
    action: 'action (really starts work)',
    cacheBefore: 'Call ',
    cacheAfter: ' after reading the file',
    reset: 'Start over',
    plan: 'The plan Spark has noted',
    busy: 'The executor is processing',
    idle: 'The executor is idle',
    readsBefore: 'Read the file from disk ',
    readsAfter: ' times',
    events: 'Event log',
    caption: 'Add several commands and notice that the status lamp never lights up. When you press an action, the lamp lights up and every step of the plan runs. Pressing an action again reads the file again each time, unless you turn on cache.',
  },
};

export default function LazyLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [plan, setPlan] = useState<Step[]>([READ]);
  const [cache, setCache] = useState(false);
  const [cached, setCached] = useState(false);
  const [reads, setReads] = useState(0);
  const [running, setRunning] = useState<number | null>(null); // index of the step being executed
  const [log, setLog] = useState<string[]>([T.start]);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const reduce = useReducedMotion();

  useEffect(() => () => clearTimeout(timer.current), []);
  const busy = running !== null;
  const push = (line: string) => setLog((l) => [...l.slice(-5), line]);

  const add = (label: string) => {
    setPlan((p) => [...p, { id: nextId.current++, label }]);
    push(T.noted(label));
  };

  const run = (action: string) => {
    const useCache = cache && cached;
    push(T.called(action, plan.length));
    if (useCache) push(T.cacheHit);
    else {
      setReads((n) => n + 1);
      push(T.readDisk);
    }
    if (cache) setCached(true);
    const stepMs = reduce ? 0 : 450;
    // on a cache hit the first step (reading the file) is not run again: the walk starts at the step after it
    let i = useCache ? 1 : 0;
    const tick = () => {
      if (i < plan.length) {
        setRunning(i);
        i += 1;
        timer.current = setTimeout(tick, stepMs);
      } else {
        setRunning(null);
        push(T.result(action));
      }
    };
    tick();
  };

  const reset = () => {
    clearTimeout(timer.current);
    setPlan([READ]);
    setReads(0);
    setCached(false);
    setRunning(null);
    setLog([T.start]);
  };

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>

      <div className="lazy-grid">
        <div className="lazy-col">
          <div className="lab-label">{T.transformation}</div>
          <div className="lazy-btns">
            {TRANSFORMS.map((t) => (
              <button key={t} type="button" className="btn" disabled={busy} onClick={() => add(t)}>+ {t}</button>
            ))}
          </div>
          <div className="lab-label" style={{ marginTop: 14 }}>{T.action}</div>
          <div className="lazy-btns">
            {ACTIONS.map((a) => (
              <button key={a} type="button" className="btn primary" disabled={busy} onClick={() => run(a)}>{a}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={cache} disabled={busy} onChange={(e) => { setCache(e.target.checked); setCached(false); }} />
            {/* one text item, so the label wraps as a sentence instead of as separate flex items */}
            <span>{T.cacheBefore}<code>cache()</code>{T.cacheAfter}</span>
          </label>
          <button type="button" className="btn" onClick={reset} style={{ alignSelf: 'flex-start' }}>{T.reset}</button>
        </div>

        <div className="lazy-col">
          <div className="lab-label">{T.plan}</div>
          <ol className="plan">
            {plan.map((s, i) => (
              <motion.li
                key={s.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={running === i ? 'on' : undefined}
              >
                <span className="mono">{i + 1}</span> {s.label}
              </motion.li>
            ))}
          </ol>
          <div className="lamp-row">
            <span className={`lamp${busy ? ' on' : ''}`} aria-hidden="true" />
            <span>{busy ? T.busy : T.idle}</span>
          </div>
          <div className="readout">
            <span>{T.readsBefore}<b>{reads}</b>{T.readsAfter}</span>
          </div>
        </div>

        <div className="lazy-col">
          <div className="lab-label">{T.events}</div>
          <ul className="log" aria-live="polite">
            {log.map((l, i) => (
              <li key={`${i}-${l}`}>{l}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="viz-caption">{T.caption}</p>
    </figure>
  );
}
