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
    { name: 'สร้าง lineage', title: 'transformation ต่อ RDD เป็นห่วงโซ่ ยังไม่เกิด job', text: 'แต่ละ RDD จำว่าตัวเองมาจาก RDD ไหนและด้วยการดำเนินการอะไร (dependencies) ยังไม่มีข้อมูลถูกคำนวณ (วัดจริง: job group ว่างจนกว่าจะเรียก collect)' },
    { name: 'action', title: 'collect() เรียก SparkContext.runJob', text: 'action ส่ง RDD สุดท้ายให้ DAGScheduler ซึ่งสร้าง ResultStage สำหรับ RDD นี้ก่อน แล้วไล่ย้อนตาม dependency เพื่อหาว่าต้องมี stage อะไรก่อนหน้า' },
    { name: 'ไล่ย้อน', title: 'เจอ ShuffleDependency: ตัดตรงนั้น', text: 'narrow dependency (map) อยู่ใน stage เดียวกัน เพราะแต่ละ partition ลูกอ่านจาก partition พ่อไม่กี่ตัว pipeline ได้ ส่วน ShuffleDependency คือขอบเขต: DAGScheduler สร้าง ShuffleMapStage ให้ฝั่งพ่อ แล้วทำซ้ำไปเรื่อยๆ' },
    { name: '3 stage', title: 'ได้ 3 stage ที่ต้องรันตามลำดับ', text: 'Stage 0 และ 1 เป็น ShuffleMapStage (จบด้วยการเขียนไฟล์ shuffle) Stage 2 เป็น ResultStage วัดจริง: 3 stage ที่มี 4, 4, 4 task (PySpark join ของ RDD เป็น union ตามด้วย shuffle หนึ่งครั้ง จึงได้แค่ 2 stage)' },
    { name: 'รัน stage 0', title: 'ส่ง Stage 0 เป็น TaskSet', text: 'stage ที่ไม่มีพ่อที่ยังขาด output ถูกส่งก่อน DAGScheduler ห่อ partition ที่ขาดเป็น TaskSet ส่งให้ TaskScheduler (TaskSetManager เลือก task ให้ executor ที่ว่าง) task ของ ShuffleMapStage ชื่อ ShuffleMapTask' },
    { name: 'รัน stage 1', title: 'output ของ stage 0 พร้อมแล้ว: ส่ง Stage 1', text: 'เมื่อทุก task ของ stage 0 เสร็จ ผลที่เขียนไว้ถูกลงทะเบียนกับ MapOutputTracker ที่ driver stage 1 ที่ต้องการผลนั้นจึงส่งได้ task ของ stage 1 อ่านไฟล์ shuffle จากผู้เขียนทุกตัวตามที่ tracker บอกตำแหน่ง' },
    { name: 'รัน stage 2', title: 'Stage สุดท้ายคืนผลให้ driver', text: 'ResultStage รัน ResultTask ที่คืนผลของแต่ละ partition ไปที่ driver ซึ่งประกอบเป็นผลของ collect ถ้า executor หายระหว่างทาง ไฟล์ shuffle หาย DAGScheduler จะส่ง stage พ่อที่ขาดใหม่ (stage attempt ถัดไป) แทนที่จะเริ่มทั้ง job' },
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
    title: 'DAGScheduler ตัด job เป็น stage ตรง shuffle',
    aria: (n: number, title: string) => `ขั้นที่ ${n}: ${title}`,
    tasks: 'task ต่อ partition: ShuffleMapTask ที่เขียนไฟล์ shuffle (stage 0, 1) และ ResultTask ที่คืนผลให้ driver (stage 2)',
    n4: 'DAGScheduler -> TaskScheduler: TaskSet(stage 0, 4 tasks) -> executors',
    n5: 'MapOutputTracker: shuffle 0 มี output ครบ 4 ตัว -> ส่ง stage 1',
    n6: 'MapOutputTracker: shuffle 1 ครบ -> ส่ง ResultStage -> collect() ได้ผล',
    status: 'สถานะ stage ตอนนี้: ',
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
