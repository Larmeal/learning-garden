import { useMemo, useState, type ReactNode } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';
import { SceneSvg, type SMsg, type SNode } from './scene';

// How an application gets its executors on each cluster manager, as a story on a clock. The order of the messages and
// the names of the classes come from the source of Spark 4.2.0:
//   standalone: SparkSubmit, StandaloneAppClient, Master.scala (schedule, scheduleExecutorsOnWorkers), Worker, ExecutorRunner
//   YARN: yarn/Client.scala (submitApplication, createContainerLaunchContext), ApplicationMaster.scala (runDriver,
//         runExecutorLauncher, allocationThreadImpl), YarnAllocator.scala, ExecutorRunnable.scala
//   Kubernetes: KubernetesClientApplication.run, ExecutorPodsAllocator, BasicExecutorFeatureStep, DriverServiceFeatureStep
// Only standalone ran for real (exercises/11_deployment_ui.py, 11b_standalone_spread.py). YARN and Kubernetes were not
// run: there was no Hadoop or Kubernetes cluster. Machines, ports and sizes in the pictures are made up.

export type CM = 'standalone' | 'yarn' | 'k8s';

// p(thai, english) picks the text of the current language
type P = (th: string, en: string) => string;
const picker = (lang: Lang): P => (th, en) => (lang === 'th' ? th : en);

interface Scenario {
  id: string;
  label: string;
  nodes: SNode[];
  msgs: SMsg[];
  marks: Mark[];
  duration: number;
  extra?: (t: number) => ReactNode;
  height: number;
  aria: string;
  caption: string;
}

const m = (at: number, name: string, title: string, text: string): Mark => ({ at, name, title, text });

