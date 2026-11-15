import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';

// Shows:      one file, notes.txt, in the three places Git keeps it (working tree, index, repository) while the reader steps through
//             create, add, commit, edit, add again, edit again and commit. The two letters of git status --short change with it.
// Because:    "git add copies, git commit takes the copy" and "MM" are statements about three copies of one file. A table cannot show
//             that the commit takes the copy in the middle and leaves the newest edit behind.
// Control:    the step buttons. Every step changes at least one of the three columns or the status line.
// Conclusion: a commit holds what was in the index at that moment, not what is in the file now.
//
// Follows exercises/01_first_commit.py: the ids 41d3c6b and 66df49b are the ones that exercise asserts, the file holds hello, then
// hello and world, then (only in the working tree) hello, world and again.

interface Commit { id: string; lines: string[] }
interface View { cmd: string; wt: string[] | null; idx: string[] | null; commits: Commit[]; changed: ('wt' | 'idx' | 'repo')[] }

const C1: Commit = { id: '41d3c6b', lines: ['hello'] };
const C2: Commit = { id: '66df49b', lines: ['hello', 'world'] };
const VIEWS: View[] = [
  { cmd: '$ git init', wt: null, idx: null, commits: [], changed: [] },
  { cmd: '$ echo hello > notes.txt', wt: ['hello'], idx: null, commits: [], changed: ['wt'] },
  { cmd: '$ git add notes.txt', wt: ['hello'], idx: ['hello'], commits: [], changed: ['idx'] },
  { cmd: '$ git commit -m "Add notes"', wt: ['hello'], idx: ['hello'], commits: [C1], changed: ['repo'] },
  { cmd: '$ echo world >> notes.txt', wt: ['hello', 'world'], idx: ['hello'], commits: [C1], changed: ['wt'] },
  { cmd: '$ git add notes.txt', wt: ['hello', 'world'], idx: ['hello', 'world'], commits: [C1], changed: ['idx'] },
  { cmd: '$ echo again >> notes.txt', wt: ['hello', 'world', 'again'], idx: ['hello', 'world'], commits: [C1], changed: ['wt'] },
  { cmd: '$ git commit -m "Add world"', wt: ['hello', 'world', 'again'], idx: ['hello', 'world'], commits: [C1, C2], changed: ['repo'] },
];

const same = (a: string[] | null, b: string[] | null) => (a === null || b === null ? a === b : a.join('|') === b.join('|'));
function status(v: View): string {
  const head = v.commits.length ? v.commits[v.commits.length - 1].lines : null;
  if (v.wt && !v.idx && !head) return '??';
  if (!v.idx) return '  ';
  const x = head === null ? 'A' : same(v.idx, head) ? ' ' : 'M';
  const y = same(v.wt, v.idx) ? ' ' : 'M';
  return x + y;
}

