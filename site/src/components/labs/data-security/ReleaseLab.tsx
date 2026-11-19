import { useState } from 'react';
import type { Lang } from '../spark/stepper';
import { Key, num } from './ds';
import data from './release.json';
import { DIA, DIAG, DAY, MONTH, N, NAMES, ROWS, SEX, YEAR, ZIP, ZIPS } from './peopleLib';

// Shows:      the four ways of releasing the same table to researchers, side by side. Each column is the parcel the researcher would receive (three of its rows, or the noisy numbers at the last stage)
//             with what two attackers get from it: one who joins it with the public voter list, and one who knows everybody in the table except Ann and guesses whether Ann is in it.
//             Under that, how close the numbers that are left still are to the truth.
// Because:    "is this release safe" has no single answer. Putting the four parcels next to each other shows that removing names stops nothing, that k-anonymity stops the join but not the second
//             attacker, and that noise is what stops him, at a price in accuracy.
// Control:    the epsilon of the last stage (0.1, 1, 5): it changes the noise in the numbers and how well the second attacker guesses. The other three columns do not depend on it.
// Conclusion: a release has to be measured against more than one attacker. Only the last stage lowers the guess of the second attacker, and a large epsilon gives most of that protection back.
//
// The rows shown are real people of the table (labPeople.json). The numbers of the attackers and of the accuracy are those of exercises/11_capstone.py (release.json): the join names 1,409 people at
// stages 0 and 1 and none after that, the second attacker is right 100% of the time until the noise (69.7% at epsilon 1, 52.5% at 0.1, 95.9% at 5), the mean salary is off by 0.03% and 0.63% and
// the count per diagnosis by 0.57% and 0.70% (epsilon 1; other epsilons were not measured). The noisy counts in the last column are one illustrative draw with a fixed seed.

type Stage = { name: string; named: number; diff: number; salaryErr: number; dxErr: number; suppressed?: number };
const STAGES = data.stages as Stage[];
const DIFF = data.diffByEps as Record<string, number>;
const EPS = ['0.1', '1.0', '5.0'];
const COL_W = 210, GAP = 8;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const laplace = (r: () => number, b: number) => { const u = r() - 0.5; return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); };

const TEXT: Record<Lang, {
  title: string; eps: string; stages: string[]; subs: string[]; sexes: string[]; attacker1: string; attacker2: string; named: (n: number) => string; guess: string; coin: string; numbers: string; salary: string; count: string; error: string;
  noRows: string; noisy: string; suppressed: (n: number) => string; notMeasured: string; noName: string; concl: (eps: string, p: string) => string; key: { bad: string; ok: string }; caption: string; sample: string;
}> = {
  th: {
    title: 'เทียบสี่วิธีปล่อยตารางเดียวกัน ว่าผู้โจมตีสองแบบได้อะไรจากแต่ละวิธี และตัวเลขที่เหลือยังแม่นแค่ไหน',
    eps: 'Epsilon ของขั้นสุดท้าย', stages: ['ตารางดิบ', 'เอาชื่อออก', 'k-anonymous', 'ตัวเลขรวมที่มี Noise'], subs: ['ส่งทุกคอลัมน์', 'ไม่มีชื่อ อีเมล เบอร์โทร', 'Zip 3 หลัก อายุช่วง 10 ปี k อย่างน้อย 5', 'ไม่ปล่อยแถวเลย'],
    sexes: ['ชาย', 'หญิง'], attacker1: 'ผู้โจมตี 1: Join กับรายชื่อผู้มีสิทธิ์เลือกตั้ง', attacker2: 'ผู้โจมตี 2: รู้ทั้งตารางยกเว้น Ann แล้วทายว่า Ann อยู่ในตารางไหม', named: (n) => `ได้ชื่อ ${num(n)} คน`, guess: 'ทายถูก', coin: 'เดาสุ่ม 50%',
    numbers: 'ตัวเลขที่ออกมายังแม่นแค่ไหน', salary: 'เงินเดือนเฉลี่ยต่อ Zip', count: 'จำนวนคนต่อโรค', error: 'คลาด', noRows: 'ไม่มีแถว', noisy: 'จำนวนคนต่อโรค (Noise ตัวอย่างหนึ่งครั้ง)', suppressed: (n) => `ตัดออก ${n} คน`, notMeasured: 'ไม่ได้วัดที่ Epsilon นี้', noName: 'ไม่มีชื่อ',
    concl: (e, p) => `ลบชื่อไม่ช่วยอะไร k-anonymous หยุดการ Join แต่ผู้โจมตี 2 ยังทายถูก 100% ส่วน Noise ที่ Epsilon ${e} ลดเหลือ ${p}`, key: { bad: 'ผู้โจมตีได้ผล', ok: 'ผู้โจมตีไม่ได้ผล' }, sample: 'ตัวอย่างที่นักวิจัยได้รับ',
    caption: 'แถวในภาพเป็นคนจริงของตารางสังเคราะห์ 2,000 คน ตัวเลขของผู้โจมตีและความแม่นมาจากแบบฝึก 11 (Epsilon 1 ทั้งขั้นสุดท้าย ส่วน Epsilon อื่นมีเฉพาะการทายของผู้โจมตี 2 ที่วัดไว้) จำนวนคนต่อโรคในช่องสุดท้ายเป็น Noise ตัวอย่างหนึ่งครั้ง ตั้งตัวสุ่มตายตัว',
  },
  en: {
    title: 'Compare four ways of releasing the same table: what two attackers get from each one, and how accurate the numbers that are left still are',
    eps: 'epsilon of the last stage', stages: ['raw table', 'names removed', 'k-anonymous', 'noisy aggregates'], subs: ['every column sent', 'no name, e-mail or phone', '3 digit zip, 10 year bands, k at least 5', 'no rows at all'],
    sexes: ['male', 'female'], attacker1: 'Attacker 1: joins with the public voter list', attacker2: 'Attacker 2: knows the whole table except Ann and guesses whether Ann is in it', named: (n) => `names ${num(n)} people`, guess: 'right', coin: 'a coin flip is 50%',
    numbers: 'how accurate the remaining numbers are', salary: 'mean salary per zip', count: 'people per diagnosis', error: 'off by', noRows: 'no rows', noisy: 'people per diagnosis (one illustrative draw of noise)', suppressed: (n) => `${n} people cut out`, notMeasured: 'not measured at this epsilon', noName: 'no name',
    concl: (e, p) => `Removing names helps nothing. k-anonymity stops the join, but attacker 2 is still right 100% of the time. Noise at epsilon ${e} brings that down to ${p}.`, key: { bad: 'the attacker succeeds', ok: 'the attacker fails' }, sample: 'what the researcher receives',
    caption: 'The rows are real people of the synthetic table of 2,000. The attacker numbers and the accuracy come from exercise 11 (epsilon 1 for the whole last stage; for other epsilons only attacker 2\'s guess was measured). The people per diagnosis in the last column is one draw of noise with a fixed seed.',
  },
};

