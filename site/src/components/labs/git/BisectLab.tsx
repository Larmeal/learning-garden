import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Commit, ease, mix } from './gl';
import data from './labData.json';

// Shows:      git bisect looking for the first bad commit among 16. A bracket covers the commits that could still be the culprit, Git tests the one
//             in the middle, the answer (good or bad) cuts the bracket in half, and after at most 4 answers one commit is left.
// Because:    "16 commits take 4 questions" is the halving of a range. Seeing the bracket shrink is what makes log2 obvious.
// Control:    the commit buttons choose which commit is really the first bad one (the reader knows the answer, Git does not); the clock plays the search.
// Conclusion: each answer throws away half of the range, so 16 commits need at most 4 answers and 1000 would need about 10.
//
// The commits Git tests, and the answers, come from exercises/16_lab_data.py: for every possible culprit the real git bisect was run.

type Path = { commit: number; verdict: 'good' | 'bad' }[];
const D = data.bisect;
const N = D.ids.length;
const STEP = 2.2;
const START = 1.2;

const TEXT: Record<Lang, { title: string; pick: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; good: string; bad: string; suspects: string; asks: (c: number) => string; range: (n: number) => string; found: (c: number) => string; caption: string; marks: (steps: Path, culprit: number) => Mark[] }> = {
  th: {
    title: 'Git หา Commit ที่ทำให้พังจาก 16 Commit ด้วยการถามไม่กี่ข้อ เลือกว่า Commit ไหนพังจริง แล้วกดเล่นดู Git ตัดช่วงลงครึ่งหนึ่งทุกคำตอบ',
    pick: 'Commit แรกที่พังคือ',
    legend: [{ kind: 'new', text: 'Commit ที่ Git กำลังให้ทดสอบ' }, { kind: 'use', text: 'ยังเป็นผู้ต้องสงสัย' }, { kind: 'skip', text: 'ตัดออกแล้ว' }],
    good: 'ผ่าน', bad: 'พัง', suspects: 'จำนวนผู้ต้องสงสัย',
    asks: (c) => `Git ให้ทดสอบ Commit ${c}`,
    range: (n) => `ผู้ต้องสงสัยเหลือ ${n} Commit`,
    found: (c) => `เจอแล้ว Commit ${c} คือ Commit แรกที่พัง`,
    caption: 'เครื่องหมาย ✓ คือทดสอบแล้วผ่าน ✗ คือทดสอบแล้วพัง Commit ที่ Git ให้ทดสอบและคำตอบของแต่ละข้อ มาจากการรัน git bisect จริงในแบบฝึก 16 สำหรับ Commit แรกที่พังแต่ละตัว (Commit 1 เป็นตัวที่ผ่านแน่นอน และ Commit 16 เป็นตัวที่พังแน่นอนตอนเริ่ม)',
    marks: (steps, culprit) => [
      { at: 0, name: 'เริ่ม', title: `มี 16 Commit รู้แค่ว่า Commit 1 ผ่านและ Commit 16 พัง`, text: `ตัวที่พังจริงคือ Commit ${culprit} แต่ Git ไม่รู้ ผู้ต้องสงสัยคือทุก Commit หลังจาก 1 ไปจนถึง 16` },
      ...steps.map((s, i) => ({
        at: START + i * STEP, name: `ถามข้อ ${i + 1}`, title: `ข้อ ${i + 1}: ทดสอบ Commit ${s.commit} ได้ผล${s.verdict === 'good' ? 'ผ่าน' : 'พัง'}`,
        text: s.verdict === 'good' ? `Commit ${s.commit} ยังผ่าน แปลว่าตัวที่พังต้องอยู่หลังจากนี้ ตัดครึ่งแรกทิ้งทั้งหมด` : `Commit ${s.commit} พังแล้ว แปลว่าตัวที่พังแรกคือ Commit นี้หรืออยู่ก่อนหน้า ตัดครึ่งหลังทิ้ง`,
      })),
      { at: START + steps.length * STEP, name: 'เจอแล้ว', title: `Commit ${culprit} คือตัวแรกที่พัง ใช้ ${steps.length} คำถาม`, text: `ผู้ต้องสงสัยเหลือตัวเดียว ถ้ามี 1,000 Commit ก็ใช้ราว 10 คำถาม เพราะทุกคำตอบตัดครึ่ง` },
    ],
  },
  en: {
    title: 'Git finds the commit that broke things among 16 by asking a few questions. Choose which commit is really the culprit, press play, and watch every answer cut the range in half',
    pick: 'The first bad commit is',
    legend: [{ kind: 'new', text: 'the commit Git asks us to test' }, { kind: 'use', text: 'still a suspect' }, { kind: 'skip', text: 'ruled out' }],
    good: 'good', bad: 'bad', suspects: 'Suspects',
    asks: (c) => `Git asks us to test commit ${c}`,
    range: (n) => `${n} suspect${n === 1 ? '' : 's'} left`,
    found: (c) => `Found it: commit ${c} is the first bad commit`,
    caption: 'A ✓ means the test passed and a ✗ means it failed. The commits Git asks us to test, and the answer to each, come from running the real git bisect in exercise 16 for every possible first bad commit (commit 1 is known to be good, and commit 16 is known to be bad at the start).',
    marks: (steps, culprit) => [
      { at: 0, name: 'start', title: 'There are 16 commits. We only know that commit 1 passes and commit 16 fails', text: `The real culprit is commit ${culprit}, but Git does not know. The suspects are every commit after 1, up to 16.` },
      ...steps.map((s, i) => ({
        at: START + i * STEP, name: `question ${i + 1}`, title: `Question ${i + 1}: commit ${s.commit} tested ${s.verdict}`,
        text: s.verdict === 'good' ? `Commit ${s.commit} still passes, so the culprit comes after it. The whole first half is ruled out.` : `Commit ${s.commit} fails, so the first bad commit is this one or an earlier one. The second half is ruled out.`,
      })),
      { at: START + steps.length * STEP, name: 'found', title: `Commit ${culprit} is the first bad one, after ${steps.length} questions`, text: 'One suspect is left. With 1,000 commits it would take about 10 questions, because every answer halves the range.' },
    ],
  },
};

