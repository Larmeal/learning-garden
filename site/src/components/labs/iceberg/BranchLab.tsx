import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';

// Shows:      snapshots as a line of dots, and the named pointers (main, a tag, a branch) that sit on them and move when you branch,
//             write to a branch, fast forward, and roll back. The two lines at the bottom say what a reader of main and of audit sees.
// Because:    "a branch does not move main" and "a rollback deletes nothing" are statements about pointers. Seeing a pointer jump while
//             the dots stay is the whole idea.
// Control:    the step buttons walk through create tag, create branch, write to the branch, fast forward, rollback and going forward again.
//             Each step moves at least one pointer, and the readers' lines change.
// Conclusion: snapshots are never removed by these commands; only the names that point at them move.
//
// Follows exercises/08_time_travel.py: three snapshots s1 to s3 (rows 1-2, 3, 4-5), tag before_cleanup on s2, branch audit on s3,
// INSERT of row 100 on the branch, fast_forward main to audit, rollback_to_snapshot s2, set_current_snapshot s3. The rows of the reader
// lines are the ones that exercise read. Snapshot s4 is the one made on the branch (row 100).

const TEXT: Record<Lang, {
  title: string; main: string; audit: string; tag: string; readMain: string; readAudit: string; none: string; grey: string; dotsNote: string;
  banners: string[]; steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'Snapshot คือจุดบนเส้น ส่วน main, Tag และ Branch คือป้ายที่ชี้ไปที่จุดเหล่านั้น ลองกดดูว่าแต่ละคำสั่งย้ายป้ายไหนบ้าง',
    main: 'main', audit: 'audit', tag: 'before_cleanup', readMain: 'ผู้อ่านของ main เห็น id', readAudit: 'ผู้อ่านของ audit เห็น id', none: 'ยังไม่มี Branch นี้', grey: 'อยู่นอกสายของ main แต่ยังไม่ถูกลบ', dotsNote: 'จุด = Snapshot',
    banners: [
      'main ชี้ที่ s3 ผู้อ่านจึงเห็น id 1 ถึง 5', 'Tag ชี้ที่ s2 ไว้ถาวร ต่อให้มี Commit ใหม่ Tag ก็ไม่ขยับตาม', 'Branch audit เริ่มต้นที่ s3 เหมือนกับ main', 'เขียนลง audit แล้ว audit ขยับไป s4 ส่วน main ยังอยู่ที่ s3',
      'Fast Forward ย้ายป้าย main ไป s4 โดยไม่ต้องคัดลอกข้อมูล', 'Rollback ย้ายป้าย main กลับไป s2 และไม่มี Snapshot ไหนถูกลบ', 's3 ยังอยู่ เราจึงย้าย main กลับไป s3 ได้อีกครั้ง',
    ],
    steps: [
      { name: 'เริ่ม', title: 'Snapshot สามอัน main ชี้ s3', text: 'เราเขียนข้อมูลสามครั้ง ได้ s1 (id 1, 2), s2 (id 3) และ s3 (id 4, 5) ป้าย main ชี้ที่ s3 ผู้อ่านจึงเห็น id 1 ถึง 5' },
      { name: 'Tag', title: 'ตั้ง Tag ที่ s2', text: 'ALTER TABLE ... CREATE TAG before_cleanup AS OF VERSION s2 ป้ายนี้จะชี้ที่ s2 ไว้ถาวร เมื่อมี Commit ใหม่ ป้าย main จะขยับไป แต่ Tag ยังอยู่ที่เดิม และอ่านด้วย VERSION AS OF \'before_cleanup\' ได้ id 1 ถึง 3' },
      { name: 'Branch', title: 'สร้าง Branch audit ที่ s3', text: 'CREATE BRANCH audit ให้ป้ายใหม่ที่ชี้ s3 เหมือนกับ main ตอนนี้ป้ายสองอันอยู่ที่จุดเดียวกัน' },
      { name: 'เขียนลง Branch', title: 'เขียนลง Branch: audit ขยับ แต่ main อยู่ที่เดิม', text: 'INSERT INTO t.branch_audit ใส่ id 100 ทำให้เกิด Snapshot ใหม่ s4 ต่อจาก s3 ป้าย audit จึงชี้ที่ s4 ส่วน main ยังชี้ที่ s3 ผู้อ่านปกติเลยยังไม่เห็น id 100' },
      { name: 'Fast Forward', title: 'เผยแพร่: main เลื่อนไปที่ s4', text: 'CALL fast_forward(main, audit) ย้ายป้าย main ไปชี้ที่ s4 โดยไม่มีการคัดลอกข้อมูล ย้ายแค่ป้ายเท่านั้น ผู้อ่านจึงเห็น id 100 ทันที' },
      { name: 'Rollback', title: 'Rollback: main ถอยไปที่ s2', text: 'rollback_to_snapshot s2 ย้ายป้าย main กลับไปที่ s2 โดย s3 และ s4 ยังอยู่ครบ (เป็นจุดเส้นประที่อยู่นอกสายของ main) ผู้อ่านเลยเห็นแค่ id 1 ถึง 3' },
      { name: 'ไปข้างหน้า', title: 'set_current_snapshot ย้ายป้ายกลับไปข้างหน้า', text: 'เพราะ Snapshot ไม่ถูกลบ เราจึงย้าย main ไปที่ s3 ได้อีกครั้ง และได้ id 1 ถึง 5 เหมือนเดิม' },
    ],
    caption: 'ลำดับคำสั่งและ id ที่อ่านได้มาจากแบบฝึก 08 (s4 คือ Snapshot ที่เกิดจากการเขียนลง Branch) ส่วนชื่อ Snapshot ในภาพเป็นชื่อย่อ',
  },
  en: {
    title: 'A snapshot is a dot on a line. main, tags and branches are labels that point at dots. See which label each command moves',
    main: 'main', audit: 'audit', tag: 'before_cleanup', readMain: 'A reader of main sees ids', readAudit: 'A reader of audit sees ids', none: 'no such branch yet', grey: 'off main’s line but not deleted', dotsNote: 'dot = snapshot',
    banners: [
      'main points to s3. A reader sees ids 1 to 5', 'The tag points at s2 for good. New commits do not move a tag', 'The branch audit starts at s3, like main', 'Write to audit: audit moves to s4 and main stays at s3',
      'Fast forward: the label main moves to s4. No data is copied', 'Rollback: the label main goes back to s2. No snapshot is deleted', 'main can go to s3 again, because s3 is still there',
    ],
    steps: [
      { name: 'start', title: 'Three snapshots, main points to s3', text: 'Three writes gave s1 (ids 1, 2), s2 (id 3) and s3 (ids 4, 5). The label main points to s3. A reader sees ids 1 to 5.' },
      { name: 'tag', title: 'Put a tag on s2', text: 'ALTER TABLE ... CREATE TAG before_cleanup AS OF VERSION s2. This label points at s2 for good. When new commits arrive, main moves but the tag stays. VERSION AS OF \'before_cleanup\' reads ids 1 to 3.' },
      { name: 'branch', title: 'Create the branch audit at s3', text: 'CREATE BRANCH audit gives a new label that points at s3, like main. Two labels are on the same dot now.' },
      { name: 'write to the branch', title: 'Write to the branch: audit moves, main stays', text: 'INSERT INTO t.branch_audit adds id 100 and makes a new snapshot s4 on top of s3. The label audit points to s4, while main still points to s3, so a normal reader does not see id 100.' },
      { name: 'fast forward', title: 'Publish: main moves to s4', text: 'CALL fast_forward(main, audit) moves the label main to s4. No data is copied, only a label moves. Readers see id 100 at once.' },
      { name: 'rollback', title: 'Rollback: main steps back to s2', text: 'rollback_to_snapshot s2 moves the label main back to s2. s3 and s4 are all still there (dashed dots, off main’s line). Readers see only ids 1 to 3.' },
      { name: 'forward again', title: 'set_current_snapshot moves the label forward again', text: 'Because snapshots were not deleted, we can move main to s3 again and get ids 1 to 5 as before.' },
    ],
    caption: 'The order of commands and the ids that are read come from exercise 08 (s4 is the snapshot made by writing to the branch). The snapshot names in the picture are short.',
  },
};

