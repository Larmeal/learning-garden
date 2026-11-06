import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// The loop inside AdaptiveSparkPlanExec.withFinalPlanUpdate, run on the query of lesson 6:
//   g = spark.range(1_000_000).groupBy((F.col("id") % 3).alias("k")).count(); g.collect()
// Measured (exercises/06_catalyst_aqe.py): the action starts 2 jobs, the shuffle holds 1,152 bytes, AQEShuffleRead
// coalesced leaves 1 partition, isFinalPlan flips to true on the DataFrame that ran. The six steps and the cost rule
// (SimpleCostEvaluator counts the ShuffleExchangeLike nodes) come from the source (AdaptiveSparkPlanExec.scala:268-396,
// simpleCosting.scala:42-65). Task counts per stage in the picture are drawn small on purpose.

const DURATION = 19;
const STEPS: Record<Lang, { name: string; text: string }[]> = {
  th: [
    { name: '1 ตัดเป็น query stage', text: 'ตัดแผนตรง Exchange' },
    { name: '2 รัน stage ที่พร้อม', text: 'materialize เป็น job' },
    { name: '3 ใส่ผลกลับในแผน', text: 'แทน stage ด้วยสถิติจริง' },
    { name: '4 reOptimize', text: 'เขียนแผนใหม่ด้วยขนาดจริง' },
    { name: '5 เทียบ cost', text: 'นับจำนวน Exchange' },
    { name: '6 วนอีกรอบ', text: 'จนไม่มี Exchange ให้ตัด' },
  ],
  en: [
    { name: '1 Cut into query stages', text: 'Cut the plan at Exchange' },
    { name: '2 Run the ready stages', text: 'Materialize as a job' },
    { name: '3 Put results back', text: 'Replace stage with real stats' },
    { name: '4 reOptimize', text: 'Re-plan with the real size' },
    { name: '5 Compare cost', text: 'Count the Exchange nodes' },
    { name: '6 Loop again', text: 'Until no Exchange is left' },
  ],
};
// [step index, start, end]; the second pass repeats steps 1, 2 and 6 for the last stage
const PHASES: [number, number, number][] = [
  [0, 0.6, 2.8],
  [1, 2.8, 6.4],
  [2, 6.4, 8.4],
  [3, 8.4, 11],
  [4, 11, 13],
  [0, 13, 14.4],
  [1, 14.4, 17],
  [5, 17, 19],
];

const MARKS_TH: Mark[] = [
  { at: 0, name: 'ตัดเป็น stage', title: 'ข้อ 1: ตัดแผนตรง Exchange เป็น query stage', text: 'AQE หาจุดที่ต้อง shuffle (Exchange) แล้วหุ้มส่วนที่อยู่ใต้มันเป็น ShuffleQueryStage 0 ส่วนที่เหลือ (HashAggregate ตัวบน) ยังรอ เพราะต้องใช้ผลของ stage นั้น ตอนนี้ isFinalPlan=false' },
  { at: 2.8, name: 'รัน stage', title: 'ข้อ 2: รัน stage ที่ไม่ต้องรอใคร (job แรก)', text: 'stage ที่พร้อมถูก materialize ก่อน แล้ว AQE หยุดรอ event ว่า stage ไหนเสร็จ (วัดจริง: action เดียวเริ่ม 2 job นี่คือ job แรก)' },
  { at: 6.4, name: 'ใส่ผลกลับ', title: 'ข้อ 3: stage ที่เสร็จถูกใส่กลับพร้อมสถิติจริง', text: 'ตอนนี้ Spark รู้แล้วว่า shuffle เขียนข้อมูลแค่ 1,152 ไบต์ ซึ่งก่อนรันไม่มีทางรู้ (แผนตั้งต้นใช้เลข 200 partition จากค่า config)' },
  { at: 8.4, name: 'reOptimize', title: 'ข้อ 4: วางแผนที่เหลือใหม่ด้วยขนาดจริง', text: 'AQE รัน logical rule ของมัน (AQEOptimizer) วางแผน physical ใหม่ แล้วรัน rule ระดับ physical อีกชุด หนึ่งในนั้นคือ CoalesceShufflePartitions ที่เห็นว่าข้อมูลเล็กมาก จึงครอบด้วย AQEShuffleRead coalesced' },
  { at: 11, name: 'เทียบ cost', title: 'ข้อ 5: แผนใหม่ดีกว่าไหม? นับ Exchange', text: 'cost เริ่มต้น (SimpleCostEvaluator) คือจำนวน ShuffleExchangeLike ในแผน ไม่ดูขนาดหรือเวลา แผนเดิมมี 1 แผนใหม่มี 1 เท่ากัน แต่แผนต่างกัน กรณีนี้ AQE รับแผนใหม่' },
  { at: 13, name: 'วนอีกรอบ', title: 'ข้อ 6 และวนกลับข้อ 1: ไม่เหลือ Exchange ให้ตัดแล้ว', text: 'ส่วนที่เหลือถูกหุ้มเป็น ResultQueryStage 1 (stage สุดท้าย มีใน Spark 4.2) แล้วรันเป็น job ที่สอง ผลคือ stage นี้อ่านแค่ 1 partition จึงมี 1 task' },
  { at: 17, name: 'จบ', title: 'ไม่มี stage ค้าง: isFinalPlan = true', text: 'แผนสุดท้ายประกอบด้วย ResultQueryStage 1, AQEShuffleRead coalesced และ ShuffleQueryStage 0 และจากนี้ g.explain() จะแสดง Final Plan กับ Initial Plan (ใช้ได้กับ DataFrame ตัวที่รันเท่านั้น)' },
];

