import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo, type Lang } from './stepper';

// A job with two shuffles, run by exercises/13_internals.py on PySpark RDDs (Spark 4.2.0):
//   pairs = parallelize(range(100), 4).map(x -> (x % 5, 1))
//   pairs.reduceByKey(add).map(...).reduceByKey(add).collect()
// The job had 3 stages of 4, 4 and 4 tasks (statusTracker). Class names are from DAGScheduler.scala and friends.

const RDDS = [
  { id: 'r0', label: 'ParallelCollectionRDD', sub: '4 partitions' },
  { id: 'r1', label: 'map (pairs)', sub: '4 partitions' },
  { id: 'r2', label: 'ShuffledRDD', sub: 'reduceByKey, 4' },
  { id: 'r3', label: 'map', sub: '4 partitions' },
  { id: 'r4', label: 'ShuffledRDD', sub: 'reduceByKey, 4' },
];
const BOX_W = 138;
const X = (i: number) => 34 + i * 168;

const STAGES = [
  { name: 'Stage 0', kind: 'ShuffleMapStage', from: 0, to: 1 },
  { name: 'Stage 1', kind: 'ShuffleMapStage', from: 2, to: 3 },
  { name: 'Stage 2', kind: 'ResultStage', from: 4, to: 4 },
];

const STEPS: Record<Lang, StepInfo[]> = {
  th: [
    { name: 'สร้าง Lineage', title: 'Transformation ต่อ RDD เป็นห่วงโซ่ โดยยังไม่เกิด Job', text: 'แต่ละ RDD จะจำว่าตัวเองมาจาก RDD ไหนและผ่านการดำเนินการอะไร (Dependencies) ตอนนี้ยังไม่มีข้อมูลถูกคำนวณเลย (ตอนวัดจริง Job Group ว่างอยู่จนกว่าจะเรียก collect)' },
    { name: 'Action', title: 'collect() เรียก SparkContext.runJob', text: 'Action จะส่ง RDD สุดท้ายให้ DAGScheduler ซึ่งสร้าง ResultStage สำหรับ RDD นี้ก่อน แล้วไล่ย้อนตาม Dependency เพื่อหาว่าต้องมี Stage อะไรมาก่อนหน้านี้บ้าง' },
    { name: 'ไล่ย้อน', title: 'เจอ ShuffleDependency ก็ตัดตรงนั้น', text: 'Narrow Dependency (map) จะอยู่ใน Stage เดียวกัน เพราะ Partition ลูกแต่ละตัวอ่านจาก Partition พ่อแค่ไม่กี่ตัว จึง Pipeline ได้ ส่วน ShuffleDependency เป็นเส้นแบ่งขอบเขต DAGScheduler จะสร้าง ShuffleMapStage ให้ฝั่งพ่อ แล้วทำแบบเดิมซ้ำไปเรื่อย ๆ' },
    { name: '3 Stage', title: 'ได้ 3 Stage ที่ต้องรันตามลำดับ', text: 'Stage 0 และ 1 เป็น ShuffleMapStage (จบด้วยการเขียนไฟล์ Shuffle) ส่วน Stage 2 เป็น ResultStage ตอนวัดจริงได้ 3 Stage ที่มี 4, 4, 4 Task (Join ของ RDD ใน PySpark เป็น union ตามด้วย Shuffle หนึ่งครั้ง จึงได้แค่ 2 Stage)' },
    { name: 'รัน Stage 0', title: 'ส่ง Stage 0 เป็น TaskSet', text: 'Stage ที่ไม่มีพ่อซึ่งยังขาด Output จะถูกส่งก่อน โดย DAGScheduler จะห่อ Partition ที่ขาดเป็น TaskSet แล้วส่งให้ TaskScheduler (TaskSetManager เลือก Task ให้ Executor ที่ว่างอยู่) และ Task ของ ShuffleMapStage มีชื่อว่า ShuffleMapTask' },
    { name: 'รัน Stage 1', title: 'Output ของ Stage 0 พร้อมแล้ว จึงส่ง Stage 1', text: 'เมื่อทุก Task ของ Stage 0 เสร็จ ผลที่เขียนไว้จะถูกลงทะเบียนกับ MapOutputTracker ที่ Driver ทำให้ Stage 1 ซึ่งต้องการผลนั้นส่งได้ จากนั้น Task ของ Stage 1 จะอ่านไฟล์ Shuffle จากผู้เขียนทุกตัวตามตำแหน่งที่ Tracker บอก' },
    { name: 'รัน Stage 2', title: 'Stage สุดท้ายคืนผลให้ Driver', text: 'ResultStage จะรัน ResultTask ที่คืนผลของแต่ละ Partition ไปที่ Driver ซึ่งประกอบเป็นผลของ collect ถ้า Executor หายไประหว่างทางและไฟล์ Shuffle หายตามไปด้วย DAGScheduler จะส่ง Stage พ่อที่ขาดไปใหม่ (Stage Attempt ถัดไป) แทนที่จะเริ่มทั้ง Job ใหม่' },
  ],
  en: [
    { name: 'Build lineage', title: 'Transformations chain RDDs together, and no job exists yet', text: 'Each RDD remembers which RDD it came from and by what operation (its dependencies). No data has been computed yet (measured: the job group is empty until collect is called).' },
    { name: 'action', title: 'collect() calls SparkContext.runJob', text: 'The action hands the last RDD to the DAGScheduler. It first creates a ResultStage for this RDD, then walks back along the dependencies to find which stages must come before it.' },
    { name: 'Walk back', title: 'Found a ShuffleDependency: cut here', text: 'A narrow dependency (map) stays in the same stage, because each child partition reads from only a few parent partitions, so it can be pipelined. A ShuffleDependency is the boundary: the DAGScheduler creates a ShuffleMapStage for the parent side, and repeats this again and again.' },
    { name: '3 stages', title: 'The result is 3 stages that must run in order', text: 'Stage 0 and 1 are ShuffleMapStages (they end by writing shuffle files). Stage 2 is the ResultStage. Measured: 3 stages with 4, 4 and 4 tasks (a PySpark RDD join is a union followed by one shuffle, so it gives only 2 stages).' },
    { name: 'Run stage 0', title: 'Submit Stage 0 as a TaskSet', text: 'A stage with no missing parent output is submitted first. The DAGScheduler wraps the missing partitions in a TaskSet and gives it to the TaskScheduler (the TaskSetManager picks tasks for free executors). A task of a ShuffleMapStage is called a ShuffleMapTask.' },
    { name: 'Run stage 1', title: 'Output of stage 0 is ready: submit Stage 1', text: 'When every task of stage 0 is done, the output it wrote is registered with the MapOutputTracker on the driver. So stage 1, which needs that output, can be submitted. Tasks of stage 1 read shuffle files from every writer, at the locations the tracker gives.' },
    { name: 'Run stage 2', title: 'The last stage returns results to the driver', text: 'The ResultStage runs ResultTasks that return the result of each partition to the driver, which assembles the result of collect. If an executor is lost on the way and its shuffle files disappear, the DAGScheduler resubmits the missing parent stage (the next stage attempt) instead of restarting the whole job.' },
  ],
};

