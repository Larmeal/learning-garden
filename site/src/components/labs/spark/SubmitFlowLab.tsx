import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// An application on a standalone cluster, client deploy mode, dynamic allocation with shuffle tracking.
// The cluster was real (exercises/11_deployment_ui.py): one master, one worker with 2 cores, executors of 1 core.
// Asserted there: no executor before the first job, 2 executors (1 core each) after it, executors that hold shuffle data
// are kept when idle, and executors of a job without a shuffle are released. Class names come from the Spark source.

type Lang = 'th' | 'en';

const STEPS: Record<Lang, StepInfo[]> = {
  th: [
    { name: 'spark-submit', title: 'คุณรันโปรแกรม: Driver เริ่มทำงาน', text: 'ใน Client Mode (ค่าเริ่มต้น) Driver จะอยู่ในคอมพิวเตอร์ที่คุณรัน spark-submit หรือ Python Script ซึ่งตรงนั้น SparkContext จะถูกสร้างขึ้น และเปิด Spark UI ที่พอร์ต 4040 (วัดจริง: Executors ตอนนี้มีแต่ Driver)' },
    { name: 'ลงทะเบียน', title: 'Driver ลงทะเบียน Application กับ Master', text: 'StandaloneAppClient จะส่งคำขอไปที่ Master พร้อมบอกว่าต้องการ Executor แบบไหน (Memory 512m, 1 Core ต่อ Executor) แล้ว Master ก็จดไว้ว่ามี Application นี้' },
    { name: 'รอทำงาน', title: 'ยังไม่มี Executor เพราะยังไม่มีงาน', text: 'เราตั้ง dynamicAllocation และ minExecutors = 0 ไว้ Spark จึงไม่ขอ Executor จนกว่าจะมีงาน ซึ่งช่วยประหยัด Resource แต่งานแรกจะต้องรอให้ Executor เริ่มทำงานก่อน' },
    { name: 'มี action', title: 'เรียก Action: DAGScheduler สร้าง Stage และ Task', text: 'collect() ทำให้ได้ 1 Job 2 Stage 14 Task (8 Map Task + 6 Task หลัง Shuffle) จากนั้น ExecutorAllocationManager เห็นว่ามีงานรออยู่ จึงขอ Executor เพิ่ม' },
    { name: 'เริ่ม executor', title: 'Master สั่ง Worker เปิด Executor', text: 'Master เลือก Worker ที่มี Core ว่าง (ที่นี่ 2 Core) แล้ว Worker จะให้ ExecutorRunner เปิด JVM ใหม่ที่รัน CoarseGrainedExecutorBackend ซึ่งได้ Executor 2 ตัว ตัวละ 1 Core' },
    { name: 'รับ task', title: 'Executor ลงทะเบียนกับ Driver แล้วรับ Task', text: 'Executor จะติดต่อกลับ Driver โดยตรง (ไม่ผ่าน Master) แล้ว TaskSchedulerImpl จะส่ง Task ให้ทีละ Core ที่ว่าง รวม 14 Task ผ่าน Executor 2 ตัว และผล Shuffle จะถูกเขียนลง Disk ของ Executor' },
    { name: 'ว่าง', title: 'งานจบ: Executor ที่ไม่มี Shuffle Data ถูกคืน', text: 'เมื่อ Executor ว่างเกิน executorIdleTimeout (ตั้ง 4 วินาที) ก็จะถูกปล่อยคืน ถ้าไม่มี Shuffle Data (วัดจริง: Job ที่ไม่มี Shuffle ได้ Executors กลับเหลือแต่ Driver) แต่ถ้ายังเก็บ Shuffle Data ของ Job ที่เพิ่งเสร็จไว้ Shuffle Tracking จะ **ไม่ปล่อย** (วัดจริง: รอ 8 วินาทีแล้วยังเหลือ 2 ตัว)' },
  ],
  en: [
    { name: 'spark-submit', title: 'You run the program: the driver starts', text: 'In client mode (the default) the driver runs on the machine where you run spark-submit or the python script. The SparkContext is created there and the Spark UI opens on port 4040 (measured: the executors list has only the driver now)' },
    { name: 'Register', title: 'The driver registers the application with the Master', text: 'StandaloneAppClient sends a request to the Master that says what kind of executor it wants (512m of memory, 1 core per executor). The Master notes that this application exists' },
    { name: 'Wait', title: 'No executor yet because there is no work yet', text: 'dynamicAllocation is on and minExecutors = 0, so Spark does not ask for an executor until there is work. This saves resources, but the first job has to wait for an executor to start' },
    { name: 'Action', title: 'An action is called: DAGScheduler builds stages and tasks', text: 'collect() gives 1 job, 2 stages and 14 tasks (8 map tasks + 6 tasks after the shuffle). ExecutorAllocationManager sees that work is waiting, so it asks for more executors' },
    { name: 'Start executors', title: 'The Master tells a Worker to start executors', text: 'The Master picks a Worker that has free cores (2 cores here). The Worker has ExecutorRunner start a new JVM that runs CoarseGrainedExecutorBackend. The result is 2 executors with 1 core each' },
    { name: 'Take tasks', title: 'The executors register with the driver and take tasks', text: 'The executors contact the driver directly (not through the Master). TaskSchedulerImpl sends tasks one per free core, so the 14 tasks go through 2 executors. The shuffle output is written to the disk of the executor' },
    { name: 'Idle', title: 'The work is done: executors without shuffle data are released', text: 'When an executor is idle for more than executorIdleTimeout (set to 4 seconds), it is released, if it holds no shuffle data (measured: after a job without a shuffle, the executors list went back to the driver only). But if it keeps the shuffle data of the job that just finished, shuffle tracking does **not** release it (measured: after waiting 8 seconds, 2 executors were still there)' },
  ],
};

