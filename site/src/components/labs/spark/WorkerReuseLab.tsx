import { useState } from 'react';
import { ClockControls, prog, useClock, type Lang, type Mark } from './timeline';

// How many Python worker processes does a job create? Eight tasks on two task slots, in three configurations.
// From the source (PythonWorkerFactory.scala:96-156 and 512-534, daemon.py:165 and 259-274, PythonRunner.scala:671-684):
//   Linux/macOS, spark.python.use.daemon and spark.python.worker.reuse true (defaults): the daemon forks one worker per
//   concurrent task; a worker that finished normally goes back to the idle pool and takes the next task.
//   reuse false: every task gets a fresh worker. Windows: no daemon (useDaemon = !isWindows && ...), the JVM starts
//   `python.exe -m pyspark.worker` for each task and stops it on release; this was observed on the owner's machine
//   (exercise 08, process list during a job). The daemon on Linux was not run here.
// The module-level counter is what the lesson warns about: with reuse, state in a module survives between tasks.

type Cfg = 'daemon' | 'noreuse' | 'windows';
const CFGS: { id: Cfg }[] = [{ id: 'daemon' }, { id: 'noreuse' }, { id: 'windows' }];

const TEXT: Record<Lang, {
  cfgLabel: Record<Cfg, string>; title: string; groupLabel: string; svgLabel: string; axis: string; noDaemon: string; daemonLine: string; daemonBar: string;
  reused: (n: number) => string; startWord: string; created: string; counterNote: string; caption: string;
  start: { name: string; title: string; text: (win: boolean) => string };
  next: { name: string; title: (c: Cfg) => string; text: (c: Cfg) => string };
  sum: { name: string; title: (created: number, tasks: number) => string; text: (c: Cfg) => string };
}> = {
  th: {
    cfgLabel: { daemon: 'Linux / macOS (ค่าเริ่มต้น)', noreuse: 'ปิด spark.python.worker.reuse', windows: 'Windows' },
    title: 'Python worker ถูกสร้างและใช้ซ้ำอย่างไร', groupLabel: 'การตั้งค่า', svgLabel: 'แท่งเวลาของ task และ Python worker บนสอง slot',
    axis: 'เวลา (หน่วยสมมติ)', noDaemon: 'ไม่มี daemon: JVM เริ่ม process เอง', daemonLine: 'daemon.py (process ถาวร)', daemonBar: 'daemon: fork worker ให้ JVM',
    reused: (n) => `worker #${n} ใช้ซ้ำทุก task`, startWord: 'เริ่ม', created: 'Python process ที่สร้างแล้ว', counterNote: 'n = counter ระดับ module',
    caption: 'กฎการสร้างและคืน worker อ่านจากซอร์ส Spark 4.2.0 (PythonWorkerFactory, daemon.py) บน Windows เห็นจริงจากรายการ process ระหว่างรัน job (exercise 08) ส่วนพฤติกรรมของ daemon บน Linux และ macOS ยังไม่ได้ทดสอบบนเครื่องนี้ ความยาวของแท่งเป็นภาพประกอบ ไม่ใช่เวลาที่วัดได้',
    start: {
      name: 'เริ่ม job', title: '8 task บน 2 slot: แต่ละ task ต้องมี Python worker',
      text: (win) => (win ? 'บน Windows ไม่มี daemon (useDaemon = !isWindows && ...) JVM จึงสั่งเริ่ม process python.exe -m pyspark.worker เองสำหรับแต่ละ task' : 'บน Linux และ macOS มี daemon (pyspark/daemon.py) ที่เป็น process ถาวรของ executor คอย fork worker ให้ JVM'),
    },
    next: {
      name: 'task ถัดไป',
      title: (c) => (c === 'daemon' ? 'task ที่สองของ slot หยิบ worker ตัวเดิมที่ว่างอยู่ไปใช้' : 'task ถัดไปต้องการ worker ใหม่'),
      text: (c) => (c === 'daemon' ? 'worker ที่ทำงานเสร็จปกติ (ตอบ END_OF_STREAM) ถูกคืนเข้า idle pool แล้ว task ต่อไปหยิบไปใช้ จึงไม่ต้องสร้าง process ใหม่ แต่ตัวแปรระดับ module ใน UDF ของคุณยังอยู่ (ตัวเลข n= บนแท่งคือค่าของ counter ที่ UDF เพิ่มทุก task)' : c === 'noreuse' ? 'reuse เป็น false: worker ออกหลังจบ task daemon ต้อง fork ตัวใหม่ทุกครั้ง state ของ module เริ่มใหม่ทุก task (n=1 เสมอ)' : 'worker ที่ไม่ใช่ daemon ถูกหยุดใน releaseWorker ทุกครั้ง บนเครื่องที่รันตอนเขียนบทนี้เห็น python.exe -m pyspark.worker เป็นลูกของ JVM และไม่เห็น pyspark.daemon'),
    },
    sum: {
      name: 'สรุป', title: (created, tasks) => `สร้าง Python process ทั้งหมด ${created} ตัวสำหรับ ${tasks} task`,
      text: (c) => (c === 'daemon' ? 'ได้เท่าจำนวน task ที่รันพร้อมกัน (2) ไม่ใช่จำนวน task ผลคือ UDF ไม่ควรพึ่ง state ที่แชร์ใน module เพราะผลขึ้นกับว่า task ไหนได้ worker ตัวไหน' : 'หนึ่ง task หนึ่ง process ได้เท่าจำนวน task (8) ต้นทุนการเริ่ม process ต่อ task บน Linux ยังไม่ได้วัดที่นี่ บน Windows ที่เห็นคือเริ่ม process ใหม่ทุก task'),
    },
  },
  en: {
    cfgLabel: { daemon: 'Linux / macOS (default)', noreuse: 'spark.python.worker.reuse off', windows: 'Windows' },
    title: 'How Python workers are created and reused', groupLabel: 'Setting', svgLabel: 'Timeline bars of the tasks and Python workers on two slots',
    axis: 'Time (made-up units)', noDaemon: 'No daemon: the JVM starts processes itself', daemonLine: 'daemon.py (permanent)', daemonBar: 'daemon: forks workers for the JVM',
    reused: (n) => `worker #${n} reused by every task`, startWord: 'start', created: 'Python processes created', counterNote: 'n = module-level counter',
    caption: 'The rules for creating and returning workers are read from the Spark 4.2.0 source (PythonWorkerFactory, daemon.py). On Windows we saw them in the process list while a job ran (exercise 08). The behavior of the daemon on Linux and macOS was not tested on this machine. The bar lengths are an illustration, not measured times.',
    start: {
      name: 'Job starts', title: '8 tasks on 2 slots: every task needs a Python worker',
      text: (win) => (win ? 'On Windows there is no daemon (useDaemon = !isWindows && ...), so the JVM starts a python.exe -m pyspark.worker process itself for each task.' : 'On Linux and macOS there is a daemon (pyspark/daemon.py), a permanent process of the executor that forks workers for the JVM.'),
    },
    next: {
      name: 'Next task',
      title: (c) => (c === 'daemon' ? 'The second task of a slot takes the same idle worker' : 'The next task needs a new worker'),
      text: (c) => (c === 'daemon' ? 'A worker that finished normally (it answers END_OF_STREAM) goes back to the idle pool and the next task takes it. So no new process is needed, but the module-level variables in your UDF are still there (the number n= on the bar is the value of the counter that the UDF increases in every task).' : c === 'noreuse' ? 'reuse is false: the worker exits after the task, so the daemon must fork a new one every time. The state of the module starts again in every task (always n=1).' : 'A worker that is not from a daemon is stopped in releaseWorker every time. On the machine used when this lesson was written, python.exe -m pyspark.worker showed up as a child of the JVM and pyspark.daemon did not.'),
    },
    sum: {
      name: 'Summary', title: (created, tasks) => `${created} Python processes created in total for ${tasks} tasks`,
      text: (c) => (c === 'daemon' ? 'The count equals the number of tasks that run at the same time (2), not the number of tasks. So a UDF should not depend on state shared in a module, because the result depends on which task gets which worker.' : 'One task, one process, so the count equals the number of tasks (8). The cost of starting a process per task on Linux was not measured here. On Windows what we saw is a new process for every task.'),
    },
  },
};

