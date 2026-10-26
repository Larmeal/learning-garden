import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Key = 'A' | 'B' | 'C';
const KEYS: Key[] = ['A', 'B', 'C'];
// Records in each of the three input partitions. Totals: A = 5, B = 3, C = 4.
const PARTS: Key[][] = [
  ['A', 'B', 'A', 'C'],
  ['B', 'C', 'A', 'B'],
  ['C', 'A', 'C', 'A'],
];
const LANE = [140, 220, 300];

const STEPS = [
  { name: 'ข้อมูลตั้งต้น', title: 'ข้อมูลถูกแบ่งเป็น 3 partition', text: 'key เดียวกันกระจายอยู่คนละก้อน เช่น key A อยู่ทั้งใน partition 1, 2 และ 3' },
  { name: 'Stage 1', title: 'task ทำงานกับก้อนของตัวเอง', text: 'แต่ละ task อ่านเฉพาะ partition ของตัวเองและนับ key ที่เจอ ไม่ต้องคุยกับ task อื่น จึงรันขนานกันได้เต็มที่' },
  { name: 'Shuffle', title: 'ส่ง key เดียวกันมารวมกัน', text: 'ข้อมูลต้องข้ามเครื่องไปหา task ที่รับผิดชอบ key นั้น ผ่านเครือข่ายและเขียน disk นี่คือส่วนที่แพงที่สุด' },
  { name: 'Stage 2', title: 'รวมผลต่อ key', text: 'เริ่มได้เมื่อ shuffle เสร็จทั้งหมด แต่ละ task รวมเฉพาะ key ของตัวเองแล้วได้ผลลัพธ์สุดท้าย' },
];

interface Dot {
  id: string;
  key: Key;
  order: number;
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}

function buildDots(): Dot[] {
  const slot: Record<Key, number> = { A: 0, B: 0, C: 0 };
  const dots: Dot[] = [];
  PARTS.forEach((keys, part) =>
    keys.forEach((key, idx) => {
      const dest = KEYS.indexOf(key);
      dots.push({
        id: `${part}-${idx}`,
        key,
        order: dots.length,
        p0: { x: 48 + idx * 26, y: LANE[part] + 10 },
        p1: { x: 234 + idx * 28, y: LANE[part] + 14 },
        p2: { x: 602 + slot[key]++ * 20, y: LANE[dest] + 16 },
      });
    }),
  );
  return dots;
}

// Sample a cubic bezier so the dot follows the same curve as the shuffle lines.
function flight(a: { x: number; y: number }, b: { x: number; y: number }) {
  const c1 = { x: a.x + 170, y: a.y };
  const c2 = { x: b.x - 170, y: b.y };
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    xs.push(u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x);
    ys.push(u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y);
  }
  return { xs, ys };
}

const SHUFFLE_PATHS = [0, 1, 2].flatMap((i) =>
  [0, 1, 2].map((j) => {
    const y0 = LANE[i] + (j - 1) * 8;
    const y1 = LANE[j] + (i - 1) * 8;
    return { d: `M360 ${y0} C470 ${y0} 470 ${y1} 580 ${y1}`, cls: `s${j + 1}`, key: `${i}${j}` };
  }),
);

