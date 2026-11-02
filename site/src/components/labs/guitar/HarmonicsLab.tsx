import { useEffect, useState } from 'react';
import { Pills } from '../../music/Controls';
import { partials, pluck } from '../../music/audio';
import { SHARP_NAMES, fretFraction, harmonicsAt } from '../../../lib/music';

// A string drawn as the six simplest ways it can vibrate (1 loop, 2 loops, 3 ...). Rest a finger above a fret and see which
// patterns still have a still point (node) under the finger: those survive and make the harmonic. The others are stopped.
// The motion is slowed down so it can be seen; higher patterns still move faster in proportion (k times).

const X0 = 70;
const X1 = 630;
const L = X1 - X0;
const ROW = 52;
const TOP = 112;
const AMP = 19;
const FRETS = [0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 19, 24];
const LOW_E = 40; // E2, the string used for the sound

const NOTE_REL: Record<number, string> = {
  1: 'โน้ตของสายเปล่า',
  2: 'สูงกว่าสายเปล่า 1 octave',
  3: 'สูงกว่าสายเปล่า 1 octave + perfect 5th',
  4: 'สูงกว่าสายเปล่า 2 octaves',
  5: 'สูงกว่าสายเปล่า 2 octaves + major 3rd (เพี้ยนเล็กน้อย)',
  6: 'สูงกว่าสายเปล่า 2 octaves + perfect 5th',
};
const noteOf = (k: number) => SHARP_NAMES[(LOW_E + Math.round(12 * Math.log2(k))) % 12];

const x = (p: number) => X0 + p * L;
const path = (k: number, row: number, phase: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 90; i++) {
    const u = i / 90;
    pts.push(`${i === 0 ? 'M' : 'L'}${(X0 + u * L).toFixed(1)},${(TOP + row * ROW - AMP * Math.sin(k * Math.PI * u) * phase).toFixed(1)}`);
  }
  return pts.join(' ');
};

