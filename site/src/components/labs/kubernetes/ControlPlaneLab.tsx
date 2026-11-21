import { useState } from 'react';
import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Num } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';

// Shows:      the API server in the middle with etcd under it, and three clients around it (the controller manager, the scheduler and the kubelet). A row of four small cards on the left tells which objects exist
//             right now (Deployment, ReplicaSet, Pod without a node, Pod on a node). The reader steps through "kubectl create deployment" and can stop one component to see which step never happens.
// Because:    the control plane is not a boss giving orders. It is several loops that each watch one kind of object and write the next one, and the only way to see that is to remove one loop.
// Control:    which component is stopped (none, scheduler, controller manager); the step buttons.
// Conclusion: every component talks only to the API server, and each does one small thing when it sees the object it cares about. Stop one and everything before it still works, and everything after it waits.
//
// Real run: exercises/10_control_plane.py. With the scheduler stopped the Pod existed as Pending with no node and no event; with the controller manager stopped a deleted Pod was not replaced and a new replica count (5) was
// stored but nothing acted on it. Both came back by themselves when the manifest returned to /etc/kubernetes/manifests.

type Stop = 'none' | 'sched' | 'cm';
const NAMES = ['Deployment', 'ReplicaSet', 'Pod (no node)', 'Pod (nodeName)'];

const TEXT: Record<Lang, { title: string; caption: string; stop: string; stops: Record<Stop, string>; objs: string[]; exists: string; no: string; steps: StepInfo[]; stalled: Record<Stop, string>; api: string; cm: string; sch: string; kl: string }> = {
  th: {
    title: 'เลือกว่าจะหยุด Component ตัวไหน แล้วกดถัดไปตามการสร้าง Deployment ว่าขั้นไหนไม่เกิดขึ้น',
    caption: 'เส้นทางเป็นลำดับเหตุการณ์ของ kubectl create deployment ส่วนผลเมื่อหยุด Scheduler หรือ Controller Manager มาจากการรันจริงในแบบฝึก 10 (ย้ายไฟล์ Manifest ของ Static Pod ออกจาก /etc/kubernetes/manifests แล้วย้ายกลับ)',
    stop: 'Component ที่หยุด', stops: { none: 'ไม่หยุดตัวไหน', sched: 'Scheduler', cm: 'Controller Manager' },
    objs: NAMES, exists: 'มีอยู่แล้ว', no: 'ยังไม่มี', api: 'API Server', cm: 'Controller Manager', sch: 'Scheduler', kl: 'Kubelet (Node)',
    steps: [
      { name: 'kubectl', title: '1 kubectl ส่ง Deployment ไปที่ API Server', text: 'API Server ตรวจสอบสิทธิ์และ Schema แล้วเขียนลง etcd เป็น Key /registry/deployments/... ไม่มีใครรันอะไรเลยในขั้นนี้' },
      { name: 'ReplicaSet', title: '2 Controller Manager เห็น Deployment ใหม่ จึงสร้าง ReplicaSet และ Pod', text: 'Controller Manager Watch อยู่ มันเขียน ReplicaSet แล้ว ReplicaSet Controller ก็เขียน Pod ที่ยังไม่มี Node' },
      { name: 'Scheduler', title: '3 Scheduler เห็น Pod ที่ยังไม่มี nodeName แล้วเลือก Node ให้', text: 'Scheduler ไม่ได้รัน Pod มันแค่เขียนค่า spec.nodeName กลับไปที่ API Server' },
      { name: 'Kubelet', title: '4 Kubelet ของ Node นั้นเห็น Pod ที่ถูกกำหนดมาที่ตัวเอง แล้วสั่ง Container Runtime', text: 'Kubelet ก็ Watch API Server เหมือนกัน ไม่มีใครส่งคำสั่งไปหามัน' },
      { name: 'Status', title: '5 Kubelet เขียนสถานะ Running กลับมา', text: 'สิ่งที่เราเห็นใน kubectl get pods คือสถานะที่ Kubelet เขียนไว้ใน API Server' },
    ],
    stalled: { none: 'ครบทุกขั้น', sched: 'Pod ถูกสร้างแล้วแต่ค้างเป็น Pending ไม่มี Node และไม่มี Event ใด ๆ (เหมือนในการรันจริง)', cm: 'Deployment ถูกเก็บแล้วแต่ไม่มี ReplicaSet และไม่มี Pod: ตั้งจำนวนเป็น 5 ก็ถูกเก็บ แต่ไม่มีใครทำตาม' },
  },
  en: {
    title: 'Pick which component to stop and step through creating a Deployment, and see which step never happens',
    caption: 'The path is the order of events of kubectl create deployment. What happens when the scheduler or the controller manager is stopped is from a real run of exercise 10 (the static Pod manifest was moved out of /etc/kubernetes/manifests and back).',
    stop: 'stopped component', stops: { none: 'none stopped', sched: 'scheduler', cm: 'controller manager' },
    objs: NAMES, exists: 'exists', no: 'not yet', api: 'API Server', cm: 'Controller Manager', sch: 'Scheduler', kl: 'Kubelet (node)',
    steps: [
      { name: 'kubectl', title: '1 kubectl sends the Deployment to the API server', text: 'The API server checks permissions and schema, then writes it to etcd as a key /registry/deployments/... Nobody runs anything at this step.' },
      { name: 'ReplicaSet', title: '2 The controller manager sees the new Deployment and creates a ReplicaSet and Pods', text: 'The controller manager is watching. It writes a ReplicaSet, and the ReplicaSet controller writes Pods that have no node yet.' },
      { name: 'Scheduler', title: '3 The scheduler sees a Pod with no nodeName and picks a node', text: 'The scheduler does not run the Pod. It only writes spec.nodeName back to the API server.' },
      { name: 'Kubelet', title: '4 The kubelet of that node sees a Pod assigned to it and tells the container runtime', text: 'The kubelet also watches the API server. Nobody sends it a command.' },
      { name: 'Status', title: '5 The kubelet writes the status Running back', text: 'What kubectl get pods shows is the status the kubelet wrote into the API server.' },
    ],
    stalled: { none: 'All steps happen', sched: 'The Pod exists but stays Pending with no node and not even an event (as in the real run)', cm: 'The Deployment is stored but there is no ReplicaSet and no Pod: a new replica count of 5 is stored too, and nobody acts on it' },
  },
};

