import { useMemo, useState } from 'react';
import { ClockControls, useClock, prog, smooth, type Lang, type Mark } from '../spark/timeline';
import { Key } from './ds';

// Shows:      two worlds that differ by one person (Ann is in the table, 351 people with the diagnosis, or she is not, 350). Both worlds answer "how many have it?" with noise added.
//             100 answers from each world fall onto one number line and pile up, the world with Ann above the line and the world without her below. A detective sees only the number and
//             guesses "Ann is in" when it is above the middle. The score of the detective is counted live.
// Because:    "the answer hides whether one person is in the data" is a claim about two piles of answers that overlap. You only believe it when you see the piles line up on top of each other.
// Control:    epsilon (0.1, 0.5, 1, 2, 5) and the clock. A small epsilon makes the piles wide and the detective's score close to a coin flip, a big one makes them narrow and the score near 100%.
// Conclusion: the answer of the world with Ann and of the world without her look alike, and epsilon decides how alike. The detective's best score is 1/2 + 1/2 (1 - e^(-epsilon/2)).
//
// The 100 answers per world are drawn in the browser with a fixed seed from Laplace noise of scale 1 / epsilon (the sampling of exercises/05_dp_basics.py), so they are an illustration,
// and the detective's score on 200 answers moves a few points around the formula. The formula is the one exercises/11_capstone.py measured (69.7% at epsilon 1, 52.5% at 0.1, 95.9% at 5).

const TRUE_WITH = 351, TRUE_WITHOUT = 350, PER = 100, NB = 24;
const EPS = [0.1, 0.5, 1, 2, 5];
const DUR = 9, T0 = 0.8, T1 = 7.4;

// a small seeded generator, so that every reader sees the same piles
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const laplace = (r: () => number, mu: number, b: number) => { const u = r() - 0.5; return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); };
const theory = (e: number) => 0.5 + 0.5 * (1 - Math.exp(-e / 2));

const TEXT: Record<Lang, {
  title: string; eps: string; withAnn: string; withoutAnn: string; truth: (n: number) => string; line: string; says: { in: string; out: string }; score: (ok: number, n: number) => string; formula: (p: string, e: number) => string; coin: string;
  key: { a: string; b: string }; caption: string; marks: (e: number) => Mark[];
}> = {
  th: {
    title: 'เลือก Epsilon แล้วกดเล่น ดูคำตอบที่มี Noise จากสองโลกตกลงมากองบนเส้นตัวเลขเดียวกัน แล้วดูว่าผู้ทายแยกสองโลกออกได้ไหม',
    eps: 'Epsilon', withAnn: 'โลกที่มี Ann ในตาราง', withoutAnn: 'โลกที่ไม่มี Ann', truth: (n) => `จำนวนจริง ${n}`, line: 'ผู้ทายเห็นแค่ตัวเลข ถ้ามากกว่า 350.5 เขาทายว่ามี Ann',
    says: { in: 'ทายว่า มี Ann', out: 'ทายว่า ไม่มี Ann' }, score: (ok, n) => `ผู้ทายทายถูก ${ok} จาก ${n} คำตอบ`, formula: (p, e) => `ทายได้ดีที่สุดที่ Epsilon ${e} คือ ${p}`, coin: 'ถ้าเดาสุ่ม 50%',
    key: { a: 'คำตอบจากโลกที่มี Ann', b: 'คำตอบจากโลกที่ไม่มี Ann' },
    caption: 'คำตอบ 100 ค่าต่อโลกสุ่มในเบราว์เซอร์ด้วย Noise แบบ Laplace ขนาด 1 / Epsilon และกำหนดตัวสุ่มตายตัว จึงเป็นภาพประกอบ คะแนนจากคำตอบ 200 ค่าจึงขยับรอบสูตรได้ไม่กี่เปอร์เซ็นต์ สูตรเป็นตัวเลขที่แบบฝึก 11 วัดได้ (69.7% ที่ Epsilon 1, 52.5% ที่ 0.1, 95.9% ที่ 5)',
    marks: (e) => [
      { at: 0, name: 'สองโลก', title: 'สองตารางที่ต่างกันคนเดียว', text: `ตารางที่มี Ann มีคนเป็นโรค ${TRUE_WITH} คน ตารางที่ไม่มีเธอมี ${TRUE_WITHOUT} คน ทั้งสองตอบคำถาม "มีกี่คน" โดยเติม Noise ที่ Epsilon ${e}` },
      { at: 2.6, name: 'คำตอบตกลงมา', title: 'ทุกคำตอบเป็นแค่ตัวเลขหนึ่งตัว', text: 'ผู้ทายไม่รู้ว่าตัวเลขมาจากโลกไหน เขาเห็นแต่ตำแหน่งบนเส้น ตัวเลขที่ตกตรงกลางทายผิดได้ง่าย' },
      { at: T1, name: 'ผลทาย', title: 'กองสองกองซ้อนกันมากแค่ไหน', text: e <= 0.5 ? 'สองกองแทบทับกันสนิท ผู้ทายแทบเดาสุ่ม Ann จึงซ่อนอยู่ในตัวเลขได้' : e >= 2 ? 'สองกองแยกจากกันชัด ผู้ทายทายถูกเกือบทุกครั้ง Noise ที่น้อยเกินไปซ่อน Ann ไม่ได้' : 'สองกองทับกันบางส่วน ผู้ทายทายได้ดีกว่าเดาสุ่มอยู่บ้าง นี่คือราคาของความแม่น' },
    ],
  },
  en: {
    title: 'Choose an epsilon and press play. Noisy answers from two worlds fall onto one number line, and a detective tries to tell the worlds apart',
    eps: 'Epsilon', withAnn: 'the world with Ann in the table', withoutAnn: 'the world without Ann', truth: (n) => `true count ${n}`, line: 'The detective only sees the number. Above 350.5 he guesses Ann is in',
    says: { in: 'guesses Ann is in', out: 'guesses Ann is out' }, score: (ok, n) => `The detective is right on ${ok} of ${n} answers`, formula: (p, e) => `The best possible at epsilon ${e} is ${p}`, coin: 'a coin flip is 50%',
    key: { a: 'answers from the world with Ann', b: 'answers from the world without Ann' },
    caption: 'The 100 answers per world are drawn in the browser from Laplace noise of scale 1 / epsilon with a fixed seed, so they are an illustration and the score on 200 answers moves a few points around the formula. The formula is what exercise 11 measured (69.7% at epsilon 1, 52.5% at 0.1, 95.9% at 5).',
    marks: (e) => [
      { at: 0, name: 'two worlds', title: 'Two tables that differ by one person', text: `The table with Ann counts ${TRUE_WITH} people with the illness, the table without her counts ${TRUE_WITHOUT}. Both answer "how many?" with noise added at epsilon ${e}.` },
      { at: 2.6, name: 'answers fall', title: 'Every answer is just one number', text: 'The detective does not know which world a number came from. He only sees where it lands, and a number in the middle is easy to get wrong.' },
      { at: T1, name: 'the guess', title: 'How much do the two piles overlap', text: e <= 0.5 ? 'The two piles nearly sit on top of each other, so the detective is close to guessing. Ann hides inside the number.' : e >= 2 ? 'The two piles are clearly apart, so the detective is right almost every time. With too little noise Ann is not hidden.' : 'The piles overlap in part. The detective does better than a coin, and that is the price of accuracy.' },
    ],
  },
};

