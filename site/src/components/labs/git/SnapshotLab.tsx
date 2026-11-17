import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Link, ease } from './gl';
import data from './labData.json';

// Shows:      two commits being made. The first writes two blobs, a tree and a commit. The second changes only a.txt, so it writes one new blob,
//             a new tree and a new commit, and its tree points at the OLD blob of b.txt. The counter goes from 4 objects to 7, not to 8.
// Because:    "Git keeps a snapshot, but an unchanged file is stored once" is about which arrows point at which box. It needs to be seen as arrows.
// Control:    play, scrub, speed and the jump buttons.
// Conclusion: every commit lists every file (a snapshot), yet only what changed costs a new object, because the id of a blob is its content.
//
// Ids come from exercises/16_lab_data.py (the same files as exercise 00).

const D = data.snapshot;
const DURATION = 10;
const [C1, C2] = D.commits;

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; commit: string; tree: string; blob: string; objects: string; shared: string; file: string; marks: Mark[]; caption: string }> = {
  th: {
    title: 'สอง Commit ของโฟลเดอร์ที่มีไฟล์ a.txt กับ b.txt กดเล่นแล้วดูว่า Commit ที่สองสร้าง Object ใหม่กี่ชิ้น และไฟล์ไหนถูกใช้ร่วมกัน',
    legend: [{ kind: 'new', text: 'Object ที่เกิดใหม่' }, { kind: 'use', text: 'Object ที่มีอยู่แล้ว' }],
    commit: 'Commit', tree: 'Tree', blob: 'Blob', objects: 'Object ใน .git', shared: 'ใช้ร่วมกัน', file: 'ไฟล์',
    caption: 'ID ทุกตัวมาจากแบบฝึก 16 (ไฟล์ชุดเดียวกับแบบฝึก 00) Commit แรกมี 4 Object และ Commit ที่สองเพิ่มอีก 3 รวมเป็น 7',
    marks: [
      { at: 0, name: 'โฟลเดอร์', title: 'โฟลเดอร์ที่มีสองไฟล์', text: 'a.txt มีคำว่า alpha และ b.txt มีคำว่า beta ยังไม่มี Object ใน .git เลย' },
      { at: 1.2, name: 'Commit แรก', title: 'Commit แรกสร้าง 4 Object', text: 'Git เขียน Blob ของแต่ละไฟล์ แล้วเขียน Tree ที่จดว่าชื่อไฟล์ไหนใช้ Blob ไหน แล้วถึงเขียน Commit ที่ชี้ไปที่ Tree นั้น' },
      { at: 5.0, name: 'แก้ a.txt', title: 'แก้เฉพาะ a.txt แล้ว Commit อีกครั้ง', text: 'a.txt มี Blob ใหม่เพราะเนื้อไฟล์เปลี่ยน Tree ใหม่จึงต้องมีด้วย แล้วก็ Commit ใหม่' },
      { at: 7.3, name: 'ใช้ร่วมกัน', title: 'b.txt ไม่ได้ถูกเก็บซ้ำ', text: 'Tree ของทั้งสอง Commit จดชื่อไฟล์ครบทั้งสองไฟล์ จึงเป็น Snapshot เต็ม แต่ b.txt ชี้ไปที่ Blob ตัวเดิม เพราะ ID ของ Blob ก็คือเนื้อไฟล์ เนื้อเท่าเดิมจึงไม่ต้องเขียนใหม่ จำนวน Object จึงเป็น 7 ไม่ใช่ 8' },
    ],
  },
  en: {
    title: 'Two commits of a folder with a.txt and b.txt. Press play and see how many new objects the second commit makes, and which file is shared',
    legend: [{ kind: 'new', text: 'a new object' }, { kind: 'use', text: 'an object that was already there' }],
    commit: 'commit', tree: 'tree', blob: 'blob', objects: 'objects in .git', shared: 'shared', file: 'file',
    caption: 'Every id comes from exercise 16 (the same files as exercise 00). The first commit has 4 objects and the second adds 3, 7 in all.',
    marks: [
      { at: 0, name: 'folder', title: 'A folder with two files', text: 'a.txt holds the word alpha and b.txt holds the word beta. There is no object in .git yet.' },
      { at: 1.2, name: 'first commit', title: 'The first commit makes 4 objects', text: 'Git writes the blob of each file, then a tree that notes which file name uses which blob, and then a commit that points at that tree.' },
      { at: 5.0, name: 'change a.txt', title: 'Change only a.txt, commit again', text: 'a.txt gets a new blob because its content changed. That needs a new tree, and then a new commit.' },
      { at: 7.3, name: 'shared', title: 'b.txt is not stored twice', text: 'The trees of both commits list both files, so each is a full snapshot, but b.txt points at the old blob. The id of a blob is its content, so the same content needs no new write. The count is 7, not 8.' },
    ],
  },
};

