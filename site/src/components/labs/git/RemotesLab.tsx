import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';

// Shows:      three repositories side by side (Alice, the shared origin, Bob), each with its own commits, its branch main and its memory of the
//             remote (origin/main). The reader steps through push, clone, a second push, fetch, merge, a rejected push, pull and a push that works.
// Because:    fetch moving only "origin/main", and a push being refused because the remote has a commit we do not, are statements about
//             which label sits on which commit in which repository. A sentence cannot show three copies at once.
// Control:    the step buttons. Every step adds a commit or moves a label in one of the three repositories.
// Conclusion: origin/main is only our memory of where origin was. Fetch updates that memory, merge moves main, and a push needs main to contain what origin has.
//
// Follows exercises/06_remotes.py in the same order (push -u, clone, push, fetch, merge, push rejected with "fetch first", pull, push).
// The commit names A1, A2, A3, B1 and M are drawn names.

type Repo = { commits: string[]; main?: string; remote?: string; exists: boolean };
interface View { cmd: string; rejected?: boolean; alice: Repo; origin: Repo; bob: Repo }
const NONE: Repo = { commits: [], exists: false };
const R = (commits: string[], main?: string, remote?: string): Repo => ({ commits, main, remote, exists: true });

const VIEWS: View[] = [
  { cmd: 'Alice  $ git commit', alice: R(['A1'], 'A1'), origin: R([]), bob: NONE },
  { cmd: 'Alice  $ git push -u origin main', alice: R(['A1'], 'A1', 'A1'), origin: R(['A1'], 'A1'), bob: NONE },
  { cmd: 'Bob  $ git clone', alice: R(['A1'], 'A1', 'A1'), origin: R(['A1'], 'A1'), bob: R(['A1'], 'A1', 'A1') },
  { cmd: 'Alice  $ git commit; git push', alice: R(['A1', 'A2'], 'A2', 'A2'), origin: R(['A1', 'A2'], 'A2'), bob: R(['A1'], 'A1', 'A1') },
  { cmd: 'Bob  $ git fetch', alice: R(['A1', 'A2'], 'A2', 'A2'), origin: R(['A1', 'A2'], 'A2'), bob: R(['A1', 'A2'], 'A1', 'A2') },
  { cmd: 'Bob  $ git merge origin/main', alice: R(['A1', 'A2'], 'A2', 'A2'), origin: R(['A1', 'A2'], 'A2'), bob: R(['A1', 'A2'], 'A2', 'A2') },
  { cmd: 'Alice  $ git commit; git push', alice: R(['A1', 'A2', 'A3'], 'A3', 'A3'), origin: R(['A1', 'A2', 'A3'], 'A3'), bob: R(['A1', 'A2'], 'A2', 'A2') },
  { cmd: 'Bob  $ git commit; git push', rejected: true, alice: R(['A1', 'A2', 'A3'], 'A3', 'A3'), origin: R(['A1', 'A2', 'A3'], 'A3'), bob: R(['A1', 'A2', 'B1'], 'B1', 'A2') },
  { cmd: 'Bob  $ git pull', alice: R(['A1', 'A2', 'A3'], 'A3', 'A3'), origin: R(['A1', 'A2', 'A3'], 'A3'), bob: R(['A1', 'A2', 'A3', 'B1', 'M'], 'M', 'A3') },
  { cmd: 'Bob  $ git push', alice: R(['A1', 'A2', 'A3'], 'A3', 'A3'), origin: R(['A1', 'A2', 'A3', 'B1', 'M'], 'M'), bob: R(['A1', 'A2', 'A3', 'B1', 'M'], 'M', 'M') },
];

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; who: [string, string][]; absent: string; rejected: string; steps: StepInfo[]; caption: string }> = {
  th: {
    title: 'สามที่ ได้แก่ Alice, Origin และ Bob กดทีละขั้นแล้วดูว่า Fetch ขยับเฉพาะ origin/main และทำไม Push ถึงถูกปฏิเสธ',
    legend: [{ kind: 'new', text: 'Commit ที่เพิ่งเกิดหรือเพิ่งมาถึง' }, { kind: 'use', text: 'Commit เดิม' }, { kind: 'node', text: 'ป้ายชื่อ Branch' }],
    who: [['Alice', 'คอมพิวเตอร์ของ Alice'], ['Origin', 'Bare Repository'], ['Bob', 'คอมพิวเตอร์ของ Bob']],
    absent: 'ยังไม่มี', rejected: '✗ Push ถูกปฏิเสธ (fetch first)',
    steps: [
      { name: 'Commit', title: 'Alice มี Commit แรก', text: 'Alice มี A1 ใน Repository ของเธอ Origin ยังว่าง และ Bob ยังไม่มีอะไร' },
      { name: 'push -u', title: 'Alice Push ขึ้น Origin', text: 'Origin ได้ A1 และ main ของมันชี้ A1 ฝั่ง Alice ได้ป้าย origin/main ชี้ A1 เป็นความจำว่า Origin อยู่ตรงไหน' },
      { name: 'clone', title: 'Bob Clone', text: 'Bob ได้ประวัติทั้งหมดจาก Origin พร้อม main และ origin/main ที่ชี้ A1' },
      { name: 'Alice Push', title: 'Alice ทำ A2 แล้ว Push', text: 'Origin ได้ A2 แต่ Bob ยังไม่รู้ origin/main ของ Bob ยังชี้ A1 เพราะเป็นแค่ความจำ ไม่ได้อัปเดตเอง' },
      { name: 'fetch', title: 'Bob Fetch: origin/main ขยับ', text: 'A2 มาถึงคอมพิวเตอร์ของ Bob และ origin/main ชี้ A2 แต่ main ของ Bob ยังอยู่ที่ A1 (ตามหลังอยู่หนึ่ง Commit) Fetch ไม่แตะ Branch และไฟล์ของเรา' },
      { name: 'merge', title: 'Bob Merge: main ขยับตาม', text: 'git merge origin/main เป็น Fast-forward เพราะ Bob ยังไม่มีงานของตัวเอง main ย้ายไป A2' },
      { name: 'Alice อีกรอบ', title: 'Alice ทำ A3 แล้ว Push', text: 'Origin มี A3 แต่ Bob ยังไม่มี ตอนนี้ Origin ล้ำหน้า Bob อยู่หนึ่ง Commit โดยที่ Bob ไม่รู้' },
      { name: 'Push ถูกปฏิเสธ', title: 'Bob ทำ B1 แล้ว Push: ถูกปฏิเสธ', text: 'Origin มี A3 ที่ Bob ไม่มี ถ้ารับ B1 ไว้ A3 จะหลุดจากปลาย Branch Git จึงปฏิเสธด้วยข้อความ fetch first' },
      { name: 'pull', title: 'Bob Pull: ได้ A3 แล้ว Merge เป็น M', text: 'Pull คือ Fetch แล้ว Merge Bob ได้ A3 มา และสร้าง Commit M ที่มีสอง Parent คือ A3 กับ B1' },
      { name: 'push', title: 'Bob Push อีกครั้ง: ผ่าน', text: 'ตอนนี้ main ของ Bob มีทุกอย่างที่ Origin มี การ Push เป็นแค่การต่อท้าย Origin จึงรับ และ origin/main ของ Bob ชี้ M' },
    ],
    caption: 'ลำดับและข้อความ rejected (fetch first) มาจากแบบฝึก 06 ส่วนชื่อ Commit A1, A2, A3, B1 และ M เป็นชื่อที่เราวาดให้เห็นภาพ (ในแบบฝึกมี Commit เพิ่มเติมที่ไม่ได้วาด)',
  },
  en: {
    title: 'Three places: Alice, Origin and Bob. Step through and see that fetch moves only origin/main, and why a push is rejected',
    legend: [{ kind: 'new', text: 'a commit just made or just arrived' }, { kind: 'use', text: 'an existing commit' }, { kind: 'node', text: 'a branch label' }],
    who: [['Alice', "Alice's computer"], ['Origin', 'Bare repository'], ['Bob', "Bob's computer"]],
    absent: 'not there yet', rejected: '✗ push rejected (fetch first)',
    steps: [
      { name: 'commit', title: 'Alice has a first commit', text: 'Alice has A1 in her repository. Origin is still empty and Bob has nothing.' },
      { name: 'push -u', title: 'Alice pushes to Origin', text: 'Origin gets A1 and its main points at A1. Alice gets a label origin/main pointing at A1, her memory of where Origin is.' },
      { name: 'clone', title: 'Bob clones', text: 'Bob gets the whole history from Origin, with main and origin/main pointing at A1.' },
      { name: 'Alice pushes', title: 'Alice makes A2 and pushes', text: 'Origin gets A2, but Bob does not know. His origin/main still points at A1, because it is only a memory and does not update by itself.' },
      { name: 'fetch', title: 'Bob fetches: origin/main moves', text: 'A2 arrives on Bob\'s computer and origin/main points at A2, but Bob\'s main is still at A1 (one commit behind). Fetch does not touch our branch or our files.' },
      { name: 'merge', title: 'Bob merges: main follows', text: 'git merge origin/main is a fast-forward because Bob has no work of his own. main moves to A2.' },
      { name: 'Alice again', title: 'Alice makes A3 and pushes', text: 'Origin has A3 and Bob does not. Origin is one commit ahead of Bob, and Bob does not know.' },
      { name: 'rejected', title: 'Bob makes B1 and pushes: rejected', text: 'Origin has A3, which Bob does not. If it took B1, A3 would fall off the tip of the branch, so Git refuses with the message fetch first.' },
      { name: 'pull', title: 'Bob pulls: gets A3 and merges into M', text: 'Pull is a fetch and a merge. Bob gets A3 and makes the commit M with two parents, A3 and B1.' },
      { name: 'push', title: 'Bob pushes again: accepted', text: 'Now Bob\'s main has everything Origin has. The push is only an append, so Origin accepts it, and Bob\'s origin/main points at M.' },
    ],
    caption: 'The order and the message rejected (fetch first) come from exercise 06. The commit names A1, A2, A3, B1 and M are drawn names (the exercise has more commits than the picture shows).',
  },
};