export default function LaplaceLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [e, setE] = useState(1);
  const clock = useClock(DUR);
  const { t } = clock;
  const b = 1 / e;
  const lo = TRUE_WITH - 6 * b - 0.5, hi = TRUE_WITH + 6 * b - 0.5, bw = (hi - lo) / NB;
  const data = useMemo(() => {
    const r = rng(7919 + Math.round(e * 100));
    return { A: Array.from({ length: PER }, () => laplace(r, TRUE_WITH, b)), B: Array.from({ length: PER }, () => laplace(r, TRUE_WITHOUT, b)) };
  }, [e, b]);
  const L = 70, R = 860, AX = 244;
  const X = (v: number) => L + ((Math.min(hi - 1e-9, Math.max(lo, v)) - lo) / (hi - lo)) * (R - L);
  const binOf = (v: number) => Math.min(NB - 1, Math.max(0, Math.floor((v - lo) / bw)));
  // the order in which the answers fall: one from each world in turn
  const order = useMemo(() => Array.from({ length: PER * 2 }, (_, j) => ({ world: j % 2 === 0 ? 'A' : 'B', v: (j % 2 === 0 ? data.A : data.B)[Math.floor(j / 2)] })), [data]);
  const tj = (j: number) => T0 + ((T1 - T0) * j) / (PER * 2);
  const fall = 0.45;
  // the height of each answer in its pile is fixed by the order of falling, so it does not jump when the clock moves
  const heights = useMemo(() => {
    const c: Record<string, number[]> = { A: Array(NB).fill(0), B: Array(NB).fill(0) };
    return order.map((o) => c[o.world][binOf(o.v)]++);
  }, [order, lo, bw]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxStack = Math.max(...heights) + 1;
  const step = Math.min(10, 135 / maxStack);
  const dotR = Math.max(2.4, Math.min(5, step / 2 - 0.4));
  const f = (j: number) => smooth(prog(t, tj(j), tj(j) + fall));
  const mid = 350.5;
  const landed = order.map((o, j) => ({ o, j })).filter(({ j }) => f(j) >= 1);
  const ok = landed.filter(({ o }) => (o.world === 'A' ? o.v > mid : o.v <= mid)).length;
  const share = landed.length ? ok / landed.length : 0.5;
  const barW = 400;
  const th = theory(e);
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.eps}</span>
        <span className="seg" role="group" aria-label={T.eps}>
          {EPS.map((x) => <button key={x} type="button" aria-pressed={e === x} onClick={() => { setE(x); clock.restart(); }}>{x}</button>)}
        </span>
      </div>
      <Key items={[{ color: 'var(--accent)', text: T.key.a }, { color: 'var(--muted)', text: T.key.b }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 584" role="img" aria-label={T.title}>
          <text x={L} y={22} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.withAnn}</text>
          {/* the number line */}
          <line x1={L} y1={AX} x2={R} y2={AX} stroke="var(--fg)" strokeWidth={2} />
          {[0, 6, 12, 18, 24].map((k) => { const v = lo + bw * k; return <g key={k}><line x1={X(v)} y1={AX - 5} x2={X(v)} y2={AX + 5} stroke="var(--fg)" strokeWidth={2} /><text x={X(v)} y={AX + 22} textAnchor="middle" style={{ fontSize: 14, fill: 'var(--muted)' }}>{v.toFixed(e >= 2 ? 1 : 0)}</text></g>; })}
          {/* true values and the detective's line */}
          <line x1={X(TRUE_WITH)} y1={36} x2={X(TRUE_WITH)} y2={AX} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 5" />
          <text x={X(TRUE_WITH) + 6} y={AX - 168} style={{ fontSize: 14, fill: 'var(--accent)', fontWeight: 700 }}>{T.truth(TRUE_WITH)}</text>
          <line x1={X(TRUE_WITHOUT)} y1={AX} x2={X(TRUE_WITHOUT)} y2={AX + 214} stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 5" />
          <text x={X(TRUE_WITHOUT) - 6} y={AX + 208} textAnchor="end" style={{ fontSize: 14, fill: 'var(--muted)', fontWeight: 700 }}>{T.truth(TRUE_WITHOUT)}</text>
          <line x1={X(mid)} y1={40} x2={X(mid)} y2={AX + 214} stroke="var(--ib-bad)" strokeWidth={3} />
          <text x={R} y={22} textAnchor="end" style={{ fontSize: 14, fill: 'var(--ib-bad)', fontWeight: 700 }}>{T.line}</text>
          <text x={X(mid) + 8} y={56} style={{ fontSize: 14, fill: 'var(--ib-bad)' }}>{`→ ${T.says.in}`}</text>
          <text x={X(mid) - 8} y={AX + 186} textAnchor="end" style={{ fontSize: 14, fill: 'var(--ib-bad)' }}>{`${T.says.out} ←`}</text>
          <text x={L} y={AX + 186} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.withoutAnn}</text>
          {/* the answers */}
          {order.map((o, j) => {
            const p = f(j);
            if (p <= 0) return null;
            const y = o.world === 'A' ? AX - 9 - heights[j] * step - (1 - p) * 70 : AX + 9 + heights[j] * step + (1 - p) * 70;
            return <circle key={j} cx={X(lo + (binOf(o.v) + 0.5) * bw)} cy={y} r={dotR} style={{ fill: o.world === 'A' ? 'var(--accent)' : 'var(--muted)', opacity: p }} />;
          })}
          {/* the score */}
          <rect x={6} y={AX + 224} width={868} height={100} rx={12} className="ib-banner" />
          <text x={22} y={AX + 254} style={{ fontSize: 18, fontWeight: 700 }}>{T.score(ok, landed.length)}</text>
          <rect x={22} y={AX + 268} width={barW} height={16} rx={8} fill="var(--accent-soft)" stroke="var(--line-strong)" />
          <rect x={22} y={AX + 268} width={Math.max(4, barW * share)} height={16} rx={8} fill={share > 0.8 ? 'var(--ib-bad)' : 'var(--accent)'} />
          <line x1={22 + barW * 0.5} y1={AX + 264} x2={22 + barW * 0.5} y2={AX + 288} stroke="var(--fg)" strokeWidth={2} />
          <text x={22 + barW + 12} y={AX + 282} style={{ fontSize: 17, fontWeight: 700 }}>{landed.length ? `${(share * 100).toFixed(0)}%` : '–'}</text>
          <text x={22} y={AX + 312} className="ib-s" style={{ fontSize: 14.5 }}>{`${T.coin}  ·  ${T.formula(`${(th * 100).toFixed(1)}%`, e)}`}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(e)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
