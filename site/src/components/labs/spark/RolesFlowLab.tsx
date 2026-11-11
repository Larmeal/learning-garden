import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';
import { SceneSvg, endpoints, toneVar, type SMsg, type SNode, type Tone } from './scene';

// Who does what in a Spark application, as one story on a clock: the driver asks the cluster manager for executors,
// the cluster manager starts them and steps back, the executors report to the driver, the driver sends tasks, the
// executors read their own partitions and then either send the result to the driver (collect) or write it (write).
// The shape is the same on every cluster manager; the pages for standalone, YARN and Kubernetes show what differs.
// Three executors and six partitions are made up. The order of events is read from the source of Spark 4.2.0 and was
// run for real on a standalone cluster (exercises/11_deployment_ui.py).

type Action = 'collect' | 'write';
const EY = [160, 252, 344];
const KEY: Tone[] = ['k1', 'k2', 'k3', 'k1'];
const DURATION = 13;

const TEXT: Record<Lang, {
  driverLines: string[]; distributing: string; inMemory: string; noData: string; backedOff: string; executors: string; storageSub: string;
  execLine: string; ask: string; launch: string; register: string; task: string; readPart: string; allResults: string; writeOwn: string;
  merge: string; title: string; groupLabel: string; endCollect: string; endWrite: string; svgLabel: string; caption: string;
  marks: { name: string; title: string; text: string }[]; collect: { name: string; title: string; text: string }; write: { name: string; title: string; text: string };
}> = {
  th: {
    driverLines: ['โค้ดของคุณอยู่ที่นี่', 'วางแผน แบ่งเป็น Task', '1 ตัวต่อแอป'],
    distributing: 'กำลังแจก Task', inMemory: 'ผลอยู่ใน Memory', noData: 'ไม่เห็นข้อมูลเลย', backedOff: 'ถอยออกแล้ว',
    executors: 'Executors (JVM บนคอมพิวเตอร์ตัวเอง)', storageSub: 'S3 / HDFS / ไฟล์', execLine: 'รับ Task ไปทำกับ Partition',
    ask: 'ขอ Executor 3 ตัว', launch: 'เปิด Executor', register: 'ลงทะเบียน', task: 'Task', readPart: 'อ่าน Partition', allResults: 'ผลทั้งหมด', writeOwn: 'เขียนไฟล์เอง',
    merge: 'รวมเป็นผลย่อย',
    title: 'Driver, Executor และ Cluster Manager ใครทำอะไร ตามลำดับเวลา', groupLabel: 'คำสั่งตอนท้าย', endCollect: 'จบด้วย collect()', endWrite: 'จบด้วย write',
    svgLabel: 'Driver ขอ Executor จาก Cluster Manager แล้ว Executor อ่านข้อมูลจาก Storage',
    caption: 'ลำดับเหตุการณ์อ่านมาจากซอร์สของ Spark 4.2.0 และตรวจกับ Standalone Cluster ที่เราเปิดเองในบทที่ 11 ซึ่งใช้ได้กับทุก Cluster Manager ส่วนที่ต่างกันอยู่ในหน้าย่อยของ Standalone, YARN และ Kubernetes จำนวน Executor (3 ตัว) และ Partition (6 อัน) เป็นเพียงตัวอย่าง',
    marks: [
      { name: 'เริ่ม', title: 'Driver เริ่มก่อน โดยถือโค้ดและแผนไว้ แต่ยังไม่มี Executor', text: 'โค้ด Python ของคุณรันที่ Driver ซึ่งสร้างแผนจาก df.groupBy(...) แต่ยังไม่ได้แตะข้อมูลเลย การคำนวณจริงต้องมีตัวอื่นมาทำ' },
      { name: 'ขอ Executor', title: 'Driver ไม่ได้เปิดคอมพิวเตอร์เอง แต่ไปขอ Cluster Manager', text: 'Driver จะบอกว่าต้องการ Executor กี่ตัว และตัวละกี่ Core กี่ GB (spark.executor.instances, spark.executor.cores, spark.executor.memory) เพราะ Cluster Manager รู้ว่าคอมพิวเตอร์เครื่องไหนว่างอยู่เท่าไร' },
      { name: 'เปิด Executor', title: 'Cluster Manager เลือกคอมพิวเตอร์แล้วสั่งเปิด Executor จากนั้นก็ถอยออกไป', text: 'งานของ Cluster Manager จบตรงนี้ มันไม่ได้ถือข้อมูล ไม่ได้แจก Task และไม่ได้อยู่ระหว่าง Driver กับ Executor (ยกเว้นตอนที่ Spark ขอเพิ่มหรือคืน Executor ภายหลัง)' },
      { name: 'ลงทะเบียน', title: 'Executor ที่เปิดขึ้นมาแล้วจะติดต่อกลับ Driver เองโดยตรง', text: 'Executor จะบอกว่า "ฉันพร้อมรับ Task แล้วนะ" จากตรงนี้ไป Driver กับ Executor จะคุยกันเอง ถ้า Driver ตาย Application ก็จบไปด้วย' },
      { name: 'แจก Task', title: 'Driver แบ่งงานเป็น Task แล้วส่งให้ Executor ที่มี Core ว่าง', text: 'ปกติแล้ว 1 Partition จะเป็น 1 Task โดย Executor ที่ได้รับ Task จะเป็นคนลงมือคำนวณ ส่วน Driver แค่คุมว่าใครทำอะไร' },
      { name: 'อ่านข้อมูล', title: 'Executor อ่าน Partition จาก Storage เอง', text: 'ข้อมูลไหลจาก Storage เข้า Executor ตรง ๆ โดยไม่ผ่าน Driver และไม่ผ่าน Cluster Manager จุดสีแต่ละจุดคือแถวหนึ่ง และจุดที่มีสีเดียวกันคือ Key เดียวกัน' },
      { name: 'คำนวณ', title: 'Executor รวมแถวของ Partition เป็นผลย่อยในมือตัวเอง', text: 'การคำนวณเกิดขึ้นที่ Executor ซึ่งผลของแต่ละตัวยังกระจายอยู่ในคอมพิวเตอร์ของใครของมัน' },
    ],
    collect: { name: 'collect()', title: 'collect() ดึงผลทุกตัวมากองรวมใน Memory ของ Driver', text: 'นี่เป็นจังหวะเดียวที่ข้อมูลมาถึง Driver ผลทั้งหมดจึงต้องพอดีกับ Memory ของ Driver ถ้าข้อมูลใหญ่ ให้กรองหรือรวมให้เล็กลงก่อน' },
    write: { name: 'write', title: 'write ให้ Executor เขียนไฟล์ลง Storage เอง', text: 'ข้อมูลไม่เคยผ่าน Driver เลย Driver รู้แค่ว่า Job สำเร็จ เราจึงเขียนข้อมูลขนาดใหญ่ได้โดยที่ Driver ไม่ต้องมี Memory มาก' },
  },
  en: {
    driverLines: ['Your code lives here', 'Plans, splits into tasks', '1 per application'],
    distributing: 'Sending tasks', inMemory: 'Result in memory', noData: 'Never sees the data', backedOff: 'Stepped back',
    executors: 'Executors (a JVM on its own machine)', storageSub: 'S3 / HDFS / files', execLine: 'Takes tasks, works on partitions',
    ask: 'Ask for 3 executors', launch: 'Start executors', register: 'Register', task: 'task', readPart: 'Read partition', allResults: 'All results', writeOwn: 'Write files itself',
    merge: 'Merge rows',
    title: 'Driver, executor and cluster manager: who does what, in time order', groupLabel: 'Final action', endCollect: 'Ends with collect()', endWrite: 'Ends with write',
    svgLabel: 'The driver asks the cluster manager for executors, then the executors read data from storage',
    caption: 'The order of events is read from the Spark 4.2.0 source and was checked on a standalone cluster that we started ourselves in lesson 11. It holds for every cluster manager. What differs is on the sub-pages for standalone, YARN and Kubernetes. The number of executors (3) and partitions (6) is an example.',
    marks: [
      { name: 'Start', title: 'The driver starts first: it holds the code and the plan, but there are no executors yet', text: 'Your Python code runs on the driver. It builds a plan from df.groupBy(...) but has not touched any data. Someone else has to do the real computing.' },
      { name: 'Ask', title: 'The driver does not start machines itself. It asks the cluster manager', text: 'It says how many executors it wants, with how many cores and how many GB each (spark.executor.instances, spark.executor.cores, spark.executor.memory). The cluster manager knows which machines have free room.' },
      { name: 'Start executors', title: 'The cluster manager picks machines and starts the executors, then steps back', text: 'The cluster manager is done here. It does not hold data, does not hand out tasks, and does not sit between the driver and the executors (except when Spark later asks for more executors or gives some back).' },
      { name: 'Register', title: 'Each new executor contacts the driver directly', text: 'It says "I am ready for tasks". From now on the driver and the executors talk to each other. If the driver dies, the application ends.' },
      { name: 'Send tasks', title: 'The driver splits the work into tasks and sends them to executors with a free core', text: 'Normally 1 partition is 1 task. The executor that gets a task is the one that computes. The driver only controls who does what.' },
      { name: 'Read data', title: 'Each executor reads its partitions from storage itself', text: 'Data flows from storage straight into the executors. It does not go through the driver or the cluster manager. Each colored dot is one row, and dots of the same color have the same key.' },
      { name: 'Compute', title: 'Each executor combines the rows of its partitions into a partial result', text: 'The computing happens on the executors. Each result still sits on its own machine.' },
    ],
    collect: { name: 'collect()', title: 'collect() pulls every result into the memory of the driver', text: 'This is the only moment when data reaches the driver. All the results must fit in the memory of the driver. If the data is big, filter or aggregate it to something smaller first.' },
    write: { name: 'write', title: 'write makes the executors write files to storage themselves', text: 'The data never goes through the driver. The driver only learns that the job succeeded, so you can write big data without the driver needing much memory.' },
  },
};

