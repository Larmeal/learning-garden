import { useState } from 'react';
import type { Lang } from '../spark/stepper';
import { Key } from './ds';
import data from './budget.json';

// Shows:      the same question ("how many people have this diagnosis?") asked again and again. Each answer is one dot with noise (epsilon 0.1 each, a real answer of exercise 06), and the blue
//             line is the running average of everything asked so far. On the left the machine answers every time: the average walks onto the true count. On the right the machine has a budget of
//             epsilon 1, a jar of ten coins: each answer takes one coin, and when the jar is empty the machine refuses.
// Because:    "each answer is noisy, so it is safe" is false for the second answer, and the third. Only when you see the average close in on the truth do you see why someone has to count the epsilon.
// Control:    how many times the question is asked (1, 10, 50, 200). Both panels use the same answers, so the only difference is the jar.
// Conclusion: noise protects one answer, not a stream of answers. A budget stops the stream, and what a fixed budget buys is a small number of questions or a lot of noise per question.
//
// The 200 answers are the first 200 of exercise 06 (budget.json: true count 351, epsilon 0.1 per answer, Laplace scale 10). The jar of ten coins is the accountant of the exercise (epsilon 1 in total,
// 0.1 per query, it refuses the 11th). The strip at the bottom is the exercise's split of a total epsilon of 1 over q queries (error 1, 2, 5, 10, 50, 100 per query).

const TRUE = data.true as number;
const ANSWERS = data.firstAnswers as number[];
const SPLIT = data.split as Record<string, number>;
const COINS = 10;
const MS = [1, 10, 50, 200];
const LO = 306, HI = 396;

const TEXT: Record<Lang, {
  title: string; times: string; left: string; leftSub: string; right: string; rightSub: string; truth: string; avg: string; refused: string; jar: string; spentLabel: (e: string) => string; err: (n: number) => string;
  strip: string; qs: (q: string) => string; concl: (m: number, l: string, r: string, spent: number) => string; key: { dot: string; avg: string; jar: string }; caption: string;
}> = {
  th: {
    title: 'เลือกจำนวนครั้งที่ถามคำถามเดิมซ้ำ แล้วดูว่าค่าเฉลี่ยของคำตอบที่มี Noise เดินเข้าหาความจริงอย่างไร และงบ Epsilon หยุดมันได้ตอนไหน',
    times: 'ถามซ้ำ', left: 'เครื่องตอบทุกครั้ง', leftSub: 'ไม่มีงบ ถามได้ไม่จำกัด', right: 'เครื่องมีงบ Epsilon 1', rightSub: 'คำตอบละ 0.1 (เหรียญ 1 อัน) หมดแล้วปฏิเสธ',
    truth: 'จำนวนจริง', avg: 'ค่าเฉลี่ยจนถึงตอนนี้', refused: 'งบหมด ปฏิเสธทุกคำถาม', jar: 'เหรียญงบ', spentLabel: (e) => `ใช้งบไปแล้ว ε ${e}`, err: (n) => `ค่าเฉลี่ยคลาดจากความจริง ${n.toFixed(1)}`,
    strip: 'แบ่งงบรวม 1 ให้หลายข้อ ความคลาดของแต่ละข้อเพิ่มตามจำนวนข้อ', qs: (q) => `ถาม ${q} ข้อ`,
    concl: (m, l, r, s) => `ถามซ้ำ ${m} ครั้ง: ฝั่งไม่มีงบ ค่าเฉลี่ยคลาด ${l} ฝั่งมีงบ ค่าเฉลี่ยคลาด ${r} (ใช้งบไป ${s.toFixed(1)} จาก 1)`,
    key: { dot: 'คำตอบหนึ่งครั้ง (มี Noise)', avg: 'ค่าเฉลี่ยของคำตอบทั้งหมดจนถึงตอนนี้', jar: 'งบที่ใช้ไปแล้ว' },
    caption: 'คำตอบ 200 ค่าเป็น 200 ค่าแรกของแบบฝึก 06 (จำนวนจริง 351 คน Epsilon 0.1 ต่อคำตอบ) ถังเหรียญคือตัวนับงบของแบบฝึก (รวม 1 ใช้ครั้งละ 0.1 ปฏิเสธข้อที่ 11) และแถบล่างคือที่แบบฝึกคำนวณว่าการแบ่งงบรวม 1 ให้ q ข้อ ทำให้ความคลาดต่อข้อเป็น q เท่า',
  },
  en: {
    title: 'Choose how many times the same question is asked, and watch the average of the noisy answers walk onto the truth, and the epsilon budget stop it',
    times: 'asked', left: 'the machine answers every time', leftSub: 'no budget, ask as often as you like', right: 'the machine has a budget of epsilon 1', rightSub: 'a coin (0.1) per answer, then it refuses',
    truth: 'true count', avg: 'average so far', refused: 'budget spent, every question refused', jar: 'budget coins', spentLabel: (e) => `budget spent so far: ε ${e}`, err: (n) => `the average is off by ${n.toFixed(1)}`,
    strip: 'Splitting the total epsilon of 1 over several questions: the error of each grows', qs: (q) => `${q} ${q === '1' ? 'question' : 'questions'}`,
    concl: (m, l, r, s) => `Asked ${m} times: with no budget the average is off by ${l}, with the budget it is off by ${r} (${s.toFixed(1)} of 1 spent)`,
    key: { dot: 'one answer (with noise)', avg: 'average of all the answers so far', jar: 'budget already spent' },
    caption: 'The 200 answers are the first 200 of exercise 06 (true count 351, epsilon 0.1 per answer). The jar of coins is the accountant of the exercise (1 in total, 0.1 per query, it refuses the 11th), and the strip at the bottom is what the exercise computed for splitting a total epsilon of 1 over q queries: q times the error per query.',
  },
};