const TEXT = {
  th: {
    title: 'DAGScheduler ตัด Job เป็น Stage ตรง Shuffle',
    aria: (n: number, title: string) => `ขั้นที่ ${n}: ${title}`,
    tasks: 'Task ต่อ Partition: ShuffleMapTask ที่เขียนไฟล์ Shuffle (stage 0, 1) และ ResultTask ที่คืนผลให้ Driver (stage 2)',
    n4: 'DAGScheduler -> TaskScheduler: TaskSet(stage 0, 4 tasks) -> executors',
    n5: 'MapOutputTracker: shuffle 0 มี Output ครบ 4 ตัว -> ส่ง stage 1',
    n6: 'MapOutputTracker: shuffle 1 ครบ -> ส่ง ResultStage -> collect() ได้ผล',
    status: 'สถานะ Stage ตอนนี้: ',
    done: 'เสร็จ',
    running: 'กำลังรัน',
    waiting: 'รอ',
  },
  en: {
    title: 'The DAGScheduler cuts a job into stages at each shuffle',
    aria: (n: number, title: string) => `Step ${n}: ${title}`,
    tasks: 'one task per partition: ShuffleMapTask writes shuffle files (stage 0, 1), ResultTask returns results to the driver (stage 2)',
    n4: 'DAGScheduler -> TaskScheduler: TaskSet(stage 0, 4 tasks) -> executors',
    n5: 'MapOutputTracker: shuffle 0 has all 4 outputs -> submit stage 1',
    n6: 'MapOutputTracker: shuffle 1 complete -> submit ResultStage -> collect() returns',
    status: 'Stage status now: ',
    done: 'done',
    running: 'running',
    waiting: 'waiting',
  },
};