export default function ShuffleDemo() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const dots = useMemo(buildDots, []);

  useEffect(() => {
    if (!playing) return;
    if (step >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2400);
    return () => clearTimeout(t);
  }, [playing, step]);

  const go = (n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };
  const play = () => {
    if (step >= STEPS.length - 1) setStep(0);
    setPlaying((p) => !p);
  };

  return (
    <figure className="viz">
      <div className="viz-title">ลองดูทีละขั้น: <code>df.groupBy("key").count()</code></div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={`ภาพเคลื่อนไหวของ groupBy count ขั้นที่ ${step + 1}: ${STEPS[step].title}`}>
          <defs>
            <marker id="sd-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>

          <rect className="band" x="10" y="40" width="370" height="304" rx="12" />
          <motion.rect className="zone" x="380" y="40" width="180" height="304" animate={{ opacity: step === 2 ? 1 : 0.35 }} transition={{ duration: 0.4 }} />
          <rect className="band" x="560" y="40" width="310" height="304" rx="12" />

          <text className="b" x="28" y="68" style={{ fontSize: 15 }}>Stage 1</text>
          <text className="s" x="28" y="87">แต่ละ task ทำงานกับ partition ของตัวเอง</text>
          <text className="b acc m" x="470" y="68" textAnchor="middle" style={{ fontSize: 15 }}>SHUFFLE</text>
          <text className="s" x="470" y="87" textAnchor="middle">ข้อมูลข้ามเครื่อง</text>
          <text className="b" x="578" y="68" style={{ fontSize: 15 }}>Stage 2</text>
          <text className="s" x="578" y="87">เริ่มได้เมื่อ shuffle เสร็จ</text>

          {SHUFFLE_PATHS.map((p) => (
            <motion.path
              key={p.key}
              className={`path ${p.cls}`}
              d={p.d}
              animate={{ opacity: step === 2 ? 0.55 : step === 3 ? 0.12 : 0 }}
              transition={{ duration: 0.5 }}
            />
          ))}

          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect className="box" x="28" y={LANE[i] - 28} width="140" height="56" rx="8" />
              <text className="s" x="38" y={LANE[i] - 11}>partition {i + 1}</text>
              <line className="ln" x1="170" y1={LANE[i]} x2="212" y2={LANE[i]} markerEnd="url(#sd-ar)" />
              <rect className={step === 1 ? 'box on' : 'box'} x="214" y={LANE[i] - 28} width="146" height="56" rx="8" />
              <text className="b" x="226" y={LANE[i] - 8}>task {i + 1}</text>

              <rect className={step === 3 ? 'box on' : 'box'} x="582" y={LANE[i] - 28} width="124" height="56" rx="8" />
              <text className="b" x="594" y={LANE[i] - 8}>task {i + 1}</text>
              <text className="s" x="594" y={LANE[i] + 2} style={{ opacity: step === 3 ? 1 : 0 }}>รวม key {KEYS[i]}</text>
              <rect className="box" x="740" y={LANE[i] - 28} width="120" height="56" rx="8" />
            </g>
          ))}
          {[5, 3, 4].map((total, i) => (
            <motion.g key={i} animate={{ opacity: step === 3 ? 1 : 0 }} transition={{ duration: 0.5, delay: step === 3 ? 0.6 : 0 }}>
              <circle className={`k${i + 1}`} cx="762" cy={LANE[i]} r="9" />
              <text className="dl" x="762" y={LANE[i] + 4}>{KEYS[i]}</text>
              <text className="m b" x="782" y={LANE[i] + 5} style={{ fontSize: 14 }}>= {total}</text>
            </motion.g>
          ))}

          {dots.map((d) => {
            const pos = step === 0 ? d.p0 : step === 1 ? d.p1 : d.p2;
            const fly = step === 2 ? flight(d.p1, d.p2) : null;
            return (
              <motion.g
                key={d.id}
                initial={{ x: d.p0.x, y: d.p0.y }}
                animate={fly ? { x: fly.xs, y: fly.ys } : { x: pos.x, y: pos.y }}
                transition={{
                  duration: reduce ? 0 : step === 2 ? 1.3 : 0.7,
                  delay: reduce ? 0 : step === 2 ? d.order * 0.05 : d.order * 0.015,
                  ease: 'easeInOut',
                }}
              >
                <circle className={`k${KEYS.indexOf(d.key) + 1}`} r="9" />
                <text className="dl" y="4">{d.key}</text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>{STEPS[step].title}</strong>
        <span>{STEPS[step].text}</span>
      </div>

      <div className="viz-controls">
        <button type="button" className="btn" onClick={() => go(step - 1)} disabled={step === 0}>← ก่อนหน้า</button>
        <button type="button" className="btn primary" onClick={play}>{playing ? 'หยุด' : step >= STEPS.length - 1 ? 'เล่นใหม่' : 'เล่นต่อเนื่อง'}</button>
        <button type="button" className="btn" onClick={() => go(step + 1)} disabled={step === STEPS.length - 1}>ถัดไป →</button>
        <div className="viz-steps">
          {STEPS.map((s, i) => (
            <button key={s.name} type="button" aria-pressed={i === step} onClick={() => go(i)}>
              {i + 1}. {s.name}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}
