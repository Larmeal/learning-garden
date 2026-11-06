import { useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// The three things AQE does, drawn with the same four phases every time so the order is always the same:
//   1 stage 1 runs   2 AQE measures the real sizes   3 AQE writes a new plan   4 stage 2 runs on the new plan
// Measured (exercises/06_catalyst_aqe.py, Spark 4.2.0): coalesce 200 -> 1 partition with 1,152 bytes of shuffle data;
// the join changes to BroadcastHashJoin when the right side turns out to have 5 rows; the plan names and config
// formulas are real. The partition sizes of the skew scene (60, 70, 55, 400, ...) are made up as the lesson says,
// and so is the dot count of each scene (every dot stands for many rows).

type Scene = 'coalesce' | 'join' | 'skew';
const SCENE_IDS: Scene[] = ['coalesce', 'join', 'skew'];
const SCENE_LABEL: Record<Lang, Record<Scene, string>> = {
  th: { coalesce: 'รวม partition เล็ก', join: 'เปลี่ยน join เป็น broadcast', skew: 'แยก partition ที่ skew' },
  en: { coalesce: 'Merge small partitions', join: 'Switch join to broadcast', skew: 'Split a skewed partition' },
};
const DURATION = 12;
const T_MEASURE = 3;
const T_REPLAN = 4.5;
const T_RUN2 = 5.5;
const PHASES: Record<Lang, string[]> = {
  th: ['1 Stage แรกรัน', '2 วัดขนาดจริง', '3 เขียนแผนใหม่', '4 Stage ถัดไปรันตามแผนใหม่'],
  en: ['1 First stage runs', '2 Measure real sizes', '3 Write a new plan', '4 Next stage runs new plan'],
};
const PLAN: Record<Scene, { old: string; now: string }> = {
  coalesce: { old: 'Exchange hashpartitioning(k, 200)', now: 'AQEShuffleRead coalesced' },
  join: { old: 'SortMergeJoin', now: 'BroadcastHashJoin  +  AQEShuffleRead local' },
  skew: { old: 'SortMergeJoin', now: 'SortMergeJoin(skew=true)  +  AQEShuffleRead skewed' },
};

const MARKS_TH: Record<Scene, Mark[]> = {
  coalesce: [
    { at: 0, name: 'Stage แรก', title: 'ก่อนรัน Spark ไม่รู้ว่าข้อมูลหลัง shuffle จะมีเท่าไร', text: 'จึงวางแผนไว้ตามค่า spark.sql.shuffle.partitions = 200 ข้อมูลของ map task วิ่งเข้าช่อง partition ตาม hash ของ key (ในภาพมี 3 key จึงมีแค่ 3 ช่องที่ได้ข้อมูล ภาพวาด 24 ช่องแทน 200)' },
    { at: T_MEASURE, name: 'วัดขนาด', title: 'Stage แรกจบ: รู้ขนาดจริงแล้ว', text: 'ข้อมูลทั้งหมดมีแค่ 1,152 ไบต์ (48 แถว) เป้าหมายคือ partition ละประมาณ 64 MB (ขั้นต่ำ 1 MB) ข้อมูลทั้งก้อนเล็กกว่าเป้าหมายมาก' },
    { at: T_REPLAN, name: 'แผนใหม่', title: 'CoalesceShufflePartitions เขียนแผนใหม่', text: 'Exchange เดิมยังอยู่ แต่มี AQEShuffleRead coalesced ครอบอยู่ ซึ่งสั่งให้อ่าน partition ที่อยู่ติดกันรวมเป็นก้อนเดียว' },
    { at: T_RUN2, name: 'Stage ถัดไป', title: 'จาก 200 task เหลือ 1 task', text: 'ถ้าไม่ปรับ 200 task ต้องเริ่มทีละตัว (ค่าเริ่ม task เสียทุกตัว) ทั้งที่ข้อมูลอยู่แค่ใน 3 partition ภาพช่วงแรกคือ task ว่างที่เสียเปล่า ภาพช่วงหลังคือ partition ที่ถูกรวม (วัดจริง: getNumPartitions = 1)' },
  ],
  join: [
    { at: 0, name: 'Stage แรก', title: 'ก่อนรัน Spark เดาขนาดไม่ได้ จึงเลือก Sort Merge Join', text: 'join นี้มีสองตารางเข้า: left คือตารางใหญ่ (5,000,000 แถว) right คือผลของ groupBy(id % 5).count() ซึ่ง optimizer ไม่รู้ว่าจะเหลือกี่แถว จึงเลือก Sort Merge Join ที่ต้อง shuffle ทั้งสองตาราง ผลถูกเขียนเป็นไฟล์ shuffle บน executor (เลขในจุดคือ key = id % 5)' },
    { at: T_MEASURE, name: 'วัดขนาด', title: 'Stage แรกจบ: ตาราง right เหลือ 5 แถว', text: 'ขนาดจริงเล็กกว่าเกณฑ์ broadcast (10 MB) มาก ตาราง left ยังใหญ่เหมือนเดิม' },
    { at: T_REPLAN, name: 'แผนใหม่', title: 'DynamicJoinSelection เปลี่ยนเป็น Broadcast Hash Join', text: 'แผนเดิมจะส่งแถวของตาราง left ข้ามเครื่องเพื่อไปรวมกับ key เดียวกัน (ลูกศรสี) แผนใหม่ไม่ต้องแล้ว AQE ยอมรับแผนใหม่เพราะไม่ต้อง shuffle เพิ่ม' },
    { at: T_RUN2, name: 'Stage ถัดไป', title: 'ส่งตารางเล็กไปทุกเครื่อง ตารางใหญ่อยู่ที่เดิม', text: 'ตาราง left shuffle ไปแล้ว AQE เลยไม่ทิ้ง แต่ให้ task อ่านไฟล์ shuffle ที่อยู่เครื่องเดียวกัน (AQEShuffleRead local) แล้วจับคู่กับสำเนาของ right ที่ key ตรงกัน (เส้นสี) ไม่ต้องดึงข้ามเครื่อง และไม่ต้อง sort' },
  ],
  skew: [
    { at: 0, name: 'Stage แรก', title: 'ก่อนรัน Spark ไม่รู้ว่า key ไหนจะใหญ่เกินไป', text: 'หลัง shuffle ตาราง left มี 8 partition (ตัวอย่างสมมติ: 1 จุด = 10 KB) ทุกอันเล็ก ยกเว้น partition ที่ 4 ที่ใหญ่ไม่สมดุลกับตัวอื่น (imbalance) ภาวะนี้เรียกว่า skew' },
    { at: T_MEASURE, name: 'วัดขนาด', title: 'เทียบขนาดกับเส้น skew', text: 'เส้น = max(skewedPartitionThresholdInBytes, median x 5) ในภาพ median = 63.5 KB ได้เส้น 317.5 KB partition ที่ 4 (400 KB) เกินเส้น จึงถูกตีว่า skew' },
    { at: T_REPLAN, name: 'แผนใหม่', title: 'OptimizeSkewedJoin หั่น partition ใหญ่ตามช่วงของ map task', text: 'partition ที่ 4 ถูกหั่นเป็น 3 ชิ้น (ตาม advisoryPartitionSizeInBytes) และ partition ที่ 4 ของตาราง right ถูกทำสำเนา 3 ชุด เพื่อให้แต่ละชิ้นยังจับคู่ได้ครบ' },
    { at: T_RUN2, name: 'Stage ถัดไป', title: 'งานกระจายขึ้น stage จบเร็วขึ้น', text: 'จาก 8 task ที่ task หนึ่งหนักเกินเพื่อน เป็น 10 task ที่หนักใกล้กัน (plan แสดง SortMergeJoin(skew=true)) ไทม์ไลน์ขวาล่างแข่งกันบน 4 core ขนาดงานเป็นตัวอย่างสมมติ' },
  ],
};

const MARKS_EN: Record<Scene, Mark[]> = {
  coalesce: [
    { at: 0, name: 'First stage', title: 'Before it runs, Spark does not know how much data the shuffle will produce', text: 'So it plans for spark.sql.shuffle.partitions = 200. The data of each map task goes into a partition slot by the hash of its key (the picture has 3 keys, so only 3 slots get data; it draws 24 slots instead of 200).' },
    { at: T_MEASURE, name: 'Measure', title: 'The first stage is done: the real size is known', text: 'All the data is only 1,152 bytes (48 rows). The target is about 64 MB per partition (at least 1 MB). The whole data set is far smaller than the target.' },
    { at: T_REPLAN, name: 'New plan', title: 'CoalesceShufflePartitions writes a new plan', text: 'The old Exchange is still there, but an AQEShuffleRead coalesced wraps it. It tells Spark to read neighboring partitions together as one block.' },
    { at: T_RUN2, name: 'Next stage', title: 'From 200 tasks to 1 task', text: 'Without the change, 200 tasks would have to start one by one (every task pays its startup cost), although the data sits in only 3 partitions. The first part of the picture shows empty tasks that are wasted. The later part shows the merged partition (measured: getNumPartitions = 1).' },
  ],
  join: [
    { at: 0, name: 'First stage', title: 'Before it runs, Spark cannot guess the size, so it picks a Sort Merge Join', text: 'Two tables go into this join. left is the big table (5,000,000 rows). right is the result of groupBy(id % 5).count(), and the optimizer does not know how many rows will be left. So it picks a Sort Merge Join, which has to shuffle both tables. The result is written as shuffle files on the executors (the number in each dot is the key = id % 5).' },
    { at: T_MEASURE, name: 'Measure', title: 'The first stage is done: table right has 5 rows', text: 'The real size is far below the broadcast threshold (10 MB). Table left is still as big as before.' },
    { at: T_REPLAN, name: 'New plan', title: 'DynamicJoinSelection switches to a Broadcast Hash Join', text: 'The old plan would send rows of table left across machines to meet the same key (the colored arrows). The new plan does not need that. AQE accepts the new plan because it adds no extra shuffle.' },
    { at: T_RUN2, name: 'Next stage', title: 'Send the small table to every machine, keep the big table where it is', text: 'Table left was already shuffled, so AQE does not throw that away. Instead, tasks read the shuffle files on their own machine (AQEShuffleRead local) and match them with the copy of right that has the same key (the colored lines). Nothing is pulled across machines, and no sort is needed.' },
  ],
  skew: [
    { at: 0, name: 'First stage', title: 'Before it runs, Spark does not know which key will be too big', text: 'After the shuffle, table left has 8 partitions (a made-up example: 1 dot = 10 KB). All are small except partition 4, which is out of proportion to the others (imbalance). This condition is called skew.' },
    { at: T_MEASURE, name: 'Measure', title: 'Compare the sizes with the skew line', text: 'Line = max(skewedPartitionThresholdInBytes, median x 5). In the picture the median is 63.5 KB, so the line is 317.5 KB. Partition 4 (400 KB) is above the line, so it is judged skewed.' },
    { at: T_REPLAN, name: 'New plan', title: 'OptimizeSkewedJoin cuts the big partition by ranges of map tasks', text: 'Partition 4 is cut into 3 slices (by advisoryPartitionSizeInBytes), and partition 4 of table right is copied 3 times, so every slice can still find all its matches.' },
    { at: T_RUN2, name: 'Next stage', title: 'The work is spread out and the stage ends sooner', text: 'From 8 tasks, where one task is much heavier than the rest, to 10 tasks of similar weight (the plan shows SortMergeJoin(skew=true)). The timelines at the bottom right race on 4 cores. The task sizes are a made-up example.' },
  ],
};
const MARKS: Record<Lang, Record<Scene, Mark[]>> = { th: MARKS_TH, en: MARKS_EN };

const TEXT: Record<Lang, {
  title: string;
  group: string;
  aria: (label: string) => string;
  oldPlan: string;
  newPlan: string;
  caption: string;
  coalesce: { written: string; tasksNext: string; before: string; after: string; shuffleData: string; unknown: string; target: string; idle: string; note: string };
  join: { keys: (ks: string) => string; leftTitle: string; rightTitle: string; oldNote: string; measured: string; leftSize: string; rightSize: string; localMatch: string };
  skew: { binsTitle: string; slice: string; line: (v: string) => string; rightTable: string; copied: string; before: (n: number) => string; after: (n: number) => string; done: string };
}> = {
  th: {
    title: 'AQE: ดูขนาดจริงหลัง stage แรก แล้วเขียนแผนใหม่',
    group: 'เลือกสถานการณ์',
    aria: (label) => `ภาพเคลื่อนไหวของ AQE สถานการณ์ ${label}`,
    oldPlan: 'แผนก่อนรัน',
    newPlan: 'แผนใหม่',
    caption: 'ลำดับสี่ช่วงเหมือนกันทุกสถานการณ์ ตัวเลข 200 เป็น 1 partition และ 1,152 ไบต์ และตาราง right 5 แถวมาจากการรันจริง (exercises/06_catalyst_aqe.py) ส่วนขนาด partition ของ skew จำนวนจุด และขนาดงานในไทม์ไลน์ เป็นตัวอย่างสมมติ ชื่อ rule และสูตร threshold เป็นของจริง',
    coalesce: {
      written: 'partition ที่ shuffle เขียนไว้ (วาด 24 จาก 200 ช่อง)',
      tasksNext: 'task ใน stage ถัดไป',
      before: 'ก่อนปรับ (ตามแผนเดิม)',
      after: 'หลัง AQE รวมแล้ว',
      shuffleData: 'ข้อมูลที่ shuffle เขียน',
      unknown: 'ยังไม่รู้',
      target: 'เป้าต่อ partition 1 MB ขึ้นไป',
      idle: 'task ว่างเสียค่าเริ่ม',
      note: 'ภาพย่อ: 4 map task x 3 key (ของจริง 16 map task x 3 key = 48 แถว) ใน 24 ช่องจาก 200',
    },
    join: {
      keys: (ks) => `รับ key ${ks}`,
      leftTitle: 'ตาราง left (ใหญ่): ไฟล์ shuffle',
      rightTitle: 'ตาราง right (ผลของ groupBy)',
      oldNote: 'แผนเดิม: แถวของตาราง left ต้องข้ามเครื่อง เส้นสีเดียวกับ key ที่ executor ปลายทางรับผิดชอบ',
      measured: 'ขนาดจริงที่ AQE วัดได้',
      leftSize: 'left: ใหญ่ (5,000,000 แถว)',
      rightSize: 'right: 5 แถว (เกณฑ์ broadcast 10 MB)',
      localMatch: 'ตาราง left จับคู่กับสำเนาของ right ในเครื่องตัวเอง: ข้ามเครื่อง 0 แถว',
    },
    skew: {
      binsTitle: 'ตาราง left: ขนาด partition หลัง shuffle (1 จุด = 10 KB)',
      slice: 'ชิ้นที่หั่นแล้วชิ้นละ ~133 KB',
      line: (v) => `เส้น skew ${v}`,
      rightTable: 'ตาราง right',
      copied: 'partition 4 ถูกทำสำเนา 3 ชุด',
      before: (n) => `ก่อน: 8 task, ช้าสุด ${n}`,
      after: (n) => `หลัง: 10 task, ช้าสุด ${n}`,
      done: 'จบ',
    },
  },
  en: {
    title: 'AQE: measure the real sizes after the first stage, then write a new plan',
    group: 'Choose a scenario',
    aria: (label) => `Animation of AQE, scenario: ${label}`,
    oldPlan: 'Old plan',
    newPlan: 'New plan',
    caption: 'The four phases are the same in every scenario. The change from 200 to 1 partition, the 1,152 bytes and the 5-row table right were measured in a real run (exercises/06_catalyst_aqe.py). The partition sizes of the skew scene, the dot counts and the task sizes in the timelines are made-up examples. The rule names and the threshold formulas are real.',
    coalesce: {
      written: 'Partitions written by the shuffle (24 of 200 drawn)',
      tasksNext: 'Tasks in next stage',
      before: 'Before (old plan)',
      after: 'After AQE merges',
      shuffleData: 'Shuffle data written',
      unknown: 'not known yet',
      target: 'Target: 1 MB+ per partition',
      idle: 'Empty tasks waste startup',
      note: 'Simplified: 4 map tasks x 3 keys (real run: 16 map tasks x 3 keys = 48 rows), 24 slots of 200 drawn',
    },
    join: {
      keys: (ks) => `keys ${ks}`,
      leftTitle: 'left table (big): shuffle files',
      rightTitle: 'right table (groupBy result)',
      oldNote: 'Old plan: rows of left must cross machines. Line color = key owned by the target executor',
      measured: 'Measured sizes',
      leftSize: 'left: big (5,000,000 rows)',
      rightSize: 'right: 5 rows (broadcast threshold 10 MB)',
      localMatch: 'left matches its local copy of right: 0 rows cross machines',
    },
    skew: {
      binsTitle: 'left table: partition sizes after the shuffle (1 dot = 10 KB)',
      slice: 'Each slice after the split: ~133 KB',
      line: (v) => `skew line ${v}`,
      rightTable: 'right table',
      copied: 'partition 4 copied 3 times',
      before: (n) => `Before: 8 tasks, slowest ${n}`,
      after: (n) => `After: 10 tasks, slowest ${n}`,
      done: 'done',
    },
  },
};

function D({ x, y, k, r = 7, ring, label }: { x: number; y: number; k: number; r?: number; ring?: boolean; label?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} className={`k${(k % 3) + 1}`} />
      {label !== undefined && <text className="dl" y="4">{label}</text>}
      {ring && <circle r={r + 4} className="fx-ring" />}
    </g>
  );
}