const TEXT: Record<Lang, {
  title: string; cols: [string, string][]; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; empty: string; none: string;
  statusLabel: string; clean: string; meaning: Record<string, string>; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'ไฟล์เดียว อยู่ได้สามที่ กดทีละขั้นแล้วดูว่า git add กับ git commit คัดลอกมันไปไว้ที่ไหน และสองตัวอักษรของ git status เปลี่ยนตาม',
    cols: [['โฟลเดอร์ที่เราแก้', 'Working Tree'], ['ที่พักก่อน Commit', 'Index'], ['ประวัติที่เก็บไว้', 'Repository']],
    legend: [{ kind: 'new', text: 'เพิ่งเปลี่ยนในขั้นนี้' }, { kind: 'use', text: 'มีอยู่' }, { kind: 'node', text: 'ยังไม่มี' }],
    empty: 'ยังว่าง', none: 'ไม่มี Commit',
    statusLabel: 'git status --short', clean: 'ว่างเปล่า',
    meaning: {
      '??': 'Git ยังไม่รู้จักไฟล์นี้', 'A ': 'เพิ่มเข้า Index แล้ว รอ Commit', '  ': 'ทั้งสามที่ตรงกัน', ' M': 'แก้แล้วแต่ยังไม่ได้ git add', 'M ': 'git add ไว้แล้ว รอ Commit', 'MM': 'git add ไปแล้ว แต่หลังจากนั้นแก้ต่ออีก',
    },
    steps: [
      { name: 'เริ่ม', title: 'git init ยังไม่มีอะไรเลย', text: 'โฟลเดอร์ว่าง ยังไม่มี Commit และ git status ว่างเปล่า' },
      { name: 'สร้างไฟล์', title: 'สร้าง notes.txt ที่เขียนว่า hello', text: 'ไฟล์อยู่ใน Working Tree เท่านั้น Git เห็นมันแต่ยังไม่รู้จัก จึงขึ้น ?? และ Index ว่างเปล่า' },
      { name: 'git add', title: 'git add คัดลอกเนื้อหาเข้า Index', text: 'ตอนนี้ Index มีสำเนา hello (ID ce01362...) สถานะขึ้น A เพราะเป็นไฟล์ใหม่ที่อยู่ใน Index แล้ว' },
      { name: 'git commit', title: 'git commit เอาของใน Index ไปสร้าง Commit', text: 'เกิด Commit 41d3c6b ที่เก็บ hello ทั้งสามที่ตรงกัน git status จึงว่างเปล่า' },
      { name: 'แก้ไฟล์', title: 'แก้ไฟล์ให้มีบรรทัด world', text: 'มีแต่ Working Tree ที่เปลี่ยน Index กับ Commit ยังเป็น hello สถานะขึ้น M ที่ตัวที่สอง (แก้แล้วแต่ยังไม่ add)' },
      { name: 'git add', title: 'git add อีกครั้ง', text: 'Index ได้สำเนา hello กับ world สถานะ M ย้ายไปอยู่ตัวแรก แปลว่า Index ต่างจาก Commit ล่าสุดและรอ Commit' },
      { name: 'แก้อีก', title: 'แก้ต่ออีกบรรทัด again โดยยังไม่ add', text: 'สองสิ่งต่างกันพร้อมกัน Working Tree ต่างจาก Index และ Index ต่างจาก Commit จึงขึ้น MM' },
      { name: 'git commit', title: 'Commit เก็บของใน Index ไม่ใช่ของในไฟล์', text: 'Commit 66df49b เก็บ hello กับ world เท่านั้น บรรทัด again ไม่ได้ติดไปเพราะไม่เคยอยู่ใน Index มันยังค้างใน Working Tree และสถานะเหลือ M ตัวที่สอง' },
    ],
    caption: 'ลำดับคำสั่ง ID ของสอง Commit (41d3c6b, 66df49b) และสถานะ ?? A M MM มาจากแบบฝึก 01 ส่วนชื่อโฟลเดอร์และสำเนาในภาพเป็นการวาดให้เห็นภาพ',
  },
  en: {
    title: 'One file, three places. Step through and see where git add and git commit copy it, and how the two letters of git status change',
    cols: [['The folder we edit', 'Working tree'], ['Parking place', 'Index'], ['The kept history', 'Repository']],
    legend: [{ kind: 'new', text: 'changed in this step' }, { kind: 'use', text: 'present' }, { kind: 'node', text: 'not there yet' }],
    empty: 'still empty', none: 'no commit',
    statusLabel: 'git status --short', clean: 'empty',
    meaning: {
      '??': 'Git does not know this file yet', 'A ': 'added to the index, waiting for a commit', '  ': 'all three places agree', ' M': 'edited, not yet added', 'M ': 'added, waiting for a commit', 'MM': 'added, and then edited again',
    },
    steps: [
      { name: 'start', title: 'git init: nothing yet', text: 'An empty folder, no commit, and git status is empty.' },
      { name: 'create', title: 'Create notes.txt that says hello', text: 'The file is in the working tree only. Git can see it but does not know it, so it shows ??, and the index is empty.' },
      { name: 'git add', title: 'git add copies the content into the index', text: 'The index now has a copy of hello (id ce01362...). The status shows A, a new file that is in the index.' },
      { name: 'git commit', title: 'git commit builds a commit from the index', text: 'Commit 41d3c6b holds hello, and all three places agree, so git status is empty.' },
      { name: 'edit', title: 'Edit the file to add the line world', text: 'Only the working tree changes. The index and the commit still say hello. The status shows M in the second letter (edited, not added).' },
      { name: 'git add', title: 'git add again', text: 'The index gets a copy of hello and world. The M moves to the first letter, which means the index differs from the latest commit and waits to be committed.' },
      { name: 'edit again', title: 'Edit once more to add the line again, without add', text: 'Two differences at once: the working tree differs from the index, and the index differs from the commit. So it shows MM.' },
      { name: 'git commit', title: 'A commit keeps what is in the index, not what is in the file', text: 'Commit 66df49b holds only hello and world. The line again did not go with it, because it was never in the index. It stays in the working tree and the status is M in the second letter.' },
    ],
    caption: 'The order of commands, the ids of the two commits (41d3c6b, 66df49b) and the statuses ?? A M MM come from exercise 01. The folder names and the copies in the picture are drawn to give a picture.',
  },
};