const X = [110, 290, 470, 690];
const Y = 168;
const R = 26;

export default function BranchLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 5200);

  const hasTag = step >= 1;
  const hasBranch = step >= 2;
  const hasS4 = step >= 3;
  const mainAt = step === 4 ? 4 : step === 5 ? 2 : 3;
  const audit = hasS4 ? 4 : 3;
  const mainIds = mainAt === 2 ? '1, 2, 3' : mainAt === 3 ? '1, 2, 3, 4, 5' : '1, 2, 3, 4, 5, 100';
  const auditIds = hasS4 ? '1, 2, 3, 4, 5, 100' : '1, 2, 3, 4, 5';
  const off = (n: number) => (mainAt === 2 && n >= 3) || (step === 6 && n === 4);
  const cy = (n: number) => (n === 4 ? Y + 70 : Y);

  const Dot = ({ n }: { n: number }) => (
    <g style={off(n) ? { opacity: 0.55 } : undefined}>
      <circle className={off(n) ? 'ib-skip' : 'ib-new'} cx={X[n - 1]} cy={cy(n)} r={R} />
      <text x={X[n - 1]} y={cy(n) + 6} textAnchor="middle" className="ib-n">s{n}</text>
    </g>
  );
  const Label = ({ x, y, w, text, color }: { x: number; y: number; w: number; text: string; color?: string }) => (
    <g>
      <rect className="ib-node" x={x} y={y} width={w} height={34} rx={8} style={color ? { stroke: color, strokeWidth: 3 } : undefined} />
      <text x={x + w / 2} y={y + 23} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{text}</text>
    </g>
  );

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <text x={16} y={28} className="ib-s">{T.dotsNote}</text>
          <path className="ib-line" d={`M${X[0]},${Y} L${X[2]},${Y}`} style={{ strokeWidth: 3 }} />
          {hasS4 && <path className="ib-line" d={`M${X[2] + 20},${Y + 18} C${X[2] + 90},${Y + 70} ${X[3] - 80},${Y + 70} ${X[3] - R},${Y + 70}`} style={{ stroke: 'var(--k2)', strokeWidth: 3 }} />}
          {[1, 2, 3].map((n) => <Dot key={n} n={n} />)}
          {hasS4 && <Dot n={4} />}
          {step === 5 && <text x={X[2] + 4} y={Y - 40} textAnchor="middle" className="ib-s">{T.grey}</text>}

          {hasTag && (
            <g>
              <path className="ib-line" d={`M${X[1]},${Y - R} L${X[1]},${Y - 56}`} style={{ strokeWidth: 3 }} />
              <Label x={X[1] - 78} y={Y - 90} w={156} text={T.tag} />
            </g>
          )}
          {hasBranch && audit === 3 && (
            <g>
              <path className="ib-line" d={`M${X[2]},${Y - R} L${X[2]},${Y - 56}`} style={{ stroke: 'var(--k2)', strokeWidth: 3 }} />
              <Label x={X[2] - 40} y={Y - 90} w={80} text={T.audit} color="var(--k2)" />
            </g>
          )}
          {hasBranch && audit === 4 && (
            <g>
              <path className="ib-line" d={`M${X[3] + R},${cy(4)} L${X[3] + 40},${cy(4)}`} style={{ stroke: 'var(--k2)', strokeWidth: 3 }} />
              <Label x={X[3] + 40} y={cy(4) - 17} w={80} text={T.audit} color="var(--k2)" />
            </g>
          )}
          {/* main */}
          <g>
            <path className="ib-arrow" d={`M${X[mainAt - 1]},${cy(mainAt) + R + 46} L${X[mainAt - 1]},${cy(mainAt) + R + 4}`} />
            <rect className="ib-use" x={X[mainAt - 1] - 40} y={cy(mainAt) + R + 46} width={80} height={34} rx={8} style={{ fill: 'var(--accent-soft)' }} />
            <text x={X[mainAt - 1]} y={cy(mainAt) + R + 69} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.main}</text>
          </g>

          {/* readers */}
          <rect className="ib-zone" x={16} y={290} width={848} height={100} rx={12} />
          <text x={32} y={316} className="ib-s">{T.readMain}</text>
          <text x={32} y={346} className="ib-n ib-acc">{mainIds}</text>
          <text x={452} y={316} className="ib-s">{T.readAudit}</text>
          <text x={452} y={346} className="ib-n">{hasBranch ? auditIds : T.none}</text>
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
