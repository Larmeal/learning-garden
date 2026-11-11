import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// JoinSelection as a flow chart you can walk with your own inputs (SparkStrategies.scala:181-420, joins.scala:318-390,
// lesson 7 in depth). The order of the checks and the table of build sides come from the source. The presets marked
// "วัดจริง" are cases that exercises/07_performance_tuning.py ran and whose plans the lesson quotes; every other
// combination is the same rules applied by hand, not run. Simplifications: keys are assumed sortable and hashable,
// a hint is attached to the smaller side, and "ขนาดเข้าเงื่อนไข shuffled hash" stands for the three size checks of the
// lesson (size below threshold x partitions, factor 3, join type) taken together.

type JType = 'inner' | 'left' | 'right' | 'full' | 'semi';
type Hint = 'none' | 'broadcast' | 'merge' | 'shuffle_hash' | 'shuffle_replicate_nl';
interface Inp {
  equi: boolean;
  jt: JType;
  hint: Hint;
  smallSide: 'left' | 'right';
  small: boolean;
  preferSMJ: boolean;
  shjOk: boolean;
}

const canBuild = (side: 'left' | 'right', jt: JType) => (side === 'left' ? jt === 'inner' || jt === 'right' : jt === 'inner' || jt === 'left' || jt === 'semi');

interface Out {
  path: string[];
  result: string;
  why: string;
}
function decide(i: Inp, L: Text): Out {
  if (!i.equi) {
    const path = ['eq', 'ne_q'];
    if (i.hint !== 'none' || i.small) return { path: [...path, 'BNLJ'], result: 'BroadcastNestedLoopJoin', why: i.hint !== 'none' ? L.whyNeHint : L.whyNeSmall };
    if (i.jt === 'inner') return { path: [...path, 'ne_inner', 'CART'], result: 'CartesianProduct', why: L.whyCart };
    return { path: [...path, 'ne_inner', 'BNLJ'], result: 'BroadcastNestedLoopJoin', why: L.whyNeBnlj };
  }
  const path = ['eq', 'hint'];
  const hintSide = i.smallSide;
  let usable = false;
  let res = '';
  let why = '';
  if (i.hint === 'broadcast' && canBuild(hintSide, i.jt)) { usable = true; res = 'BroadcastHashJoin'; why = L.whyHintBroadcast; }
  if (i.hint === 'merge') { usable = true; res = 'SortMergeJoin'; why = L.whyHintMerge; }
  if (i.hint === 'shuffle_hash') { usable = true; res = 'ShuffledHashJoin'; why = L.whyHintShj; }
  if (i.hint === 'shuffle_replicate_nl' && i.jt === 'inner') { usable = true; res = 'CartesianProduct'; why = L.whyHintNl; }
  if (usable) return { path: [...path, 'hintRes'], result: res, why };

  const unusable = i.hint !== 'none' ? L.hintUnusable : '';
  path.push('bhj_q');
  if (i.small && canBuild(i.smallSide, i.jt)) return { path: [...path, 'BHJ'], result: 'BroadcastHashJoin', why: unusable + L.whyBhj };
  path.push('shj_q');
  if (!i.preferSMJ && i.shjOk) return { path: [...path, 'SHJ'], result: 'ShuffledHashJoin', why: unusable + L.whyShj };
  return { path: [...path, 'SMJ'], result: 'SortMergeJoin', why: unusable + (i.small ? L.smjSmallNoBuild : '') + L.whySmj };
}