// ---------------------------------------------------------------- 1. coalesce
const CELLS = 24;
const FILLED = [4, 11, 17];
const cellTL = (c: number): [number, number] => [200 + (c % 12) * 40, c < 12 ? 126 : 206];
const MAPS = 4;

function CoalesceScene({ t, lang }: { t: number; lang: Lang }) {
  const T = TEXT[lang].coalesce;
  const g = smooth(prog(t, 7.4, 9.4));
  const measure = t >= T_MEASURE && t < T_RUN2;
  const idle = t >= T_RUN2 && g < 0.02;
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const taskCount = g > 0.5 ? 1 : 200;
  const dots: { m: number; key: number; i: number }[] = [];
  for (let m = 0; m < MAPS; m++) for (let key = 0; key < 3; key++) dots.push({ m, key, i: m * 3 + key });
  return (
    <g>
      {Array.from({ length: MAPS }, (_, m) => (
        <g key={m}>
          <rect className="box" x="24" y={118 + m * 52} width="140" height="46" rx="8" />
          <text className="s" x="32" y={134 + m * 52}>map task {m + 1}</text>
        </g>
      ))}
      <text className="s" x="200" y="116">{T.written}</text>

      {Array.from({ length: CELLS }, (_, c) => {
        const [x, y] = cellTL(c);
        const has = FILLED.includes(c);
        return (
          <g key={c} opacity={1 - 0.75 * g}>
            <rect className={measure && has ? 'fx-hot' : 'box'} x={x} y={y} width="36" height="64" rx="5" />
            {idle && !has && <rect x={x + 3} y={y + 44} width="30" height="16" rx="3" fill="url(#aqe-hatch)" opacity={0.35 + 0.5 * pulse} />}
            {idle && has && <rect x={x + 3} y={y + 44} width="30" height="16" rx="3" fill="url(#aqe-hatch)" opacity="0.5" />}
          </g>
        );
      })}

      <rect className="fx-hot" x={196} y={120} width={Math.max(0, 488 * g)} height={156} rx="10" opacity={g > 0 ? 1 : 0} />
      {g > 0.6 && <text className="b acc" x={440} y={296} textAnchor="middle" opacity={(g - 0.6) * 2.5}>AQEShuffleRead coalesced: 1 partition = 1 task</text>}

      {dots.map((d) => {
        const sx = 40 + d.key * 36;
        const sy = 141 + d.m * 52;
        const [cx, cy] = cellTL(FILLED[d.key]);
        const tx = cx + 18;
        const ty = cy + 12 + d.m * 11;
        const f = smooth(prog(t, 0.4 + d.i * 0.12, 2.6 + d.i * 0.12));
        let x = mix(sx, tx, f);
        let y = mix(sy, ty, f);
        x = mix(x, 236 + d.i * 36, g);
        y = mix(y, 198, g);
        return <D key={d.i} x={x} y={y} k={d.key} r={6} />;
      })}

      <g transform="translate(700 132)">
        <text className="s">{T.tasksNext}</text>
        <text className="big num" y="34">{taskCount}</text>
        {t >= T_REPLAN && g < 0.5 && <text className="s acc b" y="56">{T.before}</text>}
        {g >= 0.5 && <text className="s acc b" y="56">{T.after}</text>}
      </g>
      <g transform="translate(700 214)">
        <text className="s">{T.shuffleData}</text>
        <text className="b num" y="22">{t >= T_MEASURE ? '1,152 B' : T.unknown}</text>
        {t >= T_MEASURE && <text className="s" y="42">{T.target}</text>}
        {idle && <text className="s acc b" y="64">{T.idle}</text>}
      </g>
      <text className="s" x="24" y="334">{T.note}</text>
    </g>
  );
}

