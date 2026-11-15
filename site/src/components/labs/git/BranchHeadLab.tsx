import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';

// Shows:      commits as dots, branches as labels that point at a dot, and HEAD as a pointer that points either at a branch label
//             or (detached) straight at a dot. The reader steps through branch, switch, commit, switch back, detach, commit,
//             switch away and rescue.
// Because:    "a commit moves only the branch HEAD points at" and "a commit made while detached has no name" are about which pointer
//             moves. Seeing the label jump while the dots stay is the idea.
// Control:    the step buttons. Every step moves a label, moves HEAD, or adds a dot.
// Conclusion: branches are names for commits; HEAD says which name we are on; a commit nobody names is still there but easy to lose.
//
// Follows exercises/03_branches.py (branch, switch, commit on feature, detach at c1, commit c5, switch main, branch rescue c5).
// The names c1 to c5 are drawn names, the exercise asserts the behaviour and not these labels.

interface Pos { x: number; y: number }
const POS: Record<string, Pos> = { c1: { x: 110, y: 190 }, c2: { x: 290, y: 190 }, c3: { x: 480, y: 190 }, c5: { x: 230, y: 310 } };
const PARENT: Record<string, string> = { c2: 'c1', c3: 'c2', c5: 'c1' };

interface View { cmd: string; commits: string[]; branches: Record<string, string>; head: { branch?: string; commit?: string } }
const VIEWS: View[] = [
  { cmd: '$ git log --oneline', commits: ['c1', 'c2'], branches: { main: 'c2' }, head: { branch: 'main' } },
  { cmd: '$ git branch feature', commits: ['c1', 'c2'], branches: { main: 'c2', feature: 'c2' }, head: { branch: 'main' } },
  { cmd: '$ git switch feature', commits: ['c1', 'c2'], branches: { main: 'c2', feature: 'c2' }, head: { branch: 'feature' } },
  { cmd: '$ git commit', commits: ['c1', 'c2', 'c3'], branches: { main: 'c2', feature: 'c3' }, head: { branch: 'feature' } },
  { cmd: '$ git switch main', commits: ['c1', 'c2', 'c3'], branches: { main: 'c2', feature: 'c3' }, head: { branch: 'main' } },
  { cmd: '$ git switch --detach c1', commits: ['c1', 'c2', 'c3'], branches: { main: 'c2', feature: 'c3' }, head: { commit: 'c1' } },
  { cmd: '$ git commit', commits: ['c1', 'c2', 'c3', 'c5'], branches: { main: 'c2', feature: 'c3' }, head: { commit: 'c5' } },
  { cmd: '$ git switch main', commits: ['c1', 'c2', 'c3', 'c5'], branches: { main: 'c2', feature: 'c3' }, head: { branch: 'main' } },
  { cmd: '$ git branch rescue c5', commits: ['c1', 'c2', 'c3', 'c5'], branches: { main: 'c2', feature: 'c3', rescue: 'c5' }, head: { branch: 'main' } },
];

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; lost: string; banners: string[]; steps: StepInfo[]; caption: string }> = {
  th: {
    title: 'Branch คือป้ายที่ชี้ Commit และ HEAD คือสิ่งที่บอกว่าเราอยู่ที่ป้ายไหน กดทีละขั้นแล้วดูว่าอะไรขยับตอน Commit',
    legend: [{ kind: 'use', text: 'Commit ที่มีป้ายชี้ถึง' }, { kind: 'skip', text: 'Commit ที่ไม่มีป้ายไหนชี้ถึง' }, { kind: 'new', text: 'เพิ่งเกิดในขั้นนี้' }],
    lost: 'ไม่มีป้ายชี้ถึง',
    banners: [],
    steps: [
      { name: 'เริ่ม', title: 'main ชี้ c2 และ HEAD ชี้ main', text: 'มีสอง Commit Branch main ชี้ที่ c2 ไฟล์ HEAD ไม่ได้เก็บชื่อ Commit แต่เก็บชื่อ Branch ที่เราอยู่' },
      { name: 'git branch', title: 'สร้าง feature ที่ c2', text: 'คำสั่งแค่สร้างไฟล์ป้ายใหม่ที่ชี้ Commit เดียวกับ main ไม่มี Commit ใหม่ และ HEAD ยังชี้ main' },
      { name: 'git switch', title: 'สลับไป feature: HEAD ย้าย', text: 'HEAD เปลี่ยนไปชี้ feature ตอนนี้ป้ายสองอันอยู่ที่ Commit เดียวกัน แต่เราอยู่ที่ feature' },
      { name: 'git commit', title: 'Commit ขยับเฉพาะ feature', text: 'เกิด Commit ใหม่ c3 ป้ายที่ HEAD ชี้อยู่ (feature) ย้ายตามไป ส่วน main ยังอยู่ที่ c2' },
      { name: 'switch main', title: 'สลับกลับ main', text: 'HEAD ชี้ main ไฟล์ของ c3 หายจากโฟลเดอร์ เพราะ Git เปลี่ยนไฟล์ให้ตรงกับ Snapshot ของ c2 แต่ c3 ไม่ได้หายไปไหน' },
      { name: 'detach', title: 'git switch --detach c1: HEAD ชี้ Commit ตรง ๆ', text: 'คราวนี้ HEAD ไม่ได้ชี้ป้าย แต่ชี้ c1 ตรง ๆ ที่เรียกว่า Detached HEAD' },
      { name: 'commit ตอน detach', title: 'Commit ตอน Detached ไม่มีป้ายตาม', text: 'เกิด c5 ต่อจาก c1 HEAD ย้ายไป c5 แต่ไม่มี Branch ไหนขยับเลย' },
      { name: 'switch main', title: 'สลับออกไป c5 ไม่มีชื่อชี้ถึงแล้ว', text: 'พอ HEAD ออกไป ไม่มีอะไรชี้ถึง c5 เหลืออยู่ Commit ยังอยู่ใน Repository แต่ถ้าไม่จำชื่อมัน ก็หาไม่เจอ' },
      { name: 'rescue', title: 'git branch rescue c5 เก็บมันไว้', text: 'สร้าง Branch จากชื่อ Commit แล้ว c5 กลับมามีป้ายชี้ถึง' },
    ],
    caption: 'พฤติกรรมในแต่ละขั้นมาจากแบบฝึก 03 ส่วนชื่อ c1 ถึง c5 เป็นชื่อที่เราวาดให้เห็นภาพ',
  },
  en: {
    title: 'A branch is a label that points at a commit, and HEAD says which label we are on. Step through and see what moves on a commit',
    legend: [{ kind: 'use', text: 'a commit a label points at' }, { kind: 'skip', text: 'a commit no label points at' }, { kind: 'new', text: 'made in this step' }],
    lost: 'no label points here',
    banners: [],
    steps: [
      { name: 'start', title: 'main points at c2 and HEAD points at main', text: 'Two commits. The branch main points at c2. The HEAD file does not hold a commit name, it holds the name of the branch we are on.' },
      { name: 'git branch', title: 'Make feature at c2', text: 'The command only creates a new label file that points at the same commit as main. No new commit, and HEAD still points at main.' },
      { name: 'git switch', title: 'Switch to feature: HEAD moves', text: 'HEAD now points at feature. Two labels sit on the same commit, but we are on feature.' },
      { name: 'git commit', title: 'A commit moves only feature', text: 'A new commit c3 appears. The label HEAD points at (feature) moves along. main stays at c2.' },
      { name: 'switch main', title: 'Switch back to main', text: 'HEAD points at main. The file of c3 disappears from the folder, because Git changes the files to match the snapshot of c2, but c3 has not gone anywhere.' },
      { name: 'detach', title: 'git switch --detach c1: HEAD points straight at a commit', text: 'This time HEAD does not point at a label. It points at c1 directly, which is called a detached HEAD.' },
      { name: 'commit while detached', title: 'A commit while detached has no label to follow', text: 'c5 appears on top of c1. HEAD moves to c5, but no branch moves.' },
      { name: 'switch main', title: 'Switch away: nothing names c5 now', text: 'Once HEAD leaves, nothing points at c5. The commit is still in the repository, but if we do not remember its name we cannot find it.' },
      { name: 'rescue', title: 'git branch rescue c5 keeps it', text: 'A branch made from the commit name gives c5 a label again.' },
    ],
    caption: 'What happens at each step comes from exercise 03. The names c1 to c5 are drawn to give a picture.',
  },
};