interface Text {
  whyNeHint: string;
  whyNeSmall: string;
  whyCart: string;
  whyNeBnlj: string;
  whyHintBroadcast: string;
  whyHintMerge: string;
  whyHintShj: string;
  whyHintNl: string;
  hintUnusable: string;
  whyBhj: string;
  whyShj: string;
  smjSmallNoBuild: string;
  whySmj: string;
  nodes: Record<string, string>;
  edges: string[];
  presets: string[];
  jt: Record<JType, string>;
  measured: string;
  startName: string;
  startTitle: string;
  startText: string;
  resultName: string;
  resultTitle: (r: string) => string;
  title: string;
  presetGroup: string;
  noHint: string;
  hintBtn: (h: string) => string;
  otherGroup: string;
  equiBtn: (on: boolean) => string;
  smallSideBtn: (left: boolean) => string;
  smallBtn: (on: boolean) => string;
  preferBtn: (on: boolean) => string;
  shjBtn: (on: boolean) => string;
  svgLabel: (r: string) => string;
  equiTitle: string;
  noEqTitle: string;
  resultBox: string;
  matchesRun: string;
  byRules: string;
  notRun: string;
  caption: string;
}
const TEXT: Record<Lang, Text> = {
  th: {
    whyNeHint: 'Join ที่ไม่มีเงื่อนไข = ถ้ามี Hint ก็จะได้ BNLJ',
    whyNeSmall: 'ฝั่งเล็กพอ จึง Broadcast แล้ววนเทียบทีละแถว (BNLJ)',
    whyCart: 'ไม่มี Hint ฝั่งไหนก็ไม่เล็กพอ และเป็น Inner join จึงได้ CartesianProduct',
    whyNeBnlj: 'Cartesian ใช้ได้เฉพาะ Inner-like ที่เหลือจึงได้ BNLJ อยู่ดี ซึ่งซอร์สเตือนว่าอาจช้ามากหรือ OOM',
    whyHintBroadcast: 'Hint broadcast ที่ฝั่งเล็ก และ Join type นี้ Build ฝั่งนั้นได้',
    whyHintMerge: 'Hint merge',
    whyHintShj: 'Hint shuffle_hash (Build ฝั่งที่ใส่ Hint)',
    whyHintNl: 'Hint shuffle_replicate_nl กับ Inner join',
    hintUnusable: 'Hint ใช้ไม่ได้กับ Join type และฝั่งนี้ จึงทำเหมือนไม่มี Hint: ',
    whyBhj: 'ฝั่งเล็กอยู่ใต้ autoBroadcastJoinThreshold และ Join type นี้ Build ฝั่งนั้นได้',
    whyShj: 'preferSortMergeJoin เป็น false และขนาดผ่านเงื่อนไข (ค่าเริ่มต้นของ preferSortMergeJoin คือ true และเป็น Internal)',
    smjSmallNoBuild: 'ฝั่งเล็กพอ แต่ Join type นี้ Build ฝั่งนั้นเป็น Broadcast ไม่ได้ ',
    whySmj: 'ไม่เข้าเงื่อนไข Broadcast และ Shuffled hash จึงตกมาที่ SortMergeJoin ซึ่งเป็นค่าตั้งต้นของ Equi-join',
    nodes: {
      eq: 'มีเงื่อนไข "=" ไหม?', hint: 'มี Hint ที่ใช้ได้ไหม?', bhj_q: 'ฝั่งเล็กพอ และ Build ได้?', shj_q: 'prefer SMJ = false และขนาดผ่าน?',
      hintRes: 'ตาม Hint', BHJ: 'BroadcastHashJoin', SHJ: 'ShuffledHashJoin', SMJ: 'SortMergeJoin',
      ne_q: 'มี Hint หรือฝั่งเล็กพอ?', ne_inner: 'เป็น Inner join?', BNLJ: 'BroadcastNestedLoopJoin', CART: 'CartesianProduct',
    },
    edges: ['มี =', 'ไม่มี =', 'ใช้ได้', 'ไม่มี / ใช้ไม่ได้', 'ใช่', 'ไม่', 'ใช่', 'ไม่', 'ใช่', 'ไม่', 'ใช่', 'ไม่'],
    presets: [
      'ค่าเริ่มต้น: ฝั่งเล็กพอ',
      'Threshold 100 ไบต์ (ค่าเริ่มต้นอื่น)',
      'Threshold 100 และ preferSortMergeJoin=false',
      'Threshold -1 และ preferSortMergeJoin=false',
      'ไม่มี "=" (big.k < small.k)',
      'ไม่มี "=" และ Threshold -1',
      'ไม่มี "=", Left outer, Threshold -1',
      'Hint broadcast',
      'ฝั่งซ้ายเล็ก แต่เป็น Left outer',
    ],
    jt: { inner: 'inner', left: 'left outer', right: 'right outer', full: 'full outer', semi: 'left semi' },
    measured: ' (วัดจริง)',
    startName: 'เริ่ม',
    startTitle: 'ถามทีละข้อตามลำดับของ JoinSelection',
    startText: 'ลองเลือกตัวอย่างหรือปรับเงื่อนไขด้านบน แล้วดูว่าเส้นทางไปจบที่ Strategy ไหน กล่องที่ติดสีคือข้อที่ผ่านมาแล้ว',
    resultName: 'ผลลัพธ์',
    resultTitle: (r) => `ได้ ${r}`,
    title: 'Spark เลือก Join strategy อย่างไร ลองเดินตามผังด้วยเงื่อนไขของคุณ',
    presetGroup: 'ตัวอย่าง',
    noHint: 'ไม่มี Hint',
    hintBtn: (h) => `Hint ${h}`,
    otherGroup: 'เงื่อนไขอื่น',
    equiBtn: (on) => `มีเงื่อนไข "=": ${on ? 'ใช่' : 'ไม่'}`,
    smallSideBtn: (left) => `ฝั่งที่เล็กกว่า: ${left ? 'ซ้าย' : 'ขวา'}`,
    smallBtn: (on) => `ฝั่งเล็กอยู่ใต้ Broadcast threshold: ${on ? 'ใช่' : 'ไม่'}`,
    preferBtn: (on) => `preferSortMergeJoin: ${on ? 'true (ค่าเริ่มต้น)' : 'false'}`,
    shjBtn: (on) => `ขนาดผ่านเงื่อนไข Shuffled hash: ${on ? 'ใช่' : 'ไม่'}`,
    svgLabel: (r) => `ผังเลือก Join strategy ผลคือ ${r}`,
    equiTitle: 'Equi-join (มี =)',
    noEqTitle: 'ไม่มี =',
    resultBox: 'ผลที่ได้',
    matchesRun: 'ตรงกับที่รันจริง',
    byRules: 'คำนวณตามกฎ',
    notRun: 'ยังไม่ได้รัน',
    caption: 'ลำดับคำถามและตารางว่า Join type ไหน Build ฝั่งไหนได้ อ่านมาจาก SparkStrategies.scala และ joins.scala (Spark 4.2.0) ส่วนตัวอย่างที่มีคำว่า "วัดจริง" คือกรณีที่ exercises/07_performance_tuning.py รันแล้วอ่านผลจาก explain() ส่วนชุดเงื่อนไขอื่นเป็นการใช้กฎเดียวกันด้วยมือ โดยเราสมมติว่า Key เรียงและทำ Hash ได้ และ Hint ติดอยู่ที่ฝั่งเล็ก',
  },
  en: {
    whyNeHint: 'A join without an = condition: with a hint it is BNLJ',
    whyNeSmall: 'One side is small enough, so it is broadcast and compared row by row (BNLJ)',
    whyCart: 'No hint, neither side is small, and it is an inner join, so it is CartesianProduct',
    whyNeBnlj: 'Cartesian works only for inner-like joins, so the rest become BNLJ anyway. The source warns that this can be very slow or run out of memory.',
    whyHintBroadcast: 'A broadcast hint on the small side, and this join type can build that side',
    whyHintMerge: 'merge hint',
    whyHintShj: 'shuffle_hash hint (builds the side that has the hint)',
    whyHintNl: 'shuffle_replicate_nl hint with an inner join',
    hintUnusable: 'The hint cannot be used with this join type and side, so it acts as if there were no hint: ',
    whyBhj: 'The small side is under autoBroadcastJoinThreshold and this join type can build that side',
    whyShj: 'preferSortMergeJoin is false and the size passes the checks (the default of preferSortMergeJoin is true, and it is internal)',
    smjSmallNoBuild: 'The small side is small enough, but this join type cannot broadcast that side. ',
    whySmj: 'It fails the broadcast and shuffled hash conditions, so it falls to SortMergeJoin, the default for an equi-join',
    nodes: {
      eq: 'Is there an "=" condition?', hint: 'Is there a usable hint?', bhj_q: 'Small side and can build?', shj_q: 'prefer SMJ false, size ok?',
      hintRes: 'Follow the hint', BHJ: 'BroadcastHashJoin', SHJ: 'ShuffledHashJoin', SMJ: 'SortMergeJoin',
      ne_q: 'Hint or small side?', ne_inner: 'Is it an inner join?', BNLJ: 'BroadcastNestedLoopJoin', CART: 'CartesianProduct',
    },
    edges: ['= yes', '= no', 'usable', 'none / unusable', 'yes', 'no', 'yes', 'no', 'yes', 'no', 'yes', 'no'],
    presets: [
      'Defaults: small side is small enough',
      'threshold 100 bytes (other defaults)',
      'threshold 100 and preferSortMergeJoin=false',
      'threshold -1 and preferSortMergeJoin=false',
      'No "=" (big.k < small.k)',
      'No "=" and threshold -1',
      'No "=", left outer, threshold -1',
      'broadcast hint',
      'Left side is small, but left outer',
    ],
    jt: { inner: 'inner', left: 'left outer', right: 'right outer', full: 'full outer', semi: 'left semi' },
    measured: ' (measured)',
    startName: 'start',
    startTitle: 'Ask the questions one by one in the order of JoinSelection',
    startText: 'Pick an example or change the conditions above, then see which strategy the path ends at. The colored boxes are the questions it passed.',
    resultName: 'result',
    resultTitle: (r) => `Result: ${r}`,
    title: 'How Spark picks a join strategy: walk the chart with your own conditions',
    presetGroup: 'Examples',
    noHint: 'no hint',
    hintBtn: (h) => `hint ${h}`,
    otherGroup: 'Other conditions',
    equiBtn: (on) => `Has "=" condition: ${on ? 'yes' : 'no'}`,
    smallSideBtn: (left) => `Smaller side: ${left ? 'left' : 'right'}`,
    smallBtn: (on) => `Small side under broadcast threshold: ${on ? 'yes' : 'no'}`,
    preferBtn: (on) => `preferSortMergeJoin: ${on ? 'true (default)' : 'false'}`,
    shjBtn: (on) => `Size passes shuffled hash checks: ${on ? 'yes' : 'no'}`,
    svgLabel: (r) => `Join strategy chart, the result is ${r}`,
    equiTitle: 'equi-join (has =)',
    noEqTitle: 'no =',
    resultBox: 'Result',
    matchesRun: 'Matches real run',
    byRules: 'By the rules',
    notRun: 'Not run',
    caption: 'The order of the questions and the table of which join type can build which side are read from SparkStrategies.scala and joins.scala (Spark 4.2.0). Examples marked "measured" are cases that exercises/07_performance_tuning.py ran and read from explain(). The other combinations apply the same rules by hand. I assume the keys are sortable and hashable, and that a hint is attached to the smaller side.',
  },
};