const NW = 190, NH = 58;
function Box({ x, y, title, sub, state, op = 1 }: { x: number; y: number; title: string; sub: string; state: 'new' | 'use'; op?: number }) {
  if (op <= 0.01) return null;
  return (
    <g style={{ opacity: op }}>
      <rect className={state === 'new' ? 'ib-new' : 'ib-use'} x={x} y={y} width={NW} height={NH} rx={9} />
      <text x={x + 12} y={y + 24} className="ib-n">{title}</text>
      <text x={x + 12} y={y + 46} className="ib-m">{sub}</text>
    </g>
  );
}

export default function SnapshotLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const a = (from: number) => ease(t, from, from + 0.8);
  const state = (when: number): 'new' | 'use' => (t < when + 3.4 ? 'new' : 'use');
  // columns: first commit group on the left, second on the right, shared blob in the middle
  const P = {
    c1: [110, 70], t1: [110, 178], a1: [110, 296], b: [375, 296],
    c2: [650, 70], t2: [650, 178], a2: [650, 296],
  } as const;
  const mid = (p: readonly [number, number]) => [p[0] + NW / 2, p[1]] as const;
  const objects = [1.2, 1.4, 2.0, 2.6, 5.2, 6.0, 6.6].filter((at) => t >= at + 0.4).length;
  const shared = ease(t, 7.3, 8.3);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          <text x={14} y={104} className="ib-layer">{T.commit}</text>
          <text x={14} y={212} className="ib-layer">{T.tree}</text>
          <text x={14} y={330} className="ib-layer">{T.blob}</text>
          <g>
            <text x={440} y={30} textAnchor="middle" className="ib-s">{T.objects}</text>
            <text x={440} y={64} textAnchor="middle" className="ib-big" style={{ fontSize: 34 }}>{objects}</text>
          </g>
          {/* edges */}
          <Link x1={mid(P.t1)[0]} y1={P.c1[1] + NH} x2={mid(P.t1)[0]} y2={P.t1[1]} p={a(2.4)} accent />
          <Link x1={mid(P.t1)[0]} y1={P.t1[1] + NH} x2={mid(P.a1)[0]} y2={P.a1[1]} p={a(1.6)} accent />
          <Link x1={mid(P.t1)[0] + 40} y1={P.t1[1] + NH} x2={P.b[0] + 30} y2={P.b[1]} p={a(1.6)} accent />
          <Link x1={mid(P.t2)[0]} y1={P.c2[1] + NH} x2={mid(P.t2)[0]} y2={P.t2[1]} p={a(6.5)} accent />
          <Link x1={mid(P.t2)[0]} y1={P.t2[1] + NH} x2={mid(P.a2)[0]} y2={P.a2[1]} p={a(5.6)} accent />
          <Link x1={mid(P.t2)[0] - 40} y1={P.t2[1] + NH} x2={P.b[0] + NW - 30} y2={P.b[1]} p={a(5.6)} accent width={3 + 3 * shared} />
          <Link x1={P.c2[0]} y1={P.c2[1] + NH / 2} x2={P.c1[0] + NW} y2={P.c1[1] + NH / 2} p={a(6.8)} accent />
          {/* first commit */}
          <Box x={P.a1[0]} y={P.a1[1]} title="a.txt" sub={`${C1.files['a.txt']}  ${D.contents.a1}`} state={state(1.2)} op={a(1.2)} />
          <Box x={P.b[0]} y={P.b[1]} title="b.txt" sub={`${C1.files['b.txt']}  ${D.contents.b}`} state={state(1.4)} op={a(1.4)} />
          <Box x={P.t1[0]} y={P.t1[1]} title="tree" sub={C1.tree.slice(0, 7)} state={state(2.0)} op={a(2.0)} />
          <Box x={P.c1[0]} y={P.c1[1]} title={`${T.commit} 1`} sub={C1.id} state={state(2.6)} op={a(2.6)} />
          {/* second commit */}
          <Box x={P.a2[0]} y={P.a2[1]} title="a.txt" sub={`${C2.files['a.txt']}  alpha+more`} state={state(5.2)} op={a(5.2)} />
          <Box x={P.t2[0]} y={P.t2[1]} title="tree" sub={C2.tree.slice(0, 7)} state={state(6.0)} op={a(6.0)} />
          <Box x={P.c2[0]} y={P.c2[1]} title={`${T.commit} 2`} sub={C2.id} state={state(6.6)} op={a(6.6)} />
          {shared > 0.05 && (
            <g style={{ opacity: shared }}>
              <rect className="ib-banner" x={P.b[0] - 6} y={P.b[1] + NH + 12} width={NW + 12} height={34} rx={9} />
              <text x={P.b[0] + NW / 2} y={P.b[1] + NH + 35} textAnchor="middle" className="ib-n">{`${T.shared}: b.txt ${C2.files['b.txt']}`}</text>
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