// ---------------------------------------------------------------- 2. join
// The measured query joins left = spark.range(5,000,000) (big) with right = groupBy(id % 5).count() (5 rows, keys 0 to 4).
// The number inside every dot is its join key (id % 5); a dot of the left table sits in the executor that wrote its shuffle file.
const EX_X = (e: number) => 24 + e * 282;
const EX_W = 272;
const BIG_Y = 178;
const SMALL_Y = 282;
const bigKey = (e: number, i: number) => (i * 2 + e) % 5;
const bigX = (e: number, i: number) => EX_X(e) + 30 + i * 29;
const smallX = (e: number, key: number) => EX_X(e) + 36 + key * 50;
const smallHomeX = (key: number) => EX_X(key % 3) + 36 + Math.floor(key / 3) * 50;

function Sq({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-10" y="-10" width="20" height="20" rx="4" className={`k${(k % 3) + 1}`} />
      <text className="dl" y="4">{k}</text>
    </g>
  );
}

function JoinScene({ t, lang }: { t: number; lang: Lang }) {
  const T = TEXT[lang].join;
  const ghost = prog(t, T_REPLAN, T_REPLAN + 0.6) * (1 - prog(t, T_RUN2 + 0.4, T_RUN2 + 1.2));
  const bc = smooth(prog(t, 6, 8.2));
  const matchP = prog(t, 8.6, 9.8);
  const pairs: [number, number][] = [];
  for (let e = 0; e < 3; e++) for (let o = 0; o < 3; o++) if (e !== o) pairs.push([e, o]);
  return (
    <g>
      {[0, 1, 2].map((e) => (
        <g key={e}>
          <rect className="box" x={EX_X(e)} y="114" width={EX_W} height="214" rx="10" />
          <text className="b" x={EX_X(e) + 12} y="134">executor {e + 1}</text>
          {ghost > 0.01 && (
            <text className="s b" x={EX_X(e) + EX_W - 12} y="134" textAnchor="end" opacity={ghost} style={{ fill: `var(--k${e + 1})` }}>
              {T.keys([0, 1, 2, 3, 4].filter((k) => k % 3 === e).join(', '))}
            </text>
          )}
          <text className="s" x={EX_X(e) + 12} y="152">{T.leftTitle}</text>
          <text className="s" x={EX_X(e) + 12} y="256">{T.rightTitle}</text>
        </g>
      ))}

      {/* left table: 8 dots of shuffle output per executor */}
      {[0, 1, 2].map((e) =>
        Array.from({ length: 8 }, (_, i) => {
          const f = smooth(prog(t, 0.3 + (e * 8 + i) * 0.05, 1.5 + (e * 8 + i) * 0.05));
          return <D key={`${e}-${i}`} x={bigX(e, i)} y={mix(120, BIG_Y, f)} k={bigKey(e, i)} r={9} label={String(bigKey(e, i))} ring={matchP > 0.5} />;
        }),
      )}

      {/* what sort merge join would have done: rows of the left table cross to the executor that owns their key */}
      {ghost > 0.01 && (
        <g opacity={ghost}>
          {pairs.map(([e, o]) => {
            // a row with key k belongs to the executor k % 3: leave from a dot of e that belongs to o, land on a dot of o
            const from = Array.from({ length: 8 }, (_, i) => i).find((i) => bigKey(e, i) % 3 === o);
            const owned = Array.from({ length: 8 }, (_, i) => i).filter((i) => bigKey(o, i) % 3 === o);
            if (from === undefined || owned.length === 0) return null;
            const rank = e < o ? e : e - 1;
            const to = owned[Math.min(rank, owned.length - 1)];
            const sx = bigX(e, from);
            const ex = bigX(o, to);
            const depth = BIG_Y + 40 + Math.abs(o - e) * 16;
            const c = (o % 3) + 1;
            return (
              <path
                key={`${e}${o}`}
                d={`M${sx} ${BIG_Y + 12} C${sx} ${depth} ${ex} ${depth} ${ex} ${BIG_Y + 14}`}
                fill="none"
                stroke={`var(--k${c})`}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
          <text className="s b acc" x={440} y={350} textAnchor="middle">{T.oldNote}</text>
        </g>
      )}

      {/* right table: 5 rows (keys 0 to 4), then a copy in every executor */}
      {[0, 1, 2, 3, 4].map((key) => (
        <g key={key} opacity={bc > 0.02 ? 1 - Math.min(1, bc * 2) : 1}>
          <Sq x={smallHomeX(key)} y={SMALL_Y} k={key} />
        </g>
      ))}
      {[0, 1, 2, 3, 4].flatMap((key) =>
        [0, 1, 2].map((e) =>
          bc > 0.02 ? <Sq key={`${key}-${e}`} x={mix(smallHomeX(key), smallX(e, key), bc)} y={SMALL_Y} k={key} /> : null,
        ),
      )}

      {/* the join itself: every left row meets the right row with the same key, in the same executor */}
      {matchP > 0 &&
        [0, 1, 2].flatMap((e) =>
          Array.from({ length: 8 }, (_, i) => {
            const key = bigKey(e, i);
            return (
              <line key={`${e}-${i}`} x1={bigX(e, i)} y1={BIG_Y + 10} x2={smallX(e, key)} y2={SMALL_Y - 11} className={`path s${(key % 3) + 1}`} opacity={matchP * 0.6} strokeWidth="1.8" />
            );
          }),
        )}

      {t >= T_MEASURE && (
        <g transform="translate(24 380)">
          <text className="s">{T.measured}</text>
          <rect x="150" y="-10" width="360" height="12" rx="4" className="k1" opacity="0.85" />
          <text className="s m" x="520" y="0">{T.leftSize}</text>
          <rect x="150" y="10" width="6" height="12" rx="2" className="k2" />
          <text className="s m acc b" x="166" y="20">{T.rightSize}</text>
        </g>
      )}
      {t >= 8.6 && <text className="b acc" x={440} y={350} textAnchor="middle" opacity={matchP}>{T.localMatch}</text>}
    </g>
  );
}

// ---------------------------------------------------------------- 3. skew
const SIZES = [60, 70, 55, 400, 65, 72, 58, 62]; // KB, made up for the picture
const DOT_KB = 10;
const BASE = 306;
const COLS = 3;
const SPACING = 11;
const SLICES = [13, 13, 14];

function binX(i: number, split: boolean) {
  return split ? 30 + i * 48 : 30 + i * 60;
}

function schedule(durs: number[], cores = 4) {
  const free = Array(cores).fill(0);
  const bars = durs.map((d, task) => {
    let c = 0;
    for (let k = 1; k < cores; k++) if (free[k] < free[c]) c = k;
    const start = free[c];
    free[c] += d;
    return { task, core: c, start, end: start + d };
  });
  return { bars, wall: Math.max(...free) };
}
const BEFORE = schedule(SIZES.map((s) => s / DOT_KB));
const AFTER = schedule([6, 7, 6, 13, 13, 14, 7, 7, 6, 6]);

function Gantt({ x, y, sim, now, label, done }: { x: number; y: number; sim: ReturnType<typeof schedule>; now: number; label: string; done: string }) {
  const W = 250;
  const sc = W / BEFORE.wall;
  return (
    <g transform={`translate(${x} ${y})`}>
      <text className="s b">{label}</text>
      {[0, 1, 2, 3].map((c) => (
        <rect key={c} x="0" y={8 + c * 13} width={W} height="11" rx="3" fill="none" stroke="var(--line)" />
      ))}
      {sim.bars.map((b) => {
        if (now < b.start) return null;
        const w = Math.max(1, (Math.min(now, b.end) - b.start) * sc);
        return <rect key={b.task} x={b.start * sc} y={9 + b.core * 13} width={w} height="9" rx="2" className={b.end - b.start > 20 ? 'fx-hot' : 'k1'} />;
      })}
      {now >= sim.wall && <text className="s m b acc" x={sim.wall * sc + 6} y="46">{done}</text>}
    </g>
  );
}

function SkewScene({ t, lang }: { t: number; lang: Lang }) {
  const T = TEXT[lang].skew;
  const measure = t >= T_MEASURE;
  const sp = smooth(prog(t, 4.8, 6.2));
  const lineY = BASE - 8 - (317.5 / DOT_KB / COLS) * SPACING;
  const race = Math.max(0, (t - 6.8) / 0.12); // time units elapsed in the mini timelines
  const dots: { p: number; j: number }[] = [];
  SIZES.forEach((s, p) => {
    const n = Math.round(s / DOT_KB);
    for (let j = 0; j < n; j++) dots.push({ p, j });
  });
  return (
    <g>
      <text className="b" x="30" y="120">{T.binsTitle}</text>
      {/* bins */}
      {SIZES.map((_, p) => {
        const slices = p === 3 && sp > 0.01 ? 3 : 1;
        return Array.from({ length: slices }, (_, s) => {
          const idx = p < 3 ? p : p === 3 ? 3 + s : p + 2;
          const x0 = binX(p, false);
          const x1 = binX(idx, true);
          const x = mix(x0, x1, sp);
          return <rect key={`${p}-${s}`} className={p === 3 && measure ? 'fx-hot' : 'box'} x={x} y={BASE - 170} width={46} height={176} rx="5" opacity={0.55} />;
        });
      })}
      {dots.map(({ p, j }) => {
        const idx0 = p;
        const col0 = j % COLS;
        const row0 = Math.floor(j / COLS);
        const x0 = binX(idx0, false) + 9 + col0 * 14;
        const y0 = BASE - 8 - row0 * SPACING;
        let x = x0;
        let y = y0;
        if (p === 3) {
          const s = j < SLICES[0] ? 0 : j < SLICES[0] + SLICES[1] ? 1 : 2;
          const jj = j - SLICES.slice(0, s).reduce((a, b) => a + b, 0);
          x = mix(x0, binX(3 + s, true) + 9 + (jj % COLS) * 14, sp);
          y = mix(y0, BASE - 8 - Math.floor(jj / COLS) * SPACING, sp);
        } else {
          const idx1 = p < 3 ? p : p + 2;
          x = mix(x0, binX(idx1, true) + 9 + col0 * 14, sp);
        }
        const appear = smooth(prog(t, 0.2 + (j + p * 3) * 0.02, 1.2 + (j + p * 3) * 0.02));
        return <circle key={`${p}-${j}`} cx={x} cy={mix(y0 - 30, y, appear)} r="4.5" className={p === 3 && measure ? 'k2' : 'k1'} opacity={appear} />;
      })}
      {SIZES.map((v, p) => (
        <text key={p} className="s m" x={binX(p, false) + 23} y={BASE + 22} textAnchor="middle" opacity={sp < 0.5 ? 1 : 0}>{v}</text>
      ))}
      {sp >= 0.5 && <text className="s m" x={30} y={BASE + 22}>{T.slice}</text>}
      {measure && (
        <g>
          <line x1="24" x2="510" y1={lineY} y2={lineY} stroke="var(--accent)" strokeWidth="2" strokeDasharray="7 5" />
          <text className="s b acc m" x="510" y={lineY - 6} textAnchor="end">{T.line('317.5 KB')}</text>
          {sp < 0.5 && <text className="s b acc m" x={binX(3, false) + 52} y={BASE - 150}>400 KB</text>}
        </g>
      )}

      {/* right side */}
      <text className="b" x="560" y="122">{T.rightTable}</text>
      {Array.from({ length: 8 }, (_, i) => {
        const x = 560 + (i % 4) * 74;
        const y = 132 + Math.floor(i / 4) * 52;
        const hot = i === 3;
        return (
          <g key={i}>
            {hot && sp > 0.01 && [2, 1].map((c) => <rect key={c} className="fx-hot" x={x + c * 5 * sp} y={y + c * 5 * sp} width="62" height="40" rx="6" opacity={0.9} />)}
            <rect className={hot && sp > 0.5 ? 'fx-hot' : 'box'} x={x} y={y} width="62" height="40" rx="6" />
            <text className="s" x={x + 31} y={y + 25} textAnchor="middle">{i + 1}</text>
          </g>
        );
      })}
      {sp > 0.5 && <text className="s b acc" x="560" y="242" opacity={sp}>{T.copied}</text>}

      {t >= 6.8 && (
        <g>
          <Gantt x={560} y={262} sim={BEFORE} now={race} label={T.before(BEFORE.wall)} done={T.done} />
          <Gantt x={560} y={344} sim={AFTER} now={race} label={T.after(AFTER.wall)} done={T.done} />
        </g>
      )}
    </g>
  );
}

export default function AqeFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sc, setSc] = useState<Scene>('coalesce');
  const clock = useClock(DURATION);
  const { t } = clock;
  const phase = t >= T_RUN2 ? 3 : t >= T_REPLAN ? 2 : t >= T_MEASURE ? 1 : 0;
  const replanned = t >= T_REPLAN;

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.group}>
        {SCENE_IDS.map((id) => (
          <button key={id} type="button" aria-pressed={sc === id} onClick={() => { setSc(id); clock.restart(); }}>{SCENE_LABEL[lang][id]}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.aria(SCENE_LABEL[lang][sc])}>
          <defs>
            <pattern id="aqe-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="400" rx="12" />

          {/* the four phases, always in the same order */}
          {PHASES[lang].map((p, i) => (
            <g key={p} transform={`translate(${24 + i * 211} 22)`}>
              <rect width="203" height="28" rx="14" className={i === phase ? 'fx-hot' : i < phase ? 'fx-file' : 'box'} opacity={i > phase ? 0.55 : 1} />
              <text className={i === phase ? 'b' : 's'} x="101" y="19" textAnchor="middle" style={{ fontSize: 12.5 }}>{p}</text>
            </g>
          ))}

          {/* the plan as explain() prints it */}
          <text className="s" x="24" y="72">{T.oldPlan}</text>
          <text className="m b" x="120" y="72" style={{ opacity: replanned ? 0.45 : 1 }} textDecoration={replanned ? 'line-through' : undefined}>{PLAN[sc].old}</text>
          <text className="s" x="24" y="94" opacity={replanned ? 1 : 0.3}>{T.newPlan}</text>
          <text className="m b acc" x="120" y="94" opacity={replanned ? 1 : 0}>{PLAN[sc].now}</text>

          {sc === 'coalesce' && <CoalesceScene t={t} lang={lang} />}
          {sc === 'join' && <JoinScene t={t} lang={lang} />}
          {sc === 'skew' && <SkewScene t={t} lang={lang} />}
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang][sc]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
