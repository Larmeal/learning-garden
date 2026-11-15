import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';

// Shows:      the same history (a base, one commit on main, two commits on feature) drawn twice, side by side: once combined with a merge,
//             once combined with a rebase. The reader steps through merge, rebase, "the old commits are still there" and undoing the rebase.
// Because:    the difference between the two is the shape of the history and which ids change. A sentence says it, a picture lets you see
//             that merge keeps F1 and F2 and adds a commit with two parents, while rebase makes F1' and F2' and leaves F1 and F2 behind.
// Control:    the step buttons. Each step changes one of the two panels.
// Conclusion: merge adds a joining commit and changes nothing old; rebase makes new commits with new ids, and the old ones are not lost.
//
// Follows exercises/05_rebase.py for the ids: B1 05b88c6, M1 1e4768c, F1 d3e98c1, F2 aa574fc, and after the rebase F1' fe3ac52, F2' f6eb776.
// The merge commit has no id in the picture because exercise 05 does not run a merge.

type State = 'before' | 'merged' | 'rebased' | 'ghosts';

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; merge: string; rebase: string; orig: string; steps: StepInfo[]; caption: string }> = {
  th: {
    title: 'ประวัติเดียวกัน รวมสองแบบ ซ้ายคือ Merge ขวาคือ Rebase กดทีละขั้นแล้วเทียบรูปร่างของประวัติและ ID ของ Commit',
    legend: [{ kind: 'new', text: 'เกิดใหม่ในขั้นนี้' }, { kind: 'use', text: 'Commit เดิม' }, { kind: 'skip', text: 'ยังอยู่ แต่ไม่มี Branch ชี้ถึง' }],
    merge: 'Merge', rebase: 'Rebase', orig: 'ORIG_HEAD',
    steps: [
      { name: 'ก่อนรวม', title: 'main ไปข้างหน้าแล้วหนึ่ง Commit ส่วน feature แยกออกมาสอง Commit', text: 'ทั้งสองฝั่งเริ่มจากประวัติเดียวกัน B1 เป็นจุดที่แยกออกจากกัน M1 อยู่บน main ส่วน F1 กับ F2 อยู่บน feature' },
      { name: 'git merge', title: 'Merge: เพิ่ม Commit ที่มีสอง Parent', text: 'ฝั่งซ้ายมี Commit ใหม่ M ที่ต่อจากทั้ง M1 และ F2 F1 กับ F2 ยังอยู่ครบด้วย ID เดิม ไม่มีอะไรเก่าถูกแตะ' },
      { name: 'git rebase', title: 'Rebase: เล่น F1 กับ F2 ซ้ำต่อท้าย M1', text: 'ฝั่งขวาเกิด F1′ กับ F2′ ที่ต่อท้าย M1 เป็นเส้นตรง การเปลี่ยนแปลงเหมือนเดิม แต่ ID ใหม่ (fe3ac52 และ f6eb776) เพราะ Parent เปลี่ยน' },
      { name: 'ของเก่ายังอยู่', title: 'F1 กับ F2 เดิมยังอยู่ในกล่อง', text: 'Rebase ไม่ได้ลบ Commit เก่า แค่ไม่มี Branch ชี้ถึง Git จดตำแหน่งเดิมไว้ใน ORIG_HEAD และ Reflog จึงย้อนกลับได้' },
      { name: 'ย้อน Rebase', title: 'git reset --hard ORIG_HEAD', text: 'feature กลับไปชี้ F2 เหมือนก่อน Rebase ฝั่งขวากลับไปเหมือนตอนเริ่ม ซึ่งยืนยันว่า Rebase ไม่ทำลายอะไร' },
    ],
    caption: 'ID ของ B1, M1, F1, F2 และของ F1′, F2′ มาจากแบบฝึก 05 ส่วน Commit ของ Merge ไม่มี ID ในภาพเพราะแบบฝึกนี้ไม่ได้รัน Merge',
  },
  en: {
    title: 'The same history, combined two ways. Merge on the left, rebase on the right. Step through and compare the shape and the commit ids',
    legend: [{ kind: 'new', text: 'made in this step' }, { kind: 'use', text: 'an existing commit' }, { kind: 'skip', text: 'still there, but no branch points at it' }],
    merge: 'Merge', rebase: 'Rebase', orig: 'ORIG_HEAD',
    steps: [
      { name: 'before', title: 'main is one commit ahead, and feature split off with two commits', text: 'Both sides start from the same history. B1 is the point where they split. M1 is on main, and F1 and F2 are on feature.' },
      { name: 'git merge', title: 'Merge: add a commit with two parents', text: 'The left side has a new commit M that follows both M1 and F2. F1 and F2 are all still there with their old ids. Nothing old was touched.' },
      { name: 'git rebase', title: 'Rebase: replay F1 and F2 after M1', text: 'The right side gets F1′ and F2′ after M1, in a straight line. The change is the same, but the ids are new (fe3ac52 and f6eb776) because the parent changed.' },
      { name: 'old ones remain', title: 'The old F1 and F2 are still in the box', text: 'Rebase did not delete the old commits. No branch points at them any more. Git noted the old place in ORIG_HEAD and in the reflog, so we can go back.' },
      { name: 'undo rebase', title: 'git reset --hard ORIG_HEAD', text: 'feature points at F2 again, as before the rebase. The right side looks as it did at the start, which confirms the rebase destroyed nothing.' },
    ],
    caption: 'The ids of B1, M1, F1, F2 and of F1′, F2′ come from exercise 05. The merge commit has no id in the picture because that exercise does not run a merge.',
  },
};