const COLX = [14, 304, 594];
const LAY: Record<string, { c: number; r: number }> = { A1: { c: 0, r: 1 }, A2: { c: 1, r: 1 }, A3: { c: 2, r: 1 }, B1: { c: 2, r: 0 }, M: { c: 3, r: 1 } };
const PARENTS: Record<string, string[]> = { A2: ['A1'], A3: ['A2'], B1: ['A2'], M: ['A3', 'B1'] };

export default function RemotesLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 5400);
  const v = VIEWS[step];
  const prev = step > 0 ? VIEWS[step - 1] : null;
  const repos: [keyof Pick<View, 'alice' | 'origin' | 'bob'>, number][] = [['alice', 0], ['origin', 1], ['bob', 2]];
  const pt = (col: number, c: string) => ({ x: COLX[col] + 34 + LAY[c].c * 60, y: 214 + (LAY[c].r === 0 ? -64 : 18) + (LAY[c].r === 1 ? 20 : 0) });

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 450" role="img" aria-label={T.title}>
          <text x={16} y={26} className="ib-m" style={{ fontSize: 17 }}>{v.cmd}</text>
          {repos.map(([key, col]) => {
            const repo = v[key];
            const was = prev ? prev[key] : null;
            return (
              <g key={key}>
                <rect className="ib-zone" x={COLX[col]} y={44} width={272} height={348} rx={12} />
                <text x={COLX[col] + 14} y={72} className="ib-n" style={{ fontSize: 18, fontWeight: 700 }}>{T.who[col][0]}</text>
                <text x={COLX[col] + 14} y={94} className="ib-s">{T.who[col][1]}</text>
                {!repo.exists && <text x={COLX[col] + 136} y={250} textAnchor="middle" className="ib-s">{T.absent}</text>}
                {repo.commits.length === 0 && repo.exists && <text x={COLX[col] + 136} y={250} textAnchor="middle" className="ib-s">{lang === 'th' ? 'ว่างเปล่า' : 'empty'}</text>}
                {repo.commits.flatMap((c) => (PARENTS[c] ?? []).filter((p) => repo.commits.includes(p)).map((p) => (
                  <path key={p + c} className="ib-line" d={`M${pt(col, p).x},${pt(col, p).y} L${pt(col, c).x},${pt(col, c).y}`} style={{ strokeWidth: 3 }} />
                )))}
                {repo.commits.map((c) => {
                  const isNew = !was || !was.commits.includes(c);
                  const p = pt(col, c);
                  return (
                    <g key={c}>
                      <circle className={isNew && step > 0 ? 'ib-new' : 'ib-use'} cx={p.x} cy={p.y} r={21} />
                      <text x={p.x} y={p.y + 5} textAnchor="middle" className="ib-n" style={{ fontSize: 15 }}>{c}</text>
                    </g>
                  );
                })}
                {repo.main && (() => {
                  const p = pt(col, repo.main!);
                  return (
                    <g>
                      <path className="ib-arrow" d={`M${p.x},${p.y - 48} L${p.x},${p.y - 24}`} />
                      <rect className="ib-use" x={p.x - 30} y={p.y - 80} width={60} height={32} rx={8} style={{ fill: 'var(--accent-soft)' }} />
                      <text x={p.x} y={p.y - 59} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 15 }}>main</text>
                    </g>
                  );
                })()}
                {repo.remote && (() => {
                  const p = pt(col, repo.remote!);
                  return (
                    <g>
                      <path className="ib-arrow" d={`M${p.x},${p.y + 50} L${p.x},${p.y + 24}`} />
                      <rect className="ib-node" x={p.x - 52} y={p.y + 50} width={104} height={32} rx={8} />
                      <text x={p.x} y={p.y + 71} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 14 }}>origin/main</text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
          {v.rejected && (
            <g>
              <rect x={304} y={402} width={560} height={36} rx={9} style={{ fill: 'var(--surface)', stroke: 'var(--ib-bad, #b42318)', strokeWidth: 3 }} />
              <text x={324} y={426} className="ib-n" style={{ fill: 'var(--ib-bad, #b42318)', fontWeight: 700 }}>{T.rejected}</text>
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