const TASKS = 8;
const SLOTS = 2;
const DUR = 2.2;
const DURATION = 11;
const X0 = 150;
const W = 700;
const px = (s: number) => X0 + (s / (DURATION - 0.4)) * W;

interface Seg {
  task: number;
  slot: number;
  start: number;
  end: number;
  fresh: boolean;
  count: number; // value of the module-level counter at the end of the task
  worker: number;
}

function plan(cfg: Cfg): { segs: Seg[]; created: number } {
  const segs: Seg[] = [];
  const reuse = cfg === 'daemon';
  const inSlot = Array(SLOTS).fill(0);
  let created = 0;
  const workerOf: number[] = [];
  for (let task = 0; task < TASKS; task++) {
    const slot = task % SLOTS;
    const start = 0.6 + inSlot[slot] * (DUR + 0.25) + slot * 0.3;
    const fresh = !reuse || inSlot[slot] === 0;
    if (fresh) workerOf[task] = created++;
    else workerOf[task] = workerOf[task - SLOTS];
    const count = reuse ? inSlot[slot] + 1 : 1;
    segs.push({ task, slot, start, end: start + DUR, fresh, count, worker: workerOf[task] });
    inSlot[slot]++;
  }
  return { segs, created };
}

export default function WorkerReuseLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [cfg, setCfg] = useState<Cfg>('daemon');
  const clock = useClock(DURATION);
  const { t } = clock;
  const { segs, created } = plan(cfg);
  const lane = (s: number) => 168 + s * 96;
  const started = segs.filter((g) => t >= g.start && g.fresh).length;
  const hasDaemon = cfg !== 'windows';

  const marks: Mark[] = [
    { at: 0, name: T.start.name, title: T.start.title, text: T.start.text(cfg === 'windows') },
    { at: 3.1, name: T.next.name, title: T.next.title(cfg), text: T.next.text(cfg) },
    { at: 9.8, name: T.sum.name, title: T.sum.title(created, TASKS), text: T.sum.text(cfg) },
  ];

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.groupLabel}>
        {CFGS.map((c) => (
          <button key={c.id} type="button" aria-pressed={cfg === c.id} onClick={() => { setCfg(c.id); clock.restart(); }}>{T.cfgLabel[c.id]}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="380" rx="12" />

          {/* time axis */}
          {[0, 2, 4, 6, 8].map((s) => (
            <g key={s}>
              <line x1={px(s)} x2={px(s)} y1="86" y2="352" stroke="var(--line)" opacity="0.6" />
              <text className="s m" x={px(s)} y="372" textAnchor="middle">{s}</text>
            </g>
          ))}
          <text className="s" x={X0 + W / 2} y="388" textAnchor="middle">{T.axis}</text>

          {/* JVM and daemon */}
          <text className="b" x="26" y="52">executor (JVM)</text>
          <text className="s" x="26" y="70">{hasDaemon ? T.daemonLine : T.noDaemon}</text>
          {hasDaemon && <rect x={X0} y="58" width={W} height="22" rx="6" className="fx-file" />}
          {hasDaemon && <text className="s m" x={X0 + 8} y="74">{T.daemonBar}</text>}

          {[0, 1].map((s) => (
            <g key={s}>
              <text className="b" x="26" y={lane(s) + 22}>slot {s + 1}</text>
              <text className="s" x="26" y={lane(s) + 40}>Python process</text>
              <rect x={X0} y={lane(s) - 8} width={W} height="70" rx="8" fill="none" stroke="var(--line)" />
            </g>
          ))}

          {/* process bars */}
          {cfg === 'daemon'
            ? [0, 1].map((s) => {
                const mine = segs.filter((g) => g.slot === s);
                const startT = mine[0].start;
                const endT = mine[mine.length - 1].end;
                if (t < startT) return null;
                const e = Math.min(t, endT);
                return (
                  <g key={s}>
                    <line x1={px(startT) + 6} x2={px(startT) + 6} y1="80" y2={lane(s) - 6} stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="4 3" />
                    <text className="s b acc" x={px(startT) + 12} y={lane(s) - 12}>fork</text>
                    <rect x={px(startT)} y={lane(s)} width={Math.max(0, px(e) - px(startT))} height="54" rx="8" className="fx-hot" />
                    <text className="s b" x={px(startT) + 44} y={lane(s) - 12}>{T.reused(s + 1)}</text>
                  </g>
                );
              })
            : segs.map((g) => {
                if (t < g.start) return null;
                const e = Math.min(t, g.end);
                return (
                  <g key={g.task}>
                    {hasDaemon && <line x1={px(g.start) + 6} x2={px(g.start) + 6} y1="80" y2={lane(g.slot) - 6} stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="4 3" />}
                    <rect x={px(g.start)} y={lane(g.slot)} width={Math.max(0, px(e) - px(g.start))} height="54" rx="8" className="fx-hot" />
                    <text className="s b acc" x={px(g.start) + 12} y={lane(g.slot) + 48}>{hasDaemon ? 'fork' : T.startWord} #{g.worker + 1}</text>
                  </g>
                );
              })}

          {/* tasks and the module-level counter */}
          {segs.map((g) => {
            if (t < g.start) return null;
            const p = prog(t, g.start, g.end);
            const x = px(g.start);
            const w = px(g.end) - px(g.start);
            return (
              <g key={`t${g.task}`}>
                <rect x={x + 3} y={lane(g.slot) + 6} width={Math.max(0, (w - 6) * p)} height="26" rx="5" className="k1" />
                <text className="dl" x={x + w / 2} y={lane(g.slot) + 24} style={{ fontSize: 12.5 }}>task {g.task + 1}</text>
                {p >= 1 && <text className="s m b" x={x + w - 8} y={lane(g.slot) + 48} textAnchor="end" style={{ fill: g.count > 1 ? 'var(--accent)' : 'var(--fg)' }}>n={g.count}</text>}
              </g>
            );
          })}

          <g transform="translate(584 12)">
            <rect className="box" width="270" height="40" rx="8" />
            <text className="s" x="10" y="16">{T.created}</text>
            <text className="b num" x="10" y="34">{started} / {created}</text>
            <text className="s" x="84" y="34">{T.counterNote}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