const W = 190;
const H = 46;
const NODES: Record<string, { x: number; y: number; kind: 'q' | 'r' }> = {
  eq: { x: 24, y: 214, kind: 'q' },
  hint: { x: 258, y: 44, kind: 'q' },
  bhj_q: { x: 258, y: 118, kind: 'q' },
  shj_q: { x: 258, y: 192, kind: 'q' },
  hintRes: { x: 502, y: 44, kind: 'r' },
  BHJ: { x: 502, y: 118, kind: 'r' },
  SHJ: { x: 502, y: 192, kind: 'r' },
  SMJ: { x: 502, y: 266, kind: 'r' },
  ne_q: { x: 258, y: 350, kind: 'q' },
  ne_inner: { x: 258, y: 424, kind: 'q' },
  BNLJ: { x: 502, y: 350, kind: 'r' },
  CART: { x: 502, y: 424, kind: 'r' },
};
// edge labels are per language (TEXT.edges, same order)
const EDGES: [string, string][] = [
  ['eq', 'hint'],
  ['eq', 'ne_q'],
  ['hint', 'hintRes'],
  ['hint', 'bhj_q'],
  ['bhj_q', 'BHJ'],
  ['bhj_q', 'shj_q'],
  ['shj_q', 'SHJ'],
  ['shj_q', 'SMJ'],
  ['ne_q', 'BNLJ'],
  ['ne_q', 'ne_inner'],
  ['ne_inner', 'CART'],
  ['ne_inner', 'BNLJ'],
];

