import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';

// Shows:      the same three areas (HEAD, index, working tree) before and after git reset HEAD~1, for the three options. Pick an option and the
//             "after" row changes: the cells that moved are filled, the cells that stayed are plain.
// Because:    the three options differ by how many of the three areas they take back one commit. A table says it, but seeing the file lines
//             "1, 2, 3" stay in one cell and disappear from another is what makes it stick.
// Control:    the option buttons --soft, --mixed, --hard. Each one gives a different "after" row and a different pair of diff lines.
// Conclusion: soft moves only HEAD, mixed moves HEAD and the index, hard moves all three, and the old commit stays in every case.
//
// Follows exercises/08_rewriting_history.py: three commits C1 ("1"), C2 ("1","2"), C3 ("1","2","3") and reset HEAD~1 in the three modes.
// The staged and unstaged lines are the ones that exercise prints: soft leaves a.txt staged, mixed leaves it unstaged, hard leaves nothing.

type Mode = 'soft' | 'mixed' | 'hard';
const BEFORE = { head: ['1', '2', '3'], idx: ['1', '2', '3'], wt: ['1', '2', '3'] };
const AFTER: Record<Mode, { head: string[]; idx: string[]; wt: string[]; staged: boolean; unstaged: boolean }> = {
  soft: { head: ['1', '2'], idx: ['1', '2', '3'], wt: ['1', '2', '3'], staged: true, unstaged: false },
  mixed: { head: ['1', '2'], idx: ['1', '2'], wt: ['1', '2', '3'], staged: false, unstaged: true },
  hard: { head: ['1', '2'], idx: ['1', '2'], wt: ['1', '2'], staged: false, unstaged: false },
};

const TEXT: Record<Lang, {
  title: string; pick: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; cols: [string, string][]; before: string; after: string;
  rows: Record<Mode, string>; staged: string; unstaged: string; none: string; moved: string; caption: string; keep: string; headAt: [string, string];
}> = {
  th: {
    title: 'เลือกตัวเลือกของ git reset แล้วดูว่าสามพื้นที่ ถอยไปหนึ่ง Commit กี่พื้นที่ และการแก้ของ Commit ที่ถอยออกไปค้างอยู่ที่ไหน',
    pick: 'ตัวเลือก',
    legend: [{ kind: 'new', text: 'พื้นที่ที่ถอยตาม' }, { kind: 'use', text: 'พื้นที่ที่ไม่ขยับ' }],
    cols: [['HEAD', 'Commit ที่ Branch ชี้'], ['Index', 'ที่พักก่อน Commit'], ['Working Tree', 'ไฟล์ในโฟลเดอร์']],
    before: 'ก่อน reset', after: 'หลัง git reset',
    rows: { soft: 'ถอยเฉพาะ HEAD', mixed: 'ถอย HEAD และ Index', hard: 'ถอยทั้งสามพื้นที่' },
    staged: 'git diff --staged', unstaged: 'git diff', none: 'ว่างเปล่า', moved: 'a.txt ที่แก้', caption: 'ผลของทั้งสามแบบ (บรรทัดในไฟล์ และสิ่งที่ค้างใน Index หรือ Working Tree) มาจากแบบฝึก 08 ส่วนชื่อ C1 ถึง C3 และเนื้อไฟล์ 1, 2, 3 เป็นตัวอย่างที่แบบฝึกใช้', keep: 'C3 ยังอยู่ใน Object Store และ Git จำตำแหน่งไว้ใน ORIG_HEAD', headAt: ['C3', 'C2'],
  },
  en: {
    title: 'Pick an option of git reset and see how many of the three areas step back one commit, and where the change of the commit we stepped back from is left',
    pick: 'Option',
    legend: [{ kind: 'new', text: 'an area that stepped back' }, { kind: 'use', text: 'an area that did not move' }],
    cols: [['HEAD', 'the commit the branch points at'], ['Index', 'the parking place'], ['Working tree', 'the files in the folder']],
    before: 'before reset', after: 'after git reset',
    rows: { soft: 'only HEAD steps back', mixed: 'HEAD and the index step back', hard: 'all three areas step back' },
    staged: 'git diff --staged', unstaged: 'git diff', none: 'empty', moved: 'edited a.txt', caption: 'The results of the three options (the lines of the file, and what is left in the index or the working tree) come from exercise 08. The names C1 to C3 and the file lines 1, 2, 3 are the example the exercise uses.', keep: 'C3 is still in the object store, and Git notes where it was in ORIG_HEAD', headAt: ['C3', 'C2'],
  },
};

const COLX = [20, 306, 592];
const CW = 268;

export default function ResetLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('mixed');
  const a = AFTER[mode];
  const cell = (x: number, y: number, lines: string[], cls: string, label?: string) => (
    <g>
      <rect className={cls} x={x} y={y} width={CW} height={104} rx={10} />
      {label && <text x={x + 14} y={y + 26} className="ib-m">{label}</text>}
      {lines.map((l, i) => <text key={i} x={x + 14 + i * 56} y={y + 74} className="ib-n" style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24 }}>{l}</text>)}
    </g>
  );
  const cells: [string[], string[]][] = [[BEFORE.head, a.head], [BEFORE.idx, a.idx], [BEFORE.wt, a.wt]];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {(['soft', 'mixed', 'hard'] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>--{m}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          {T.cols.map(([plain, tech], i) => (
            <g key={plain}>
              <text x={COLX[i]} y={30} className="ib-n" style={{ fontSize: 18, fontWeight: 700 }}>{plain}</text>
              <text x={COLX[i]} y={52} className="ib-s">{tech}</text>
            </g>
          ))}
          <text x={16} y={86} className="ib-s">{T.before}</text>
          {cells.map(([b], i) => cell(COLX[i], 94, b, 'ib-use', i === 0 ? T.headAt[0] : undefined))}
          <text x={16} y={236} className="ib-m" style={{ fontSize: 17 }}>{`$ git reset --${mode} HEAD~1`}</text>
          <text x={16} y={264} className="ib-s">{T.after}</text>
          {cells.map(([b, af], i) => cell(COLX[i], 272, af, b.join() === af.join() ? 'ib-use' : 'ib-new', i === 0 ? T.headAt[1] : undefined))}
          <text x={16} y={402} className="ib-n" style={{ fontWeight: 700 }}>{T.rows[mode]}</text>

          <rect className="ib-zone" x={16} y={412} width={848} height={50} rx={10} />
          <text x={30} y={443} className="ib-m">{T.staged}</text>
          <text x={210} y={443} className="ib-n ib-acc">{a.staged ? T.moved : T.none}</text>
          <text x={440} y={443} className="ib-m">{T.unstaged}</text>
          <text x={560} y={443} className="ib-n ib-acc">{a.unstaged ? T.moved : T.none}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.keep}. {T.caption}</figcaption>
    </figure>
  );
}