export default function ReleaseLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [eps, setEps] = useState('1.0');
  const e = Number(eps);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const diff = (i: number) => (i === 3 ? DIFF[eps] : STAGES[i].diff);
  // the three rows of a parcel
  const rowText = (i: number, r: number): [string, string] => {
    const x = ROWS[r];
    const bandStart = Math.floor(x[YEAR] / 10) * 10;
    if (i === 0) return [NAMES[r], `${ZIPS[x[ZIP]]} · ${x[YEAR]}-${String(x[MONTH]).padStart(2, '0')}-${String(x[DAY]).padStart(2, '0')} · ${T.sexes[x[SEX]]} · ${DIAG[x[DIA]]}`];
    if (i === 1) return [T.noName, `${ZIPS[x[ZIP]]} · ${x[YEAR]}-${String(x[MONTH]).padStart(2, '0')}-${String(x[DAY]).padStart(2, '0')} · ${T.sexes[x[SEX]]} · ${DIAG[x[DIA]]}`];
    return [T.noName, `${ZIPS[x[ZIP]].slice(0, 3)}** · ${bandStart}s · ${T.sexes[x[SEX]]} · ${DIAG[x[DIA]]}`];
  };
  // illustrative noisy counts for the last stage
  const counts = DIAG.map((d, k) => ({ d, n: ROWS.filter((x) => x[DIA] === k).length })).sort((a, b) => b.n - a.n).slice(0, 3);
  const rd = rng(424242 + Math.round(e * 10));
  const noisy = counts.map((c) => ({ d: c.d, v: Math.round(c.n + laplace(rd, 2 / e)) }));
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.eps}</span>
        <span className="seg" role="group" aria-label={T.eps}>{EPS.map((x) => <button key={x} type="button" aria-pressed={eps === x} onClick={() => setEps(x)}>{Number(x)}</button>)}</span>
      </div>
      <Key items={[{ color: 'var(--ib-bad)', text: T.key.bad }, { color: 'var(--accent)', text: T.key.ok }]} />
      <div className="viz-box">
        <svg viewBox="0 0 868 640" role="img" aria-label={T.title}>
          {STAGES.map((st, i) => {
            const x0 = 4 + i * (COL_W + GAP);
            const named = st.named;
            const guess = diff(i);
            const badJoin = named > 0, badGuess = guess > 0.9;
            const measured = i < 3 || eps === '1.0';
            return (
              <g key={st.name}>
                <rect x={x0} y={4} width={COL_W} height={632} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
                <circle cx={x0 + 24} cy={30} r={14} style={{ fill: 'var(--accent)' }} />
                <text x={x0 + 24} y={36} textAnchor="middle" style={{ fill: 'var(--on-key, #fff)', fontWeight: 700, fontSize: 16 }}>{i}</text>
                <text x={x0 + 46} y={36} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.stages[i]}</text>
                <foreignObject x={x0 + 10} y={52} width={COL_W - 20} height={40}><div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.3 }}>{T.subs[i]}</div></foreignObject>
                {/* the parcel */}
                <text x={x0 + 12} y={110} className="ib-s" style={{ fontSize: 13.5 }}>{T.sample}</text>
                {i < 3 ? [0, 1, 2].map((r) => {
                  const [a, b] = rowText(i, r);
                  return (
                    <g key={r}>
                      <rect x={x0 + 8} y={120 + r * 74} width={COL_W - 16} height={66} rx={10} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} />
                      <text x={x0 + 18} y={141 + r * 74} style={{ fontSize: 15, fontWeight: 700, fill: i === 0 ? 'var(--ib-bad)' : 'var(--muted)' }}>{a}</text>
                      <foreignObject x={x0 + 14} y={146 + r * 74} width={COL_W - 28} height={38}><div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12.5, lineHeight: 1.25 }}>{b}</div></foreignObject>
                    </g>
                  );
                }) : (
                  <g>
                    <text x={x0 + 12} y={134} style={{ fontSize: 15, fontWeight: 700 }}>{T.noRows}</text>
                    <foreignObject x={x0 + 10} y={140} width={COL_W - 20} height={40}><div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.25 }}>{T.noisy}</div></foreignObject>
                    {noisy.map((c, r) => (
                      <g key={c.d}>
                        <rect x={x0 + 8} y={186 + r * 56} width={COL_W - 16} height={48} rx={10} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} />
                        <text x={x0 + 18} y={216 + r * 56} style={{ fontSize: 15.5, fontFamily: 'var(--mono, monospace)', fontWeight: 700 }}>{`${c.d}: ${num(c.v)}`}</text>
                      </g>
                    ))}
                  </g>
                )}
                {i === 2 ? <text x={x0 + 12} y={350} style={{ fontSize: 14, fill: 'var(--muted)' }}>{T.suppressed(st.suppressed ?? 0)}</text> : null}
                {/* attacker 1 */}
                <foreignObject x={x0 + 10} y={364} width={COL_W - 20} height={50}><div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{T.attacker1}</div></foreignObject>
                <text x={x0 + 12} y={446} style={{ fontSize: 17, fontWeight: 700, fill: badJoin ? 'var(--ib-bad)' : 'var(--accent)' }}>{`${badJoin ? '✗' : '✓'} ${T.named(named)}`}</text>
                <rect x={x0 + 12} y={456} width={COL_W - 24} height={10} rx={5} fill="var(--accent-soft)" stroke="var(--line-strong)" />
                <rect x={x0 + 12} y={456} width={Math.max(0, ((COL_W - 24) * named) / N)} height={10} rx={5} fill="var(--ib-bad)" />
                {/* attacker 2 */}
                <foreignObject x={x0 + 10} y={480} width={COL_W - 20} height={60}><div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{T.attacker2}</div></foreignObject>
                <text x={x0 + 12} y={560} style={{ fontSize: 17, fontWeight: 700, fill: badGuess ? 'var(--ib-bad)' : 'var(--accent)' }}>{`${badGuess ? '✗' : '✓'} ${T.guess} ${pct(guess)}`}</text>
                <rect x={x0 + 12} y={570} width={COL_W - 24} height={10} rx={5} fill="var(--accent-soft)" stroke="var(--line-strong)" />
                <rect x={x0 + 12} y={570} width={(COL_W - 24) * guess} height={10} rx={5} fill={badGuess ? 'var(--ib-bad)' : 'var(--accent)'} style={{ transition: 'width .3s' }} />
                <line x1={x0 + 12 + (COL_W - 24) * 0.5} y1={566} x2={x0 + 12 + (COL_W - 24) * 0.5} y2={584} stroke="var(--fg)" strokeWidth={2} />
                {/* the accuracy that is left */}
                <text x={x0 + 12} y={604} className="ib-s" style={{ fontSize: 13 }}>{measured ? `${T.salary}: ${T.error} ${pct(st.salaryErr)}` : T.notMeasured}</text>
                <text x={x0 + 12} y={624} className="ib-s" style={{ fontSize: 13 }}>{measured ? `${T.count}: ${T.error} ${pct(st.dxErr)}` : ''}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="viz-now" style={{ margin: '8px 0' }}><span><strong>{T.concl(String(e), pct(DIFF[eps]))}</strong></span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