const P = { B1: [40, 150], M1: [150, 150], F1: [150, 290], F2: [260, 290], M: [380, 220], F1n: [260, 150], F2n: [370, 150] } as const;
type K = keyof typeof P;
const ID: Partial<Record<K, string>> = { B1: '05b88c6', M1: '1e4768c', F1: 'd3e98c1', F2: 'aa574fc', F1n: 'fe3ac52', F2n: 'f6eb776' };
const NAME: Record<K, string> = { B1: 'B1', M1: 'M1', F1: 'F1', F2: 'F2', M: 'M', F1n: 'F1′', F2n: 'F2′' };

function Panel({ ox, state, label, kind, T }: { ox: number; state: State; label: string; kind: 'merge' | 'rebase'; T: { orig: string } }) {
  const nodes: { k: K; cls: string; faded?: boolean }[] = [{ k: 'B1', cls: 'ib-use' }, { k: 'M1', cls: 'ib-use' }];
  const edges: [K, K][] = [['B1', 'M1'], ['B1', 'F1'], ['F1', 'F2']];
  let mainAt: K = 'M1';
  let featAt: K = 'F2';
  if (state === 'merged') {
    nodes.push({ k: 'F1', cls: 'ib-use' }, { k: 'F2', cls: 'ib-use' }, { k: 'M', cls: 'ib-new' });
    edges.push(['M1', 'M'], ['F2', 'M']);
    mainAt = 'M'; featAt = 'M';
  } else if (state === 'rebased' || state === 'ghosts') {
    nodes.push({ k: 'F1', cls: 'ib-skip', faded: true }, { k: 'F2', cls: 'ib-skip', faded: true }, { k: 'F1n', cls: state === 'rebased' ? 'ib-new' : 'ib-use' }, { k: 'F2n', cls: state === 'rebased' ? 'ib-new' : 'ib-use' });
    edges.push(['M1', 'F1n'], ['F1n', 'F2n']);
    featAt = 'F2n';
  } else {
    nodes.push({ k: 'F1', cls: 'ib-use' }, { k: 'F2', cls: 'ib-use' });
  }
  const has = (k: K) => nodes.some((n) => n.k === k);
  const shown = (k: K) => has(k);
  const pos = (k: K) => ({ x: ox + P[k][0], y: P[k][1] });
  const lab = (k: K, text: string, dy: number, accent?: boolean) => {
    const p = pos(k);
    return (
      <g key={text + k}>
        <rect className={accent ? 'ib-use' : 'ib-node'} x={p.x - 48} y={p.y + dy} width={96} height={32} rx={8} style={accent ? { fill: 'var(--accent-soft)' } : undefined} />
        <text x={p.x} y={p.y + dy + 22} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{text}</text>
      </g>
    );
  };
  return (
    <g>
      <text x={ox + 10} y={36} className="ib-n" style={{ fontSize: 20, fontWeight: 700 }}>{label}</text>
      {edges.filter(([a, b]) => shown(a) && shown(b)).map(([a, b]) => (
        <path key={a + b} className="ib-line" d={`M${pos(a).x},${pos(a).y} L${pos(b).x},${pos(b).y}`} style={{ strokeWidth: 3, opacity: (a === 'F1' || b === 'F1' || a === 'F2' || b === 'F2') && (state === 'rebased' || state === 'ghosts') && !(a === 'M1' || b === 'M') ? 0.45 : 1, strokeDasharray: (state === 'rebased' || state === 'ghosts') && ((a === 'B1' && b === 'F1') || (a === 'F1' && b === 'F2')) ? '6 5' : undefined }} />
      ))}
      {nodes.map(({ k, cls, faded }) => (
        <g key={k} style={faded ? { opacity: 0.6 } : undefined}>
          <circle className={cls} cx={pos(k).x} cy={pos(k).y} r={28} />
          <text x={pos(k).x} y={pos(k).y + 6} textAnchor="middle" className="ib-n">{NAME[k]}</text>
          {ID[k] && <text x={pos(k).x} y={pos(k).y + 50} textAnchor="middle" className="ib-m">{ID[k]}</text>}
        </g>
      ))}
      {lab(mainAt, 'main', -80, true)}
      {lab(featAt, 'feature', mainAt === featAt ? 64 : 64, false)}
      {kind === 'rebase' && state === 'ghosts' && lab('F2', T.orig, 64)}
    </g>
  );
}

export default function MergeRebaseLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 5200);
  const left: State = step >= 1 ? 'merged' : 'before';
  const right: State = step === 0 || step === 4 ? 'before' : step === 2 ? 'rebased' : step === 1 ? 'before' : 'ghosts';
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <line x1={440} y1={20} x2={440} y2={380} className="ib-line" style={{ strokeDasharray: '4 6', opacity: 0.5 }} />
          <Panel ox={0} state={left} label={T.merge} kind="merge" T={T} />
          <Panel ox={450} state={right} label={T.rebase} kind="rebase" T={T} />
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
