import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// Spark's unified memory on a JVM with a 600 MiB heap, measured by exercises/13_internals.py:
//   unified = (heap - 300 MiB reserved) x spark.memory.fraction (0.6) = 188,743,680 B = 180 MiB,
//   storage region = unified x spark.memory.storageFraction (0.5) = 90 MiB,
//   after caching 4 blocks: 153.9 MiB used by storage (more than its 90 MiB: it borrowed),
//   after a sort that needs execution memory: 77.0 MiB left (2 of 4 blocks evicted).
// Each of the 4 cached blocks is about 38.5 MiB. The execution size during the sort is drawn, not measured.

const UNIFIED = 180;
const REGION = 90;
const BLOCK = 38.5;

type Lang = 'th' | 'en';

interface S extends StepInfo {
  blocks: number; // cached blocks still in memory
  exec: number; // MiB of execution memory in use (drawn)
  evicted?: number;
}

const STEPS: Record<Lang, S[]> = {
  th: [
    { name: 'ขนาด', title: 'Heap 600 MiB แบ่งเป็นสามส่วน', text: 'Reserved 300 MiB เป็นส่วนที่ Spark กันไว้ใช้เอง ทำให้เหลือ 300 MiB ซึ่งแบ่งเป็น User Memory 40% = 120 MiB สำหรับ Object ในโค้ดของคุณ และอีก 60% = 180 MiB เป็น Unified Memory ที่ Spark ใช้ ตอนวัดจริงได้ 188,743,680 ไบต์ ตรงกับสูตรพอดี', blocks: 0, exec: 0 },
    { name: 'เส้นแบ่ง', title: 'Unified Memory มีเส้นแบ่ง "นุ่ม" ตรงครึ่ง', text: 'spark.memory.storageFraction = 0.5 ตั้งเส้นแบ่งไว้ที่ 90 MiB โดยฝั่งซ้ายเป็นพื้นที่ของ Storage (cache, broadcast) และฝั่งขวาเป็นของ Execution (shuffle, sort, join, aggregate) เส้นนี้สามารถขยับได้ เหมือนฉากกั้นที่เลื่อนได้ ไม่ได้เป็นกำแพงตายตัว', blocks: 0, exec: 0 },
    { name: 'Cache', title: 'Cache 4 Block: Storage ยืมที่ว่างของ Execution', text: 'เมื่อเรา cache ข้อมูล 154 MiB (4 block) ซึ่งเกินครึ่งของ Storage แต่ตอนนี้ Execution ยังไม่ได้ใช้พื้นที่ของตัวเอง Storage จึงยืมมาใช้ได้ ตอนวัดจริง Storage ใช้ไป 153.9 MiB เกินเส้น 90 MiB', blocks: 4, exec: 0 },
    { name: 'Sort', title: 'Sort ต้องการ Memory: Execution เอาคืนได้', text: 'เมื่อ Execution ขอ Memory เพิ่มและที่ว่างหมดแล้ว UnifiedMemoryManager จะไล่ evict Block ของ Storage ที่เกินเส้นออก (MemoryStore ใช้ LRU) ตอนวัดจริงเหลือ 2 จาก 4 Block (77.0 MiB) แล้ว Execution ก็ได้พื้นที่ไปทำงาน', blocks: 2, exec: 100, evicted: 2 },
    { name: 'จบ Sort', title: 'สิ่งที่ควรรู้: Block ที่ถูก evict ไม่กลับมาเอง', text: 'พอ Sort จบ Execution จะคืน Memory แต่ Block ที่ถูก evict ไปแล้วจะไม่ถูกโหลดกลับมา ถ้าต้องใช้อีกก็ต้องคำนวณใหม่ (หรืออ่านจาก Disk ถ้าเก็บแบบ MEMORY_AND_DISK) เพราะฉะนั้น Cache ที่ใช้ MEMORY_ONLY จึงไม่รับประกันว่าข้อมูลจะอยู่ครบ', blocks: 2, exec: 0, evicted: 2 },
    { name: 'ทางกลับ', title: 'ทางกลับทำไม่ได้: Storage ไม่ evict Execution', text: 'กฎคือ Execution สามารถ evict Storage ที่ยืมเกินเส้นไปได้ แต่ Storage จะไม่เอา Memory คืนจาก Execution เลย (Execution ห้ามถูก evict เพราะ Task กำลังใช้อยู่) ถ้า Execution ถือ Memory ไว้เกือบหมด การ cache ครั้งใหม่ก็อาจใส่ไม่ได้ (source: คอมเมนต์ใน UnifiedMemoryManager)', blocks: 2, exec: 110, evicted: 2 },
  ],
  en: [
    { name: 'Sizes', title: 'A 600 MiB heap is split into three parts', text: 'reserved 300 MiB (Spark keeps it for itself) leaves 300 MiB. One part is user memory (40% = 120 MiB for the objects of your code) and the other 60% = 180 MiB is the unified memory that Spark uses. Measured: 188,743,680 bytes, exactly the formula', blocks: 0, exec: 0 },
    { name: 'Boundary', title: 'Unified memory has a "soft" boundary at the middle', text: 'spark.memory.storageFraction = 0.5 puts the boundary at 90 MiB. The left side is the area of storage (cache, broadcast) and the right side is execution (shuffle, sort, join, aggregate). The line can move. It is not a wall', blocks: 0, exec: 0 },
    { name: 'cache', title: 'Cache 4 blocks: storage borrows free space from execution', text: 'Caching 154 MiB of data (4 blocks) is more than the storage half of unified memory (90 MiB), but execution is not using its side yet, so storage can borrow it (measured: storage used 153.9 MiB, past the 90 MiB line)', blocks: 4, exec: 0 },
    { name: 'sort', title: 'A sort needs memory: execution can take it back', text: 'Execution asks for more memory. If no free space is left, UnifiedMemoryManager evicts the storage blocks that are past the line (MemoryStore uses LRU). Measured: 2 of 4 blocks are left (77.0 MiB) and execution gets the space to work', blocks: 2, exec: 100, evicted: 2 },
    { name: 'Sort ends', title: 'What to know: an evicted block does not come back by itself', text: 'When the sort ends, execution gives its memory back, but the blocks that were evicted are not loaded again. If they are needed, they are computed again (or read from disk if stored as MEMORY_AND_DISK). So a cache with MEMORY_ONLY does not guarantee that everything stays', blocks: 2, exec: 0, evicted: 2 },
    { name: 'The other way', title: 'The other way is not possible: storage does not evict execution', text: 'The rule is that execution may evict storage that borrowed past the line, but storage never takes memory back from execution (execution cannot be evicted because a task is using it). If execution holds almost everything, a new cache may not fit (read from the source: the comments in UnifiedMemoryManager)', blocks: 2, exec: 110, evicted: 2 },
  ],
};

