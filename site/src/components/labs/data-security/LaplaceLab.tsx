import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './laplace.json';

// Shows:      the answer to "how many people have this diagnosis" published with Laplace noise. Two curves: the possible answers when Ann is in the table (true count 351) and when she
//             is not (350). Press play and the noisy answers fall onto the axis one at a time. A smaller epsilon pulls the curves together (you cannot tell the two worlds apart) and
//             pushes the answers further from the truth.
// Because:    "differential privacy" is the claim that the two curves overlap, and the price is that the answers spread out. Both are one picture.
// Control:    epsilon (0.1, 0.5, 1, 2, 5) and the clock. Every epsilon redraws the curves, the overlap, the bound on the ratio and the dots.
// Conclusion: the curves differ by at most the factor e^epsilon at any point, and the average error is 1/epsilon. A small epsilon hides one person and blurs the count.
//
// The curve is the Laplace density with scale 1/epsilon. The 120 answers per epsilon, the overlap and the true count are those of exercises/05_dp_basics.py (laplace.json).

type E = { scale: number; overlap: number; answers: number[] };
const EPS = Object.keys(data.eps) as string[];
const D = data.eps as Record<string, E>;
const TRUE = data.true;
const DUR = 9;

const TEXT: Record<Lang, {
  title: string; eps: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; with: string; without: string; bound: (e: number) => string; overlap: string; err: string; answers: string; caption: string; marks: (e: string) => Mark[]; truth: string;
}> = {
  th: {
    title: 'เลือกค่า Epsilon แล้วกดเล่นดูคำตอบที่มี Noise ตกลงบนแกน เส้นโค้งสองเส้นคือคำตอบที่เป็นไปได้ตอนมี Ann กับตอนไม่มี',
    eps: 'Epsilon', legend: [{ kind: 'new', text: 'มี Ann ในตาราง (351)' }, { kind: 'use', text: 'ไม่มี Ann (350)' }],
    with: 'มี Ann', without: 'ไม่มี Ann', bound: (e) => `ที่จุดไหนก็ตาม ความน่าจะเป็นของสองโลกต่างกันไม่เกิน ${Math.exp(e).toFixed(2)} เท่า`, overlap: 'ส่วนที่ซ้อนกันของสองเส้นโค้ง', err: 'ความคลาดเคลื่อนเฉลี่ยของคำตอบ', answers: 'คำตอบที่ปล่อยออกไป', truth: 'ค่าจริง 351',
    caption: 'เส้นโค้งคือความหนาแน่นของ Laplace ที่มี Scale เท่ากับ 1 หารด้วย Epsilon คำตอบ 120 ค่าต่อ Epsilon ส่วนที่ซ้อนกัน และจำนวนจริง 351 มาจากแบบฝึก 05',
    marks: (e) => [
      { at: 0, name: 'สองโลก', title: 'สองตารางที่ต่างกันคนเดียว', text: `ตารางที่มี Ann นับได้ 351 ตารางที่ไม่มีเธอนับได้ 350 ทั้งสองถูกเติม Noise แบบ Laplace ด้วย Epsilon ${e}` },
      { at: 2.0, name: 'คำตอบแรก', title: 'คำตอบแต่ละอันเป็นแค่จุดบนเส้นโค้ง', text: 'ผู้ใช้เห็นเลขเดียว ถ้าเลขนั้นอยู่ตรงที่เส้นโค้งสองเส้นซ้อนกัน เขาบอกไม่ได้ว่ามาจากโลกไหน' },
      { at: 7.5, name: 'เห็นทั้งหมด', title: 'คำตอบทั้งหมดกระจายรอบค่าจริง', text: 'ยิ่ง Epsilon เล็ก คำตอบยิ่งกระจาย ความเป็นส่วนตัวมากขึ้นต้องแลกกับความแม่นที่น้อยลง' },
    ],
  },
  en: {
    title: 'Choose an epsilon and press play to watch the noisy answers fall onto the axis. The two curves are the possible answers with Ann in the table and without her',
    eps: 'Epsilon', legend: [{ kind: 'new', text: 'Ann is in the table (351)' }, { kind: 'use', text: 'Ann is not (350)' }],
    with: 'with Ann', without: 'without Ann', bound: (e) => `At every point the probabilities of the two worlds differ by at most ${Math.exp(e).toFixed(2)} times`, overlap: 'overlap of the two curves', err: 'average error of an answer', answers: 'answers released', truth: 'true count 351',
    caption: 'The curves are the Laplace density with scale 1 / epsilon. The 120 answers per epsilon, the overlap and the true count 351 come from exercise 05.',
    marks: (e) => [
      { at: 0, name: 'two worlds', title: 'Two tables that differ by one person', text: `The table with Ann counts 351 and the table without her counts 350. Both get Laplace noise with epsilon ${e}.` },
      { at: 2.0, name: 'first answers', title: 'Each answer is only a point on a curve', text: 'The reader sees a single number. If it lands where the two curves overlap, he cannot say which world it came from.' },
      { at: 7.5, name: 'all of them', title: 'The answers spread around the true value', text: 'The smaller the epsilon, the wider they spread. More privacy costs accuracy.' },
    ],
  },
};