const MARKS_EN: Mark[] = [
  { at: 0, name: 'Cut into stages', title: 'Step 1: cut the plan at Exchange into query stages', text: 'AQE finds the points that need a shuffle (Exchange) and wraps the part below it as ShuffleQueryStage 0. The rest (the upper HashAggregate) still waits, because it needs the result of that stage. Right now isFinalPlan=false.' },
  { at: 2.8, name: 'Run stage', title: 'Step 2: run the stage that does not wait for anyone (the first job)', text: 'The ready stage is materialized first. Then AQE stops and waits for an event that says which stage finished (measured: one action starts 2 jobs, and this is the first job).' },
  { at: 6.4, name: 'Put back', title: 'Step 3: the finished stage is put back with real statistics', text: 'Now Spark knows that the shuffle wrote only 1,152 bytes. There is no way to know that before running (the starting plan uses the number 200 partitions from the config).' },
  { at: 8.4, name: 'reOptimize', title: 'Step 4: re-plan the rest with the real size', text: 'AQE runs its own logical rules (AQEOptimizer), plans the physical plan again, and then runs another set of physical rules. One of them is CoalesceShufflePartitions. It sees that the data is very small, so it wraps the read in AQEShuffleRead coalesced.' },
  { at: 11, name: 'Compare cost', title: 'Step 5: is the new plan better? Count the Exchange nodes', text: 'The default cost (SimpleCostEvaluator) is the number of ShuffleExchangeLike nodes in the plan. It does not look at size or time. The old plan has 1 and the new plan has 1, so they are equal, but the plans differ. In this case AQE accepts the new plan.' },
  { at: 13, name: 'Loop again', title: 'Step 6 and back to step 1: no Exchange is left to cut', text: 'The rest is wrapped as ResultQueryStage 1 (the final stage, which exists in Spark 4.2) and run as the second job. This stage reads only 1 partition, so it has 1 task.' },
  { at: 17, name: 'Done', title: 'No stage is left: isFinalPlan = true', text: 'The final plan is made of ResultQueryStage 1, AQEShuffleRead coalesced and ShuffleQueryStage 0. From now on g.explain() shows a Final Plan and an Initial Plan (this works only on the DataFrame that ran).' },
];
const MARKS: Record<Lang, Mark[]> = { th: MARKS_TH, en: MARKS_EN };