export default function BranchHeadLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 5200);
  const v = VIEWS[step];
  const prev = step > 0 ? VIEWS[step - 1] : null;
  function isAncestor(a: string, b: string): boolean {
    let cur: string | undefined = b;
    while (cur) { if (cur === a) return true; cur = PARENT[cur]; }
    return false;
  }
  const reachable = (c: string) => Object.values(v.branches).some((b) => isAncestor(c, b));

  const names = Object.entries(v.branches);
  const slot = (branch: string, commit: string) => {
    const same = names.filter(([, c]) => c === commit).map(([n]) => n).sort();
    return { i: same.indexOf(branch), n: same.length };
  };

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <text x={16} y={26} className="ib-m" style={{ fontSize: 17 }}>{v.cmd}</text>
          {v.commits.filter((c) => PARENT[c]).map((c) => (
            <path key={c} className="ib-line" d={`M${POS[PARENT[c]].x},${POS[PARENT[c]].y} L${POS[c].x},${POS[c].y}`} style={{ strokeWidth: 3, opacity: reachable(c) || v.head.commit === c ? 1 : 0.5 }} />
          ))}
          {v.commits.map((c) => {
            const isNew = !prev || !prev.commits.includes(c);
            const alive = reachable(c) || v.head.commit === c;
            return (
              <g key={c} style={alive ? undefined : { opacity: 0.6 }}>
                <circle className={isNew && step > 0 ? 'ib-new' : alive ? 'ib-use' : 'ib-skip'} cx={POS[c].x} cy={POS[c].y} r={28} />
                <text x={POS[c].x} y={POS[c].y + 6} textAnchor="middle" className="ib-n">{c}</text>
                {!alive && <text x={POS[c].x} y={POS[c].y + 52} textAnchor="middle" className="ib-s">{T.lost}</text>}
              </g>
            );
          })}
          {names.map(([b, c]) => {
            const { i, n } = slot(b, c);
            const w = 96;
            const cx = POS[c].x + (i - (n - 1) / 2) * (w + 8);
            const y = POS[c].y - 98;
            const headHere = v.head.branch === b;
            return (
              <g key={b}>
                <path className="ib-arrow" d={`M${cx},${y + 34} L${POS[c].x},${POS[c].y - 30}`} />
                <rect className={headHere ? 'ib-use' : 'ib-node'} x={cx - w / 2} y={y} width={w} height={34} rx={8} style={headHere ? { fill: 'var(--accent-soft)' } : undefined} />
                <text x={cx} y={y + 23} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{b}</text>
                {headHere && (
                  <g>
                    <path className="ib-arrow" d={`M${cx},${y - 22} L${cx},${y - 2}`} />
                    <rect className="ib-new" x={cx - 36} y={y - 52} width={72} height={30} rx={8} />
                    <text x={cx} y={y - 31} textAnchor="middle" className="ib-m" style={{ fontWeight: 700 }}>HEAD</text>
                  </g>
                )}
              </g>
            );
          })}
          {v.head.commit && (
            <g>
              <path className="ib-arrow" d={`M${POS[v.head.commit].x},${POS[v.head.commit].y + 74} L${POS[v.head.commit].x},${POS[v.head.commit].y + 34}`} />
              <rect className="ib-new" x={POS[v.head.commit].x - 36} y={POS[v.head.commit].y + 74} width={72} height={30} rx={8} />
              <text x={POS[v.head.commit].x} y={POS[v.head.commit].y + 95} textAnchor="middle" className="ib-m" style={{ fontWeight: 700 }}>HEAD</text>
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
