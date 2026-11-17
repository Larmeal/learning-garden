import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import data from './labData.json';

// Shows:      one pair of nine-line files and the diff that each of four algorithms writes for it. The lines that differ from the Myers answer
//             are marked, and the plus and minus counts sit above each answer.
// Because:    "a diff is one of several correct answers" cannot be taken on trust. Switching the algorithm and watching the same two files
//             produce a different list of lines is what makes the point.
// Control:    the four algorithm buttons. Each changes the diff column and the counts.
// Conclusion: all four diffs are correct (applying any of them gives the new file) but they are not the same, so the "change" you read is a choice.
//
// The pair of files is made up (it was found by a search over random files full of repeated lines, see exercise 13) and the four diffs are
// the output of git diff --diff-algorithm=<name> in exercises/16_lab_data.py.

type Algo = 'myers' | 'minimal' | 'patience' | 'histogram';
const D = data.diff;
const ALGOS: Algo[] = ['myers', 'minimal', 'patience', 'histogram'];

const TEXT: Record<Lang, { title: string; pick: string; old: string; neu: string; diff: string; blank: string; added: string; removed: string; same: string; differs: string; caption: string; note: Record<Algo, string> }> = {
  th: {
    title: 'ไฟล์สองฉบับเดิม แต่ Git เขียนผลต่างได้หลายแบบ เลือกอัลกอริทึมทีละตัวแล้วดูว่าบรรทัดไหนถูกนับว่าเพิ่มหรือลบ',
    pick: 'อัลกอริทึม', old: 'ฉบับเก่า', neu: 'ฉบับใหม่', diff: 'ผลต่างที่ได้', blank: '(บรรทัดว่าง)',
    added: 'บรรทัดเพิ่ม', removed: 'บรรทัดลบ', same: 'เหมือนผลของ Myers', differs: 'ต่างจากผลของ Myers',
    note: {
      myers: 'ค่าเริ่มต้นของ Git เป็นอัลกอริทึมแบบ Greedy ขั้นพื้นฐาน',
      minimal: 'เหมือน Myers แต่ยอมช้าลงเพื่อให้ได้จำนวนบรรทัดที่เปลี่ยนน้อยที่สุดจริง ๆ',
      patience: 'เริ่มจากบรรทัดที่ไม่ซ้ำกันเลยในทั้งสองไฟล์ ใช้เป็นหลักยึดแล้วค่อยเทียบส่วนที่เหลือ',
      histogram: 'ต่อยอดจาก Patience ให้รองรับบรรทัดที่เหมือนกันแต่เจอน้อยครั้ง',
    },
    caption: 'ไฟล์ทั้งสองเป็นของสมมติ ที่ผู้เขียนค้นเจอว่าอัลกอริทึมให้ผลต่างกัน (แบบฝึก 13) ส่วนผลต่างของแต่ละอัลกอริทึมเป็นผลของ git diff --diff-algorithm จริงในแบบฝึก 16 และผลทุกแบบเอาไปใช้กับไฟล์เก่าแล้วได้ไฟล์ใหม่เป๊ะ (แบบฝึก 13) ข้อความอธิบายของแต่ละอัลกอริทึมสรุปจากเอกสารของ Git ไม่ได้รันเทียบ',
  },
  en: {
    title: 'The same two files, but Git can write the difference several ways. Pick an algorithm and see which lines it counts as added or removed',
    pick: 'Algorithm', old: 'old file', neu: 'new file', diff: 'the diff', blank: '(blank line)',
    added: 'lines added', removed: 'lines removed', same: 'same as Myers', differs: 'differs from Myers',
    note: {
      myers: 'Git\'s default. It looks for the fewest changed lines it can find quickly.',
      minimal: 'Like Myers, but it takes longer to make sure the number of changed lines really is the smallest.',
      patience: 'Starts from lines that are unique in both files, uses them as anchors, then compares what is between them.',
      histogram: 'Extends patience to support common lines that occur only a few times.',
    },
    caption: 'The two files are made up, found by a search for a pair on which the algorithms disagree (exercise 13). The diff of each algorithm is the output of the real git diff --diff-algorithm in exercise 16, and each one applies cleanly to the old file to give exactly the new one (exercise 13). The one-line description of each algorithm is a summary of Git\'s documentation and was not run.',
  },
};

