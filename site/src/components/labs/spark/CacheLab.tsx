import { useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Shows:      what each of three Actions in a row has to do when a DataFrame is a recipe of four steps over four partitions,
//             with or without a shuffle in it, and where (or whether) the result of one step was cached
// Because:    a DataFrame remembers its recipe and not its results, so without a cache an Action walks the recipe again, and a
//             text table cannot show which partitions skip which steps
// Control:    the recipe (with or without a shuffle), the step to cache after, the StorageLevel, and whether memory is enough
// Conclusion: a cache cuts the recipe at one step; a partition whose block is gone walks the recipe again on its own; shuffle
//             files are a second kind of saved result, so the part before a shuffle does not run again for the same DataFrame
//
// What a cell is: one partition doing one step. It is NOT a Spark task (one task covers several steps of a stage, and an Action
// that reads a cache still starts tasks to read it).
//
// Measured (Spark 4.2.0, exercises/07_performance_tuning.py `cache_lineage` on an RDD chain with a counter in every step, and
// `cache_dataframe` on DataFrames with a Python UDF that counts the rows reaching the expensive step: 4000 = all, 1000 = one
// partition), and 07b_jvm_limits.py `levels`:
//   - narrow chain, cache after step k: the next Action runs the steps after k only (none when k is last); with the block of
//     partition 2 removed, that partition alone runs again from the first step
//   - groupBy or join, the same DataFrame again: the part before the shuffle does not run (the shuffle files are used again,
//     for both sides of a join), cached or not; a different query on the same base runs it again unless the base is cached
//   - cache after the shuffle and one block removed: the part before the shuffle still does not run, the lost partition is
//     rebuilt from the shuffle files
//   - shuffle files deleted as well: the part before the shuffle runs again (shuffle and join; 07b_jvm_limits.py `lost_shuffle`,
//     a session of its own because it makes Spark treat the local executor as lost)
//   - 171 MB of data in 94 MB of storage memory: MEMORY_ONLY kept 3 of 6 partitions (3 built again), MEMORY_AND_DISK kept 6 (the
//     overflow on disk, none built again), DISK_ONLY kept all on disk. "Memory is short" in the picture is 2 of 4 partitions.

type Recipe = 'narrow' | 'shuffle';
type Level = 'mem' | 'memdisk' | 'disk';
type Cell = 'run' | 'skip' | 'hitMem' | 'hitDisk' | 'reuse';
type Block = 'mem' | 'disk' | null;

const STEPS = 4;
const PARTS = 4;
const SHUFFLE_AFTER = 2; // in the shuffle recipe, steps 1 and 2 are before the shuffle
const RECIPES: Recipe[] = ['narrow', 'shuffle'];
const LEVELS: Level[] = ['mem', 'memdisk', 'disk'];
const LEVEL_NAME: Record<Level, string> = { mem: 'MEMORY_ONLY', memdisk: 'MEMORY_AND_DISK', disk: 'DISK_ONLY' };
const LOSE = 2; // the partition whose block is lost before the third Action
const FITS = 2; // when memory is short, the first two partitions fit

const PX = [40, 330, 620];
const GRID_Y = 190;
const CELL_W = 50;
const CELL_H = 30;
const GAP = 5;
const STEP_T = 0.55;
const AT = [0.4, 3.4, 6.7];
const LOST_AT = 6.0;
const END = AT[2] + STEPS * STEP_T + 0.4 + 1.6;

interface Sim {
  cells: Cell[][][]; // [action][partition][step]
  runs: number[];
  have: number[]; // partitions that start the action with a block they can use
  none: number[];
  lost: boolean; // a block of partition 2 really disappeared before the third Action
  matters: boolean; // and the Actions use that cache at all
  stored: { mem: number; disk: number; none: number }; // after the first Action
}

function simulate(recipe: Recipe, c: number, level: Level, tight: boolean): Sim {
  const sh = recipe === 'shuffle' ? SHUFFLE_AFTER : 0;
  const blk: Block[] = Array(PARTS).fill(null);
  const cells: Cell[][][] = [];
  const runs: number[] = [];
  const have: number[] = [];
  const none: number[] = [];
  let lost = false;
  let stored = { mem: 0, disk: 0, none: PARTS };
  for (let a = 0; a < 3; a++) {
    if (a === 2 && blk[LOSE]) {
      blk[LOSE] = null;
      lost = true;
    }
    const grid: Cell[][] = [];
    let h = 0;
    let reading = false; // does any partition read the shuffle files in this Action
    for (let p = 0; p < PARTS; p++) {
      const row: Cell[] = [];
      const b = c > 0 ? blk[p] : null;
      const usable = !!b && c > sh; // a block before the shuffle is not needed: the shuffle files are used again
      if (usable) h++;
      for (let s = 1; s <= STEPS; s++) {
        let kind: Cell = 'run';
        if (a > 0 && s <= sh) kind = 'skip';
        else if (usable && s < c) kind = 'skip';
        else if (usable && s === c) kind = b === 'mem' ? 'hitMem' : 'hitDisk';
        if (a > 0 && s === sh + 1 && kind === 'run' && sh > 0) reading = true;
        row.push(kind);
      }
      grid.push(row);
    }
    if (a > 0 && sh > 0 && reading) for (const row of grid) row[sh - 1] = 'reuse';
    cells.push(grid);
    runs.push(grid.flat().filter((k) => k === 'run').length);
    have.push(h);
    none.push(PARTS - h);
    if (c > 0) {
      for (let p = 0; p < PARTS; p++) {
        if (blk[p]) continue;
        const fits = !tight || p < FITS;
        if (level === 'mem') blk[p] = fits ? 'mem' : null;
        else if (level === 'memdisk') blk[p] = fits ? 'mem' : 'disk';
        else blk[p] = 'disk';
      }
    }
    if (a === 0) stored = { mem: blk.filter((x) => x === 'mem').length, disk: blk.filter((x) => x === 'disk').length, none: blk.filter((x) => !x).length };
  }
  return { cells, runs, have, none, lost, matters: c > sh, stored };
}

const TEXT: Record<Lang, {
  title: string; recipeLabel: string; recipes: Record<Recipe, string>; cacheLabel: string; none: string; levelLabel: string; memLabel: string; memOk: string; memTight: string;
  recipe: string; steps: Record<Recipe, string[]>; cacheBadge: string; shuffle: string; action: (n: number) => string; works: (k: number) => string; lostTag: string;
  legend: string[]; cacheCell: string; diskCell: string; shuffleCell: string;
  readoutTotal: string; readoutOf: (n: number) => string; readoutStored: string; readoutNothing: string; unitMem: string; unitDisk: string; unitParts: string;
  caption: string; svgLabel: string;
  mark: {
    start: string; end: string; lost: string;
    startTitle: string; startText: (c: number) => string; a1Text: (r: Recipe, c: number, s: Sim) => string;
    again: (r: Recipe, c: number, have: number, none: number) => string;
    lostTitle: (s: Sim) => string; lostText: (r: Recipe, c: number, s: Sim) => string; lostExtra: (r: Recipe) => string;
    endTitle: (total: number) => string; endText: (r: Recipe, total: number, base: number, c: number) => string;
  };
}> = {
  th: {
    title: 'เลือกจุดที่ Cache แล้วดูว่า Action สามครั้งติดกันต้องทำอะไรบ้าง',
    recipeLabel: 'สายของ DataFrame',
    recipes: { narrow: 'ไม่มี Shuffle', shuffle: 'มี Shuffle (groupBy, Join)' },
    cacheLabel: 'Cache หลังขั้น',
    none: 'ไม่ Cache',
    levelLabel: 'ระดับที่เก็บ',
    memLabel: 'Memory',
    memOk: 'พอ',
    memTight: 'ไม่พอ (ใส่ได้ 2 จาก 4 Partition)',
    recipe: 'Recipe ของ DataFrame (Lineage)',
    steps: { narrow: ['อ่านไฟล์', 'filter', 'withColumn', 'select'], shuffle: ['อ่านไฟล์', 'filter', 'groupBy + sum', 'select'] },
    cacheBadge: 'Cache',
    shuffle: 'Shuffle',
    action: (n) => `Action ${n}`,
    works: (k) => `${k} ขั้นย่อย`,
    lostTag: 'P2 หาย',
    legend: ['ทำจริง', 'ข้ามไป', 'อ่านจาก Memory', 'อ่านจาก Disk', 'ใช้ไฟล์ Shuffle', 'Block หาย'],
    cacheCell: 'Memory',
    diskCell: 'Disk',
    shuffleCell: 'Shuffle',
    readoutTotal: 'รวม',
    readoutOf: (n) => `จาก ${n} ถ้าไม่ Cache`,
    readoutStored: 'หลัง Action 1 เก็บไว้',
    readoutNothing: 'ไม่ได้เก็บอะไร',
    unitMem: 'ใน Memory',
    unitDisk: 'ใน Disk',
    unitParts: 'Partition',
    caption: 'หนึ่งช่องคือ Partition หนึ่งตัวทำหนึ่งขั้นของ Recipe (เรียกว่าขั้นย่อย) ไม่ใช่ Task ของ Spark เพราะ Task หนึ่งตัวทำหลายขั้นต่อกันได้ และ Action ที่อ่านจาก Cache ก็ยังมี Task ไปอ่านอยู่ดี Join ของตารางใหญ่สองตารางทำงานแบบเดียวกับ groupBy ในภาพ คือทั้งสองฝั่งถูก Shuffle แล้วใช้ไฟล์ซ้ำได้ ตัวเลขทุกกรณีวัดจริง สายที่ไม่มี Shuffle วัดด้วยตัวนับทุกขั้นบน RDD (cache_lineage) สายที่มี Shuffle และ Join วัดบน DataFrame ด้วย UDF ที่นับแถว (cache_dataframe) ทั้งสองอยู่ใน exercises/07_performance_tuning.py ส่วนกรณี Memory ไม่พอวัดด้วยข้อมูล 171 MB บนที่เก็บ Cache 94 MB (levels ใน exercises/07b_jvm_limits.py) ได้ MEMORY_ONLY เก็บ 3 จาก 6 Partition ภาพจึงใช้ 2 จาก 4',
    svgLabel: 'Recipe สี่ขั้นบน 4 Partition และสิ่งที่ Action สามครั้งต้องทำ แสดงเป็นตารางสามชุด',
    mark: {
      start: 'เริ่ม',
      end: 'สรุป',
      lost: 'Partition หาย',
      startTitle: 'ยังไม่มีอะไรถูกเก็บ',
      startText: (c) => (c === 0
        ? 'DataFrame มีแต่ Recipe สี่ขั้น ยังไม่มีผลของขั้นไหนถูกเก็บ และเราไม่ได้สั่ง Cache ไว้'
        : `DataFrame มี Recipe สี่ขั้น เราสั่ง Cache หลังขั้นที่ ${c} แต่ยังไม่มีอะไรถูกเก็บ เพราะ Cache เป็น Lazy`),
      a1Text: (r, c, s) => {
        const sh = r === 'shuffle' ? ' ระหว่างขั้นที่ 2 กับ 3 Spark เขียนไฟล์ Shuffle เก็บไว้ด้วย' : '';
        if (c === 0) return `ไม่มีอะไรให้ข้าม ทุก Partition เดินตาม Recipe ตั้งแต่ขั้นแรกจนจบ${sh}`;
        const where = [s.stored.mem ? `Memory ${s.stored.mem} Partition` : '', s.stored.disk ? `Disk ${s.stored.disk} Partition` : ''].filter(Boolean).join(' และ ');
        const rest = s.stored.none ? ` อีก ${s.stored.none} Partition เก็บไม่ได้เพราะ Memory ไม่พอ` : '';
        return `ทุก Partition เดินตาม Recipe ตั้งแต่ขั้นแรก เหมือนไม่ได้ Cache เลย แต่พอจบขั้นที่ ${c} Spark เก็บผลของขั้นนั้นไว้ที่ ${where}${rest}${sh}`;
      },
      again: (r, c, have, none) => {
        const sh = r === 'shuffle';
        if (sh && c <= SHUFFLE_AFTER) {
          return c === 0
            ? 'ไม่ได้ Cache แต่ไฟล์ Shuffle จาก Action แรกยังอยู่ Spark จึงข้ามขั้นก่อน Shuffle เอง และทำเฉพาะขั้นหลัง Shuffle'
            : `Cache หลังขั้นที่ ${c} อยู่ก่อน Shuffle จึงไม่ถูกใช้ในรอบนี้ เพราะไฟล์ Shuffle ใช้ซ้ำได้อยู่แล้ว ผลเลยเท่ากับไม่ได้ Cache ลอง Cache หลังขั้นที่ 3`;
        }
        if (c === 0) return 'ไม่มีผลที่เก็บไว้ ทุก Partition จึงเดินตาม Recipe ตั้งแต่ขั้นแรกอีกครั้ง';
        const a = have ? `${have} Partition ที่มีผลเก็บไว้ อ่านผลของขั้นที่ ${c} จาก Cache เลย${c < STEPS ? ` แล้วทำต่อตั้งแต่ขั้นที่ ${c + 1}` : ' ไม่ต้องทำอะไรต่อ'}` : '';
        const b = none ? `${have ? ' ส่วน ' : ''}${none} Partition ที่ไม่มีผลเก็บไว้ ${sh ? 'ทำใหม่ตั้งแต่ขั้นที่ 3 โดยอ่านไฟล์ Shuffle เดิม ไม่ต้องทำขั้นก่อน Shuffle ใหม่' : 'ต้องเดินตั้งแต่ขั้นแรก'}` : '';
        return a + b;
      },
      lostTitle: (s) => (s.lost ? 'Block ของ Partition 2 หาย' : 'ไม่มีอะไรหาย'),
      lostText: (r, c, s) => {
        if (!s.lost) return c === 0 ? 'ไม่มีอะไรหาย เพราะเราไม่ได้เก็บอะไรไว้เลย' : 'Partition 2 ไม่มีผลเก็บไว้อยู่แล้ว เพราะ Memory ไม่พอ จึงไม่มีอะไรหายเพิ่ม';
        if (!s.matters) return 'สมมติว่า Executor ที่ถือ Partition 2 ล้ม ผลที่ Cache ไว้ของ Partition นี้หายไป แต่ Action ไม่ได้ใช้ Cache นี้อยู่แล้ว จึงไม่มีอะไรเปลี่ยน';
        return 'สมมติว่า Executor ที่ถือ Partition 2 ล้ม ผลที่เก็บไว้ของ Partition นี้หายไปด้วย Partition อื่นไม่เป็นอะไร';
      },
      lostExtra: (r) => (r === 'shuffle'
        ? ' Partition 2 ทำใหม่ตั้งแต่ขั้นที่ 3 โดยอ่านไฟล์ Shuffle เดิม ไม่ต้องเริ่มจากไฟล์ต้นทาง'
        : ' Partition 2 ย้อนตาม Recipe ของมันเองอย่างเดียว ไม่ต้องให้ Partition อื่นทำใหม่'),
      endTitle: (total) => `สามครั้งรวมกันทำ ${total} ขั้นย่อย`,
      endText: (r, total, base, c) => {
        if (c === 0) return r === 'shuffle'
          ? 'ถึงไม่ Cache Action ที่ 2 กับ 3 ก็ทำน้อยกว่า Action แรก เพราะข้ามขั้นก่อน Shuffle ด้วยไฟล์ Shuffle ลอง Cache หลังขั้นที่ 3 หรือ 4 แล้วเทียบ'
          : 'ทุก Action ทำ 16 ขั้นย่อยเท่ากัน เพราะ Spark ไม่เก็บผลของ Action ที่แล้วไว้ ลองเลือก Cache หลังขั้นอื่นแล้วเทียบตัวเลขนี้';
        return total < base
          ? `เทียบกับ ${base} ถ้าไม่ Cache (ประหยัด ${base - total}) ลองเลื่อนจุด Cache ไปท้ายสาย หรือเปลี่ยนระดับกับ Memory เพื่อดูว่า Partition ที่เก็บไม่ได้ไปอยู่ที่ไหน`
          : `เท่ากับตอนไม่ Cache (${base}) เพราะ Cache นี้ไม่ได้ถูกใช้เลย ลองเลื่อนไปหลังขั้นที่ 3`;
      },
    },
  },
  en: {
    title: 'Pick where to cache and see what three Actions in a row have to do',
    recipeLabel: 'DataFrame recipe',
    recipes: { narrow: 'No shuffle', shuffle: 'With a shuffle (groupBy, join)' },
    cacheLabel: 'Cache after step',
    none: 'No cache',
    levelLabel: 'Storage level',
    memLabel: 'Memory',
    memOk: 'enough',
    memTight: 'short (room for 2 of 4 partitions)',
    recipe: 'Recipe of the DataFrame (lineage)',
    steps: { narrow: ['read file', 'filter', 'withColumn', 'select'], shuffle: ['read file', 'filter', 'groupBy + sum', 'select'] },
    cacheBadge: 'Cache',
    shuffle: 'Shuffle',
    action: (n) => `Action ${n}`,
    works: (k) => `${k} partition-steps`,
    lostTag: 'P2 lost',
    legend: ['runs', 'skipped', 'read from memory', 'read from disk', 'shuffle files', 'block lost'],
    cacheCell: 'Memory',
    diskCell: 'Disk',
    shuffleCell: 'Shuffle',
    readoutTotal: 'Total',
    readoutOf: (n) => `of ${n} without a cache`,
    readoutStored: 'After Action 1 stored',
    readoutNothing: 'nothing stored',
    unitMem: 'in memory',
    unitDisk: 'on disk',
    unitParts: 'partitions',
    caption: 'One cell is one partition doing one step of the recipe (called a partition-step). It is not a Spark task, because one task does several steps in a row, and an Action that reads a cache still starts tasks to read it. A join of two big tables works like the groupBy in the picture: both sides are shuffled and the files can be used again. Every case was measured. The recipe without a shuffle was measured with a counter in every step on an RDD (cache_lineage), the recipe with a shuffle and the join on DataFrames with a UDF that counts rows (cache_dataframe), both in exercises/07_performance_tuning.py. The case of short memory was measured with 171 MB of data and 94 MB of storage memory (levels in exercises/07b_jvm_limits.py): MEMORY_ONLY stored 3 of 6 partitions, so the picture uses 2 of 4.',
    svgLabel: 'A recipe of four steps over 4 partitions and what three Actions have to do, drawn as three grids',
    mark: {
      start: 'Start',
      end: 'Summary',
      lost: 'Partition lost',
      startTitle: 'Nothing is stored yet',
      startText: (c) => (c === 0
        ? 'The DataFrame has only a recipe of four steps. No step result is stored, and we did not ask for a cache.'
        : `The DataFrame has a recipe of four steps, and we asked for a cache after step ${c}. Nothing is stored yet, because a cache is lazy.`),
      a1Text: (r, c, s) => {
        const sh = r === 'shuffle' ? ' Between step 2 and 3 Spark also writes shuffle files.' : '';
        if (c === 0) return `Nothing to skip. Every partition walks the recipe from the first step to the end.${sh}`;
        const where = [s.stored.mem ? `memory (${s.stored.mem} partitions)` : '', s.stored.disk ? `disk (${s.stored.disk} partitions)` : ''].filter(Boolean).join(' and ');
        const rest = s.stored.none ? ` The other ${s.stored.none} partitions could not be stored because memory is short.` : '';
        return `Every partition walks the recipe from the first step, as if there were no cache. When step ${c} is done, Spark keeps its result in ${where}.${rest}${sh}`;
      },
      again: (r, c, have, none) => {
        const sh = r === 'shuffle';
        if (sh && c <= SHUFFLE_AFTER) {
          return c === 0
            ? 'There is no cache, but the shuffle files of Action 1 are still there, so Spark skips the steps before the shuffle by itself and runs only the steps after it.'
            : `The cache after step ${c} is before the shuffle, so it is not used here: the shuffle files can be used again anyway. The result is the same as with no cache. Try a cache after step 3.`;
        }
        if (c === 0) return 'No result is stored, so every partition walks the recipe from the first step again.';
        const a = have ? `${have} partitions that have a stored result read the result of step ${c} from the cache${c < STEPS ? ` and continue from step ${c + 1}` : ' and need to do nothing more'}.` : '';
        const b = none ? `${have ? ' ' : ''}${none} partitions with no stored result ${sh ? 'run again from step 3, reading the old shuffle files, and do not redo the steps before the shuffle.' : 'walk the recipe from the first step.'}` : '';
        return a + b;
      },
      lostTitle: (s) => (s.lost ? 'The block of partition 2 is lost' : 'Nothing is lost'),
      lostText: (r, c, s) => {
        if (!s.lost) return c === 0 ? 'Nothing is lost, because nothing was stored.' : 'Partition 2 has no stored result already, because memory is short, so nothing more is lost.';
        if (!s.matters) return 'Suppose the executor that holds partition 2 dies and its cached result is gone. The Actions do not use this cache anyway, so nothing changes.';
        return 'Suppose the executor that holds partition 2 dies. The stored result of that partition is gone with it. The other partitions are fine.';
      },
      lostExtra: (r) => (r === 'shuffle'
        ? ' Partition 2 runs again from step 3, reading the old shuffle files. It does not start from the source file.'
        : ' Partition 2 walks back along its own recipe only. The other partitions do not redo anything.'),
      endTitle: (total) => `The three Actions together ran ${total} partition-steps`,
      endText: (r, total, base, c) => {
        if (c === 0) return r === 'shuffle'
          ? 'Even with no cache, Actions 2 and 3 do less than Action 1, because the shuffle files let them skip the steps before the shuffle. Try a cache after step 3 or 4 and compare.'
          : 'Every Action runs the same 16 partition-steps, because Spark does not keep the result of an earlier Action. Pick a cache after another step and compare this number.';
        return total < base
          ? `Compare with ${base} without a cache (${base - total} saved). Move the cache toward the end of the recipe, or change the level and memory to see where the partitions that do not fit go.`
          : `The same as with no cache (${base}), because this cache is never used. Try a cache after step 3.`;
      },
    },
  },
};

export default function CacheLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [recipe, setRecipe] = useState<Recipe>('narrow');
  const [c, setC] = useState(3);
  const [level, setLevel] = useState<Level>('mem');
  const [tight, setTight] = useState(false);
  const sim = simulate(recipe, c, level, tight);
  const base = simulate(recipe, 0, level, tight).runs.reduce((a, b) => a + b, 0);
  const clock = useClock(END);
  const { t } = clock;
  const restart = () => clock.restart();
  const total = sim.runs.reduce((a, b) => a + b, 0);
  const sh = recipe === 'shuffle' ? SHUFFLE_AFTER : 0;
  const steps = T.steps[recipe];

  const marks: Mark[] = [
    { at: 0, name: T.mark.start, title: T.mark.startTitle, text: T.mark.startText(c) },
    { at: AT[0], name: T.action(1), title: `${T.action(1)}: ${T.works(sim.runs[0])}`, text: T.mark.a1Text(recipe, c, sim) },
    { at: AT[1], name: T.action(2), title: `${T.action(2)}: ${T.works(sim.runs[1])}`, text: T.mark.again(recipe, c, sim.have[1], sim.none[1]) },
    { at: LOST_AT, name: T.mark.lost, title: T.mark.lostTitle(sim), text: T.mark.lostText(recipe, c, sim) },
    { at: AT[2], name: T.action(3), title: `${T.action(3)}: ${T.works(sim.runs[2])}`, text: T.mark.again(recipe, c, sim.have[2], sim.none[2]) + (sim.lost && sim.matters ? T.mark.lostExtra(recipe) : '') },
    { at: AT[2] + STEPS * STEP_T + 0.4, name: T.mark.end, title: T.mark.endTitle(total), text: T.mark.endText(recipe, total, base, c) },
  ];

  const cellXY = (panel: number, p: number, s: number): [number, number] => [PX[panel] + 30 + s * (CELL_W + GAP), GRID_Y + p * (CELL_H + 6)];
  const boxX = (i: number) => 40 + i * 210;
  const storedParts = [sim.stored.mem ? `${sim.stored.mem} ${T.unitParts} ${T.unitMem}` : '', sim.stored.disk ? `${sim.stored.disk} ${T.unitParts} ${T.unitDisk}` : ''].filter(Boolean).join(', ');
  const legendKinds = ['run', 'skip', 'hitMem', 'hitDisk', 'reuse', 'lost'];
  const LEG_W = 140;

  const swatch = (kind: string, x: number, y: number) => {
    const p = { x, y, width: 16, height: 14, rx: 4 };
    if (kind === 'run') return <rect {...p} style={{ fill: 'var(--accent)' }} />;
    if (kind === 'skip') return <rect {...p} fill="none" strokeWidth="1.5" strokeDasharray="3 3" style={{ stroke: 'var(--muted)' }} />;
    if (kind === 'hitMem') return <rect {...p} style={{ fill: 'var(--k1)' }} />;
    if (kind === 'hitDisk') return <rect {...p} style={{ fill: 'var(--k3)' }} />;
    if (kind === 'reuse') return <rect {...p} style={{ fill: 'var(--k2)' }} />;
    return <rect {...p} fill="none" strokeWidth="2" strokeDasharray="4 3" style={{ stroke: 'var(--wrong)' }} />;
  };

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.recipeLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.recipeLabel}>
          {RECIPES.map((r) => (
            <button key={r} type="button" aria-pressed={recipe === r} onClick={() => { setRecipe(r); restart(); }}>{T.recipes[r]}</button>
          ))}
        </div>
      </div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.cacheLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.cacheLabel}>
          <button type="button" aria-pressed={c === 0} onClick={() => { setC(0); restart(); }}>{T.none}</button>
          {steps.map((name, i) => (
            <button key={name} type="button" aria-pressed={c === i + 1} onClick={() => { setC(i + 1); restart(); }}>{i + 1} {name}</button>
          ))}
        </div>
      </div>
      <div className="lab-controls" style={{ opacity: c === 0 ? 0.45 : 1 }}>
        <span className="lab-label" style={{ margin: 0 }}>{T.levelLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.levelLabel}>
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => { setLevel(l); restart(); }}>{LEVEL_NAME[l]}</button>
          ))}
        </div>
      </div>
      <div className="lab-controls" style={{ opacity: c === 0 || level === 'disk' ? 0.45 : 1 }}>
        <span className="lab-label" style={{ margin: 0 }}>{T.memLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.memLabel}>
          <button type="button" aria-pressed={!tight} onClick={() => { setTight(false); restart(); }}>{T.memOk}</button>
          <button type="button" aria-pressed={tight} onClick={() => { setTight(true); restart(); }}>{T.memTight}</button>
        </div>
      </div>

      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="390" rx="12" />
          <text className="b" x="40" y="38" style={{ fontSize: 13.5 }}>{T.recipe}</text>
          {sh > 0 && <text className="b" x={boxX(sh - 1) + 190} y="44" textAnchor="middle" style={{ fontSize: 13, fill: 'var(--accent)' }}>{T.shuffle}</text>}

          {steps.map((name, i) => (
            <g key={name}>
              <rect className={`box${c === i + 1 ? ' on' : ''}`} x={boxX(i)} y="50" width="170" height="44" rx="10" />
              <text className="b" x={boxX(i) + 85} y="77" textAnchor="middle" style={{ fontSize: 14 }}>{i + 1} {name}</text>
              {i < STEPS - 1 && <path className="ln" d={`M${boxX(i) + 172} 72 L${boxX(i) + 206} 72`} markerEnd="url(#cl-arrow)" style={i === sh - 1 && sh > 0 ? { stroke: 'var(--accent)', strokeWidth: 2.4 } : undefined} />}
            </g>
          ))}
          {c > 0 && (
            <g>
              <path className="ln" d={`M${boxX(c - 1) + 85} 96 L${boxX(c - 1) + 85} 108`} />
              <rect x={boxX(c - 1) + 45} y="108" width="80" height="24" rx="12" style={{ fill: 'var(--k1)' }} />
              <text className="dl" x={boxX(c - 1) + 85} y="124" style={{ fontSize: 12 }}>{T.cacheBadge}</text>
            </g>
          )}
          <defs>
            <marker id="cl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 1 L9 5 L0 9 z" style={{ fill: 'var(--muted)' }} />
            </marker>
          </defs>

          {[0, 1, 2].map((a) => {
            const lostOn = a === 2 && sim.lost;
            const lostF = smooth(prog(t, LOST_AT, LOST_AT + 0.35));
            return (
              <g key={a}>
                <text className="b" x={PX[a]} y="170" style={{ fontSize: 15 }}>
                  {T.action(a + 1)}
                  <tspan className="s" dx="8" style={{ fontSize: 13 }}>{T.works(sim.runs[a])}</tspan>
                  {lostOn && <tspan dx="8" style={{ fontSize: 13, fill: 'var(--wrong)', opacity: lostF }}>{T.lostTag}</tspan>}
                </text>
                {Array.from({ length: STEPS }, (_, s) => (
                  <text key={s} className="s" x={cellXY(a, 0, s)[0] + CELL_W / 2} y="185" textAnchor="middle" style={{ fontSize: 12 }}>{s + 1}</text>
                ))}
                {sh > 0 && (
                  <path d={`M${cellXY(a, 0, sh)[0] - GAP / 2} ${GRID_Y - 4} L${cellXY(a, 0, sh)[0] - GAP / 2} ${GRID_Y + PARTS * (CELL_H + 6) - 4}`} fill="none" strokeWidth="1.8" strokeDasharray="4 3" style={{ stroke: 'var(--accent)' }} />
                )}
                {Array.from({ length: PARTS }, (_, p) => (
                  <g key={p}>
                    <text className="s b" x={PX[a]} y={cellXY(a, p, 0)[1] + 20} style={{ fontSize: 12 }}>P{p}</text>
                    {Array.from({ length: STEPS }, (_, s) => {
                      const [x, y] = cellXY(a, p, s);
                      const kind = sim.cells[a][p][s];
                      const f = smooth(prog(t, AT[a] + s * STEP_T, AT[a] + s * STEP_T + 0.35));
                      const label = kind === 'hitMem' ? T.cacheCell : kind === 'hitDisk' ? T.diskCell : kind === 'reuse' ? T.shuffleCell : '';
                      return (
                        <g key={s}>
                          <rect x={x} y={y} width={CELL_W} height={CELL_H} rx="6" className="box" style={{ strokeWidth: 1, opacity: 0.55 }} />
                          {kind === 'run' && <rect x={x} y={y} width={CELL_W} height={CELL_H} rx="6" style={{ fill: 'var(--accent)', opacity: f }} />}
                          {kind === 'skip' && <rect x={x} y={y} width={CELL_W} height={CELL_H} rx="6" fill="none" strokeWidth="1.5" strokeDasharray="3 3" style={{ stroke: 'var(--muted)', opacity: f * 0.8 }} />}
                          {label && (
                            <g style={{ opacity: f }}>
                              <rect x={x} y={y} width={CELL_W} height={CELL_H} rx="6" style={{ fill: kind === 'hitMem' ? 'var(--k1)' : kind === 'hitDisk' ? 'var(--k3)' : 'var(--k2)' }} />
                              <text className="dl" x={x + CELL_W / 2} y={y + 19} style={{ fontSize: 11 }}>{label}</text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                    {lostOn && p === LOSE && (
                      <rect x={PX[a] - 4} y={cellXY(a, p, 0)[1] - 3} width={30 + STEPS * (CELL_W + GAP) + 2} height={CELL_H + 6} rx="8" fill="none" strokeWidth="2" strokeDasharray="5 4" style={{ stroke: 'var(--wrong)', opacity: smooth(prog(t, LOST_AT, LOST_AT + 0.35)) }} />
                    )}
                  </g>
                ))}
              </g>
            );
          })}

          {legendKinds.map((kind, i) => (
            <g key={kind}>
              {swatch(kind, 40 + i * LEG_W, 360)}
              <text className="s" x={40 + i * LEG_W + 22} y="372" style={{ fontSize: 12.5 }}>{T.legend[i]}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="readout" aria-live="off">
        <span>{T.action(1)} <b>{sim.runs[0]}</b></span>
        <span>{T.action(2)} <b>{sim.runs[1]}</b></span>
        <span>{T.action(3)} <b>{sim.runs[2]}</b></span>
        <span>{T.readoutTotal} <b>{total}</b> {T.readoutOf(base)}</span>
        <span>{T.readoutStored} <b>{c === 0 || !storedParts ? T.readoutNothing : storedParts}</b></span>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