const TEXT: Record<Lang, {
  title: string;
  aria: (n: number, title: string) => string;
  yourMachine: string;
  knows: string;
  runs: (n: number) => string;
  holds: string;
  tasksDirect: string;
  addExec: string;
  caption: string;
}> = {
  th: {
    title: 'spark-submit ถึง Executor: ใครคุยกับใคร',
    aria: (n, title) => `ขั้นที่ ${n}: ${title}`,
    yourMachine: 'คอมพิวเตอร์ของคุณ: Driver',
    knows: 'รู้ว่ามี Worker กี่ตัว',
    runs: (n) => `รัน Task ${n} ตัว`,
    holds: 'เก็บ Shuffle Data อยู่ จึงยังไม่ถูกปล่อย',
    tasksDirect: 'Tasks (ตรงจาก Driver)',
    addExec: 'ขอ Executor เพิ่ม',
    caption: 'Cluster ในภาพรันจริงใน WSL ด้วย spark-class ชุดเดียวกับที่ sbin/start-master.sh ใช้ ส่วน YARN และ Kubernetes จะมีผู้เล่นต่างกัน (ResourceManager, API server) แต่ลำดับที่ Driver ขอ Executor แล้ว Executor ติดต่อ Driver นั้นเหมือนกัน',
  },
  en: {
    title: 'spark-submit to executor: who talks to whom',
    aria: (n, title) => `Step ${n}: ${title}`,
    yourMachine: 'Your machine: Driver',
    knows: 'knows the Workers',
    runs: (n) => `runs ${n} tasks`,
    holds: 'holds shuffle data, so not released',
    tasksDirect: 'tasks (direct from driver)',
    addExec: 'add executors',
    caption: 'The cluster in the picture ran for real in WSL, started with the same spark-class that sbin/start-master.sh uses. YARN and Kubernetes have different players (ResourceManager, API server), but the order is the same: the driver asks for executors, then the executors contact the driver.',
  },
};

const EASE = { duration: 0.6, ease: 'easeInOut' as const };

export default function SubmitFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 3800);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : EASE;
  const showApp = step >= 1;
  const showExec = step >= 4;
  const tasks = step >= 5 ? 14 : 0;
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={T.aria(step + 1, steps[step].title)}>
          <defs>
            <marker id="sf-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="340" rx="12" />

          {/* driver */}
          <rect className="box on" x="30" y="40" width="220" height="150" rx="10" />
          <text className="b" x="46" y="66">{T.yourMachine}</text>
          <text className="s" x="46" y="88">SparkContext, DAGScheduler</text>
          <text className="s" x="46" y="106">Spark UI :4040</text>
          <motion.text className="m s" x="46" y="140" initial={false} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={t}>1 job / 2 stage / 14 task</motion.text>

          {/* master */}
          <rect className="box" x="330" y="40" width="220" height="110" rx="10" />
          <text className="b" x="346" y="66">Master (:7077)</text>
          <motion.text className="s" x="346" y="92" initial={false} animate={{ opacity: showApp ? 1 : 0 }} transition={t}>application: c11</motion.text>
          <text className="s" x="346" y="112">{T.knows}</text>

          {/* worker */}
          <rect className="box" x="330" y="190" width="520" height="140" rx="10" />
          <text className="b" x="346" y="216">Worker (2 cores, 2 GB)</text>
          {[0, 1].map((i) => (
            <motion.g key={i} initial={false} animate={{ opacity: showExec ? 1 : 0, y: showExec ? 0 : 14 }} transition={{ ...t, delay: reduce ? 0 : i * 0.25 }}>
              <rect className="box on" x={360 + i * 230} y="236" width="210" height="76" rx="8" />
              <text className="b m" x={372 + i * 230} y="260" style={{ fontSize: 13 }}>Executor {i} (1 core)</text>
              <text className="s" x={372 + i * 230} y="280">CoarseGrainedExecutorBackend</text>
              <motion.text className="m s b acc" x={372 + i * 230} y="300" initial={false} animate={{ opacity: step >= 5 && step < 6 ? 1 : 0 }} transition={t}>{T.runs(tasks / 2)}</motion.text>
            </motion.g>
          ))}
          <motion.text className="s b acc" x="360" y="326" initial={false} animate={{ opacity: step === 6 ? 1 : 0 }} transition={t}>{T.holds}</motion.text>

          {/* arrows */}
          <motion.g initial={false} animate={{ opacity: step === 1 ? 1 : 0.25 }} transition={t}>
            <line className="ln" x1="252" y1="80" x2="328" y2="80" markerEnd="url(#sf-ar)" />
            <text className="s" x="256" y="70">register</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: step === 4 ? 1 : 0.2 }} transition={t}>
            <line className="ln" x1="440" y1="152" x2="440" y2="188" markerEnd="url(#sf-ar)" />
            <text className="s" x="448" y="176">launch executor</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: step === 5 ? 1 : 0.2 }} transition={t}>
            <line className="ln" x1="140" y1="192" x2="140" y2="270" />
            <line className="ln" x1="140" y1="270" x2="358" y2="270" markerEnd="url(#sf-ar)" />
            <text className="s" x="150" y="262">{T.tasksDirect}</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: step === 3 ? 1 : 0.2 }} transition={t}>
            <line className="ln" x1="252" y1="130" x2="328" y2="110" markerEnd="url(#sf-ar)" />
            <text className="s" x="254" y="146">{T.addExec}</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