export default function BisectLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [culprit, setCulprit] = useState(11);
  const steps = (D.paths as Record<string, Path>)[String(culprit)];
  const duration = START + steps.length * STEP + 2.2;
  const clock = useClock(duration);
  const { t } = clock;

  // state of the search at time t: which question we are in, and the range [lo, hi] (lo known good, hi known bad)
  let lo = 1, hi = N;
  let asked = -1; // index of the question that is open or just answered
  let answered = false;
  for (let i = 0; i < steps.length; i++) {
    if (t >= START + i * STEP) {
      asked = i;
      answered = t >= START + i * STEP + STEP * 0.55;
    }
  }
  const cuts: { lo: number; hi: number }[] = [];
  let l = 1, h = N;
  steps.forEach((s) => { if (s.verdict === 'good') l = s.commit; else h = s.commit; cuts.push({ lo: l, hi: h }); });
  const settled = asked >= 0 ? (answered ? asked : asked - 1) : -1;
  if (settled >= 0) { lo = cuts[settled].lo; hi = cuts[settled].hi; }
  const over = t >= START + steps.length * STEP + 0.4;
  const X = (i: number) => 40 + (i - 1) * 52;
  const nSuspects = hi - lo; // lo is known good and hi is known bad, so the first bad commit is one of lo+1 .. hi
  const stateOf = (i: number) => (i <= lo || i > hi ? 'out' : 'in');
  const testing = asked >= 0 && !over ? steps[asked].commit : -1;
  const verdictShown = (i: number) => {
    // a commit we already tested shows its answer
    const idx = steps.findIndex((s) => s.commit === i);
    if (idx < 0) return null;
    if (idx < asked || (idx === asked && answered)) return steps[idx].verdict;
    return null;
  };

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {Array.from({ length: N - 1 }, (_, k) => k + 2).map((c) => (
            <button key={c} type="button" aria-pressed={culprit === c} onClick={() => { setCulprit(c); clock.restart(); }}>{c}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 44 880 276" role="img" aria-label={T.title}>
          {/* the range that is still possible */}
          <rect className="ib-zone" x={X(lo + 1) - 28} y={96} width={X(hi) - X(lo + 1) + 56} height={110} rx={14} style={{ transition: 'all .5s' }} />
          <rect className="ib-zone-dash" x={X(lo + 1) - 28} y={96} width={X(hi) - X(lo + 1) + 56} height={110} rx={14} style={{ transition: 'all .5s' }} />
          {Array.from({ length: N }, (_, k) => k + 1).map((i) => {
            const st = stateOf(i);
            const v = verdictShown(i);
            const isTest = i === testing;
            const found = over && i === culprit;
            return (
              <g key={i}>
                <Commit x={X(i)} y={150} name={String(i)} r={19} kind={found ? 'new' : isTest ? 'new' : st === 'out' ? 'skip' : 'use'} op={st === 'out' && !found ? 0.55 : 1} />
                {v && <text x={X(i)} y={150 + 44} textAnchor="middle" className={v === 'good' ? 'ib-ok ib-n' : 'ib-bad ib-n'}>{v === 'good' ? '✓' : '✗'}</text>}
                {i === 1 && <text x={X(i)} y={150 + 44} textAnchor="middle" className="ib-ok ib-n">✓</text>}
                {i === N && !verdictShown(N) && <text x={X(i)} y={150 + 44} textAnchor="middle" className="ib-bad ib-n">✗</text>}
              </g>
            );
          })}
          {testing > 0 && (
            <g>
              <text x={X(testing)} y={70} textAnchor="middle" className="ib-n">{T.asks(testing)}</text>
            </g>
          )}
          <text x={X(lo + 1) - 28} y={232} className="ib-n" style={{ opacity: ease(t, 0, 0.8) }}>{over ? T.found(culprit) : T.range(nSuspects)}</text>
          <g>
            <rect className="ib-banner" x={12} y={256} width={856} height={50} rx={10} />
            <text x={26} y={287} className="ib-n">{`${T.suspects}: ${[N - 1, ...cuts.slice(0, Math.max(0, settled + 1)).map((c) => c.hi - c.lo)].join(' → ')}`}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(steps, culprit)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
