import { useEffect, useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend, Node } from '../iceberg/ib';
import data from './objectGraph.json';

// Shows:      the objects behind two commits: a commit points at a tree, a tree points at blobs and at other trees. The second commit changes
//             one file, and the picture shows which objects are new (a commit, a tree, a blob) and which are reused (the subtree src and the
//             blob of app.txt). Every box can be clicked to read its real bytes.
// Because:    "a commit stores a snapshot but only the changed path is new" is a statement about shared objects. A sentence says it, but only a
//             picture with an arrow from the new tree back to the old subtree shows that nothing was copied.
// Control:    the step buttons, and a click on any box. Each step changes what is drawn or what is selected.
// Conclusion: an unchanged file or folder is not stored again. The new commit points at the old object.
//
// Data: exercises/15_object_graph.py --write reads every object with git cat-file and saves objectGraph.json. The ids are the ones that
// exercise 11 prints too (top tree e5f88fb, subtree src 8e37aeb, second commit d712b54).

type Obj = { id: string; short: string; type: string; size: number; pretty: string; points: string[]; store: string };
const OBJ = data.objects as Record<string, Obj>;
const ID = { c1: data.c1, c2: data.c2, t1: data.t1, t2: data.t2, src: data.src, hello: data.hello, app: data.app, hello2: data.hello2 };

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; heads: [string, string, string]; reused: string; fresh: string; absent: string;
  commit: [string, string]; tree: [string, string]; src: string; blobs: [string, string, string];
  inspect: string; field: { id: string; kind: string; stored: string; shown: string; points: string; none: string; hint: string };
  steps: StepInfo[]; caption: string;
}> = {
  th: {
    title: 'Commit ชี้ Tree และ Tree ชี้ Blob กดทีละขั้นเพื่อดูว่า Commit ที่สองสร้างอะไรใหม่ ใช้อะไรซ้ำ แล้วคลิกกล่องใดก็ได้เพื่ออ่านไบต์ข้างใน',
    legend: [{ kind: 'new', text: 'Object ใหม่' }, { kind: 'use', text: 'Object ที่ใช้ซ้ำ' }, { kind: 'node', text: 'ยังไม่เกิด (เส้นประ)' }],
    heads: ['Commit', 'โฟลเดอร์ (Tree)', 'เนื้อไฟล์ (Blob)'], reused: 'ใช้ซ้ำ', fresh: 'ใหม่', absent: 'ยังไม่เกิด',
    commit: ['Commit แรก', 'Commit ที่สอง'], tree: ['โฟลเดอร์หลัก', 'โฟลเดอร์หลัก (ใหม่)'], src: 'โฟลเดอร์ src', blobs: ['hello', 'hello + world', 'app'],
    inspect: 'คลิกกล่องเพื่อดูข้างใน', field: { id: 'ID เต็ม', kind: 'ชนิดและขนาด', stored: 'ข้อมูลที่ถูก Hash (Header + NUL + เนื้อหา)', shown: 'git cat-file -p', points: 'ชี้ไปที่', none: 'ไม่ชี้ไปที่ไหน', hint: 'ไบต์ดิบของ Tree เก็บ ID เป็นเลขฐานสอง 20 ไบต์ จึงไม่แสดงตรงนี้' },
    steps: [
      { name: 'Commit แรก', title: 'Commit ชี้ Tree และ Tree ชี้ Blob กับ Tree ย่อย', text: 'Commit แรกชี้ Tree หลัก ซึ่งจดสองรายการ คือ Blob ของ notes.txt (hello) และ Tree ย่อยของโฟลเดอร์ src ที่ชี้ Blob ของ app.txt ชื่อไฟล์อยู่บนเส้นที่ออกจาก Tree ไม่ได้อยู่ใน Blob' },
      { name: 'Commit ที่สอง', title: 'แก้ notes.txt แล้ว Commit: เกิดสามอย่างใหม่ ที่เหลือใช้ซ้ำ', text: 'เกิด Blob ใหม่ (hello + world) Tree หลักใหม่ และ Commit ใหม่ที่ชี้กลับไปที่ Commit แรกเป็น Parent ส่วน Tree ย่อย src กับ Blob ของ app.txt ไม่มีอะไรเปลี่ยน Tree หลักใหม่จึงชี้ไปที่ของเดิม' },
      { name: 'ดูข้างใน', title: 'ID ของ Commit คำนวณจากข้อความข้างในรวมถึง Parent', text: 'คลิก Commit ที่สองจะเห็นบรรทัด parent ชี้ Commit แรก ID ของ Commit ผูกกับประวัติทั้งสายก่อนหน้า ส่วน Tree หลักใหม่ชี้ Blob ใหม่ และ Tree src เดิมในรายการเดียวกัน' },
    ],
    caption: 'ID ไบต์ และข้อความทุกอย่างในภาพอ่านจาก Repository จริงด้วย git cat-file ในแบบฝึก 15 ส่วนชื่อที่เห็นบนกล่อง (Commit แรก, โฟลเดอร์ src) เป็นชื่อที่เราตั้งให้อ่านง่าย',
  },
  en: {
    title: 'A commit points at a tree, and a tree points at blobs. Step through to see what the second commit makes new and what it reuses, then click any box to read the bytes inside',
    legend: [{ kind: 'new', text: 'a new object' }, { kind: 'use', text: 'a reused object' }, { kind: 'node', text: 'not made yet (dashed)' }],
    heads: ['Commit', 'Folder (tree)', 'File content (blob)'], reused: 'reused', fresh: 'new', absent: 'not made yet',
    commit: ['First commit', 'Second commit'], tree: ['Top folder', 'Top folder (new)'], src: 'Folder src', blobs: ['hello', 'hello + world', 'app'],
    inspect: 'Click a box to look inside', field: { id: 'Full id', kind: 'Type and size', stored: 'What is hashed (header + NUL + content)', shown: 'git cat-file -p', points: 'Points at', none: 'points at nothing', hint: 'The raw bytes of a tree hold each id as 20 binary bytes, so they are not shown here' },
    steps: [
      { name: 'first commit', title: 'A commit points at a tree, and a tree points at blobs and subtrees', text: 'The first commit points at the top tree, which lists two entries: the blob of notes.txt (hello) and the subtree of the folder src, which points at the blob of app.txt. The file names are on the lines that leave a tree. They are not in a blob.' },
      { name: 'second commit', title: 'Edit notes.txt and commit: three new objects, the rest reused', text: 'A new blob (hello + world), a new top tree and a new commit are made, and the commit points back at the first commit as its parent. The subtree src and the blob of app.txt did not change, so the new top tree points at the old ones.' },
      { name: 'look inside', title: 'The id of a commit is computed from its text, parent included', text: 'Click the second commit and you see a parent line that points at the first commit. The id of a commit is tied to the whole history before it. The new top tree lists the new blob and the old tree src in the same list.' },
    ],
    caption: 'Every id, size and text in the picture is read from a real repository with git cat-file in exercise 15. The names on the boxes (First commit, folder src) are names we gave to make them easy to read.',
  },
};