const BASE: Inp = { equi: true, jt: 'inner', hint: 'none', smallSide: 'right', small: true, preferSMJ: true, shjOk: false };
// preset labels are per language (TEXT.presets, same order)
const PRESETS: { real: boolean; v: Inp }[] = [
  { real: true, v: BASE },
  { real: true, v: { ...BASE, small: false, shjOk: true } },
  { real: true, v: { ...BASE, small: false, shjOk: true, preferSMJ: false } },
  { real: true, v: { ...BASE, small: false, shjOk: false, preferSMJ: false } },
  { real: true, v: { ...BASE, equi: false } },
  { real: true, v: { ...BASE, equi: false, small: false } },
  { real: true, v: { ...BASE, equi: false, small: false, jt: 'left' } },
  { real: true, v: { ...BASE, hint: 'broadcast', small: false } },
  { real: false, v: { ...BASE, jt: 'left', smallSide: 'left' } },
];

const JT_IDS: JType[] = ['inner', 'left', 'right', 'full', 'semi'];
const HINTS: Hint[] = ['none', 'broadcast', 'merge', 'shuffle_hash', 'shuffle_replicate_nl'];

function edgePath(a: string, b: string) {
  const A = NODES[a];
  const B = NODES[b];
  if (A.x === B.x) return `M${A.x + W / 2} ${A.y + H} V${B.y}`;
  const x1 = A.x + W;
  const y1 = A.y + H / 2;
  const x2 = B.x;
  const y2 = B.y + H / 2;
  const xm = (x1 + x2) / 2;
  return `M${x1} ${y1} H${xm} V${y2} H${x2}`;
}

