import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// Conceptual walk through what a sort does when its memory runs out.
// Mechanism: Spillable.maybeSpill, TaskMemoryManager.acquireExecutionMemory, UnsafeExternalSorter.spill
// (Spark 4.2.0 source, see the in-depth page). The two totals in the last step were measured.

type Lang = 'th' | 'en';

const STEPS: Record<Lang, StepInfo[]> = {
  th: [
    { name: 'เริ่ม', title: 'Task หนึ่งตัว Sort ข้อมูลของ Partition ตัวเอง', text: 'ทุก Task จะได้ส่วนแบ่งของ Execution Memory ใน Pool ของ Executor ซึ่ง Sorter ต้องเก็บแถวไว้ใน Memory เพื่อใช้ Sort' },
    { name: 'เก็บแถว', title: 'แถวไหลเข้า Buffer', text: 'Sorter ขอ Memory เพิ่มจาก Pool ทีละก้อน ๆ และเมื่อได้ครบก็เก็บแถวต่อ ทำให้ Buffer ค่อย ๆ เต็ม' },
    { name: 'เต็ม', title: 'ขอ Memory เพิ่มไม่ได้แล้ว', text: 'Pool ไม่มี Memory เหลือให้ Task นี้แล้ว เพราะ Task อื่นก็ใช้อยู่ด้วย TaskMemoryManager จึงสั่งให้ Consumer ที่ถือ Memory อยู่ไปเขียนลง Disk' },
    { name: 'Spill', title: 'Sort สิ่งที่มีอยู่ แล้วเขียนเป็น Spill File', text: 'แถวใน Buffer ถูก Sort แล้วเขียนลงไฟล์ชั่วคราวบน Disk จากนั้น Memory จะถูกคืนให้ Pool นี่แหละคือ Spill ซึ่งจะช้าลงเพราะต้องเขียน Disk แต่ก็ไม่ได้เป็น Error' },
    { name: 'ทำซ้ำ', title: 'เก็บแถวต่อ เต็มอีก Spill อีก', text: 'วนซ้ำแบบนี้จนอ่านข้อมูลหมด แล้วเราจะได้ Spill File หลายไฟล์ที่ Sort แล้วทั้งหมด' },
    { name: 'Merge', title: 'ไล่รวมไฟล์ที่เรียงแล้วเป็นผลลัพธ์เดียว', text: 'Spill File ทุกไฟล์กับ Buffer ที่เหลือจะถูก Merge แบบ k-way ซึ่งได้ข้อมูลที่เรียงลำดับแล้ว ใน Spark UI เราจะเห็น Spill (Memory) และ Spill (Disk) ของ Stage นี้ (วัดจริง: 6 ล้านแถวบน Memory 600 MB ได้ 280 MiB และ 232 MiB)' },
  ],
  en: [
    { name: 'Start', title: 'One task sorts the data of its own partition', text: 'Every task gets a share of the execution memory in the executor pool. The sorter has to keep the rows in memory to sort them' },
    { name: 'Collect rows', title: 'Rows flow into the buffer', text: 'The sorter asks the pool for more memory in chunks. When it gets the memory, it keeps adding rows and the buffer slowly fills up' },
    { name: 'Full', title: 'No more memory can be requested', text: 'The pool has no memory left for this task (the other tasks are using it too). So TaskMemoryManager tells a consumer that holds memory to write it to disk' },
    { name: 'Spill', title: 'Sort what is there, then write a spill file', text: 'The rows in the buffer are sorted and written to a temporary file on disk. The memory goes back to the pool. This is a spill: slower because it writes to disk, but not an error' },
    { name: 'Repeat', title: 'Collect more rows, fill up again, spill again', text: 'This repeats until all the data is read. The result is several spill files, all sorted' },
    { name: 'Merge', title: 'Merge the sorted files into one result', text: 'All spill files and the rows left in the buffer are merged with a k-way merge, which gives sorted data. In the Spark UI you see Spill (Memory) and Spill (Disk) for this stage (measured: 6 million rows with 600 MB of memory gave 280 MiB and 232 MiB)' },
  ],
};

