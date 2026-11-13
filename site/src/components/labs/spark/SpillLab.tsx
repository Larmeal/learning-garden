import { useMemo, useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Shows:      why a task spills and how many spill files it writes
// Because:    the cause is a limit that depends on the other tasks of the executor, and the result depends on two numbers at
//             once (the share of the task and the size of its partition); a sentence cannot let you change them
// Control:    "tasks running at the same time" sets the share of our task (pool / N); "data in the partition" sets how much
//             has to pass through that share. Both restart the clock and change the number of spill files.
// Conclusion: a smaller share or a bigger partition means more spill files; if the data fits in the share nothing is written
//
// Mechanism (Spark 4.2.0 source): ExecutionMemoryPool.acquireMemory keeps a task between 1/(2N) and 1/N of the pool
// (maxMemoryPerTask = maxPoolSize / numActiveTasks); UnsafeExternalSorter.spill sorts the records in memory, writes them as a
// spill file and frees the memory; getSortedIterator merges the spill files with what is still in memory
// (UnsafeSorterSpillMerger). The blocks are a drawing: one block stands for the same amount of data everywhere.

const POOL = 8; // slots of the execution memory pool of the executor
const TASKS = [1, 2, 4]; // tasks that run at the same time in the executor
const DATA = [6, 12, 18]; // blocks in the partition of our task
const ARRIVE = 0.45; // seconds between two blocks
const FLY = 0.4; // a block travels from the input row to its slot
const FULL = 0.5; // the beat in which the share is full and the next block waits
const WRITE = 0.8; // the blocks travel to the disk
const MERGE = 1.8;

const SLOT = 34;
const GAP = 4;
const PX = 24;
const PY = 176;
const slotX = (s: number) => PX + s * (SLOT + GAP);
const inX = (i: number) => PX + 7 + i * 18;
const IN_Y = 66;
const FX = 448; // spill files
const fileXY = (n: number): [number, number] => [FX + (n % 3) * 70, 64 + Math.floor(n / 3) * 58];
const RX = 672; // result
const resXY = (k: number): [number, number] => [RX + 16 + (k % 6) * 28, 104 + Math.floor(k / 6) * 28];

const TEXT: Record<Lang, {
  title: string; tasksLabel: string; tasks: (n: number) => string; dataLabel: string; data: (n: number) => string;
  poolHead: string; inputHead: (d: number) => string; share: (l: number, n: number) => string; others: (n: number) => string;
  cannot: string; sortWrite: string; diskHead: string; resultHead: string; blocks: (n: number) => string;
  spilled: string; files: string; inMem: string; unit: string; caption: string; svgLabel: string;
  start: Omit<Mark, 'at'>; collect: Omit<Mark, 'at'>; full: Omit<Mark, 'at'>; spill: Omit<Mark, 'at'>; repeat: Omit<Mark, 'at'>;
  merge: Omit<Mark, 'at'>; noSpill: Omit<Mark, 'at'>;
}> = {
  th: {
    title: 'ลองเปลี่ยนจำนวน Task กับขนาดของ Partition แล้วดูว่า Task หนึ่งตัวต้อง Spill กี่ครั้ง',
    tasksLabel: 'Task ที่รันพร้อมกันใน Executor',
    tasks: (n) => `${n} Task`,
    dataLabel: 'ข้อมูลใน Partition ของ Task นี้',
    data: (n) => `${n} ก้อน`,
    poolHead: `Execution Memory Pool ของ Executor (${POOL} ช่อง ใช้ร่วมกันทุก Task)`,
    inputHead: (d) => `Partition ของ Task นี้ (${d} ก้อน) ถูกอ่านเข้ามาทีละก้อน`,
    share: (l, n) => (n === 1 ? `ส่วนของ Task นี้ ${l} ช่อง (ได้ทั้ง Pool เพราะรันอยู่ตัวเดียว)` : `ส่วนของ Task นี้ ไม่เกิน 1/${n} ของ Pool = ${l} ช่อง`),
    others: (n) => `Task อื่นอีก ${n - 1} ตัวถืออยู่`,
    cannot: 'ขอ Memory เพิ่มไม่ได้',
    sortWrite: 'Sort แล้วเขียน',
    diskHead: 'Disk: Spill File (Sort แล้ว)',
    resultHead: 'ผลที่เรียงแล้ว',
    blocks: (n) => `${n} ก้อน`,
    spilled: 'Spill ไปแล้ว',
    files: 'ไฟล์',
    inMem: 'ถืออยู่ใน Memory',
    unit: 'ช่อง',
    caption: 'ภาพนี้เป็นแบบจำลอง ก้อนหนึ่งก้อนแทนข้อมูลปริมาณเท่า ๆ กัน และไม่ได้วาดตามสัดส่วนจริง กฎที่ว่า Task หนึ่งถือได้ไม่เกิน 1/N ของ Pool อ่านจาก ExecutionMemoryPool ส่วนการ Spill กับการ Merge อ่านจาก UnsafeExternalSorter ใน Source ของ Spark 4.2.0 ตัวเลขที่วัดจริงอยู่ในข้อความใต้ภาพ',
    svgLabel: 'แบบจำลอง Task ที่ Sort ข้อมูลแล้ว Memory ไม่พอ จึงเขียน Spill File ลง Disk แล้ว Merge กลับ',
    start: { name: 'เริ่ม', title: 'Task หนึ่งตัวกำลังจะ Sort ข้อมูลของ Partition ตัวเอง', text: 'Executor มี Execution Memory Pool ก้อนเดียวให้ทุก Task ที่รันอยู่ใช้ร่วมกัน และ Task หนึ่งตัวถือได้ไม่เกิน 1/N ของ Pool เมื่อมี N Task รันพร้อมกัน ในภาพ ช่องที่มีขอบสีน้ำเงินคือส่วนของ Task ที่เรากำลังดู' },
    collect: { name: 'เก็บแถว', title: 'แถวไหลเข้ามาเก็บใน Memory ทีละก้อน', text: 'Sorter ต้องเก็บแถวไว้ใน Memory ให้ครบก่อนถึงจะ Sort ได้ เราจึงเห็นก้อนข้อมูลเลื่อนลงมาเรียงอยู่ในส่วนของ Task' },
    full: { name: 'เต็ม', title: 'ส่วนของ Task เต็มแล้ว แต่ก้อนถัดไปยังรออยู่', text: 'Task ถือเกิน 1/N ของ Pool ไม่ได้ และ Memory ที่เหลือก็เป็นของ Task อื่น Sorter จึงขอเพิ่มไม่ได้ ต้องเอาที่ถืออยู่ไปเก็บลง Disk ก่อน' },
    spill: { name: 'Spill', title: 'Sort ก้อนที่ถืออยู่ แล้วเขียนเป็น Spill File', text: 'แถวในส่วนของ Task ถูก Sort แล้วเขียนเป็นไฟล์ชั่วคราวบน Disk จากนั้น Memory ก็ว่างให้ก้อนถัดไป Spill ทำให้ช้าลงเพราะต้องเขียน Disk แต่ไม่ใช่ Error และ Job ยังจบได้ตามปกติ' },
    repeat: { name: 'ทำซ้ำ', title: 'เต็มอีกก็ Spill อีก ไฟล์จึงเพิ่มขึ้นเรื่อย ๆ', text: 'ส่วนของ Task ยิ่งเล็ก หรือข้อมูลใน Partition ยิ่งเยอะ ไฟล์ที่ได้ก็ยิ่งเยอะ ลองเปลี่ยนตัวเลือกด้านบนแล้วดูว่าจำนวนไฟล์เปลี่ยนไปเท่าไร' },
    merge: { name: 'Merge', title: 'รวม Spill File กับแถวที่ยังอยู่ใน Memory ให้เป็นผลที่เรียงแล้ว', text: 'ทุกไฟล์ถูก Sort มาแล้ว Spark จึง Merge แบบ k-way ได้ ใน Spark UI เราจะเห็นผลรวมของสิ่งที่ Spill เป็น Spill (Memory) กับ Spill (Disk) ของ Stage นี้' },
    noSpill: { name: 'Sort', title: 'ข้อมูลทั้งหมดอยู่ใน Memory พอดี จึงไม่ต้อง Spill', text: 'Sort ใน Memory แล้วส่งผลต่อได้เลย ไม่มีไฟล์ใดถูกเขียนลง Disk ลองเพิ่มจำนวน Task ที่รันพร้อมกัน หรือเลือก Partition ที่ใหญ่ขึ้น แล้วดูว่า Spill เริ่มเกิดตอนไหน' },
  },
  en: {
    title: 'Change the number of tasks and the size of the partition and see how many times one task has to spill',
    tasksLabel: 'Tasks running at the same time in the executor',
    tasks: (n) => `${n} ${n === 1 ? 'task' : 'tasks'}`,
    dataLabel: 'Data in the partition of this task',
    data: (n) => `${n} blocks`,
    poolHead: `Execution memory pool (${POOL} slots, shared)`,
    inputHead: (d) => `The partition of this task (${d} blocks), read in one block at a time`,
    share: (l, n) => (n === 1 ? `Share of this task: ${l} slots (the whole pool, because it runs alone)` : `Share of this task: at most 1/${n} of the pool = ${l} slots`),
    others: (n) => `${n - 1} other ${n === 2 ? 'task holds' : 'tasks hold'} the rest`,
    cannot: 'Cannot ask for more memory',
    sortWrite: 'sort and write',
    diskHead: 'Disk: spill files (sorted)',
    resultHead: 'Sorted result',
    blocks: (n) => `${n} blocks`,
    spilled: 'Spilled so far',
    files: 'files',
    inMem: 'Held in memory',
    unit: 'slots',
    caption: 'The picture is a model. One block stands for the same amount of data everywhere, and nothing is drawn to scale. The rule that a task holds at most 1/N of the pool is read from ExecutionMemoryPool, and the spill and the merge from UnsafeExternalSorter, in the Spark 4.2.0 source. The measured numbers are in the text under the picture.',
    svgLabel: 'A model of a task that sorts its data, runs out of memory, writes spill files to disk and merges them back',
    start: { name: 'Start', title: 'One task is about to sort the data of its own partition', text: 'The executor has one execution memory pool that every running task shares, and one task can hold at most 1/N of it when N tasks run at the same time. In the picture, the slots with a blue border are the share of the task we are watching.' },
    collect: { name: 'Collect rows', title: 'Rows flow in and are kept in memory one block at a time', text: 'The sorter has to keep the rows in memory before it can sort them, so the blocks of data slide down and line up in the share of the task.' },
    full: { name: 'Full', title: 'The share of the task is full, but the next block is waiting', text: 'A task cannot hold more than 1/N of the pool, and the rest of the memory belongs to the other tasks. So the sorter cannot ask for more and has to put what it holds on disk first.' },
    spill: { name: 'Spill', title: 'Sort what is held, then write it as a spill file', text: 'The rows in the share of the task are sorted and written to a temporary file on disk. Then the memory is free for the next block. A spill makes the task slower because it writes to disk, but it is not an error and the job still finishes.' },
    repeat: { name: 'Repeat', title: 'Full again, spill again, so the files keep growing', text: 'The smaller the share of the task, or the more data in the partition, the more files you get. Change the choices above and see how the number of files changes.' },
    merge: { name: 'Merge', title: 'Merge the spill files and the rows still in memory into one sorted result', text: 'Every file was sorted when it was written, so Spark can merge them with a k-way merge. In the Spark UI you see the total of what was spilled as Spill (Memory) and Spill (Disk) for this stage.' },
    noSpill: { name: 'Sort', title: 'All the data fits in memory, so there is nothing to spill', text: 'The task sorts in memory and passes the result on. No file is written to disk. Try more tasks at the same time, or a bigger partition, and see when the spill starts.' },
  },
};

interface Add { i: number; at: number; slot: number }
interface Spill { n: number; at: number; from: number }

export default function SpillLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [tasks, setTasks] = useState(2);
  const [data, setData] = useState(12);
  const L = POOL / tasks; // slots in the share of our task

  // The whole story as a list of events, so that the picture is a function of the clock time alone.
  const plan = useMemo(() => {
    const adds: Add[] = [];
    const spills: Spill[] = [];
    let tm = 0.7;
    let held = 0;
    for (let i = 0; i < data; i++) {
      if (held === L) {
        spills.push({ n: spills.length, at: tm, from: i - L });
        tm += FULL + WRITE;
        held = 0;
      }
      adds.push({ i, at: tm, slot: held });
      held++;
      tm += ARRIVE;
    }
    const mergeAt = tm + 0.5;
    return { adds, spills, mergeAt, end: mergeAt + MERGE + 0.6 };
  }, [data, L]);

  const clock = useClock(plan.end);
  const { t } = clock;
  const { adds, spills, mergeAt } = plan;
  const restart = () => clock.restart();

  const marks: Mark[] = [{ at: 0, ...T.start }, { at: adds[0].at, ...T.collect }];
  if (spills.length) {
    marks.push({ at: spills[0].at, ...T.full }, { at: spills[0].at + FULL, ...T.spill });
    if (spills.length > 1) marks.push({ at: spills[1].at, ...T.repeat });
    marks.push({ at: mergeAt, ...T.merge });
  } else {
    marks.push({ at: mergeAt, ...T.noSpill });
  }

  const spillOf = (i: number) => spills.find((s) => i >= s.from && i < s.from + L);
  const slotC = (slot: number): [number, number] => [slotX(slot) + SLOT / 2, PY + SLOT / 2];
  const filesDone = spills.filter((s) => t >= s.at + FULL + WRITE).length;
  const flashing = spills.find((s) => t >= s.at && t < s.at + FULL);
  const writing = spills.find((s) => t >= s.at + FULL && t < s.at + FULL + WRITE);
  const mergeP = prog(t, mergeAt, mergeAt + MERGE);
  const inMem = adds.filter((a) => {
    if (t < a.at + FLY * 0.5) return false;
    const s = spillOf(a.i);
    if (s && t >= s.at + FULL) return false;
    return mergeP < 0.2;
  }).length;
  const resultShown = Math.floor(data * smooth(prog(t, mergeAt + 0.3, mergeAt + MERGE)));

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.tasksLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.tasksLabel}>
          {TASKS.map((n) => <button key={n} type="button" aria-pressed={tasks === n} onClick={() => { setTasks(n); restart(); }}>{T.tasks(n)}</button>)}
        </div>
      </div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.dataLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.dataLabel}>
          {DATA.map((n) => <button key={n} type="button" aria-pressed={data === n} onClick={() => { setData(n); restart(); }}>{T.data(n)}</button>)}
        </div>
      </div>

      <div className="viz-box">
        <svg viewBox="0 0 880 304" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="284" rx="12" />

          <text className="b" x={PX} y="40" style={{ fontSize: 13.5 }}>{T.inputHead(data)}</text>
          <text className="b" x={PX} y={PY - 16} style={{ fontSize: 13.5 }}>{T.poolHead}</text>

          {/* the pool: our share (blue border) and the slots that the other tasks hold */}
          {Array.from({ length: POOL }, (_, s) => {
            const ours = s < L;
            return (
              <rect key={s} x={slotX(s)} y={PY} width={SLOT} height={SLOT} rx="6" className="box"
                style={ours ? { stroke: 'var(--k1)', strokeWidth: 2 } : { fill: 'var(--line)', stroke: 'var(--line-strong)', opacity: 0.8 }} />
            );
          })}
          <rect x={slotX(0) - 3} y={PY - 3} width={L * (SLOT + GAP) - GAP + 6} height={SLOT + 6} rx="9" fill="none"
            style={{ stroke: flashing ? 'var(--accent)' : 'var(--k1)', strokeWidth: flashing ? 3.5 : 1.5, transition: 'stroke .2s' }} />
          <text className="s b" x={PX} y={PY + SLOT + 22} style={{ fill: 'var(--k1)' }}>{T.share(L, tasks)}</text>
          {tasks > 1 && <text className="s" x={PX} y={PY + SLOT + 42}>{T.others(tasks)}</text>}
          {flashing && <text className="s b acc" x={PX} y={PY + SLOT + 64}>{T.cannot}</text>}

          {/* the data of our task, block by block */}
          {adds.map((a) => {
            const [sx, sy] = slotC(a.slot);
            const fly = smooth(prog(t, a.at, a.at + FLY));
            let x = mix(inX(a.i), sx, fly);
            let y = mix(IN_Y, sy, fly);
            let op = 1;
            let fill = 'var(--k1)';
            const s = spillOf(a.i);
            if (s) {
              const w = smooth(prog(t, s.at + FULL, s.at + FULL + WRITE));
              const [fx, fy] = fileXY(s.n);
              x = mix(x, fx + 31, w);
              y = mix(y, fy + 23, w);
              if (w > 0) fill = 'var(--accent)';
              if (w >= 1) op = 0;
            } else if (t >= mergeAt) {
              op = 1 - smooth(prog(t, mergeAt + 0.2, mergeAt + 1.0));
            }
            const size = mix(14, 26, fly);
            return <rect key={a.i} x={x - size / 2} y={y - size / 2} width={size} height={size} rx="4" opacity={op} style={{ fill }} />;
          })}

          {/* from the pool to the disk: in the free space right of the pool row, so it crosses neither the header nor a slot */}
          <g opacity={writing || flashing ? 1 : 0.18}>
            <line className="ln" x1={slotX(POOL) + 2} y1={PY + SLOT / 2} x2={FX - 14} y2={PY + SLOT / 2} />
            <text className="s" x={mix(slotX(POOL), FX - 14, 0.5)} y={PY + SLOT / 2 - 8} textAnchor="middle">{T.sortWrite}</text>
          </g>

          <text className="b" x={FX} y="40" style={{ fontSize: 13.5 }}>{T.diskHead}</text>
          {spills.map((s) => {
            const done = prog(t, s.at + FULL + WRITE - 0.2, s.at + FULL + WRITE + 0.2);
            const [fx, fy] = fileXY(s.n);
            return (
              <g key={s.n} opacity={done} transform={`translate(${fx} ${fy})`}>
                <rect className="fx-hot" width="62" height="46" rx="8" opacity={1 - 0.45 * smooth(mergeP)} />
                <text className="s m b" x="31" y="20" textAnchor="middle">spill-{s.n + 1}</text>
                <text className="s" x="31" y="36" textAnchor="middle">{T.blocks(L)}</text>
              </g>
            );
          })}

          <text className="b" x={RX} y="40" style={{ fontSize: 13.5 }}>{T.resultHead}</text>
          <rect className="box" x={RX} y="64" width="190" height="140" rx="10" />
          {mergeP > 0 && spills.map((s) => {
            const [fx, fy] = fileXY(s.n);
            return <line key={s.n} className="ln" x1={fx + 62} y1={fy + 23} x2={RX} y2="134" opacity={0.5 * smooth(prog(t, mergeAt, mergeAt + 0.5))} />;
          })}
          {Array.from({ length: data }, (_, k) => {
            const [rx, ry] = resXY(k);
            return k < resultShown ? <rect key={k} x={rx} y={ry} width="22" height="22" rx="4" className="k2" /> : null;
          })}
        </svg>
      </div>

      <div className="readout" aria-live="off">
        <span>{T.spilled} <b>{filesDone}</b> {T.files}</span>
        <span>{T.inMem} <b>{inMem}</b> / {L} {T.unit}</span>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