export default function HarmonicsLab({ start = 12 }: { start?: number }) {
  const [fret, setFret] = useState(start);
  const [moving, setMoving] = useState(true);
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!moving || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setTime((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving]);

  const modes = harmonicsAt(fret);
  const alive = modes.filter((m) => m.alive);
  const p = fretFraction(fret);
  const lowest = alive[0];

  const listen = () => {
    if (alive.length) partials(LOW_E, alive.map((m) => m.k));
    else pluck(LOW_E, 0, 0.12, 0.05); // every pattern stopped: only a dull tick
  };

  return (
    <figure className="viz">
      <div className="viz-title">สายสั่นเป็นกี่โค้ง และนิ้วที่แตะหยุดอะไรไป</div>
      <Pills<number>
        label="แตะเหนือเฟร็ต"
        value={fret}
        onChange={setFret}
        options={FRETS.map((f) => ({ value: f, text: f === 0 ? 'ไม่แตะ' : String(f) }))}
      />
      <div className="viz-box">
        <svg viewBox="0 0 760 440" role="img" aria-label={`ภาพรูปแบบการสั่นของสายเมื่อแตะเหนือเฟร็ต ${fret}`}>
          {/* the string with its frets */}
          <line x1={X0} x2={X1} y1="46" y2="46" stroke="var(--muted)" strokeWidth="2.5" />
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
            <line key={n} x1={x(fretFraction(n))} x2={x(fretFraction(n))} y1="38" y2="54" stroke="var(--line-strong)" strokeWidth={[5, 7, 12].includes(n) ? 3 : 1.5} />
          ))}
          {[5, 7, 12, 19, 24].map((n) => (
            <text key={n} className="s" x={x(fretFraction(n))} y="32" textAnchor="middle">{n}</text>
          ))}
          <text className="s" x={X0 - 12} y="50" textAnchor="end">nut</text>
          <text className="s" x={X1 + 8} y="50">bridge</text>

          {/* one row for each way the string can vibrate */}
          {modes.map((m, i) => {
            const y = TOP + i * ROW;
            const cos = Math.cos(2 * Math.PI * 0.5 * m.k * time);
            return (
              <g key={m.k}>
                <text className="s b" x="8" y={y + 4}>{m.k === 1 ? 'k = 1' : `k = ${m.k}`}</text>
                <text className="s" x="8" y={y + 18}>{m.k === 1 ? 'ทั้งเส้น' : `${m.k} โค้ง`}</text>
                <line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
                {/* the shape this pattern would have */}
                <path d={path(m.k, i, 1)} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="4 4" />
                <path d={path(m.k, i, -1)} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="4 4" />
                {/* the moving string: only if it survives */}
                {m.alive && <path d={path(m.k, i, cos)} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />}
                {/* the still points */}
                {Array.from({ length: m.k + 1 }, (_, j) => (
                  <circle key={j} cx={x(j / m.k)} cy={y} r="3.5" fill={m.alive ? 'var(--accent)' : 'var(--muted)'} />
                ))}
                {/* where the finger meets this pattern */}
                {fret > 0 && (
                  <circle cx={x(p)} cy={y - AMP * Math.sin(m.k * Math.PI * p)} r={m.alive ? 5 : 7} fill={m.alive ? 'var(--brand)' : 'var(--wrong)'} stroke="var(--surface)" strokeWidth="2" />
                )}
                <text x={X1 + 12} y={y + 5} className="b" style={{ fill: m.alive ? 'var(--brand)' : 'var(--wrong)', fontSize: 15 }}>
                  {m.alive ? 'รอด' : 'ถูกหยุด'}
                </text>
              </g>
            );
          })}

          {/* the finger */}
          {fret > 0 && (
            <>
              <line x1={x(p)} x2={x(p)} y1="54" y2={TOP + 5 * ROW + 24} stroke="var(--fg)" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.6" />
              <circle cx={x(p)} cy="46" r="9" fill="var(--sun)" stroke="var(--fg)" strokeWidth="2" />
              <text x={x(p)} y="76" textAnchor="middle" className="b" style={{ fontSize: 12 }}>นิ้วแตะ ที่ {(p * 100).toFixed(1)}% ของสาย</text>
            </>
          )}
        </svg>
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>
          {fret === 0
            ? 'ไม่แตะ: ทุกรูปแบบสั่นได้พร้อมกัน ได้ยินเป็นโน้ตของสาย'
            : alive.length
              ? `แตะเหนือเฟร็ต ${fret}: รอด k = ${alive.map((m) => m.k).join(', ')}`
              : `แตะเหนือเฟร็ต ${fret}: ไม่มีรูปแบบไหนรอด`}
        </strong>
        <span style={{ display: 'block' }}>
          {fret === 0
            ? 'ลองเลือกเฟร็ต 12 เพื่อเริ่มดู'
            : lowest
              ? `เสียงที่ได้ยินคือ k = ${lowest.k} (โน้ต ${noteOf(lowest.k)}, ${NOTE_REL[lowest.k]}) เพราะรูปแบบที่ต่ำกว่าถูกนิ้วหยุดไว้`
              : 'ทุกรูปแบบต้องการให้จุดใต้นิ้วขยับ จึงถูกหยุดทั้งหมด เสียงที่ได้เป็นเสียงทึบสั้นๆ'}
        </span>
        {fret > 0 && (
          <span style={{ display: 'block' }}>
            วงกลมสีแดงคือจุดที่รูปแบบนั้นอยากขยับแต่ถูกนิ้วจับไว้ ยิ่งอยู่ไกลจากเส้นกลางยิ่งถูกหยุดแรง
            วงเขียวคือรูปแบบที่มีจุดนิ่งอยู่ใต้นิ้วพอดี
          </span>
        )}
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={listen}>ฟังเสียง (สาย 6)</button>
          <button type="button" className="btn sm" onClick={() => pluck(LOW_E, 0, 1.6)}>ฟังสายเปล่าเทียบ</button>
          <button type="button" className="btn sm" onClick={() => setMoving((v) => !v)}>{moving ? 'หยุดภาพเคลื่อนไหว' : 'เล่นภาพเคลื่อนไหว'}</button>
        </div>
      </div>
      <p className="viz-caption">ภาพเคลื่อนไหวช้ากว่าจริงหลายร้อยเท่า เส้นประคือรูปร่างสูงสุดของแต่ละรูปแบบ</p>
    </figure>
  );
}