const TEXT: Record<Lang, {
  title: string;
  aria: (n: number, title: string) => string;
  reserved: string;
  boundary: string;
  storageLeft: string;
  execRight: string;
  storageUsed: (v: string) => string;
  execUsed: (exec: number) => string;
  evicted: (n: number) => string;
  caption: string;
}> = {
  th: {
    title: 'Unified Memory: Storage กับ Execution แบ่งกันใช้',
    aria: (n, title) => `ขั้นที่ ${n}: ${title}`,
    reserved: 'Reserved 300 MiB',
    boundary: 'เส้นแบ่งนุ่ม 90 MiB (storageFraction 0.5)',
    storageLeft: 'Storage (cache) เริ่มจากซ้าย',
    execRight: 'Execution เริ่มจากขวา',
    storageUsed: (v) => `Storage ใช้อยู่ ${v} MiB (พื้นที่ของตัวเอง 90.0 MiB)`,
    execUsed: (e) => `Execution ใช้อยู่ ${e > 0 ? `${e} MiB (วาดตามตัวอย่าง ไม่ได้วัด)` : '0 MiB'}`,
    evicted: (n) => `evict แล้ว ${n} Block`,
    caption: 'ขนาด 600 MiB, 180 MiB, 90 MiB และตัวเลข 153.9 กับ 77.0 MiB เราวัดจริงด้วย SparkEnv.get.memoryManager (exercises/13_internals.py) ส่วนขนาดของ Execution ในภาพเป็นเพียงค่าสาธิตนะ',
  },
  en: {
    title: 'Unified memory: storage and execution share it',
    aria: (n, title) => `Step ${n}: ${title}`,
    reserved: 'reserved 300 MiB',
    boundary: 'soft boundary 90 MiB (storageFraction 0.5)',
    storageLeft: 'storage (cache) starts from the left',
    execRight: 'execution starts from the right',
    storageUsed: (v) => `storage uses ${v} MiB (its own area 90.0 MiB)`,
    execUsed: (e) => `execution uses ${e > 0 ? `${e} MiB (drawn as an example, not measured)` : '0 MiB'}`,
    evicted: (n) => `evicted ${n} block${n === 1 ? '' : 's'}`,
    caption: 'The sizes 600 MiB, 180 MiB, 90 MiB and the numbers 153.9 and 77.0 MiB were measured with SparkEnv.get.memoryManager (exercises/13_internals.py). The execution size in the picture is only a demonstration value.',
  },
};

