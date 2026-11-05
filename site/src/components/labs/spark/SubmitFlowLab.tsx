import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// An application on a standalone cluster, client deploy mode, dynamic allocation with shuffle tracking.
// The cluster was real (exercises/11_deployment_ui.py): one master, one worker with 2 cores, executors of 1 core.
// Asserted there: no executor before the first job, 2 executors (1 core each) after it, executors that hold shuffle data
// are kept when idle, and executors of a job without a shuffle are released. Class names come from the Spark source.

const STEPS: StepInfo[] = [
  { name: 'spark-submit', title: 'คุณรันโปรแกรม: driver เริ่มทำงาน', text: 'ใน client mode (ค่าเริ่มต้น) driver อยู่ในเครื่องที่คุณรัน spark-submit หรือ python script ตรงนั้น SparkContext ถูกสร้าง และเปิด Spark UI ที่พอร์ต 4040 (วัดจริง: executors ตอนนี้มีแต่ driver)' },
  { name: 'ลงทะเบียน', title: 'driver ลงทะเบียน application กับ Master', text: 'StandaloneAppClient ส่งคำขอไปที่ Master พร้อมบอกว่าต้องการ executor แบบไหน (memory 512m, 1 core ต่อ executor) Master จดไว้ว่ามี application นี้' },
  { name: 'รอทำงาน', title: 'ยังไม่มี executor เพราะยังไม่มีงาน', text: 'ตั้ง dynamicAllocation และ minExecutors = 0 ไว้ Spark จึงไม่ขอ executor จนกว่าจะมีงาน ประหยัด resource แต่งานแรกต้องรอ executor เริ่มทำงาน' },
  { name: 'มี action', title: 'เรียก action: DAGScheduler สร้าง stage และ task', text: 'collect() ทำให้ได้ 1 job 2 stage 14 task (8 map task + 6 task หลัง shuffle) ExecutorAllocationManager เห็นว่ามีงานรออยู่ จึงขอ executor เพิ่ม' },
  { name: 'เริ่ม executor', title: 'Master สั่ง Worker เปิด executor', text: 'Master เลือก Worker ที่มี core ว่าง (ที่นี่ 2 core) Worker ให้ ExecutorRunner เปิด JVM ใหม่ที่รัน CoarseGrainedExecutorBackend ได้ executor 2 ตัว ตัวละ 1 core' },
  { name: 'รับ task', title: 'executor ลงทะเบียนกับ driver แล้วรับ task', text: 'executor ติดต่อกลับ driver โดยตรง (ไม่ผ่าน Master) TaskSchedulerImpl ส่ง task ให้ทีละ core ที่ว่าง 14 task ผ่าน executor 2 ตัว ผล shuffle เขียนลง disk ของ executor' },
  { name: 'ว่าง', title: 'งานจบ: executor ที่ไม่มี shuffle data ถูกคืน', text: 'เมื่อ executor ว่างเกิน executorIdleTimeout (ตั้ง 4 วินาที) ถูกปล่อยคืน ถ้าไม่มี shuffle data (วัดจริง: job ที่ไม่มี shuffle ได้ executors กลับเหลือแต่ driver) แต่ถ้าเก็บ shuffle data ของ job ที่เพิ่งเสร็จไว้ shuffle tracking จะ **ไม่ปล่อย** (วัดจริง: รอ 8 วินาทีแล้วยังเหลือ 2 ตัว)' },
];

const EASE = { duration: 0.6, ease: 'easeInOut' as const };

export default function SubmitFlowLab() {
  const { step, go, playing, toggle } = useStepper(STEPS.length, 3800);
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : EASE;
  const showApp = step >= 1;
  const showExec = step >= 4;
  const tasks = step >= 5 ? 14 : 0;
  return (
    <figure className="viz">
      <div className="viz-title">spark-submit ถึง executor: ใครคุยกับใคร</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={`ขั้นที่ ${step + 1}: ${STEPS[step].title}`}>
          <defs>
            <marker id="sf-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>
          <rect className="band" x="10" y="10" width="860" height="340" rx="12" />

          {/* driver */}
          <rect className="box on" x="30" y="40" width="220" height="150" rx="10" />
          <text className="b" x="46" y="66">เครื่องของคุณ: Driver</text>
          <text className="s" x="46" y="88">SparkContext, DAGScheduler</text>
          <text className="s" x="46" y="106">Spark UI :4040</text>
          <motion.text className="m s" x="46" y="140" initial={false} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={t}>1 job / 2 stage / 14 task</motion.text>

          {/* master */}
          <rect className="box" x="330" y="40" width="220" height="110" rx="10" />
          <text className="b" x="346" y="66">Master (:7077)</text>
          <motion.text className="s" x="346" y="92" initial={false} animate={{ opacity: showApp ? 1 : 0 }} transition={t}>application: c11</motion.text>
          <text className="s" x="346" y="112">รู้ว่ามี Worker กี่ตัว</text>

          {/* worker */}
          <rect className="box" x="330" y="190" width="520" height="140" rx="10" />
          <text className="b" x="346" y="216">Worker (2 cores, 2 GB)</text>
          {[0, 1].map((i) => (
            <motion.g key={i} initial={false} animate={{ opacity: showExec ? 1 : 0, y: showExec ? 0 : 14 }} transition={{ ...t, delay: reduce ? 0 : i * 0.25 }}>
              <rect className="box on" x={360 + i * 230} y="236" width="210" height="76" rx="8" />
              <text className="b m" x={372 + i * 230} y="260" style={{ fontSize: 13 }}>Executor {i} (1 core)</text>
              <text className="s" x={372 + i * 230} y="280">CoarseGrainedExecutorBackend</text>
              <motion.text className="m s b acc" x={372 + i * 230} y="300" initial={false} animate={{ opacity: step >= 5 && step < 6 ? 1 : 0 }} transition={t}>รัน task {tasks / 2} ตัว</motion.text>
            </motion.g>
          ))}
          <motion.text className="s b acc" x="360" y="326" initial={false} animate={{ opacity: step === 6 ? 1 : 0 }} transition={t}>เก็บ shuffle data อยู่ จึงยังไม่ถูกปล่อย</motion.text>

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
            <text className="s" x="150" y="262">tasks (ตรงจาก driver)</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: step === 3 ? 1 : 0.2 }} transition={t}>
            <line className="ln" x1="252" y1="130" x2="328" y2="110" markerEnd="url(#sf-ar)" />
            <text className="s" x="254" y="146">ขอ executor เพิ่ม</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={STEPS} step={step} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">cluster ในภาพรันจริงใน WSL ด้วย spark-class ชุดเดียวกับที่ sbin/start-master.sh ใช้ YARN และ Kubernetes มีผู้เล่นต่างกัน (ResourceManager, API server) แต่ลำดับ driver ขอ executor แล้ว executor ติดต่อ driver เหมือนกัน</figcaption>
    </figure>
  );
}