const TEXT: Record<Lang, { title: string; aria: (n: number) => string; mem: string; full: string; buffer: string; noMore: string; sortWrite: string; disk: string; merge: string; sorted: string; caption: string }> = {
  th: {
    title: 'Spill: เมื่อ Memory ของ Task ไม่พอ',
    aria: (n) => `ขั้นที่ ${n} ของ Spill`,
    mem: 'Execution Memory ของ Task',
    full: 'เต็ม!',
    buffer: 'Buffer ของแถวที่ยังไม่ Sort',
    noMore: 'Pool ไม่มีให้เพิ่ม',
    sortWrite: 'Sort + เขียน',
    disk: 'Disk: Spill File (Sort แล้ว)',
    merge: 'Merge',
    sorted: 'ผลลัพธ์เรียงลำดับ',
    caption: 'ภาพนี้เล่าลำดับเหตุการณ์ และไม่ได้วาดตามสัดส่วนจริง ส่วนกลไกอ้างจาก Spillable.maybeSpill และ UnsafeExternalSorter.spill ใน source ของ Spark 4.2.0',
  },
  en: {
    title: 'Spill: when the memory of a task is not enough',
    aria: (n) => `Step ${n} of the spill`,
    mem: 'Execution memory of the task',
    full: 'Full!',
    buffer: 'buffer of unsorted rows',
    noMore: 'pool has no more',
    sortWrite: 'sort + write',
    disk: 'Disk: spill files (sorted)',
    merge: 'merge',
    sorted: 'sorted result',
    caption: 'The picture tells the order of events and is not drawn to scale. The mechanism is taken from Spillable.maybeSpill and UnsafeExternalSorter.spill in the Spark 4.2.0 source.',
  },
};

const FILL = [0, 0.35, 1, 0, 1, 0.3];
const FILES = [0, 0, 0, 1, 2, 2];

export default function SpillLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 3200);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { duration: 0.7, ease: 'easeInOut' as const };
  const fill = FILL[step];
  const files = FILES[step];
  const merging = step === 5;
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.aria(step + 1)}>
          <rect className="band" x="10" y="10" width="860" height="310" rx="12" />

          <text className="b" x="40" y="42">{T.mem}</text>
          <rect className="box" x="40" y="60" width="240" height="220" rx="10" />
          <motion.rect
            className={step === 2 ? 'k2' : 'k1'}
            x="48"
            width="224"
            rx="6"
            initial={false}
            animate={{ y: 272 - 204 * fill, height: 204 * fill }}
            transition={t}
          />
          <motion.text className="b acc" x="160" y="170" textAnchor="middle" initial={false} animate={{ opacity: step === 2 ? 1 : 0 }} transition={t}>{T.full}</motion.text>
          <text className="s" x="160" y="298" textAnchor="middle">{T.buffer}</text>

          <motion.g initial={false} animate={{ opacity: step === 2 ? 1 : 0 }} transition={t}>
            <text className="s b acc" x="300" y="150">{T.noMore}</text>
          </motion.g>

          <line className="ln" x1="300" y1="190" x2="400" y2="190" style={{ opacity: step === 3 || step === 4 ? 1 : 0.15 }} />
          <text className="s" x="305" y="180" style={{ opacity: step === 3 || step === 4 ? 1 : 0 }}>{T.sortWrite}</text>

          <text className="b" x="420" y="42">{T.disk}</text>
          {[0, 1, 2].map((i) => (
            <motion.g key={i} initial={false} animate={{ opacity: files > i ? 1 : 0, x: files > i ? 0 : -20 }} transition={t}>
              <rect className="box on" x="420" y={64 + i * 58} width="200" height="46" rx="8" />
              <text className="m s" x="436" y={92 + i * 58}>spill-{i + 1}.tmp  (sorted)</text>
            </motion.g>
          ))}

          <motion.g initial={false} animate={{ opacity: merging ? 1 : 0 }} transition={t}>
            <line className="ln" x1="630" y1="140" x2="690" y2="140" />
            <line className="ln" x1="630" y1="198" x2="690" y2="160" />
            <rect className="box on" x="690" y="110" width="160" height="90" rx="10" />
            <text className="b" x="770" y="150" textAnchor="middle">{T.merge}</text>
            <text className="s" x="770" y="170" textAnchor="middle">{T.sorted}</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
