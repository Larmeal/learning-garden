import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Bar, Card, Row, num } from './ds';
import data from './budget.json';

// Shows:      two things that spend a privacy budget. Left: one total epsilon of 1 split over k queries, so each answer has noise k times larger. Right: an attacker who asks the same
//             question again and again and averages the answers, with fresh noise each time (the error melts away) or with a stored answer (nothing is gained).
// Because:    the budget is only visible as a number that runs out, and the repeated question is the attack the budget exists to stop.
// Control:    the number of queries k (slider) and the mode of the repeated question (fresh noise, stored answer) with the number of repeats m (slider).
// Conclusion: noise per query grows with the number of queries, and fresh noise on the same question can be averaged away, so epsilon has to be added up (or the answer stored).
//
// The averaged error by number of repeats comes from exercises/06_privacy_budget.py (budget.json, 30 repetitions per point, epsilon 0.1 each, true count 351).

type P = { m: number; error: number };
const CURVE = data.avgCurve as P[];
const TRUE = data.true;

const TEXT: Record<Lang, {
  title: string; k: string; m: string; mode: string; fresh: string; stored: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; leftTitle: string; rightTitle: string;
  each: string; err: string; rel: (p: number) => string; spent: string; avgErr: string; stillNoisy: string; known: string; caption: string; budget: string;
}> = {
  th: {
    title: 'ลากจำนวนคำถามเพื่อดูว่า Epsilon รวม 1 ถูกแบ่งแล้วแต่ละคำตอบเพี้ยนเท่าไร และลองถามคำถามเดิมซ้ำเพื่อดูว่า Noise หายไปเมื่อเฉลี่ยหรือไม่',
    k: 'จำนวนคำถามที่แบ่ง Epsilon 1', m: 'ถามคำถามเดิมซ้ำ', mode: 'คำตอบ', fresh: 'Noise ใหม่ทุกครั้ง', stored: 'ใช้คำตอบที่เก็บไว้',
    legend: [{ kind: 'new', text: 'ความคลาดเคลื่อน' }, { kind: 'use', text: 'งบที่ใช้ไป' }],
    leftTitle: 'แบ่งงบ Epsilon 1 ให้หลายคำถาม', rightTitle: 'ถามคำถามเดียวซ้ำ ๆ (Epsilon 0.1 ต่อครั้ง)',
    each: 'Epsilon ต่อคำถาม', err: 'ความคลาดเคลื่อนเฉลี่ยต่อคำตอบ', rel: (p) => `คิดเป็น ${p.toFixed(p < 10 ? 1 : 0)}% ของค่าจริง 351`, spent: 'Epsilon ที่ใช้ไปรวม', avgErr: 'ความคลาดเคลื่อนของค่าเฉลี่ย', stillNoisy: 'คำตอบที่เก็บไว้มี Noise ก้อนเดิมก้อนเดียว เฉลี่ยกี่ครั้งก็ไม่ใกล้ความจริงขึ้น', known: 'ผู้โจมตีรู้ค่าจริงเกือบเป๊ะ แต่จ่าย Epsilon ไปแล้ว', budget: 'งบรวม 1',
    caption: 'ความคลาดเคลื่อนของค่าเฉลี่ยตามจำนวนครั้งที่ถามซ้ำ (เฉลี่ยจาก 30 รอบ) มาจากแบบฝึก 06 ส่วนฝั่งซ้ายเป็นสูตร Scale เท่ากับ 1 หารด้วย Epsilon ต่อคำถาม',
  },
  en: {
    title: 'Slide the number of queries to see how a total epsilon of 1 is split and how far each answer drifts, and ask the same question again to see whether the noise averages away',
    k: 'queries that share epsilon 1', m: 'repeats of the same question', mode: 'answers', fresh: 'fresh noise each time', stored: 'stored answer',
    legend: [{ kind: 'new', text: 'error' }, { kind: 'use', text: 'budget spent' }],
    leftTitle: 'Splitting a budget of epsilon 1 over many queries', rightTitle: 'Asking one question again and again (epsilon 0.1 each time)',
    each: 'epsilon per query', err: 'average error of each answer', rel: (p) => `${p.toFixed(p < 10 ? 1 : 0)}% of the true count 351`, spent: 'total epsilon spent', avgErr: 'error of the average', stillNoisy: 'The stored answer holds one piece of noise. Averaging it any number of times gets no closer to the truth.', known: 'The attacker knows the true count almost exactly, but the epsilon is spent.', budget: 'total budget 1',
    caption: 'The error of the average by number of repeats (30 repetitions per point) comes from exercise 06. The left side is the formula scale = 1 / epsilon per query.',
  },
};

export default function BudgetLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState(10);
  const [mi, setMi] = useState(5); // index into CURVE
  const [fresh, setFresh] = useState(true);
  const perQ = 1 / k;
  const errQ = k;
  const pt = CURVE[mi];
  const first = CURVE[0].error;
  const avgErr = fresh ? pt.error : first;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <Row>
        <Card style={{ flex: '1 1 320px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{T.leftTitle}</div>
          <label className="ib-lbl">{`${T.k}: ${k}`}{' '}
            <input type="range" min={1} max={100} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label={T.k} style={{ width: 200 }} />
          </label>
          <Bar label={T.each} value={perQ} max={1} text={perQ.toFixed(perQ < 0.1 ? 3 : 2)} />
          <Bar label={T.err} value={errQ} max={100} text={num(errQ)} bad />
          <div style={{ fontSize: 14, color: errQ > 35 ? 'var(--ib-bad)' : 'var(--muted)', fontWeight: 700 }}>{T.rel((errQ / TRUE) * 100)}</div>
        </Card>
        <Card style={{ flex: '1 1 320px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{T.rightTitle}</div>
          <div className="ib-controls" style={{ flexWrap: 'wrap', margin: '0 0 6px' }}>
            <span className="ib-lbl">{T.mode}</span>
            <span className="seg" role="group" aria-label={T.mode}>
              <button type="button" aria-pressed={fresh} onClick={() => setFresh(true)}>{T.fresh}</button>
              <button type="button" aria-pressed={!fresh} onClick={() => setFresh(false)}>{T.stored}</button>
            </span>
          </div>
          <label className="ib-lbl">{`${T.m}: ${num(pt.m)}`}{' '}
            <input type="range" min={0} max={CURVE.length - 1} value={mi} onChange={(e) => setMi(Number(e.target.value))} aria-label={T.m} style={{ width: 200 }} />
          </label>
          <Bar label={T.avgErr} value={avgErr} max={first} text={avgErr.toFixed(2)} bad={!fresh || avgErr > 3} />
          <Bar label={T.spent} value={fresh ? pt.m * 0.1 : 0.1} max={200} text={`${(fresh ? pt.m * 0.1 : 0.1).toFixed(1)}  (${T.budget})`} />
          <div style={{ fontSize: 14, fontWeight: 700, color: fresh && avgErr < 2 ? 'var(--ib-bad)' : 'var(--muted)' }}>{fresh ? (avgErr < 2 ? T.known : '') : T.stillNoisy}</div>
        </Card>
      </Row>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