export default function RolesFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [action, setAction] = useState<Action>('collect');
  const clock = useClock(DURATION);
  const { t } = clock;

  const nodes: SNode[] = useMemo(
    () => [
      {
        id: 'driver', x: 20, y: 124, w: 198, h: 240, tone: 'k1', at: 0, title: 'Driver', sub: 'SparkSession',
        lines: T.driverLines,
        status: [
          { at: 5.1, text: T.distributing },
          { at: 9.6, text: action === 'collect' ? T.inMemory : T.noData, tone: action === 'collect' ? 'acc' : 'k2' },
        ],
      },
      {
        id: 'cm', x: 340, y: 8, w: 260, h: 86, tone: 'k3', at: 0.3, dimAt: 4.2, title: 'Cluster manager', sub: 'standalone / YARN / K8s',
        status: [{ at: 4.2, text: T.backedOff, tone: 'k3' }],
      },
      { id: 'exg', group: true, x: 340, y: 124, w: 260, h: 312, tone: 'mute', at: 2.9, title: T.executors },
      ...EY.map((y, i): SNode => ({
        id: `e${i}`, x: 354, y, w: 232, h: 80, tone: 'k2', at: 3.0 + i * 0.25, title: `Executor ${i + 1}`, lines: [T.execLine],
      })),
      { id: 'store', x: 690, y: 124, w: 180, h: 312, tone: 'mute', at: 0, title: 'Storage', sub: T.storageSub },
    ],
    [action, lang],
  );

  const regY = [150, 170, 190];
  const taskY = [212, 232, 252];
  const outY = [284, 304, 324];
  const msgs: SMsg[] = [
    { id: 'ask', from: 'driver', to: 'cm', at: 0.9, n: 1, tone: 'k1', p0: [150, 122], p1: [338, 56], label: T.ask, lx: 28, ly: 108, anchor: 'start' },
    { id: 'launch', from: 'cm', to: 'exg', at: 2.1, n: 2, tone: 'k3', p0: [470, 96], p1: [470, 122], label: T.launch, lx: 482, ly: 110, anchor: 'start' },
    ...EY.map((y, i): SMsg => ({
      id: `reg${i}`, from: `e${i}`, to: 'driver', at: 4.0 + i * 0.12, n: i === 0 ? 3 : undefined, tone: 'k2', p0: [352, y + 18], p1: [220, regY[i]],
      label: i === 0 ? T.register : undefined, lx: 286, ly: 158, anchor: 'middle',
    })),
    ...EY.map((y, i): SMsg => ({
      id: `task${i}`, from: 'driver', to: `e${i}`, at: 5.2 + i * 0.12, n: i === 0 ? 4 : undefined, tone: 'k1', p0: [220, taskY[i]], p1: [352, y + 40],
      label: i === 0 ? T.task : undefined, lx: 286, ly: 214, anchor: 'middle',
    })),
    ...EY.map((y, i): SMsg => ({
      id: `read${i}`, from: 'store', to: `e${i}`, at: 6.1 + i * 0.1, n: i === 0 ? 5 : undefined, tone: 'mute', dur: 0.6, p0: [688, y + 40], p1: [588, y + 40],
      label: i === 0 ? T.readPart : undefined, lx: 638, ly: EY[0] + 30, anchor: 'middle',
    })),
    ...EY.map((y, i): SMsg =>
      action === 'collect'
        ? { id: `out${i}`, from: `e${i}`, to: 'driver', at: 9.2 + i * 0.15, n: i === 0 ? 6 : undefined, tone: 'acc', dur: 0.8, p0: [352, y + 62], p1: [220, outY[i]], label: i === 0 ? T.allResults : undefined, lx: 286, ly: 272, anchor: 'middle' }
        : { id: `out${i}`, from: `e${i}`, to: 'store', at: 9.2 + i * 0.15, n: i === 0 ? 6 : undefined, tone: 'acc', dur: 0.8, p0: [588, y + 62], p1: [688, y + 62], label: i === 0 ? T.writeOwn : undefined, lx: 638, ly: EY[0] + 54, anchor: 'middle' },
    ),
  ];

  // Rows as dots: they leave the storage, wait in the executor, get combined into one result dot, and the result travels on.
  const by = new Map(nodes.map((n) => [n.id, n]));
  const extras = (
    <g>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <g key={k} transform={`translate(724 ${178 + k * 42})`}>
          <rect width="132" height="30" rx="7" className="fx-file" />
          <text className="s m" x="10" y="20">part {k}</text>
          {[0, 1, 2].map((d) => <circle key={d} cx={86 + d * 12} cy="15" r="3.6" fill={toneVar(KEY[(k + d) % 4])} />)}
        </g>
      ))}
      {EY.map((y, i) => {
        const [a] = endpoints(msgs.find((m) => m.id === `read${i}`)!, by);
        const [, d] = endpoints(msgs.find((m) => m.id === `out${i}`)!, by);
        const mx = 470;
        const my = y + 66;
        return [0, 1, 2, 3].map((j) => {
          const start = 6.1 + i * 0.1 + j * 0.1;
          const fly = smooth(prog(t, start, start + 0.7));
          if (fly <= 0) return null;
          const rest = { x: 372 + j * 17, y: my };
          const merge = smooth(prog(t, 7.7, 8.6));
          const go = smooth(prog(t, 9.2 + i * 0.15, 9.2 + i * 0.15 + 0.8));
          if (go > 0) {
            if (j !== 0) return null;
            return <circle key={`${i}-${j}`} cx={mx + (d[0] - mx) * go} cy={my + (d[1] - my) * go} r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />;
          }
          let x = a[0] + (rest.x - a[0]) * fly;
          let yy = a[1] + (rest.y - a[1]) * fly - Math.sin(fly * Math.PI) * 6;
          x += (mx - x) * merge;
          yy += (my - yy) * merge;
          const isResult = merge > 0.98;
          if (isResult && j !== 0) return null;
          return <circle key={`${i}-${j}`} cx={x} cy={yy} r={isResult ? 7 : 5.5} fill={isResult ? 'var(--accent)' : toneVar(KEY[(i + j) % 4])} stroke="var(--surface)" strokeWidth="1.5" />;
        });
      })}
      {action === 'collect' && [0, 1, 2].map((i) => {
        if (t < 10.0 + i * 0.15) return null;
        return <circle key={`got${i}`} cx={42 + i * 22} cy={322} r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />;
      })}
      {action === 'write' && [0, 1, 2].map((i) => {
        const land = smooth(prog(t, 10.0 + i * 0.15, 10.5 + i * 0.15));
        if (land <= 0) return null;
        return <rect key={`file${i}`} x={696} y={EY[i] + 26} width="20" height="26" rx="4" fill="var(--accent)" opacity={land} />;
      })}
      {/* the label sits beside the merged dot, inside the first executor, so it never covers the group title */}
      {t >= 7.7 && t < 9.2 && <text className="s b" x="488" y={EY[0] + 70} style={{ fill: 'var(--k2)' }}>{T.merge}</text>}
    </g>
  );

  const at = [0, 0.9, 2.1, 4.0, 5.2, 6.1, 7.7];
  const marks: Mark[] = [
    ...T.marks.map((m, k) => ({ at: at[k], ...m })),
    { at: 9.2, ...(action === 'collect' ? T.collect : T.write) },
  ];

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.groupLabel}>
        {([['collect', T.endCollect], ['write', T.endWrite]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={action === id} onClick={() => { setAction(id); clock.restart(); }}>{label}</button>
        ))}
      </div>
      <div className="viz-box">
        <SceneSvg nodes={nodes} msgs={msgs} t={t} height={452} label={T.svgLabel} extra={extras} />
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