// ----------------------------------------------------------------------------------------------- standalone
const WY = [24, 152, 280];
function standalone(lang: Lang): Scenario {
  const p = picker(lang);
  const nodes: SNode[] = [
    { id: 'gc', group: true, x: 14, y: 44, w: 206, h: 214, tone: 'mute', at: 0, title: p('เครื่องของคุณ', 'Your machine'), sub: 'client mode' },
    { id: 'driver', x: 28, y: 88, w: 178, h: 156, tone: 'k1', at: 0.2, title: 'Driver', lines: ['SparkContext', 'StandaloneAppClient'], status: [{ at: 8.6, text: p('แจก task ให้ executor', 'Sends tasks to executors') }] },
    { id: 'master', x: 330, y: 24, w: 210, h: 100, tone: 'k3', at: 0.2, dimAt: 8.4, title: 'Master :7077', sub: p('ผู้จัดสรร core', 'core allocator'), status: [{ at: 2.8, text: p('แบ่ง core 2 · 2 · 2', 'splits cores 2 · 2 · 2'), tone: 'k3' }] },
    ...WY.flatMap((y, i): SNode[] => [
      { id: `w${i}`, group: true, x: 580, y, w: 286, h: 116, tone: 'mute', at: 0.2, title: `Worker ${i + 1}`, sub: '4 core · 2 GB' },
      { id: `e${i}`, x: 594, y: y + 50, w: 166, h: 56, tone: 'k2', at: 6.0 + i * 0.2, title: `Executor ${i + 1}`, sub: '2 core' },
    ]),
  ];
  const msgs: SMsg[] = [
    ...WY.map((y, i): SMsg => ({ id: `rw${i}`, from: `w${i}`, to: 'master', at: 0.4 + i * 0.1, tone: 'k3', dashed: true, dur: 0.7, p0: [578, y + 40], p1: [542, 46 + i * 20], label: i === 0 ? p('Worker ลงทะเบียนไว้ก่อน', 'Workers register first') : undefined, lx: 560, ly: 18, anchor: 'middle' })),
    { id: 'app', from: 'driver', to: 'master', at: 1.7, n: 1, tone: 'k1', p0: [208, 112], p1: [328, 92], label: p('ลงทะเบียน app', 'register app'), lx: 268, ly: 84, anchor: 'middle' },
    ...WY.map((y, i): SMsg => ({ id: `ln${i}`, from: 'master', to: `w${i}`, at: 4.7 + i * 0.12, n: i === 0 ? 2 : undefined, tone: 'k3', p0: [542, 106 + i * 6], p1: [578, y + 76], label: i === 0 ? 'LaunchExecutor' : undefined, lx: 548, ly: 140, anchor: 'end' })),
    ...WY.map((_, i): SMsg => ({ id: `rg${i}`, from: `e${i}`, to: 'driver', at: 7.3 + i * 0.12, n: i === 0 ? 3 : undefined, tone: 'k2', offset: 6, label: i === 0 ? 'RegisterExecutor' : undefined, lx: 400, ly: 188, anchor: 'middle' })),
    ...WY.map((_, i): SMsg => ({ id: `tk${i}`, from: 'driver', to: `e${i}`, at: 8.9 + i * 0.12, n: i === 0 ? 4 : undefined, tone: 'k1', offset: 6, label: i === 2 ? 'LaunchTask' : undefined, lx: 400, ly: 300, anchor: 'middle' })),
  ];
  // The number in a core square is the order in which the Master handed that core out (spreadOutApps = true).
  const extra = (t: number) => (
    <g>
      {WY.map((y, w) => (
        <g key={w} transform={`translate(776 ${y + 56})`}>
          {[0, 1, 2, 3].map((k) => {
            const order = k < 2 ? k * 3 + w + 1 : 0;
            const on = order > 0 && t >= 3.2 + order * 0.18;
            const flash = order > 0 ? 1 - smooth(prog(t, 3.2 + order * 0.18, 3.2 + order * 0.18 + 0.6)) : 0;
            return (
              <g key={k} transform={`translate(${k * 22} 0)`}>
                <rect width="19" height="19" rx="4" fill={on ? 'var(--k2)' : 'var(--surface)'} stroke={on ? 'var(--k2)' : 'var(--line-strong)'} strokeWidth="1.6" />
                {on && <text x="9.5" y="13.5" textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--on-key, #fff)', fontFamily: 'var(--mono)' }}>{order}</text>}
                {flash > 0.02 && <rect x="-3" y="-3" width="25" height="25" rx="6" fill="none" stroke="var(--accent)" strokeWidth="2.5" opacity={flash} />}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
  return {
    id: 'client',
    label: 'client mode',
    nodes,
    msgs,
    extra,
    duration: 11,
    height: 420,
    aria: p('driver ลงทะเบียน application กับ Master, Master สั่ง Worker เปิด executor, executor ติดต่อกลับ driver', 'The driver registers the application with the Master, the Master tells the Workers to start executors, and the executors contact the driver'),
    caption: p('ลำดับและชื่อ class อ่านจากซอร์ส Spark 4.2.0 (Master.scala, Worker.scala, ExecutorRunner.scala) และตรวจกับ standalone cluster จริงที่เปิดเองใน WSL (exercises/11_deployment_ui.py: ไม่มี executor ก่อนมีงาน แล้วได้ executor ตามที่ Worker ว่าง) การแบ่ง core เป็น 2 · 2 · 2 วัดจริงใน exercises/11b_standalone_spread.py ส่วน cluster 3 Worker ในภาพเป็นตัวอย่าง standalone cluster mode ใช้กับแอป Python ไม่ได้ จึงแสดงเฉพาะ client mode', 'The order and the class names are read from the Spark 4.2.0 source (Master.scala, Worker.scala, ExecutorRunner.scala) and checked against a real standalone cluster started in WSL (exercises/11_deployment_ui.py: no executor before there is work, then executors as the Workers have room). The split of cores as 2 · 2 · 2 was measured in exercises/11b_standalone_spread.py. The cluster of 3 Workers in the picture is an example. Standalone cluster mode cannot be used with a Python app, so only client mode is shown.'),
    marks: [
      m(0, p('เตรียม', 'setup'), p('Worker บอก Master ไว้ก่อนว่าตัวเองมี core และ memory เท่าไร', 'Workers tell the Master first how many cores and how much memory they have'), p('ทุก Worker ลงทะเบียนกับ Master ตอนเปิด (RegisterWorker) และส่ง heartbeat ถ้า Master ไม่ได้ยินเกิน spark.worker.timeout (ค่าเริ่มต้น 60 วินาที) จะถือว่า Worker ตาย Master จึงรู้ตลอดว่ามี core ว่างเท่าไร', 'Every Worker registers with the Master when it starts (RegisterWorker) and sends heartbeats. If the Master hears nothing for longer than spark.worker.timeout (default 60 seconds), it treats the Worker as dead. So the Master always knows how many cores are free.')),
      m(1.7, p('ลงทะเบียน app', 'register app'), p('Driver ส่งคำขอไป Master: ขอ core และ memory', 'The driver sends a request to the Master: it asks for cores and memory'), p('ใน client mode driver อยู่ที่เครื่องของคุณ StandaloneAppClient ส่ง RegisterApplication ถ้าไม่ตั้ง spark.cores.max แอปจะขอทุก core ที่ cluster มี (spark.deploy.defaultCores ค่าเริ่มต้นไม่จำกัด)', 'In client mode the driver is on your machine. StandaloneAppClient sends RegisterApplication. If spark.cores.max is not set, the app asks for every core the cluster has (spark.deploy.defaultCores is unlimited by default).')),
      m(2.9, p('แบ่ง core', 'split cores'), p('Master เป็นคนเดียวที่ตัดสินว่า core ไหนของ Worker ไหนให้แอปนี้', 'The Master is the only one who decides which core of which Worker goes to this app'), p('เลขในช่อง core คือลำดับที่ Master แจก ค่าเริ่มต้น spark.deploy.spreadOutApps = true วนให้ทีละ 1 core ต่อ Worker จึงได้ 2 · 2 · 2 (วัดจริง) ดูหน้า "ลำดับการแจก core" ด้านล่างว่าปิดแล้วเป็นอย่างไร', 'The number in a core box is the order in which the Master handed it out. By default spark.deploy.spreadOutApps = true, which gives 1 core at a time to each Worker in turn, so the result is 2 · 2 · 2 (measured). See the lab on the order of handing out cores below for what happens when it is turned off.')),
      m(4.7, p('สั่งเปิด', 'launch'), p('Master ส่ง LaunchExecutor ให้แต่ละ Worker', 'The Master sends LaunchExecutor to each Worker'), p('Master ไม่ได้เปิด executor เอง Worker ที่ได้รับคำสั่งจะเปิดต่อ', 'The Master does not start executors itself. The Worker that receives the command starts them.')),
      m(6.0, p('executor เกิด', 'executor starts'), p('Worker ให้ ExecutorRunner เปิด JVM ใหม่เป็น child process', 'The Worker has ExecutorRunner start a new JVM as a child process'), p('process นั้นรัน CoarseGrainedExecutorBackend มี core ตามที่ Master แบ่ง ถ้า executor ตาย Worker รายงานกลับ Master และ Master ขอให้เปิดใหม่ได้ไม่เกิน spark.deploy.maxExecutorRetries (10) รอบ', 'That process runs CoarseGrainedExecutorBackend and has the cores the Master gave it. If an executor dies, the Worker reports it to the Master, and the Master can ask for a new one at most spark.deploy.maxExecutorRetries (10) times.')),
      m(7.3, p('ลงทะเบียน', 'register'), p('Executor ติดต่อ driver โดยตรง ไม่ผ่าน Master', 'The executor contacts the driver directly, not through the Master'), p('executor รู้ที่อยู่ของ driver จากคำสั่งที่ถูกใช้เปิดมัน แล้วส่ง RegisterExecutor ไปที่ driver ตั้งแต่นี้ Master ไม่อยู่ในเส้นทางข้อมูลและ task อีกแล้ว', 'The executor knows the driver address from the command used to start it, and sends RegisterExecutor to the driver. From now on the Master is no longer on the path of data and tasks.')),
      m(8.9, p('รับ task', 'get tasks'), p('Driver ส่ง LaunchTask ให้ executor ที่มี core ว่าง', 'The driver sends LaunchTask to an executor that has a free core'), p('Master ถูกหรี่ไว้เพราะไม่ต้องทำอะไรอีกจนกว่าแอปจะขอ executor เพิ่ม เอกสาร standalone HA ระบุว่า application ที่รันอยู่ไม่กระทบเมื่อ Master สลับตัว (อ่านจากเอกสาร ไม่ได้ทดสอบ)', 'The Master is dimmed because it has nothing more to do until the app asks for more executors. The standalone HA documentation says that running applications are not affected when the Master is replaced (read from the documentation, not tested).')),
    ],
  };
}

// ----------------------------------------------------------------------------------------------- YARN
function yarn(client: boolean, lang: Lang): Scenario {
  const p = picker(lang);
  const nodes: SNode[] = [
    { id: 'gc', group: true, x: 14, y: 24, w: 250, h: 152, tone: 'mute', at: 0, title: p('เครื่องที่รัน spark-submit', 'Machine running spark-submit') },
    client
      ? { id: 'drv', x: 28, y: 64, w: 222, h: 98, tone: 'k1', at: 0.2, title: 'Driver', sub: 'SparkContext', lines: ['YarnClientSchedulerBackend'], status: [{ at: 10.0, text: p('แจก task', 'Sends tasks') }] }
      : { id: 'drv', x: 28, y: 64, w: 222, h: 98, tone: 'k1', at: 0.2, dimAt: 5.4, title: 'spark-submit', sub: 'yarn.Client', lines: [p('ส่งแล้วรอ หรือออกเลยก็ได้', 'Submits, then waits or exits')] },
    { id: 'rm', x: 360, y: 24, w: 224, h: 112, tone: 'k3', at: 0.2, dimAt: 9.6, title: 'ResourceManager', sub: p('ถือ core/memory ทั้ง cluster', 'Holds all cores/memory'), lines: [p('ตัดสินว่า container ไปที่ไหน', 'Decides where containers go')] },
    { id: 'gb', group: true, x: 16, y: 218, w: 214, h: 214, tone: 'mute', at: 0.2, title: 'NodeManager B' },
    { id: 'ga', group: true, x: 333, y: 218, w: 214, h: 214, tone: 'mute', at: 0.2, title: 'NodeManager A' },
    { id: 'gcn', group: true, x: 650, y: 218, w: 214, h: 214, tone: 'mute', at: 0.2, title: 'NodeManager C' },
    client
      ? { id: 'am', x: 345, y: 262, w: 190, h: 150, tone: 'acc', at: 3.4, title: 'AM container', sub: 'ExecutorLauncher', lines: [p('ไม่มี driver ในนี้', 'No driver in here'), p('แค่ขอ container แทน', 'Only asks for containers')] }
      : { id: 'am', x: 345, y: 262, w: 190, h: 150, tone: 'acc', at: 3.4, title: 'AM container', sub: 'ApplicationMaster', lines: [p('Driver เป็น thread ในนี้', 'Driver is a thread in here'), p('โค้ดคุณ + SparkContext', 'Your code + SparkContext')], status: [{ at: 4.6, text: p('Driver เริ่มแล้ว', 'Driver started'), tone: 'k1' }, { at: 10.0, text: p('แจก task', 'Sends tasks'), tone: 'k1' }] },
    { id: 'eb', x: 28, y: 262, w: 190, h: 90, tone: 'k2', at: 7.6, title: 'Executor 1', sub: 'container', lines: ['2 core · 4 GB'] },
    { id: 'ec', x: 662, y: 262, w: 190, h: 90, tone: 'k2', at: 7.8, title: 'Executor 2', sub: 'container', lines: ['2 core · 4 GB'] },
  ];
  const msgs: SMsg[] = [
    { id: 'sub', from: 'drv', to: 'rm', at: 0.9, n: 1, tone: 'k1', label: 'submit app', lx: 311, ly: 76, anchor: 'middle' },
    { id: 'amstart', from: 'rm', to: 'am', at: 2.5, n: 2, tone: 'k3', p0: [452, 138], p1: [432, 260], label: p('เปิด AM', 'start AM'), lx: 428, ly: 172, anchor: 'end' },
    ...(client
      ? [{ id: 'amdrv', from: 'am', to: 'drv', at: 4.2, n: 3, tone: 'acc', label: p('AM ต่อกลับ driver', 'AM connects back to driver'), lx: 296, ly: 214, anchor: 'end' } as SMsg]
      : []),
    { id: 'reg', from: 'am', to: 'rm', at: 5.0, n: client ? 4 : 3, tone: 'acc', p0: [470, 260], p1: [490, 138], label: p('ลงทะเบียน + ขอ container', 'register + ask for containers'), lx: 500, ly: 172, anchor: 'start' },
    { id: 'got', from: 'rm', to: 'am', at: 6.2, n: client ? 5 : 4, tone: 'k3', p0: [512, 138], p1: [510, 260], label: p('container ที่ว่าง', 'free containers'), lx: 520, ly: 224, anchor: 'start' },
    { id: 'sb', from: 'am', to: 'eb', at: 7.0, n: client ? 6 : 5, tone: 'acc', dur: 0.7, p0: [343, 288], p1: [220, 288], label: 'startContainer', lx: 282, ly: 280, anchor: 'middle' },
    { id: 'sc', from: 'am', to: 'ec', at: 7.1, tone: 'acc', dur: 0.7, p0: [537, 288], p1: [660, 288], label: 'startContainer', lx: 598, ly: 280, anchor: 'middle' },
    ...(client
      ? [
          { id: 'rb', from: 'eb', to: 'drv', at: 8.7, n: 7, tone: 'k2', offset: 7, label: p('ลงทะเบียน', 'register'), lx: 120, ly: 196, anchor: 'middle' } as SMsg,
          { id: 'rc', from: 'ec', to: 'drv', at: 8.8, tone: 'k2', offset: 7 } as SMsg,
          { id: 'tb', from: 'drv', to: 'eb', at: 10.1, n: 8, tone: 'k1', offset: 7 } as SMsg,
          { id: 'tc', from: 'drv', to: 'ec', at: 10.2, tone: 'k1', offset: 7 } as SMsg,
        ]
      : [
          { id: 'rb', from: 'eb', to: 'am', at: 8.7, n: 6, tone: 'k2', p0: [220, 314], p1: [343, 314], label: p('ลงทะเบียน', 'register'), lx: 282, ly: 306, anchor: 'middle' } as SMsg,
          { id: 'rc', from: 'ec', to: 'am', at: 8.8, tone: 'k2', p0: [660, 314], p1: [537, 314], label: p('ลงทะเบียน', 'register'), lx: 598, ly: 306, anchor: 'middle' } as SMsg,
          { id: 'tb', from: 'am', to: 'eb', at: 10.1, n: 7, tone: 'k1', p0: [343, 340], p1: [220, 340], label: 'task', lx: 282, ly: 332, anchor: 'middle' } as SMsg,
          { id: 'tc', from: 'am', to: 'ec', at: 10.2, tone: 'k1', p0: [537, 340], p1: [660, 340], label: 'task', lx: 598, ly: 332, anchor: 'middle' } as SMsg,
        ]),
  ];
  const common: Mark[] = [
    m(0, p('เตรียม', 'setup'), client ? p('client mode: driver อยู่ที่เครื่องที่รัน spark-submit', 'client mode: the driver is on the machine that runs spark-submit') : p('cluster mode: spark-submit เป็นแค่ผู้ส่ง driver จะไปรันใน cluster', 'cluster mode: spark-submit only submits, and the driver runs in the cluster'), p('YARN แยกบทบาทเป็น ResourceManager (ผู้จัดสรรทั้ง cluster) กับ NodeManager (ตัวแทนบนแต่ละเครื่อง เปิดและเฝ้า container) งานของ Spark ทุกชิ้นรันใน container', 'YARN splits the roles into the ResourceManager (allocator of the whole cluster) and the NodeManager (agent on each machine, starts and watches containers). Every piece of Spark work runs in a container.')),
    m(0.9, p('ส่ง app', 'submit app'), p('yarn.Client ขอ application id จาก RM แล้วส่งวิธีเปิด ApplicationMaster', 'yarn.Client asks the RM for an application id, then sends how to start the ApplicationMaster'), p(`Client.submitApplication() อัปโหลด jar และ conf ไปไว้ staging directory ใน HDFS แล้วส่ง ContainerLaunchContext ที่มีคำสั่งเปิด ${client ? 'org.apache.spark.deploy.yarn.ExecutorLauncher' : 'org.apache.spark.deploy.yarn.ApplicationMaster'} (Client.scala:1139-1144)`, `Client.submitApplication() uploads the jar and conf to the staging directory in HDFS, then sends a ContainerLaunchContext with the command to start ${client ? 'org.apache.spark.deploy.yarn.ExecutorLauncher' : 'org.apache.spark.deploy.yarn.ApplicationMaster'} (Client.scala:1139-1144)`)),
    m(2.5, p('เปิด AM', 'start AM'), p('RM เลือก NodeManager ที่ว่างให้เปิด container แรกของแอป', 'The RM picks a free NodeManager to start the first container of the app'), p('container แรกนี้คือ ApplicationMaster (AM) ของแอป AM เป็นตัวแทนของแอปคุยกับ RM ตลอดอายุแอป', 'This first container is the ApplicationMaster (AM) of the app. The AM talks to the RM on behalf of the app for the whole life of the app.')),
  ];
  const marks: Mark[] = client
    ? [
        ...common,
        m(4.2, p('AM ต่อกลับ', 'AM connects back'), p('AM แบบ ExecutorLauncher ต่อกลับไปหา driver ที่เครื่องของคุณ', 'An AM of type ExecutorLauncher connects back to the driver on your machine'), p('ใน client mode AM ไม่ได้รัน driver จึงไม่รอ SparkContext แต่ต่อ RPC ไปที่ driver ทันที (ApplicationMaster.runExecutorLauncher) ถ้าเครื่องที่รัน driver ปิดหรือหลุด แอปจบ', 'In client mode the AM does not run the driver, so it does not wait for a SparkContext. It opens an RPC connection to the driver at once (ApplicationMaster.runExecutorLauncher). If the machine that runs the driver shuts down or drops out, the app ends.')),
        m(5.0, p('ขอ container', 'ask for containers'), p('AM ลงทะเบียนกับ RM แล้วขอ container สำหรับ executor', 'The AM registers with the RM and asks for containers for the executors'), p('จำนวนที่ขอมาจากที่ driver บอก (spark.executor.instances หรือ dynamic allocation) การคุยกับ RM เป็นแบบ polling: เรียก allocate() เป็นช่วงๆ (ดูแล็บด้านล่าง)', 'The number asked for comes from what the driver says (spark.executor.instances or dynamic allocation). Talking to the RM is polling: the AM calls allocate() from time to time (see the lab below).')),
        m(6.2, p('RM ตอบ', 'RM answers'), p('RM ตอบกลับด้วยรายการ container ที่ว่างตอนนี้', 'The RM answers with the list of containers that are free right now'), p('ได้ container ครบหรือไม่ขึ้นกับว่า cluster ว่างเท่าไร ที่ยังไม่ได้ AM ถามซ้ำรอบหน้า', 'Whether all containers are granted depends on how much of the cluster is free. The AM asks again in the next round for those not granted.')),
        m(7.0, p('เปิด executor', 'start executor'), p('AM สั่ง NodeManager เปิด container ของ executor', 'The AM tells the NodeManager to start the executor container'), p('ใช้ NMClient.startContainer (ExecutorRunnable) คำสั่งที่รันคือ YarnCoarseGrainedExecutorBackend', 'It uses NMClient.startContainer (ExecutorRunnable). The command that runs is YarnCoarseGrainedExecutorBackend.')),
        m(8.7, p('ลงทะเบียน', 'register'), p('Executor ต่อกลับ driver บนเครื่องของคุณ', 'The executors connect back to the driver on your machine'), p('executor ใน cluster ต้องต่อเข้ามาที่เครื่องคุณได้ (firewall และ spark.driver.host ต้องถูก) ข้อนี้เป็นสาเหตุของปัญหา client mode ที่เจอบ่อยเมื่อรันจากนอก cluster', 'An executor in the cluster must be able to connect to your machine (the firewall and spark.driver.host must be correct). This is the cause of the client mode problem people often meet when they run from outside the cluster.')),
        m(10.1, p('รับ task', 'get tasks'), p('Driver ส่ง task ให้ executor', 'The driver sends tasks to the executors'), p('AM อยู่ต่อเพื่อขอ container เพิ่มหรือคืนตามที่ driver ต้องการ แต่ไม่เห็น task', 'The AM stays to ask for more containers or give them back as the driver needs, but it does not see the tasks.')),
      ]
    : [
        ...common,
        m(3.5, p('AM เริ่ม driver', 'AM starts driver'), p('ใน cluster mode AM เรียกโปรแกรมของคุณเป็น thread ชื่อ Driver', 'In cluster mode the AM calls your program as a thread named Driver'), p('ApplicationMaster.startUserApplication() โหลด main class (หรือ PythonRunner สำหรับ .py) แล้วรัน main ใน thread นั้น ดังนั้น driver กับ AM อยู่ใน JVM เดียวกัน spark-submit ออกได้เมื่อ spark.yarn.submit.waitAppCompletion = false', 'ApplicationMaster.startUserApplication() loads the main class (or PythonRunner for .py) and runs main in that thread. So the driver and the AM are in the same JVM. spark-submit can exit when spark.yarn.submit.waitAppCompletion = false.')),
        m(5.0, p('ขอ container', 'ask for containers'), p('AM รอ SparkContext พร้อมแล้วลงทะเบียนกับ RM และขอ container', 'The AM waits until the SparkContext is ready, then registers with the RM and asks for containers'), p('รอได้ไม่เกิน spark.yarn.am.waitTime (100 วินาที) ถ้า SparkContext ไม่เกิดในเวลานั้นแอปล้ม จากนั้น YarnAllocator ขอ container ตามจำนวน executor ที่ driver ต้องการ', 'It waits at most spark.yarn.am.waitTime (100 seconds). If no SparkContext is created in that time, the app fails. Then YarnAllocator asks for containers for the number of executors the driver needs.')),
        m(6.2, p('RM ตอบ', 'RM answers'), p('RM ตอบกลับด้วยรายการ container ที่ว่างตอนนี้', 'The RM answers with the list of containers that are free right now'), p('การคุยกับ RM เป็นแบบ polling AM เรียก allocate() ทุก 3 วินาที (spark.yarn.scheduler.heartbeat.interval-ms) หรือถี่กว่านั้นถ้ายังมี container ค้างขอ (ดูแล็บด้านล่าง)', 'Talking to the RM is polling. The AM calls allocate() every 3 seconds (spark.yarn.scheduler.heartbeat.interval-ms), or more often while some requested containers are still missing (see the lab below).')),
        m(7.0, p('เปิด executor', 'start executor'), p('AM สั่ง NodeManager เปิด container ของ executor', 'The AM tells the NodeManager to start the executor container'), p('ใช้ NMClient.startContainer (ExecutorRunnable) คำสั่งที่รันคือ YarnCoarseGrainedExecutorBackend ในแต่ละ container', 'It uses NMClient.startContainer (ExecutorRunnable). The command that runs in each container is YarnCoarseGrainedExecutorBackend.')),
        m(8.7, p('ลงทะเบียน', 'register'), p('Executor ติดต่อ driver ซึ่งอยู่ใน AM container', 'The executors contact the driver, which is in the AM container'), p('executor ได้ที่อยู่ของ driver ในคำสั่งเปิด container driver กับ executor อยู่ใน cluster เดียวกัน ปัญหา firewall จึงน้อยกว่า client mode', 'The executor gets the driver address in the command that starts its container. The driver and the executors are in the same cluster, so there are fewer firewall problems than in client mode.')),
        m(10.1, p('รับ task', 'get tasks'), p('Driver ส่ง task ให้ executor', 'The driver sends tasks to the executors'), p('ถ้า AM container ตาย YARN เปิด AM ใหม่ได้ตาม spark.yarn.maxAppAttempts (ถ้าไม่ตั้งใช้ค่าของ YARN) แต่ driver อยู่ในนั้น จึงเริ่มโปรแกรมใหม่ทั้งหมด', 'If the AM container dies, YARN can start a new AM up to spark.yarn.maxAppAttempts (if not set, the YARN value is used). But the driver is in it, so the whole program starts over.')),
      ];
  return {
    id: client ? 'client' : 'cluster',
    label: client ? 'client mode' : 'cluster mode',
    nodes,
    msgs,
    marks,
    duration: 12,
    height: 452,
    aria: client
      ? p('YARN client mode: driver อยู่บนเครื่องที่ส่งงาน AM ขอ container ให้ executor ซึ่งต่อกลับ driver', 'YARN client mode: the driver is on the machine that submits the job, and the AM asks for containers for the executors, which connect back to the driver')
      : p('YARN cluster mode: driver อยู่ใน ApplicationMaster container ซึ่งขอ container ให้ executor', 'YARN cluster mode: the driver is in the ApplicationMaster container, which asks for containers for the executors'),
    caption: p('ลำดับและชื่อ class อ่านจากซอร์ส Spark 4.2.0 (yarn/Client.scala, ApplicationMaster.scala, YarnAllocator.scala, ExecutorRunnable.scala) ยังไม่ได้รันบน YARN จริง เพราะเครื่องนี้ไม่มี Hadoop cluster จำนวนเครื่องและขนาด container ในภาพเป็นตัวอย่าง', 'The order and the class names are read from the Spark 4.2.0 source (yarn/Client.scala, ApplicationMaster.scala, YarnAllocator.scala, ExecutorRunnable.scala). It has not been run on a real YARN, because this machine has no Hadoop cluster. The machines and container sizes in the picture are examples.'),
  };
}

// ----------------------------------------------------------------------------------------------- Kubernetes
function k8s(del: boolean, lang: Lang): Scenario {
  const p = picker(lang);
  const podTimes = [6.7, 6.9];
  const gone = del ? 13.0 : undefined;
  const pod = (id: string, x: number, y: number, i: number): SNode => ({
    id, x, y, w: 190, h: 100, tone: 'k2', at: podTimes[i], until: gone, title: `Executor pod ${i + 1}`, lines: ['owner: driver pod'],
    status: [{ at: podTimes[i], text: 'Pending', tone: 'mute' }, { at: podTimes[i] + 0.9, text: 'Running', tone: 'k2' }],
  });
  const nodes: SNode[] = [
    { id: 'gc', group: true, x: 14, y: 24, w: 250, h: 152, tone: 'mute', at: 0, title: p('เครื่องที่รัน spark-submit', 'Machine running spark-submit') },
    { id: 'sub', x: 28, y: 64, w: 222, h: 98, tone: 'k1', at: 0.2, dimAt: 5.0, title: 'spark-submit', sub: 'KubernetesClientApplication', lines: [p('ส่งแล้วเฝ้าดูสถานะ pod', 'Submits, watches pod status')] },
    { id: 'api', x: 360, y: 24, w: 224, h: 112, tone: 'k3', at: 0.2, title: 'API server', sub: p('รู้ว่ามี pod อะไรบ้าง', 'Knows which pods exist'), lines: [p('kube-scheduler เลือก node ให้', 'kube-scheduler picks the node')] },
    { id: 'gb', group: true, x: 16, y: 218, w: 214, h: 214, tone: 'mute', at: 0.2, title: 'Node B' },
    { id: 'ga', group: true, x: 333, y: 218, w: 214, h: 214, tone: 'mute', at: 0.2, title: 'Node A' },
    { id: 'gcn', group: true, x: 650, y: 218, w: 214, h: 214, tone: 'mute', at: 0.2, title: 'Node C' },
    {
      id: 'driver', x: 345, y: 262, w: 190, h: 150, tone: 'acc', at: 3.6, crossAt: del ? 11.6 : undefined, title: 'Driver pod', sub: 'spark-submit (client)',
      lines: [p('Driver JVM อยู่ข้างใน', 'Driver JVM inside'), 'headless Service'], status: [{ at: 3.6, text: 'Pending', tone: 'mute' }, { at: 4.5, text: 'Running', tone: 'k1' }],
    },
    pod('p0', 28, 262, 0),
    pod('p1', 662, 262, 1),
  ];
  const msgs: SMsg[] = [
    { id: 'create', from: 'sub', to: 'api', at: 0.9, n: 1, tone: 'k1', label: p('สร้าง pod', 'create pod'), lx: 311, ly: 76, anchor: 'middle' },
    { id: 'place', from: 'api', to: 'driver', at: 2.5, n: 2, tone: 'k3', p0: [452, 138], p1: [432, 260], label: p('วาง pod ที่ Node A', 'place pod on Node A'), lx: 428, ly: 172, anchor: 'end' },
    { id: 'ask', from: 'driver', to: 'api', at: 5.2, n: 3, tone: 'acc', p0: [490, 260], p1: [500, 138], label: p('สร้าง executor pod', 'create executor pod'), lx: 508, ly: 190, anchor: 'start' },
    { id: 'mk0', from: 'api', to: 'p0', at: 6.0, n: 4, tone: 'k3', dur: 0.7, p0: [380, 138], p1: [123, 260] },
    { id: 'mk1', from: 'api', to: 'p1', at: 6.1, tone: 'k3', dur: 0.7, p0: [570, 138], p1: [757, 260] },
    { id: 'rg0', from: 'p0', to: 'driver', at: 8.7, n: 5, tone: 'k2', p0: [220, 298], p1: [343, 298], label: p('ลงทะเบียน', 'register'), lx: 282, ly: 290, anchor: 'middle' },
    { id: 'rg1', from: 'p1', to: 'driver', at: 8.8, tone: 'k2', p0: [660, 298], p1: [537, 298] },
    { id: 'tk0', from: 'driver', to: 'p0', at: 10.0, n: 6, tone: 'k1', p0: [343, 338], p1: [220, 338], label: 'task', lx: 282, ly: 330, anchor: 'middle' },
    { id: 'tk1', from: 'driver', to: 'p1', at: 10.1, tone: 'k1', p0: [537, 338], p1: [660, 338] },
    ...(del
      ? [
          { id: 'gc0', from: 'api', to: 'p0', at: 12.2, n: 7, tone: 'acc', dashed: true, dur: 0.6, p0: [380, 138], p1: [123, 260] } as SMsg,
          { id: 'gc1', from: 'api', to: 'p1', at: 12.3, tone: 'acc', dashed: true, dur: 0.6, p0: [570, 138], p1: [757, 260] } as SMsg,
        ]
      : []),
  ];
  const marks: Mark[] = [
    m(0, p('เตรียม', 'setup'), p('ใน Kubernetes ไม่มี "ผู้จัดสรร core" แยกต่างหาก ทุกอย่างคือ pod', 'Kubernetes has no separate "core allocator". Everything is a pod'), p('spark-submit --master k8s://https://<api-server> --deploy-mode cluster ต้องมี image ที่มี Spark (spark.kubernetes.container.image) และ service account ที่สร้าง pod ได้ คุยกับ API server ที่เดียว', 'spark-submit --master k8s://https://<api-server> --deploy-mode cluster needs an image that contains Spark (spark.kubernetes.container.image) and a service account that can create pods. It talks only to the API server.')),
    m(0.9, p('สร้าง driver pod', 'create driver pod'), p('spark-submit ประกอบ driver pod กับ ConfigMap ของ spark conf แล้วสั่งสร้าง', 'spark-submit builds the driver pod and a ConfigMap of the spark conf, then asks for them to be created'), p('KubernetesClientApplication.run() สร้าง pod ของ driver แล้วผูก ownerReference ของ ConfigMap และ resource อื่นเข้ากับ pod นั้น เมื่อ pod หายสิ่งเหล่านี้ถูกลบตาม จากนั้นเฝ้าดู pod (watch) ถ้า spark.kubernetes.submission.waitAppCompletion = true (ค่าเริ่มต้น)', 'KubernetesClientApplication.run() creates the driver pod, then sets the ownerReference of the ConfigMap and other resources to that pod. When the pod is gone, these are deleted with it. Then it watches the pod if spark.kubernetes.submission.waitAppCompletion = true (the default).')),
    m(2.5, p('วาง pod', 'place pod'), p('kube-scheduler เลือก node ที่ว่าง kubelet บน node นั้นเปิด container', 'kube-scheduler picks a free node, and the kubelet on that node starts the container'), p('Spark ไม่ได้เลือก node ให้ pod เอง Kubernetes ตัดสินจาก resource ที่ขอและกติกาที่ตั้ง (nodeSelector, tolerations ฯลฯ)', 'Spark does not choose the node for the pod itself. Kubernetes decides from the resources requested and the rules that are set (nodeSelector, tolerations and so on).')),
    m(3.6, p('driver ขึ้น', 'driver up'), p('ใน container ของ driver รัน spark-submit แบบ client mode อีกชั้น', 'Inside the driver container, spark-submit runs once more in client mode'), p('entrypoint ของ image ที่ใช้คำสั่ง driver เรียก spark-submit ข้างใน (entrypoint.sh) driver จึงเป็น JVM ธรรมดาที่เปิด headless Service (DriverServiceFeatureStep) เพื่อให้ executor หาเจอด้วยชื่อ', 'The entrypoint of the image, given the driver command, calls spark-submit inside (entrypoint.sh). So the driver is a normal JVM that opens a headless Service (DriverServiceFeatureStep) so executors can find it by name.')),
    m(5.2, p('ขอ executor pod', 'ask for executor pods'), p('Driver เป็นคนสร้าง executor pod เอง ผ่าน API server', 'The driver itself creates the executor pods, through the API server'), p('ExecutorPodsAllocator สร้างทีละไม่เกิน spark.kubernetes.allocation.batch.size (20) ต่อรอบ ห่างกัน spark.kubernetes.allocation.batch.delay (1 วินาที) ไม่มี cluster manager ตัวกลางแบบ Master หรือ ResourceManager', 'ExecutorPodsAllocator creates at most spark.kubernetes.allocation.batch.size (20) per round, spaced spark.kubernetes.allocation.batch.delay (1 second) apart. There is no middle cluster manager like the Master or the ResourceManager.')),
    m(6.0, p('pod เกิด', 'pods start'), p('pod ของ executor ถูกวางที่ node ว่าง และมี ownerReference เป็น driver pod', 'The executor pods are placed on free nodes and have the driver pod as ownerReference'), p('BasicExecutorFeatureStep ใส่ ownerReference (controller) ชี้ไปที่ driver pod จึงมีผลตอนที่ driver หายไป (ดูสถานการณ์ "ลบ driver pod")', 'BasicExecutorFeatureStep sets an ownerReference (controller) that points to the driver pod. This matters when the driver disappears (see the scenario "delete driver pod").')),
    m(8.7, p('ลงทะเบียน', 'register'), p('Executor ต่อกลับ driver ผ่านชื่อ Service', 'The executors connect back to the driver through the Service name'), p('executor pod รู้ที่อยู่ driver จาก spark.driver.host ที่เป็นชื่อ Service ของ driver', 'An executor pod knows the driver address from spark.driver.host, which is the Service name of the driver')),
    m(10.0, p('รับ task', 'get tasks'), p('Driver ส่ง task ให้ executor', 'The driver sends tasks to the executors'), p('ถ้า executor pod ตาย (เช่น ถูก OOMKilled) ExecutorPodsLifecycleManager รู้จากการ watch แล้ว driver ขอ pod ใหม่มาทดแทน', 'If an executor pod dies (for example OOMKilled), ExecutorPodsLifecycleManager learns about it from the watch, and the driver asks for a new pod to replace it.')),
    ...(del
      ? [
          m(11.6, p('driver ถูกลบ', 'driver deleted'), p('ลบ driver pod (หรือมันตาย)', 'Delete the driver pod (or it dies)'), p('driver ตายแปลว่าแอปจบ ไม่มีใครรับ task หรือเก็บผลอีก', 'When the driver dies the app is over. Nobody takes tasks or collects results any more.')),
          m(12.2, p('ถูกเก็บกวาด', 'cleaned up'), p('Kubernetes ลบ executor pod ตาม ownerReference', 'Kubernetes deletes the executor pods by ownerReference'), p('เพราะ executor pod ชี้ owner เป็น driver pod garbage collector ของ Kubernetes ลบ pod ที่ owner หายไป ไม่ต้องมีใครสั่ง (กลไกของ Kubernetes อ่านจากการตั้ง ownerReference ในซอร์ส ไม่ได้ทดลอง)', 'Because the executor pods name the driver pod as owner, the Kubernetes garbage collector deletes pods whose owner is gone, and nobody has to order it (a Kubernetes mechanism read from the ownerReference setting in the source, not tried).')),
        ]
      : []),
  ];
  return {
    id: del ? 'del' : 'ok',
    label: del ? p('ลบ driver pod', 'delete driver pod') : p('ปกติ', 'normal'),
    nodes,
    msgs,
    marks,
    duration: del ? 15 : 12,
    height: 452,
    aria: p('Kubernetes: spark-submit สร้าง driver pod, driver สร้าง executor pod ผ่าน API server แล้ว executor ต่อกลับ driver', 'Kubernetes: spark-submit creates the driver pod, the driver creates the executor pods through the API server, then the executors connect back to the driver'),
    caption: p('ลำดับและชื่อ class อ่านจากซอร์ส Spark 4.2.0 (KubernetesClientApplication, ExecutorPodsAllocator, BasicExecutorFeatureStep, DriverServiceFeatureStep, entrypoint.sh) ยังไม่ได้รันบน Kubernetes จริง เพราะเครื่องนี้ไม่มี cluster จำนวน node และ pod ในภาพเป็นตัวอย่าง', 'The order and the class names are read from the Spark 4.2.0 source (KubernetesClientApplication, ExecutorPodsAllocator, BasicExecutorFeatureStep, DriverServiceFeatureStep, entrypoint.sh). It has not been run on a real Kubernetes, because this machine has no cluster. The nodes and pods in the picture are examples.'),
  };
}

const scenarios = (cm: CM, lang: Lang): Scenario[] =>
  cm === 'standalone' ? [standalone(lang)] : cm === 'yarn' ? [yarn(false, lang), yarn(true, lang)] : [k8s(false, lang), k8s(true, lang)];
const TITLE = (p: P): Record<CM, string> => ({
  standalone: p('จาก spark-submit ถึง executor บน standalone: ใครสั่งใคร', 'From spark-submit to the executors on standalone: who tells whom'),
  yarn: p('จาก spark-submit ถึง executor บน YARN: ใครสั่งใคร', 'From spark-submit to the executors on YARN: who tells whom'),
  k8s: p('จาก spark-submit ถึง executor บน Kubernetes: ใครสั่งใคร', 'From spark-submit to the executors on Kubernetes: who tells whom'),
});

export default function ClusterLaunchLab({ cm, lang = 'th' }: { cm: CM; lang?: Lang }) {
  const list = useMemo(() => scenarios(cm, lang), [cm, lang]);
  const p = picker(lang);
  const [idx, setIdx] = useState(0);
  const sc = list[idx];
  const clock = useClock(sc.duration);
  const t = clock.t;
  return (
    <figure className="viz lg">
      <div className="viz-title">{TITLE(p)[cm]}</div>
      {list.length > 1 && (
        <div className="viz-steps" role="group" aria-label={p('สถานการณ์', 'Scenario')}>
          {list.map((s, i) => (
            <button key={s.id} type="button" aria-pressed={idx === i} onClick={() => { setIdx(i); clock.restart(); }}>{s.label}</button>
          ))}
        </div>
      )}
      <div className="viz-box">
        <SceneSvg nodes={sc.nodes} msgs={sc.msgs} t={t} height={sc.height} label={sc.aria} extra={sc.extra?.(t)} />
      </div>
      <ClockControls clock={clock} marks={sc.marks} lang={lang} />
      <figcaption className="viz-caption">{sc.caption}</figcaption>
    </figure>
  );
}