const TEXT: Record<Lang, {
  title: string; svgLabel: string; plan: string; round1: string; round2: string; resultRunning: string; shuffleDone: string; shuffleRunning: string;
  coalesceSub: string; nothingHere: string; stats: string; loopTitle: string; jobs: string; costTitle: string; costLine: string;
  accepted: string; comparing: string; caption: string;
}> = {
  th: {
    title: 'ลูปของ AQE: ตัดเป็น stage รัน วัด วางแผนใหม่ แล้ววน',
    svgLabel: 'ลูปหกขั้นของ AdaptiveSparkPlanExec บน query groupBy count',
    plan: 'แผนของ g = range.groupBy(k).count()', round1: 'รอบที่ 1 ของลูป', round2: 'รอบที่ 2 ของลูป: stage สุดท้าย',
    resultRunning: ' (กำลังรัน: 1 task)', shuffleDone: ' (เสร็จแล้ว)', shuffleRunning: ' (กำลังรัน)',
    coalesceSub: '200 partition → 1', nothingHere: '(ยังไม่มีอะไรคั่นตรงนี้)', stats: 'สถิติจริงของ shuffle',
    loopTitle: 'ลูปใน withFinalPlanUpdate', jobs: 'job ที่เริ่มแล้ว', costTitle: 'cost = จำนวน Exchange', costLine: 'แผนเดิม 1  แผนใหม่ 1',
    accepted: 'เท่ากันแต่ต่าง: รับ', comparing: 'กำลังเทียบ...',
    caption: '2 job ต่อ 1 action, สถิติ 1,152 ไบต์ และผลรวมเหลือ 1 partition วัดจริงใน exercises/06_catalyst_aqe.py ส่วนลำดับหกขั้น ชื่อ rule และกฎ cost อ่านจากซอร์ส (AdaptiveSparkPlanExec, simpleCosting) จำนวน task ต่อ stage ในภาพวาดย่อ',
  },
  en: {
    title: 'The AQE loop: cut into stages, run, measure, re-plan, repeat',
    svgLabel: 'The six-step loop of AdaptiveSparkPlanExec on a groupBy count query',
    plan: 'Plan of g = range.groupBy(k).count()', round1: 'Round 1 of the loop', round2: 'Round 2 of the loop: the last stage',
    resultRunning: ' (running: 1 task)', shuffleDone: ' (finished)', shuffleRunning: ' (running)',
    coalesceSub: '200 partitions → 1', nothingHere: '(nothing here yet)', stats: 'Real shuffle stats',
    loopTitle: 'The loop in withFinalPlanUpdate', jobs: 'Jobs started', costTitle: 'cost = Exchange count', costLine: 'old 1  new 1',
    accepted: 'Tie: accept new plan', comparing: 'Comparing...',
    caption: '2 jobs per action, 1,152 bytes of statistics, and the result coalesced to 1 partition were measured in exercises/06_catalyst_aqe.py. The six steps, the rule names and the cost rule are read from the source (AdaptiveSparkPlanExec, simpleCosting). The number of tasks per stage is drawn small in the picture.',
  },
};

const NODE_X = 24;
const NODE_W = 330;
const NODE_H = 40;
const Y = { agg: 122, read: 180, exch: 256, part: 310, rng: 364 };

function Node({ y, label, sub, hot, opacity = 1 }: { y: number; label: string; sub?: string; hot?: boolean; opacity?: number }) {
  return (
    <g transform={`translate(${NODE_X} ${y})`} opacity={opacity}>
      <rect className={hot ? 'fx-hot' : 'box'} width={NODE_W} height={NODE_H} rx="7" />
      <text className="m b" x="12" y={sub ? 17 : 25} style={{ fontSize: 12.5 }}>{label}</text>
      {sub && <text className="s m" x="12" y="33">{sub}</text>}
    </g>
  );
}