const COLX = [20, 324, 628];
const CW = 232;

export default function ThreeAreasLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 4800);
  const v = VIEWS[step];
  const code = status(v);
  const shown = code === '  ' ? T.clean : code;

  const File = ({ x, lines, changed, y = 110, h = 130 }: { x: number; lines: string[] | null; changed: boolean; y?: number; h?: number }) => (
    <g>
      <rect className={lines ? (changed ? 'ib-new' : 'ib-use') : 'ib-node'} x={x} y={y} width={CW} height={h} rx={10} style={lines ? undefined : { strokeDasharray: '6 5', opacity: 0.55 }} />
      {lines ? (
        <>
          <text x={x + 14} y={y + 28} className="ib-m">notes.txt</text>
          {lines.map((l, i) => <text key={l} x={x + 14} y={y + 62 + i * 26} className="ib-n" style={{ fontFamily: 'var(--mono, monospace)' }}>{l}</text>)}
        </>
      ) : (
        <text x={x + CW / 2} y={y + h / 2 + 6} textAnchor="middle" className="ib-s">{T.empty}</text>
      )}
    </g>
  );

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 430" role="img" aria-label={T.title}>
          <text x={16} y={24} className="ib-m" style={{ fontSize: 17 }}>{v.cmd}</text>
          {T.cols.map(([plain, tech], i) => (
            <g key={tech}>
              <text x={COLX[i]} y={60} className="ib-n" style={{ fontSize: 18 }}>{plain}</text>
              <text x={COLX[i]} y={84} className="ib-m">{tech}</text>
            </g>
          ))}
          <File x={COLX[0]} lines={v.wt} changed={v.changed.includes('wt')} />
          <File x={COLX[1]} lines={v.idx} changed={v.changed.includes('idx')} />
          {v.commits.length === 0 ? (
            <File x={COLX[2]} lines={null} changed={false} />
          ) : (
            v.commits.map((c, i) => (
              <g key={c.id}>
                <rect className={i === v.commits.length - 1 && v.changed.includes('repo') ? 'ib-new' : 'ib-use'} x={COLX[2]} y={110 + i * 98} width={CW} height={88} rx={10} />
                <text x={COLX[2] + 14} y={110 + i * 98 + 28} className="ib-m" style={{ fontWeight: 700 }}>{c.id}</text>
                <text x={COLX[2] + 14} y={110 + i * 98 + 56} className="ib-n" style={{ fontFamily: 'var(--mono, monospace)' }}>{c.lines.join(' + ')}</text>
              </g>
            ))
          )}
          <path className="ib-arrow" d={`M${COLX[0] + CW + 4},175 L${COLX[1] - 6},175`} />
          <path className="ib-arrow" d={`M${COLX[1] + CW + 4},175 L${COLX[2] - 6},175`} />
          <text x={COLX[0] + CW + 36} y={160} className="ib-s" textAnchor="middle">add</text>
          <text x={COLX[1] + CW + 36} y={160} className="ib-s" textAnchor="middle">commit</text>

          <rect className="ib-zone" x={16} y={350} width={848} height={70} rx={12} />
          <text x={32} y={378} className="ib-s">{T.statusLabel}</text>
          <text x={32} y={406} className="ib-n ib-acc" style={{ fontFamily: 'var(--mono, monospace)', fontSize: 22, whiteSpace: 'pre' }}>{shown === T.clean ? shown : `${shown} notes.txt`}</text>
          <text x={300} y={406} className="ib-n">{T.meaning[code]}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