const NW = 160;
const NH = 66;
const POS = { c1: [16, 96], t1: [216, 96], hello: [476, 48], src: [476, 144], app: [716, 144], c2: [16, 300], t2: [216, 300], hello2: [476, 300] } as const;
type K = keyof typeof POS;

export default function ObjectStoreLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 6200);
  const defaults: K[] = ['c1', 'c2', 'c2'];
  const [sel, setSel] = useState<K>('c1');
  useEffect(() => setSel(defaults[step]), [step]);
  const second = step >= 1;
  const state = (k: K): 'new' | 'use' | 'node' => {
    if (['c2', 't2', 'hello2'].includes(k)) return second ? (step === 1 ? 'new' : 'use') : 'node';
    return step === 0 ? 'new' : 'use';
  };
  const present = (k: K) => second || !['c2', 't2', 'hello2'].includes(k);
  const mid = (k: K, side: 'l' | 'r' | 't' | 'b') => {
    const [x, y] = POS[k];
    return side === 'r' ? [x + NW, y + NH / 2] : side === 'l' ? [x, y + NH / 2] : side === 't' ? [x + NW / 2, y] : [x + NW / 2, y + NH];
  };
  const edge = (a: K, b: K, label?: string, from: 'r' | 'b' | 't' = 'r', to: 'l' | 'b' | 't' = 'l', off = 0) => {
    if (!present(a) || !present(b)) return null;
    const p = mid(a, from);
    const q = mid(b, to);
    return (
      <g key={a + b}>
        <path className="ib-arrow" d={`M${p[0]},${p[1] + off} L${q[0]},${q[1]}`} />
        {label && <text x={(p[0] + q[0]) / 2} y={(p[1] + q[1]) / 2 - 8 + off / 2} textAnchor="middle" className="ib-m" style={{ fontSize: 14 }}>{label}</text>}
      </g>
    );
  };
  const objOf = (k: K): Obj => OBJ[ID[k]];
  const titleOf = (k: K) => ({ c1: T.commit[0], c2: T.commit[1], t1: T.tree[0], t2: T.tree[1], src: T.src, hello: T.blobs[0], hello2: T.blobs[1], app: T.blobs[2] })[k];
  const tagOf = (k: K) => (step === 1 && ['src', 'app'].includes(k) ? T.reused : step === 1 && ['c2', 't2', 'hello2'].includes(k) ? T.fresh : undefined);
  const o = objOf(sel);

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          {[16, 216, 476].map((x, i) => <text key={x} x={x} y={28} className="ib-s" style={{ fontWeight: 700 }}>{T.heads[i]}</text>)}
          {edge('c1', 't1')}
          {edge('t1', 'hello', 'notes.txt', 'r', 'l', -14)}
          {edge('t1', 'src', 'src', 'r', 'l', 14)}
          {edge('src', 'app', 'app.txt')}
          {edge('c2', 't2')}
          {edge('t2', 'hello2', 'notes.txt')}
          {second && (
            <g>
              <path className="ib-arrow" d={`M${mid('t2', 'r')[0]},${mid('t2', 'r')[1] - 14} L${mid('src', 'b')[0] - 40},${mid('src', 'b')[1] + 2}`} style={{ stroke: 'var(--accent)' }} />
              <text x={mid('t2', 'r')[0] + 52} y={mid('src', 'b')[1] + 80} className="ib-m" style={{ fontSize: 14 }}>src</text>
            </g>
          )}
          {second && (
            <g>
              <path className="ib-arrow" d={`M${mid('c2', 't')[0]},${mid('c2', 't')[1]} L${mid('c1', 'b')[0]},${mid('c1', 'b')[1]}`} />
              <text x={mid('c1', 'b')[0] + 8} y={(mid('c2', 't')[1] + mid('c1', 'b')[1]) / 2 + 4} className="ib-m" style={{ fontSize: 14 }}>parent</text>
            </g>
          )}
          {(Object.keys(POS) as K[]).map((k) => {
            const [x, y] = POS[k];
            const ob = objOf(k);
            const shown = present(k);
            return (
              <g key={k} role="button" tabIndex={0} aria-label={`${titleOf(k)} ${ob.short}`} style={{ cursor: shown ? 'pointer' : 'default' }}
                onClick={() => shown && setSel(k)} onKeyDown={(e) => { if (shown && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSel(k); } }}>
                {shown ? (
                  <Node x={x} y={y} w={NW} h={NH} title={titleOf(k)} sub={`${ob.type} ${ob.short}`} state={state(k)} tag={tagOf(k)} />
                ) : (
                  <g>
                    <rect className="ib-node" x={x} y={y} width={NW} height={NH} rx={9} style={{ strokeDasharray: '6 5', opacity: 0.5 }} />
                    <text x={x + NW / 2} y={y + NH / 2 + 6} textAnchor="middle" className="ib-s">{T.absent}</text>
                  </g>
                )}
                {shown && sel === k && <rect x={x - 5} y={y - 5} width={NW + 10} height={NH + 10} rx={12} fill="none" stroke="var(--fg)" strokeWidth={2} strokeDasharray="6 4" />}
              </g>
            );
          })}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <div className="tbl-wrap">
        <table className="mini-tbl">
          <caption style={{ textAlign: 'left', fontWeight: 600, paddingBottom: 6 }}>{T.inspect}: {titleOf(sel)}</caption>
          <tbody>
            <tr><th>{T.field.id}</th><td style={{ fontFamily: 'var(--mono, monospace)', wordBreak: 'break-all' }}>{o.id}</td></tr>
            <tr><th>{T.field.kind}</th><td>{o.type} · {o.size} bytes</td></tr>
            <tr><th>{T.field.stored}</th><td style={{ fontFamily: 'var(--mono, monospace)', wordBreak: 'break-all' }}>{o.type === 'tree' ? `tree ${o.size}\\0 ... (${o.points.length})` : o.store}</td></tr>
            <tr><th>{T.field.shown}</th><td><pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}>{o.pretty}</pre></td></tr>
            <tr><th>{T.field.points}</th><td style={{ fontFamily: 'var(--mono, monospace)' }}>{o.points.length ? o.points.map((p) => `${OBJ[p].type} ${OBJ[p].short}`).join(', ') : T.none}{o.type === 'tree' ? ` — ${T.field.hint}` : ''}</td></tr>
          </tbody>
        </table>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