export default function BudgetLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [m, setM] = useState(10);
  const rowH = Math.min(7.4, 250 / m), y0 = 118;
  const panel = (x0: number, limit: number, budget: boolean) => {
    const W = 410;
    const X = (v: number) => x0 + 14 + ((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * (W - 28);
    const used = Math.min(m, limit);
    const means: number[] = [];
    let sum = 0;
    for (let j = 0; j < used; j++) { sum += ANSWERS[j]; means.push(sum / (j + 1)); }
    const err = used ? Math.abs(means[used - 1] - TRUE) : 0;
    const spent = budget ? Math.min(m, COINS) * 0.1 : m * 0.1;
    const pts = means.map((v, j) => `${X(v).toFixed(1)},${(y0 + j * rowH).toFixed(1)}`).join(' ');
    return { X, used, err, spent, pts, W, means };
  };
  const L = panel(6, 200, false), R = panel(450, COINS, true);
  const drawPanel = (p: ReturnType<typeof panel>, x0: number, budget: boolean) => (
    <g>
      <rect x={x0} y={6} width={p.W + 14} height={394} rx={14} fill="var(--surface)" stroke={budget ? 'var(--accent)' : 'var(--ib-bad)'} strokeWidth={2.5} />
      <text x={x0 + 14} y={32} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{budget ? T.right : T.left}</text>
      <text x={x0 + 14} y={54} className="ib-s" style={{ fontSize: 14 }}>{budget ? T.rightSub : T.leftSub}</text>
      {budget ? (
        <g>
          {Array.from({ length: COINS }, (_, c) => (
            <circle key={c} cx={x0 + 28 + c * 31} cy={78} r={11} style={{ fill: c < Math.min(m, COINS) ? 'var(--ib-bad)' : 'var(--accent-soft)', stroke: 'var(--line-strong)', strokeWidth: 1.5, transition: 'fill .3s' }} />
          ))}
        </g>
      ) : (
        <text x={x0 + 14} y={82} className="ib-n" style={{ fontSize: 15, fontWeight: 700 }}>{T.spentLabel((m * 0.1).toFixed(1))}</text>
      )}
      <line x1={p.X(TRUE)} y1={96} x2={p.X(TRUE)} y2={380} stroke="var(--fg)" strokeWidth={2} strokeDasharray="5 5" />
      <text x={p.X(TRUE)} y={110} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }}>{`${T.truth} ${TRUE}`}</text>
      {ANSWERS.slice(0, p.used).map((a, j) => <circle key={j} cx={p.X(a)} cy={y0 + j * rowH} r={m > 60 ? 1.7 : 2.9} style={{ fill: 'var(--muted)' }} />)}
      {p.used > 1 ? <polyline points={p.pts} fill="none" stroke="var(--accent)" strokeWidth={3.5} strokeLinejoin="round" /> : null}
      {p.used >= 1 ? <circle cx={p.X(p.means[p.used - 1])} cy={y0 + (p.used - 1) * rowH} r={6} style={{ fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }} /> : null}
      {budget && m > COINS ? (
        <g>
          <rect x={x0 + 14} y={y0 + COINS * rowH + 10} width={p.W - 28} height={Math.max(60, 366 - (y0 + COINS * rowH + 14))} rx={10} fill="color-mix(in srgb, var(--ib-bad) 12%, var(--surface))" stroke="var(--ib-bad)" strokeWidth={2.5} />
          <text x={x0 + p.W / 2 + 7} y={(y0 + COINS * rowH + 10 + 366) / 2} textAnchor="middle" style={{ fontSize: 17, fontWeight: 700, fill: 'var(--ib-bad)' }}>{`✗ ${T.refused}`}</text>
        </g>
      ) : null}
      <text x={x0 + 14} y={388} style={{ fontSize: 15.5, fontWeight: 700, fill: budget ? 'var(--fg)' : 'var(--ib-bad)' }}>{T.err(p.err)}</text>
    </g>
  );
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.times}</span>
        <span className="seg" role="group" aria-label={T.times}>{MS.map((x) => <button key={x} type="button" aria-pressed={m === x} onClick={() => setM(x)}>{x}</button>)}</span>
      </div>
      <Key items={[{ color: 'var(--muted)', text: T.key.dot }, { color: 'var(--accent)', text: T.key.avg }, { color: 'var(--ib-bad)', text: T.key.jar }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 570" role="img" aria-label={T.title}>
          {drawPanel(L, 6, false)}
          {drawPanel(R, 450, true)}
          <text x={10} y={426} className="ib-n" style={{ fontWeight: 700, fontSize: 15 }}>{T.strip}</text>
          {Object.entries(SPLIT).map(([q, e], i) => (
            <g key={q}>
              <rect x={10 + i * 144} y={438} width={136} height={50} rx={10} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={1.5} />
              <text x={10 + i * 144 + 68} y={459} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{T.qs(q)}</text>
              <text x={10 + i * 144 + 68} y={480} textAnchor="middle" style={{ fontSize: 17, fontWeight: 700 }}>{`± ${e}`}</text>
            </g>
          ))}
          <rect x={6} y={500} width={868} height={60} rx={12} className="ib-banner" />
          <text x={22} y={536} className="ib-n" style={{ fontWeight: 700, fontSize: 15.5 }}>{T.concl(m, L.err.toFixed(1), R.err.toFixed(1), R.spent)}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