export default function LaplaceLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [e, setE] = useState(EPS.includes('1.0') ? '1.0' : EPS[0]);
  const clock = useClock(DUR);
  const { t } = clock;
  const d = D[e];
  const b = d.scale;
  const lo = TRUE - 6 * Math.max(b, 1.2), hi = TRUE + 6 * Math.max(b, 1.2);
  const X = (v: number) => 40 + ((v - lo) / (hi - lo)) * 800;
  const f = (x: number, c: number) => Math.exp(-Math.abs(x - c) / b) / (2 * b);
  const peak = 1 / (2 * b);
  const Y = (p: number) => 250 - (p / peak) * 170;
  const path = (c: number) => Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160).map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(f(x, c)).toFixed(1)}`).join(' ');
  const n = Math.floor(smooth(prog(t, 1.2, 8)) * d.answers.length);
  const shown = d.answers.slice(0, n);
  const meanErr = shown.length ? shown.reduce((s, a) => s + Math.abs(a - TRUE), 0) / shown.length : 0;
  const epsN = Number(e);
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.eps}</span>
        <span className="seg" role="group" aria-label={T.eps}>
          {EPS.map((x) => <button key={x} type="button" aria-pressed={e === x} onClick={() => { setE(x); clock.restart(); }}>{x}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <path d={path(TRUE - 1)} fill="none" style={{ stroke: 'var(--muted)', strokeWidth: 3, strokeDasharray: '7 5' }} />
          <path d={path(TRUE)} fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 4 }} />
          <line x1={40} y1={250} x2={840} y2={250} className="ib-line" style={{ strokeWidth: 2 }} />
          <line x1={X(TRUE)} y1={70} x2={X(TRUE)} y2={256} style={{ stroke: 'var(--fg)', strokeWidth: 1.5, strokeDasharray: '3 4' }} />
          <text x={X(TRUE)} y={62} textAnchor="middle" className="ib-s">{T.truth}</text>
          {shown.map((a, i) => (
            <circle key={i} cx={X(Math.max(lo, Math.min(hi, a)))} cy={238 - (i % 7) * 9} r={5} className="ib-new" style={{ opacity: 0.8 }} />
          ))}
          <text x={40} y={286} className="ib-s">{`${lo.toFixed(0)}`}</text>
          <text x={840} y={286} textAnchor="end" className="ib-s">{`${hi.toFixed(0)}`}</text>
          <rect className="ib-banner" x={14} y={304} width={852} height={84} rx={10} />
          <text x={30} y={332} className="ib-n" style={{ fontWeight: 700 }}>{T.bound(epsN)}</text>
          <text x={30} y={358} className="ib-n">{`${T.overlap}: ${(d.overlap * 100).toFixed(1)}%   ·   ${T.err}: ${b.toFixed(1)}   ·   ${T.answers}: ${shown.length} (${T.err}: ${meanErr.toFixed(1)})`}</text>
          <text x={30} y={380} className="ib-s">{`${T.with}: ───    ${T.without}: - - -`}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(e)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
