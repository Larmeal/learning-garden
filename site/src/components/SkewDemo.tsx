import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Work per key in made-up units. Key A is the "hot" key; B and C stay at 1.
export default function SkewDemo() {
  const [hot, setHot] = useState(6);
  const reduce = useReducedMotion();
  const id = useId();

  const work = [hot, 1, 1];
  const keys = ['A', 'B', 'C'];
  const max = Math.max(...work);
  const idle = Math.round((1 - work.reduce((a, b) => a + b, 0) / (max * work.length)) * 100);
  const pct = (w: number) => `${(w / 10) * 100}%`;

  return (
    <figure className="viz">
      <div className="viz-title">ปรับดู: key เดียวมีข้อมูลมากกว่าตัวอื่น</div>
      <div className="range">
        <label htmlFor={id}>key A มีงานมากกว่า key อื่น <b className="mono">{hot}</b> เท่า</label>
        <input id={id} type="range" min={1} max={10} step={1} value={hot} onChange={(e) => setHot(Number(e.target.value))} />
      </div>

      <div className="viz-box" style={{ padding: 16 }}>
        <div className="stack" style={{ gap: 10, minWidth: 360 }}>
          {work.map((w, i) => (
            <div className="skew-row" key={keys[i]}>
              <span className="lbl">task {i + 1} · key {keys[i]}</span>
              <div className="skew-track">
                <motion.div
                  className={`skew-bar${i === 0 && hot > 1 ? ' hot' : ''}`}
                  initial={false}
                  animate={{ width: pct(w) }}
                  transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
                />
                <motion.span
                  className="skew-end"
                  aria-hidden="true"
                  initial={false}
                  animate={{ left: pct(max) }}
                  transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
          <div className="skew-row">
            <span />
            <span className="viz-caption">เส้นประสีส้มคือจุดที่ stage จบ (ตามตัวที่ช้าที่สุด)</span>
          </div>
        </div>
      </div>

      <div className="readout" aria-live="polite">
        <span>stage ใช้เวลา <b>{max}</b> หน่วย</span>
        <span>เวลาที่ task อื่นว่างรอ <b>{idle}%</b></span>
      </div>
      <p className="viz-caption">ตัวเลขเป็นหน่วยสมมติ ใช้ดูสัดส่วนเท่านั้น ลองเลื่อนไปที่ 1 เพื่อดูกรณีข้อมูลกระจายเท่ากัน ว่างรอเป็น 0%</p>
    </figure>
  );
}