export default function JoinDecisionLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  const [inp, setInp] = useState<Inp>(BASE);
  const clock = useClock(9);
  const { t } = clock;
  const out = useMemo(() => decide(inp, L), [inp, L]);
  const preset = PRESETS.find((p) => JSON.stringify(p.v) === JSON.stringify(inp));
  const set = (patch: Partial<Inp>) => { setInp({ ...inp, ...patch }); clock.restart(); };

  const STEP = 0.8;
  const lit = (id: string) => {
    const i = out.path.indexOf(id);
    return i >= 0 && t >= 0.4 + i * STEP;
  };
  const edgeOn = (a: string, b: string) => {
    const ia = out.path.indexOf(a);
    const ib = out.path.indexOf(b);
    return ia >= 0 && ib === ia + 1 && t >= 0.4 + ib * STEP - 0.3;
  };
  const doneAt = 0.4 + out.path.length * STEP;
  const marks: Mark[] = [
    { at: 0, name: L.startName, title: L.startTitle, text: L.startText },
    { at: Math.max(0.5, doneAt - STEP * 1.2), name: L.resultName, title: L.resultTitle(out.result), text: out.why },
  ];

  const labelFor = (id: string) => (id === 'hintRes' && lit('hintRes') ? (inp.hint === 'broadcast' ? 'BroadcastHashJoin (hint)' : inp.hint === 'merge' ? 'SortMergeJoin (hint)' : inp.hint === 'shuffle_hash' ? 'ShuffledHashJoin (hint)' : 'CartesianProduct (hint)') : L.nodes[id]);

  return (
    <figure className="viz lg">
      <div className="viz-title">{L.title}</div>
      <div className="viz-steps" role="group" aria-label={L.presetGroup}>
        {PRESETS.map((p, pi) => (
          <button key={pi} type="button" aria-pressed={JSON.stringify(p.v) === JSON.stringify(inp)} onClick={() => { setInp(p.v); clock.restart(); }}>
            {L.presets[pi]}{p.real ? L.measured : ''}
          </button>
        ))}
      </div>
      <div className="viz-steps" role="group" aria-label="join type">
        {JT_IDS.map((j) => <button key={j} type="button" aria-pressed={inp.jt === j} onClick={() => set({ jt: j })}>{L.jt[j]}</button>)}
      </div>
      <div className="viz-steps" role="group" aria-label="hint">
        {HINTS.map((h) => <button key={h} type="button" aria-pressed={inp.hint === h} onClick={() => set({ hint: h })}>{h === 'none' ? L.noHint : L.hintBtn(h)}</button>)}
      </div>
      <div className="viz-steps" role="group" aria-label={L.otherGroup}>
        <button type="button" aria-pressed={inp.equi} onClick={() => set({ equi: !inp.equi })}>{L.equiBtn(inp.equi)}</button>
        <button type="button" aria-pressed={inp.smallSide === 'left'} onClick={() => set({ smallSide: inp.smallSide === 'left' ? 'right' : 'left' })}>{L.smallSideBtn(inp.smallSide === 'left')}</button>
        <button type="button" aria-pressed={inp.small} onClick={() => set({ small: !inp.small })}>{L.smallBtn(inp.small)}</button>
        <button type="button" aria-pressed={!inp.preferSMJ} onClick={() => set({ preferSMJ: !inp.preferSMJ })}>{L.preferBtn(inp.preferSMJ)}</button>
        <button type="button" aria-pressed={inp.shjOk} onClick={() => set({ shjOk: !inp.shjOk })}>{L.shjBtn(inp.shjOk)}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 500" role="img" aria-label={L.svgLabel(out.result)}>
          <rect className="band" x="10" y="10" width="860" height="480" rx="12" />
          <text className="s b" x="24" y="34">{L.equiTitle}</text>
          <text className="s b" x="24" y="338">{L.noEqTitle}</text>

          {EDGES.map(([a, b], ei) => {
            const l = L.edges[ei];
            const on = edgeOn(a, b);
            const A = NODES[a];
            const B = NODES[b];
            const mx = A.x === B.x ? A.x + W / 2 + 8 : (A.x + W + B.x) / 2 + 4;
            const my = A.x === B.x ? (A.y + H + B.y) / 2 + 4 : (A.y + B.y) / 2 + H / 2 - 4;
            return (
              <g key={a + b}>
                <path d={edgePath(a, b)} fill="none" stroke={on ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={on ? 3.5 : 1.6} opacity={on ? 1 : 0.7} />
                <text className="s" x={mx} y={my} style={{ fill: on ? 'var(--accent)' : undefined, fontWeight: on ? 700 : undefined }}>{l}</text>
              </g>
            );
          })}
          {Object.entries(NODES).map(([id, n]) => {
            const on = lit(id);
            const final = on && out.path[out.path.length - 1] === id;
            return (
              <g key={id} transform={`translate(${n.x} ${n.y})`}>
                <rect width={W} height={H} rx={n.kind === 'q' ? 8 : 23} className={final ? 'fx-hot' : on ? 'fx-file' : 'box'} stroke={final ? 'var(--accent)' : on ? 'var(--k2)' : undefined} strokeWidth={on ? 2.5 : undefined} opacity={on || id === 'eq' ? 1 : 0.7} />
                <text className={n.kind === 'r' ? 'm b' : ''} x={W / 2} y={H / 2 + 5} textAnchor="middle" style={{ fontSize: n.kind === 'r' ? 12 : 12.5 }}>{labelFor(id)}</text>
              </g>
            );
          })}

          <g transform="translate(724 120)" opacity={smooth(prog(t, doneAt - 0.3, doneAt + 0.3))}>
            <rect className="fx-hot" width="136" height="150" rx="10" />
            <text className="s" x="10" y="22">{L.resultBox}</text>
            <text className="b" x="10" y="46" style={{ fontSize: 13 }}>{out.result.match(/^(Broadcast|Sort|Shuffled|Cartesian)/)![0]}</text>
            <text className="b" x="10" y="64" style={{ fontSize: 13 }}>{out.result.replace(/^(Broadcast|Sort|Shuffled|Cartesian)/, '')}</text>
            {preset?.real && <text className="s b acc" x="10" y="94">{L.matchesRun}</text>}
            {!preset?.real && <text className="s" x="10" y="94">{L.byRules}</text>}
            {!preset?.real && <text className="s" x="10" y="112">{L.notRun}</text>}
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{L.caption}</figcaption>
    </figure>
  );
}