const X0 = 60;
const W = 760;
const px = (mib: number) => X0 + (mib / UNIFIED) * W;
const EASE = { duration: 0.7, ease: 'easeInOut' as const };

export default function MemoryLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 4200);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : EASE;
  const s = steps[step];
  const storageUsed = s.blocks * BLOCK;
  const execStart = UNIFIED - s.exec;
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.aria(step + 1, s.title)}>
          <rect className="band" x="10" y="10" width="860" height="320" rx="12" />

          {/* heap overview */}
          <text className="b" x="40" y="38">JVM heap 600 MiB</text>
          <rect x={40} y={48} width={400} height={26} className="box" />
          <rect x={440} y={48} width={160} height={26} className="box" style={{ fill: 'var(--surface-2)' }} />
          <motion.rect x={600} y={48} width={240} height={26} className="box on" initial={false} animate={{ opacity: step >= 0 ? 1 : 0 }} />
          <text className="s" x={50} y={66}>{T.reserved}</text>
          <text className="s" x={450} y={66}>user 120 MiB</text>
          <text className="s b" x={612} y={66}>unified 180 MiB</text>
          <line x1={600} y1={74} x2={X0} y2={118} stroke="var(--line-strong)" strokeDasharray="3 4" />
          <line x1={840} y1={74} x2={X0 + W} y2={118} stroke="var(--line-strong)" strokeDasharray="3 4" />

          {/* unified region */}
          <rect className="box" x={X0} y={120} width={W} height={92} rx="6" />
          {/* storage: cached blocks from the left */}
          {[0, 1, 2, 3].map((i) => {
            const present = i < s.blocks;
            return (
              <motion.g key={i} initial={false} animate={{ opacity: present ? 1 : step >= 2 ? 0.18 : 0, scale: present ? 1 : 0.9 }} transition={t} style={{ transformOrigin: `${px(i * BLOCK + BLOCK / 2)}px 166px` }}>
                <rect className="k1" x={px(i * BLOCK) + 1} y={126} width={(BLOCK / UNIFIED) * W - 2} height={80} rx="4" />
                <text className="dl" x={px(i * BLOCK + BLOCK / 2)} y={170}>block {i + 1}</text>
              </motion.g>
            );
          })}
          {/* execution from the right */}
          <motion.rect className="k2" y={126} height={80} rx="4" initial={false} animate={{ x: px(execStart), width: Math.max(0, (s.exec / UNIFIED) * W - 2), opacity: s.exec > 0 ? 1 : 0 }} transition={t} />
          <motion.text className="dl" y={170} initial={false} animate={{ x: px(execStart + s.exec / 2), opacity: s.exec > 0 ? 1 : 0 }} transition={t}>execution</motion.text>

          {/* soft boundary */}
          <line x1={px(REGION)} x2={px(REGION)} y1={112} y2={222} stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="7 5" />
          <text className="s b acc" x={px(REGION)} y={236} textAnchor="middle">{T.boundary}</text>

          <text className="s" x={X0} y={110}>{T.storageLeft}</text>
          <text className="s" x={X0 + W} y={110} textAnchor="end">{T.execRight}</text>

          {/* numbers */}
          <rect className="box" x={X0} y={252} width={W} height={62} rx="8" />
          <text className="m s" x={X0 + 14} y={274}>{T.storageUsed(storageUsed.toFixed(1))}</text>
          <text className="m s" x={X0 + 14} y={294}>{T.execUsed(s.exec)}</text>
          <motion.text className="m s b acc" x={X0 + 400} y={274} initial={false} animate={{ opacity: s.evicted ? 1 : 0 }} transition={t}>
            {T.evicted(s.evicted ?? 0)}
          </motion.text>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
