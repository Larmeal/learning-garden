import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface Step {
  id: number;
  label: string;
}

const TRANSFORMS = ['filter(...)', 'select(...)', 'groupBy(...).agg(...)'];
const ACTIONS = ['show()', 'count()'];
const READ: Step = { id: 0, label: 'read.csv(...)' };

export default function LazyLab() {
  const [plan, setPlan] = useState<Step[]>([READ]);
  const [cache, setCache] = useState(false);
  const [cached, setCached] = useState(false);
  const [reads, setReads] = useState(0);
  const [running, setRunning] = useState<number | null>(null); // index of the step being executed
  const [log, setLog] = useState<string[]>(['เริ่มจากอ่านไฟล์ (ยังไม่ได้อ่านจริง)']);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const reduce = useReducedMotion();

  useEffect(() => () => clearTimeout(timer.current), []);
  const busy = running !== null;
  const push = (line: string) => setLog((l) => [...l.slice(-5), line]);

  const add = (label: string) => {
    setPlan((p) => [...p, { id: nextId.current++, label }]);
    push(`จดแผน: ${label} (ยังไม่ประมวลผลอะไร)`);
  };

  const run = (action: string) => {
    const useCache = cache && cached;
    push(`เรียก ${action}: เริ่มรันทั้งแผน ${plan.length} ขั้น`);
    if (useCache) push('ข้อมูลอยู่ใน cache แล้ว ไม่ต้องอ่านไฟล์ซ้ำ');
    else {
      setReads((n) => n + 1);
      push('อ่านไฟล์จาก disk');
    }
    if (cache) setCached(true);
    const stepMs = reduce ? 0 : 450;
    let i = 0;
    const tick = () => {
      if (i < plan.length) {
        setRunning(i);
        i += 1;
        timer.current = setTimeout(tick, stepMs);
      } else {
        setRunning(null);
        push(`${action} ได้ผลลัพธ์`);
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
    setLog(['เริ่มจากอ่านไฟล์ (ยังไม่ได้อ่านจริง)']);
  };

  return (
    <figure className="viz">
      <div className="viz-title">เพิ่มคำสั่งลงแผน แล้วดูว่า Spark เริ่มทำงานเมื่อไร</div>

      <div className="lazy-grid">
        <div className="lazy-col">
          <div className="lab-label">transformation (แค่จดแผน)</div>
          <div className="lazy-btns">
            {TRANSFORMS.map((t) => (
              <button key={t} type="button" className="btn" disabled={busy} onClick={() => add(t)}>+ {t}</button>
            ))}
          </div>
          <div className="lab-label" style={{ marginTop: 14 }}>action (เริ่มทำงานจริง)</div>
          <div className="lazy-btns">
            {ACTIONS.map((a) => (
              <button key={a} type="button" className="btn primary" disabled={busy} onClick={() => run(a)}>{a}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={cache} disabled={busy} onChange={(e) => { setCache(e.target.checked); setCached(false); }} />
            เรียก <code>cache()</code> ไว้หลังอ่านไฟล์
          </label>
          <button type="button" className="btn" onClick={reset} style={{ alignSelf: 'flex-start' }}>เริ่มใหม่</button>
        </div>

        <div className="lazy-col">
          <div className="lab-label">แผนที่ Spark จดไว้</div>
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
            <span>{busy ? 'executor กำลังประมวลผล' : 'executor ว่างอยู่'}</span>
          </div>
          <div className="readout">
            <span>อ่านไฟล์จาก disk แล้ว <b>{reads}</b> ครั้ง</span>
          </div>
        </div>

        <div className="lazy-col">
          <div className="lab-label">บันทึกเหตุการณ์</div>
          <ul className="log" aria-live="polite">
            {log.map((l, i) => (
              <li key={`${i}-${l}`}>{l}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="viz-caption">
        ลองเพิ่มคำสั่งหลายตัวแล้วสังเกตว่าไฟสถานะไม่ติดเลย พอกด action ไฟถึงติดและไล่ทำทุกขั้นในแผน กด action ซ้ำจะอ่านไฟล์ใหม่ทุกครั้ง ยกเว้นเปิด cache
      </p>
    </figure>
  );
}