export default function SchedulerLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 3800);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { duration: 0.55, ease: 'easeInOut' as const };
  const showStages = step >= 3;
  // which stages are running / done at this step
  const runningStage = step >= 4 ? step - 4 : -1;
  const doneUpTo = step >= 4 ? step - 4 : -1; // stages with index < runningStage are done
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.aria(step + 1, steps[step].title)}>
          <defs>
            <marker id="sc-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="320" rx="12" />

          {/* stage frames */}
          {STAGES.map((s, i) => (
            <motion.g key={s.name} initial={false} animate={{ opacity: showStages ? 1 : 0 }} transition={t}>
              <rect
                className={runningStage === i ? 'box on' : 'box'}
                x={X(s.from) - 12}
                y={50}
                width={X(s.to) + BOX_W - X(s.from) + 24}
                height={158}
                rx="12"
                strokeDasharray={doneUpTo > i ? '6 4' : undefined}
                style={{ fill: 'none' }}
              />
              <text className="b" x={X(s.from)} y={44}>{s.name}</text>
              <text className="s" x={X(s.from) + 66} y={44}>{s.kind}</text>
            </motion.g>
          ))}

          {/* RDD chain */}
          {RDDS.map((r, i) => (
            <g key={r.id}>
              <motion.rect
                className="box"
                x={X(i)}
                y={74}
                width={BOX_W}
                height={52}
                rx="8"
                initial={false}
                animate={{ stroke: step === 1 && i === 4 ? 'var(--accent)' : 'var(--line-strong)' }}
                transition={t}
              />
              <text className="b" x={X(i) + 10} y={96} style={{ fontSize: 12 }}>{r.label}</text>
              <text className="s" x={X(i) + 10} y={114}>{r.sub}</text>
              {i < RDDS.length - 1 && (
                <>
                  {i === 1 || i === 3 ? (
                    <g>
                      <path d={`M${X(i) + BOX_W} 100 L${X(i + 1) - 2} 100`} stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 4" fill="none" markerEnd="url(#sc-ar)" />
                      <text className="s b acc" x={X(i) + BOX_W - 6} y={66}>shuffle</text>
                    </g>
                  ) : (
                    <line className="ln" x1={X(i) + BOX_W} y1={100} x2={X(i + 1) - 2} y2={100} markerEnd="url(#sc-ar)" />
                  )}
                </>
              )}
            </g>
          ))}

          {/* tasks */}
          {STAGES.map((s, si) =>
            [0, 1, 2, 3].map((k) => {
              const status = si < runningStage ? 'done' : si === runningStage ? 'run' : 'wait';
              const visible = showStages;
              return (
                <motion.g key={`${si}-${k}`} initial={false} animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }} transition={{ ...t, delay: reduce ? 0 : k * 0.05 }}>
                  <rect
                    x={X(s.from) + 2 + k * 34}
                    y={150}
                    width={30}
                    height={34}
                    rx="6"
                    className={status === 'wait' ? 'box' : 'box on'}
                    style={{ fill: status === 'done' ? 'var(--accent-soft)' : undefined }}
                  />
                  <text className="s m" x={X(s.from) + 17 + k * 34} y={171} textAnchor="middle">{status === 'done' ? 'ok' : `t${k}`}</text>
                </motion.g>
              );
            }),
          )}
          <motion.text className="s" x="34" y="232" initial={false} animate={{ opacity: showStages ? 1 : 0 }} transition={t}>
            {T.tasks}
          </motion.text>

          {/* driver notes */}
          <motion.g initial={false} animate={{ opacity: step >= 4 ? 1 : 0 }} transition={t}>
            <rect className="box" x="34" y="248" width="800" height="58" rx="8" />
            <text className="m s" x="48" y="270">
              {step === 4 && T.n4}
              {step === 5 && T.n5}
              {step === 6 && T.n6}
            </text>
            <text className="s" x="48" y="292">{T.status}{STAGES.map((s, i) => `${s.name} ${i < runningStage ? T.done : i === runningStage ? T.running : T.waiting}`).join(' | ')}</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
    </figure>
  );
}