type Line = { t: string; s: string };
const key = (l: Line[]) => l.map((x) => x.t + x.s).join('\n');

export default function DiffLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [algo, setAlgo] = useState<Algo>('patience');
  const lines = D.algos[algo] as Line[];
  const myers = D.algos.myers as Line[];
  const plus = lines.filter((l) => l.t === '+').length;
  const minus = lines.filter((l) => l.t === '-').length;
  const equal = key(lines) === key(myers);
  const show = (s: string) => (s === '' ? T.blank : s);
  const rowH = 30;
  // which old and new lines each diff line stands for, so the picture can mark them in the two files
  let oi = 0, ni = 0;
  const marks = lines.map((l) => {
    const m = { old: l.t !== '+' ? oi : -1, neu: l.t !== '-' ? ni : -1 };
    if (l.t !== '+') oi++;
    if (l.t !== '-') ni++;
    return m;
  });
  const removedOld = new Set(marks.filter((m, i) => lines[i].t === '-').map((m) => m.old));
  const addedNew = new Set(marks.filter((m, i) => lines[i].t === '+').map((m) => m.neu));
  const col = (x: number, title: string, rows: string[], flagged: Set<number>, sign: string) => (
    <g>
      <text x={x} y={30} className="ib-t">{title}</text>
      {rows.map((r, i) => (
        <g key={i}>
          <rect className={flagged.has(i) ? 'ib-new' : 'ib-node'} x={x} y={46 + i * rowH} width={190} height={rowH - 5} rx={6} style={flagged.has(i) ? { stroke: sign === '-' ? 'var(--ib-bad)' : 'var(--accent)' } : undefined} />
          <text x={x + 10} y={46 + i * rowH + 18} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14.5 }}>{`${i + 1}  ${show(r)}`}</text>
          {flagged.has(i) && <text x={x + 178} y={46 + i * rowH + 19} textAnchor="end" className={sign === '-' ? 'ib-bad ib-n' : 'ib-ok ib-n'}>{sign}</text>}
        </g>
      ))}
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick}>
          {ALGOS.map((a) => (
            <button key={a} type="button" aria-pressed={algo === a} onClick={() => setAlgo(a)}>{a}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          {col(16, T.old, D.old, removedOld, '-')}
          {col(246, T.neu, D.new, addedNew, '+')}
          <text x={476} y={30} className="ib-t">{T.diff}</text>
          {lines.map((l, i) => (
            <g key={`${algo}-${i}`} className="gl-pop" style={{ animation: `gitlight .35s ease ${i * 0.05}s both` }}>
              <rect className="ib-node" x={476} y={46 + i * (rowH - 4)} width={388} height={rowH - 8} rx={6} style={l.t === '+' ? { fill: 'var(--accent-soft)', stroke: 'var(--accent)' } : l.t === '-' ? { stroke: 'var(--ib-bad)', strokeWidth: 2.5 } : undefined} />
              <text x={486} y={46 + i * (rowH - 4) + 17} className={l.t === '-' ? 'ib-m ib-bad' : 'ib-m'} style={{ fill: l.t === '-' ? 'var(--ib-bad)' : 'var(--fg)', fontSize: 14.5, fontWeight: l.t === ' ' ? 400 : 700 }}>{`${l.t === ' ' ? ' ' : l.t}  ${show(l.s)}`}</text>
            </g>
          ))}
          <g>
            <rect className="ib-banner" x={12} y={338} width={856} height={34} rx={10} />
            <text x={26} y={361} className="ib-n">{`+${plus}  −${minus}   ${equal ? T.same : T.differs}`}</text>
          </g>
        </svg>
      </div>
      <div className="readout">{T.note[algo]}</div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
