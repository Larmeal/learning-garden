import { useMemo } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// One FixedPoint batch of the Optimizer, "Operator Optimization before Inferring Filters", on a query with four nested
// subqueries (exercises/06b_rule_iterations.py, Spark 4.2.0):
//   SELECT x FROM (SELECT y + 1 AS x FROM (SELECT z + 1 AS y FROM (SELECT id + 1 AS z FROM nums WHERE id > 5) WHERE z < 100) WHERE y > 0) WHERE x > 1
// Measured: the batch ran 4 rounds; the rules that changed the plan, in order, were PushDownPredicates, CollapseProject,
// ConstantFolding, ReorderAssociativeOperator (round 1), the same four (round 2), ConstantFolding (round 3) and none
// (round 4, the round that proves nothing changes any more). The plan after each effective rule is read from the plan
// change log, with casts and ids left out and long filters shortened.

interface N {
  id: string;
  text: string;
}
const S: N[][] = [
  [
    { id: 'fx', text: 'Filter x > 1' },
    { id: 'px', text: 'Project (y + 1) AS x' },
    { id: 'fy', text: 'Filter y > 0' },
    { id: 'py', text: 'Project (z + 1) AS y' },
    { id: 'fz', text: 'Filter z < 100' },
    { id: 'pz', text: 'Project (id + 1) AS z' },
    { id: 'fid', text: 'Filter id > 5' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // round 1: PushDownPredicates
  [
    { id: 'px', text: 'Project (y + 1) AS x' },
    { id: 'fy', text: 'Filter y > 0 AND y + 1 > 1' },
    { id: 'py', text: 'Project (z + 1) AS y' },
    { id: 'pz', text: 'Project (id + 1) AS z' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // CollapseProject
  [
    { id: 'px', text: 'Project (y + 1) AS x' },
    { id: 'fy', text: 'Filter y > 0 AND y + 1 > 1' },
    { id: 'py', text: 'Project ((id + 1) + 1) AS y' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // ConstantFolding (the casts of the literals go away)
  [
    { id: 'px', text: 'Project (y + 1) AS x' },
    { id: 'fy', text: 'Filter y > 0 AND y + 1 > 1' },
    { id: 'py', text: 'Project ((id + 1) + 1) AS y' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // ReorderAssociativeOperator
  [
    { id: 'px', text: 'Project (y + 1) AS x' },
    { id: 'fy', text: 'Filter y > 0 AND y + 1 > 1' },
    { id: 'py', text: 'Project (id + (1 + 1)) AS y' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // round 2: PushDownPredicates
  [
    { id: 'px', text: 'Project (y + 1) AS x' },
    { id: 'py', text: 'Project (id + (1 + 1)) AS y' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100 AND id + (1 + 1) > 0 AND (id + (1 + 1)) + 1 > 1' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // CollapseProject
  [
    { id: 'px', text: 'Project ((id + (1 + 1)) + 1) AS x' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100 AND id + (1 + 1) > 0 AND (id + (1 + 1)) + 1 > 1' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // ConstantFolding
  [
    { id: 'px', text: 'Project ((id + 2) + 1) AS x' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100 AND id + 2 > 0 AND (id + 2) + 1 > 1' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // ReorderAssociativeOperator
  [
    { id: 'px', text: 'Project (id + (2 + 1)) AS x' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100 AND id + 2 > 0 AND id + (2 + 1) > 1' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
  // round 3: ConstantFolding
  [
    { id: 'px', text: 'Project (id + 3) AS x' },
    { id: 'fid', text: 'Filter id > 5 AND id + 1 < 100 AND id + 2 > 0 AND id + 3 > 1' },
    { id: 'rng', text: 'Range (0, 1000)' },
  ],
];

const RULES = ['PushDownPredicates', 'CollapseProject', 'ConstantFolding', 'ReorderAssociativeOperator'];
const MATRIX = [
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [0, 0, 1, 0],
  [0, 0, 0, 0],
];

interface Ev {
  kind: 'rule' | 'check';
  round: number;
  rule: number;
  eff: boolean;
  before: number;
  after: number;
  start: number;
  dur: number;
  changed?: boolean;
}

function buildEvents(): { events: Ev[]; total: number } {
  const events: Ev[] = [];
  let t = 0.6;
  let state = 0;
  MATRIX.forEach((row, round) => {
    row.forEach((eff, rule) => {
      const dur = eff ? 1.5 : 0.45;
      events.push({ kind: 'rule', round, rule, eff: !!eff, before: state, after: eff ? state + 1 : state, start: t, dur });
      if (eff) state++;
      t += dur;
    });
    const changed = row.some((x) => x === 1);
    events.push({ kind: 'check', round, rule: -1, eff: false, before: state, after: state, start: t, dur: changed ? 1.3 : 2.4, changed });
    t += changed ? 1.3 : 2.4;
  });
  return { events, total: t + 0.6 };
}

const TEXT: Record<Lang, {
  marks: { name: string; title: string; text: string }[];
  title: string;
  svgLabel: string;
  planOf: string;
  roundOf: (n: number) => string;
  changed: string;
  nothing: string;
  moreRules1: string;
  moreRules2: string;
  checkTitle: string;
  differs: string;
  same: string;
  endBatch: string;
  waiting: string;
  nodeCount: (n: number) => string;
  caption: string;
}> = {
  th: {
    marks: [
      { name: 'ต้น batch', title: 'แผนก่อนเข้า batch: 8 node ซ้อนกันตาม subquery ทั้งสี่ชั้น', text: 'batch "Operator Optimization before Inferring Filters" เป็นแบบ FixedPoint(100): ไล่รัน rule ทุกตัวในรายการหนึ่งรอบ แล้วเทียบแผนปลายรอบกับต้นรอบ ถ้ายังต่างก็วนอีกรอบ (ในภาพมีแค่ rule ที่เปลี่ยนแผนของ query นี้ batch จริงมีราว 60 rule)' },
      { name: 'รอบ 1', title: 'รอบที่ 1: ทั้งสี่ rule เปลี่ยนแผน', text: 'PushDownPredicates ดัน filter ลงมารวมกัน CollapseProject รวม Project ที่ซ้อนกัน ConstantFolding คิดค่าคงที่ ReorderAssociativeOperator จัดวงเล็บใหม่ แต่ละ rule เห็นแผนที่ rule ก่อนหน้าเพิ่งแก้' },
      { name: 'รอบ 2', title: 'รอบที่ 2: แผนที่ได้จากรอบแรกเปิดโอกาสใหม่', text: 'filter ที่รวมแล้วลงมาติด Project อีกชั้นได้ ทำให้ push และ collapse ได้อีก นี่คือเหตุผลที่ต้องวน: rule หนึ่งทำให้อีก rule มีงาน' },
      { name: 'รอบ 3', title: 'รอบที่ 3: เหลือแค่ ConstantFolding', text: 'การจัดวงเล็บรอบก่อนสร้างเลขคงที่ใหม่ (2 + 1) ที่ต้องคิดเป็น 3 rule อื่นไม่มีอะไรทำแล้ว' },
      { name: 'รอบ 4', title: 'รอบที่ 4: ไม่มี rule ไหนเปลี่ยนแผนเลย = fixed point', text: 'รอบนี้ไม่ได้ทำงานเพิ่ม แต่เป็นรอบที่พิสูจน์ว่าแผนนิ่งแล้ว (curPlan.fastEquals(lastPlan)) จึงจบ batch ได้ วัดจริง: Spark รายงาน 4 รอบ ถ้าเป็น batch แบบ Once จะรันรอบเดียวแล้วจบ ไม่ว่าแผนจะยังเปลี่ยนอยู่หรือไม่' },
    ],
    title: 'RuleExecutor: วน rule ใน batch จนแผนไม่เปลี่ยน (FixedPoint)',
    svgLabel: 'ไล่ rule ของ batch ทีละรอบ จนแผนของ query ไม่เปลี่ยนอีก',
    planOf: 'แผนของ query ที่มี subquery ซ้อน 4 ชั้น (ย่อ cast และ id ออกให้อ่านง่าย)',
    roundOf: (n) => `รอบที่ ${n} / 4`,
    changed: 'เปลี่ยนแผน',
    nothing: 'ไม่มีอะไรทำ',
    moreRules1: 'rule อื่นอีกราว 56 ตัวรันด้วยทุกรอบ',
    moreRules2: 'แต่ไม่เปลี่ยนอะไรใน query นี้',
    checkTitle: 'จบรอบ: แผนต่างจากต้นรอบไหม?',
    differs: 'ต่าง: วนอีกรอบ',
    same: 'เหมือนเดิม: fixed point',
    endBatch: 'จบ batch ส่งแผนนี้ต่อ',
    waiting: 'รอจน rule ครบทั้งรอบ',
    nodeCount: (n) => `node ในแผน: ${n}`,
    caption: 'จำนวนรอบ (4) และลำดับ rule ที่เปลี่ยนแผน (PushDownPredicates, CollapseProject, ConstantFolding, ReorderAssociativeOperator สองรอบ แล้ว ConstantFolding หนึ่งรอบ) วัดจริงใน exercises/06b_rule_iterations.py แผนหลังแต่ละ rule ย่อมาจาก plan change log ของรันนั้น',
  },
  en: {
    marks: [
      { name: 'batch start', title: 'The plan before the batch: 8 nodes nested by the four layers of subquery', text: 'The batch "Operator Optimization before Inferring Filters" is FixedPoint(100): it runs every rule in the list once (one round), then compares the plan at the end of the round with the plan at the start. If they still differ, it runs another round. (The picture shows only the rules that change the plan of this query. The real batch has about 60 rules.)' },
      { name: 'round 1', title: 'Round 1: all four rules change the plan', text: 'PushDownPredicates pushes the filters down and merges them. CollapseProject merges nested Projects. ConstantFolding computes constants. ReorderAssociativeOperator regroups the parentheses. Each rule sees the plan that the previous rule just changed.' },
      { name: 'round 2', title: 'Round 2: the plan from round 1 opens new chances', text: 'The merged filter can move down past one more Project, so push and collapse can run again. This is why the loop is needed: one rule gives another rule new work.' },
      { name: 'round 3', title: 'Round 3: only ConstantFolding is left', text: 'The regrouping in the last round created a new constant expression (2 + 1) that must be computed as 3. The other rules have nothing to do.' },
      { name: 'round 4', title: 'Round 4: no rule changes the plan = fixed point', text: 'This round does no extra work, but it proves the plan is stable (curPlan.fastEquals(lastPlan)), so the batch can end. Measured: Spark reports 4 rounds. A batch of type Once runs a single round and stops, whether or not the plan would still change.' },
    ],
    title: 'RuleExecutor: loop the rules of a batch until the plan stops changing (FixedPoint)',
    svgLabel: 'The rules of the batch, round by round, until the plan of the query stops changing',
    planOf: 'Plan of a query with 4 nested subqueries (casts and ids left out to keep it readable)',
    roundOf: (n) => `Round ${n} / 4`,
    changed: 'changed',
    nothing: 'no change',
    moreRules1: 'About 56 other rules also run in every round',
    moreRules2: 'but change nothing in this query',
    checkTitle: 'End of round: plan changed?',
    differs: 'Different: another round',
    same: 'Same: fixed point',
    endBatch: 'Batch ends, pass this plan on',
    waiting: 'Wait until all rules have run',
    nodeCount: (n) => `nodes in the plan: ${n}`,
    caption: 'The number of rounds (4) and the order of the rules that change the plan (PushDownPredicates, CollapseProject, ConstantFolding and ReorderAssociativeOperator in each of two rounds, then ConstantFolding alone in one round) were measured in exercises/06b_rule_iterations.py. The plan after each rule is shortened from the plan change log of that run.',
  },
};

const NODE_W = 540;
const NODE_H = 36;
const GAP = 7;
const TOP = 70;
const nodeY = (i: number) => TOP + i * (NODE_H + GAP);

export default function RuleLoopLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  const { events, total } = useMemo(buildEvents, []);
  const clock = useClock(total);
  const { t } = clock;

  const cur = events.filter((e) => t >= e.start).slice(-1)[0] ?? null;
  const round = cur ? cur.round : 0;
  const p = cur ? smooth(prog(t, cur.start, cur.start + Math.min(0.8, cur.dur))) : 0;
  const state = cur ? (cur.kind === 'rule' && cur.eff ? (p >= 1 ? cur.after : cur.before) : cur.after) : 0;
  const before = cur && cur.kind === 'rule' && cur.eff ? S[cur.before] : null;
  const after = cur && cur.kind === 'rule' && cur.eff ? S[cur.after] : null;
  const shown = before && after ? after : S[state];

  // effective rules already seen in the current round
  const doneInRound = events.filter((e) => e.kind === 'rule' && e.round === round && e.eff && e.start + e.dur <= t + 0.001).map((e) => e.rule);

  const roundStart = (r: number) => events.find((e) => e.round === r)!.start;
  const marks: Mark[] = [
    { at: 0, ...L.marks[0] },
    { at: roundStart(0), ...L.marks[1] },
    { at: roundStart(1), ...L.marks[2] },
    { at: roundStart(2), ...L.marks[3] },
    { at: roundStart(3), ...L.marks[4] },
  ];

  // node positions: interpolate between the plan before and after the current rule
  const nodes: { id: string; text: string; y: number; o: number; flash: number }[] = [];
  if (before && after) {
    const ids = new Set([...before.map((n) => n.id), ...after.map((n) => n.id)]);
    ids.forEach((id) => {
      const b = before.findIndex((n) => n.id === id);
      const a = after.findIndex((n) => n.id === id);
      const ny = (i: number) => nodeY(i);
      const text = (a >= 0 && p > 0.5 ? after[a].text : b >= 0 ? before[b].text : after[a].text);
      const changed = a >= 0 && b >= 0 && before[b].text !== after[a].text;
      nodes.push({
        id,
        text,
        y: b >= 0 && a >= 0 ? mix(ny(b), ny(a), p) : b >= 0 ? ny(b) : ny(a),
        o: b >= 0 && a >= 0 ? 1 : b >= 0 ? 1 - p : p,
        flash: changed || a < 0 || b < 0 ? Math.sin(p * Math.PI) : 0,
      });
    });
  } else {
    shown.forEach((n, i) => nodes.push({ id: n.id, text: n.text, y: nodeY(i), o: 1, flash: 0 }));
  }
  const count = shown.length;

  return (
    <figure className="viz lg">
      <div className="viz-title">{L.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={L.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="420" rx="12" />
          <text className="b m" x="24" y="38" style={{ fontSize: 13 }}>Batch: Operator Optimization before Inferring Filters   FixedPoint(100)</text>
          <text className="s" x="24" y="58">{L.planOf}</text>

          {nodes.map((n) => (
            <g key={n.id} opacity={n.o} transform={`translate(24 ${n.y})`}>
              <rect className={n.flash > 0.05 ? 'fx-hot' : 'box'} width={NODE_W} height={NODE_H} rx="7" />
              <text className="m" x="12" y="23" style={{ fontSize: 12.5 }}>{n.text}</text>
            </g>
          ))}

          {/* the rules */}
          <g transform="translate(590 70)">
            <text className="b">{L.roundOf(round + 1)}</text>
            {RULES.map((r, k) => {
              const active = cur?.kind === 'rule' && cur.rule === k;
              const changed = active && cur!.eff;
              const done = doneInRound.includes(k);
              return (
                <g key={r} transform={`translate(0 ${16 + k * 42})`}>
                  <rect className={active ? (changed ? 'fx-hot' : 'box') : 'box'} width="270" height="34" rx="7" opacity={active || done ? 1 : 0.6} />
                  {done && !active && <circle cx="256" cy="17" r="6" className="k2" />}
                  <text className="m" x="10" y="21" style={{ fontSize: 11.5 }}>{r}</text>
                  {active && <text className="s b" x="262" y="21" textAnchor="end" style={{ fill: changed ? 'var(--accent)' : 'var(--muted)' }}>{changed ? L.changed : L.nothing}</text>}
                </g>
              );
            })}
            <text className="s" y="200">{L.moreRules1}</text>
            <text className="s" y="216">{L.moreRules2}</text>
          </g>

          {/* round check */}
          <g transform="translate(590 306)">
            <rect className={cur?.kind === 'check' ? (cur.changed ? 'fx-hot' : 'fx-file') : 'box'} width="270" height="84" rx="8" />
            <text className="b" x="12" y="24" style={{ fontSize: 13 }}>{L.checkTitle}</text>
            {cur?.kind === 'check' ? (
              cur.changed ? (
                <text className="s b acc" x="12" y="50">{L.differs}</text>
              ) : (
                <>
                  <text className="s b acc" x="12" y="50">{L.same}</text>
                  <text className="s" x="12" y="68">{L.endBatch}</text>
                </>
              )
            ) : (
              <text className="s" x="12" y="50">{L.waiting}</text>
            )}
          </g>
          <text className="s m" x="590" y="412">{L.nodeCount(count)}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">
        {L.caption}
      </figcaption>
    </figure>
  );
}