export default function ControlPlaneLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [stop, setStop] = useState<Stop>('none');
  const sp = useStepper(T.steps.length, 3000);
  const k = sp.step;
  // which objects exist after step k
  const cmOk = stop !== 'cm', schOk = stop !== 'sched';
  const exist = [k >= 0, k >= 1 && cmOk, k >= 1 && cmOk, k >= 2 && cmOk && schOk];
  const run = k >= 3 && cmOk && schOk;
  const act = [k === 0, k === 1, k === 2, k === 3 || k === 4];
  const tone = (ok: boolean, now: boolean) => (!ok ? 'bad' : now ? 'on' : 'plain') as 'bad' | 'on' | 'plain';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.stop} options={(Object.keys(T.stops) as Stop[]).map((x) => ({ id: x, text: T.stops[x] }))} value={stop} onChange={(v) => { setStop(v); sp.reset(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {NAMES.map((n, i) => (
            <g key={n}>
              <rect className={exist[i] ? (i === 3 && run && k >= 4 ? 'nw-cell ok' : 'nw-cell on') : 'nw-cell'} x={14} y={16 + i * 66} width={190} height={54} rx={10} style={exist[i] ? undefined : { strokeDasharray: '6 5', opacity: 0.5 }} />
              <text x={28} y={40 + i * 66} className="ib-n">{T.objs[i]}</text>
              <text x={28} y={60 + i * 66} className="ib-s">{exist[i] ? T.exists : T.no}</text>
            </g>
          ))}
          <Tile x={380} y={150} w={160} h={70} title={T.api} state={act[0] ? 'on' : 'plain'} />
          <Tile x={380} y={250} w={160} h={44} title="etcd" state={k >= 0 ? 'ok' : 'plain'} />
          <Arrow x1={460} y1={222} x2={460} y2={248} />
          <Tile x={300} y={16} w={190} h={60} title={T.cm} sub={stop === 'cm' ? 'STOPPED' : undefined} state={stop === 'cm' ? 'bad' : act[1] ? 'on' : 'plain'} />
          <Tile x={560} y={16} w={170} h={60} title={T.sch} sub={stop === 'sched' ? 'STOPPED' : undefined} state={stop === 'sched' ? 'bad' : act[2] ? 'on' : 'plain'} />
          <Tile x={650} y={250} w={200} h={60} title={T.kl} state={!run && k >= 3 ? 'skip' : act[3] ? 'on' : 'plain'} />
          <Arrow x1={400} y1={80} x2={430} y2={148} op={act[1] ? 1 : 0.25} bad={stop === 'cm'} />
          <Arrow x1={620} y1={80} x2={520} y2={148} op={act[2] ? 1 : 0.25} bad={stop === 'sched'} />
          <Arrow x1={700} y1={246} x2={540} y2={200} op={act[3] ? 1 : 0.25} />
          <Arrow x1={238} y1={160} x2={376} y2={180} op={act[0] ? 1 : 0.25} />
          <Num x={300} y={150} n={1} />
          <Num x={400} y={110} n={2} />
          <Num x={600} y={110} n={3} />
          <Num x={620} y={236} n={4} />
        </svg>
      </div>
      <StepControls steps={T.steps} step={k} playing={sp.playing} go={sp.go} toggle={sp.toggle} lang={lang} />
      {stop !== 'none' && <p className="viz-now"><strong>{T.stops[stop]}</strong><span>{T.stalled[stop]}</span></p>}
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