export default function AqeLoopLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const phase = PHASES.filter((ph) => t >= ph[1]).slice(-1)[0] ?? PHASES[0];
  const step = phase[0];
  const pass2 = t >= 13;

  const cut1 = smooth(prog(t, 0.6, 2.2));
  const run1 = prog(t, 2.8, 6.2);
  const done1 = t >= 6.4;
  const reopt = smooth(prog(t, 9, 10.4));
  const cmp = smooth(prog(t, 11, 11.8));
  const cut2 = smooth(prog(t, 13, 14.2));
  const run2 = prog(t, 14.4, 16.8);
  const final = t >= 17;
  const jobs = t >= 17 ? 2 : t >= 14.4 ? 2 : t >= 2.8 ? 1 : 0;
  const accepted = t >= 12.2;

  // dots moving up through a stage while it runs
  const flow = (p: number, x: number, y0: number, y1: number, n: number, color: string) =>
    p <= 0 || p >= 1
      ? null
      : Array.from({ length: n }, (_, i) => {
          const f = (p * 3 + i / n) % 1;
          return <circle key={i} cx={x + (i % 3) * 9} cy={y0 + (y1 - y0) * f} r="4.5" className={color} />;
        });

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="420" rx="12" />
          <text className="b" x="24" y="36">{T.plan}</text>
          <text className="s m" x="24" y="56">isFinalPlan={final ? 'true' : 'false'}</text>
          <text className="s" x="24" y="78">{pass2 ? T.round2 : T.round1}</text>

          {/* result stage frame */}
          <rect x={NODE_X - 8} y={Y.agg - 8} width={NODE_W + 16} height={Y.read + NODE_H + 8 - (Y.agg - 8)} rx="10" fill="none" stroke={final ? 'var(--k2)' : 'var(--k3)'} strokeWidth="2.5" strokeDasharray={final ? undefined : '7 5'} opacity={cut2} />
          {cut2 > 0.3 && <text className="s b" x={NODE_X + 4} y={Y.agg - 13} style={{ fill: final ? 'var(--k2)' : 'var(--k3)' }}>ResultQueryStage 1{run2 > 0 && !final ? T.resultRunning : ''}</text>}

          {/* shuffle stage frame */}
          <rect x={NODE_X - 8} y={Y.exch - 8} width={NODE_W + 16} height={Y.rng + NODE_H + 8 - (Y.exch - 8)} rx="10" fill={done1 ? 'var(--accent-soft)' : 'none'} stroke={done1 ? 'var(--k2)' : 'var(--k1)'} strokeWidth="2.5" strokeDasharray={done1 ? undefined : '7 5'} opacity={cut1} />
          {cut1 > 0.3 && <text className="s b" x={NODE_X + 4} y={Y.exch - 13} style={{ fill: done1 ? 'var(--k2)' : 'var(--k1)' }}>ShuffleQueryStage 0{done1 ? T.shuffleDone : run1 > 0 ? T.shuffleRunning : ''}</text>}

          <Node y={Y.agg} label="HashAggregate (final)  count" />
          <Node y={Y.read} label="AQEShuffleRead coalesced" sub={T.coalesceSub} hot={reopt > 0.2 && reopt < 1} opacity={reopt} />
          <Node y={Y.exch} label="Exchange hashpartitioning(k, 200)" />
          <Node y={Y.part} label="HashAggregate (partial)  partial_count" />
          <Node y={Y.rng} label="Range (0, 1000000)" />
          {reopt === 0 && <text className="s" x={NODE_X + 4} y={Y.read + 24} opacity="0.6">{T.nothingHere}</text>}

          {/* running stages */}
          {flow(run1, NODE_X + NODE_W - 60, Y.rng + 10, Y.exch + 30, 8, 'k1')}
          {flow(run2, NODE_X + NODE_W - 60, Y.read + 30, Y.agg + 10, 1, 'k2')}

          {/* statistics badge after the stage finished */}
          {done1 && (
            <g transform={`translate(${NODE_X + NODE_W + 16} ${Y.exch + 6})`}>
              <rect className="fx-hot" width="150" height="46" rx="8" />
              <text className="s" x="10" y="18">{T.stats}</text>
              <text className="b num" x="10" y="38">1,152 B</text>
            </g>
          )}

          {/* the six steps */}
          <g transform="translate(560 70)">
            <text className="b">{T.loopTitle}</text>
            {steps.map((s, i) => {
              const active = i === step;
              return (
                <g key={s.name} transform={`translate(0 ${16 + i * 40})`}>
                  <rect className={active ? 'fx-hot' : 'box'} width="296" height="34" rx="7" opacity={active ? 1 : 0.65} />
                  <text className={active ? 'b' : ''} x="10" y="15" style={{ fontSize: 12.5 }}>{s.name}</text>
                  <text className="s" x="10" y="29">{s.text}</text>
                </g>
              );
            })}
            {/* back edge from step 6 to step 1 */}
            <path d="M296 273 C330 273 330 33 296 33" fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 4" />
            <text className="s" x="214" y="274" opacity="0">.</text>
          </g>

          {/* counters and the cost card */}
          <g transform="translate(560 336)">
            <rect className="box" width="140" height="66" rx="8" />
            <text className="s" x="10" y="20">{T.jobs}</text>
            <text className="big num" x="10" y="52">{jobs}</text>
            <g transform="translate(156 0)" opacity={0.25 + 0.75 * cmp}>
              <rect className={accepted ? 'fx-hot' : 'box'} width="156" height="66" rx="8" />
              <text className="s" x="10" y="18">{T.costTitle}</text>
              <text className="m b" x="10" y="38" style={{ fontSize: 12.5 }}>{T.costLine}</text>
              <text className="s b acc" x="10" y="56">{accepted ? T.accepted : cmp > 0 ? T.comparing : ''}</text>
            </g>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang]} lang={lang} />
      <figcaption className="viz-caption">
        {T.caption}
      </figcaption>
    </figure>
  );
}
