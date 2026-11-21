import { useState, type ReactNode } from 'react';
import { ClockControls, useClock, prog, smooth, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './workloads.json';

// Shows:      the four workloads that are not "N identical copies for ever", each drawn as the thing it really does: a Job as six pieces of work taken two at a time, a CronJob as a clock that
//             stamps out a Job on every tick, a DaemonSet as one Pod on every node, and a StatefulSet as three named Pods that each own a disk and get it back after a delete.
// Because:    the four differ by what they do over time and by what the Pods keep (a count, a schedule, a place, a name and a disk). A sentence for each gets mixed up, a picture of each does not.
// Control:    the kind of workload; play, scrub and jump buttons.
// Conclusion: choose the workload by what must stay true: finish N times (Job), repeat on a schedule (CronJob), one per node (DaemonSet), keep identity and data (StatefulSet).
//
// Numbers from exercises/06_jobs_stateful.py (workloads.json): completions 6 and parallelism 2 with at most 2 Pods at once, the DaemonSet on the two workers and then on all three nodes with a toleration,
// the StatefulSet Pods db-0 to db-2 with claims data-db-0 to data-db-2, and db-1 coming back with its data. The CronJob timings are from the same run (the schedule fired within a minute).

type Kind = 'job' | 'cron' | 'ds' | 'sts';
const D = 12;
const J = data.job;

const TEXT: Record<Lang, { title: string; caption: string; kind: string; kinds: Record<Kind, string>; marks: Record<Kind, Mark[]>; banner: Record<Kind, string[]>; node: string; disk: string; done: string }> = {
  th: {
    title: 'เลือกชนิดของ Workload แล้วกดเล่น ดูว่าแต่ละชนิดทำอะไรเมื่อเวลาผ่านไป และ Pod ของมันเก็บอะไรไว้',
    caption: `ตัวเลขมาจากการรันจริงในแบบฝึก 06: Job completions ${J.completions} parallelism ${J.parallelism} (Pod ทำงานพร้อมกันได้สูงสุด ${J.peak}), DaemonSet บน Worker 2 เครื่องแล้วเพิ่ม Control Plane เมื่อมี Toleration, StatefulSet ${data.stateful.pods.join(', ')} ที่ใช้ Claim ${data.stateful.claims.join(', ')} ส่วนเวลาในภาพถูกย่อ`,
    kind: 'Workload', kinds: { job: 'Job', cron: 'CronJob', ds: 'DaemonSet', sts: 'StatefulSet' }, node: 'Node', disk: 'ดิสก์', done: 'เสร็จแล้ว',
    marks: {
      job: [
        { at: 0, name: 'เริ่ม', title: 'Job ต้องการให้งานเสร็จ 6 ชิ้น ทำพร้อมกันได้ 2 ชิ้น', text: 'completions: 6 คือจำนวนครั้งที่ต้องสำเร็จ parallelism: 2 คือจำนวน Pod ที่ทำงานพร้อมกัน' },
        { at: 3.5, name: 'รอบที่สอง', title: 'สองชิ้นแรกเสร็จ สองชิ้นต่อไปเริ่ม', text: 'Pod ที่เสร็จจะมีสถานะ Completed และไม่ถูกรันซ้ำ' },
        { at: 8.5, name: 'จบ', title: 'ครบ 6 ชิ้น Job เป็น Complete', text: 'Pod ที่เสร็จแล้วยังเก็บไว้ให้อ่าน Log ได้ ถ้ามี Pod ล้มเหลว Job จะลองใหม่ได้ถึง backoffLimit ครั้งแล้วยอมแพ้' },
      ],
      cron: [
        { at: 0, name: 'ตั้งเวลา', title: 'CronJob มี Schedule และแม่แบบของ Job', text: 'ตัวมันเองไม่รันอะไร มีหน้าที่สร้าง Job ตามเวลา' },
        { at: 3, name: 'ถึงเวลา', title: 'ถึงเวลา: Job แรกถูกสร้างจากแม่แบบ', text: 'ในการรันจริง Schedule "* * * * *" สร้าง Job ภายในหนึ่งนาทีแรก Job สร้าง Pod และ Pod ทำงานจนจบ' },
        { at: 8, name: 'รอบถัดไป', title: 'รอบถัดไปได้ Job ใหม่ ส่วน Job เก่าถูกเก็บตาม History Limit', text: 'concurrencyPolicy: Forbid จะข้ามรอบถ้ารอบก่อนยังไม่จบ' },
      ],
      ds: [
        { at: 0, name: 'เริ่ม', title: 'DaemonSet ต้องการ Pod หนึ่งตัวต่อ Node', text: 'จำนวนไม่ได้ตั้งเอง ขึ้นกับว่ามี Node กี่ตัวที่เข้าเงื่อนไข' },
        { at: 3, name: 'บน Worker', title: 'ได้ Pod บน Worker 2 เครื่อง ไม่ได้บน Control Plane', text: 'Control Plane มี Taint node-role.kubernetes.io/control-plane จึงไม่รับ Pod ที่ไม่ทน Taint นั้น' },
        { at: 8, name: 'เพิ่ม Toleration', title: 'เพิ่ม Toleration แล้ว Control Plane ก็ได้ Pod', text: 'kube-proxy และ kindnet รันบน Control Plane ได้ด้วยวิธีนี้' },
      ],
      sts: [
        { at: 0, name: 'เริ่ม', title: 'StatefulSet ต้องการ 3 ตัว ที่มีชื่อประจำตัว', text: 'ชื่อคือ db-0, db-1, db-2 ไม่ใช่ชื่อสุ่ม' },
        { at: 5.5, name: 'สร้างตามลำดับ', title: 'สร้างทีละตัวตามลำดับ และแต่ละตัวได้ดิสก์ของตัวเอง', text: 'db-1 จะเริ่มหลังจาก db-0 พร้อมแล้ว แต่ละตัวมี PersistentVolumeClaim ที่ชื่อตามหลัง' },
        { at: 8, name: 'ลบ db-1', title: 'ลบ db-1 ออก', text: 'ดิสก์ data-db-1 ยังอยู่' },
        { at: 10.5, name: 'กลับมา', title: 'db-1 กลับมาด้วยชื่อเดิมและเจอข้อมูลเดิม', text: 'ไฟล์ที่เขียนไว้ยังอยู่ เพราะ StatefulSet ผูกชื่อ Pod เข้ากับ Claim' },
      ],
    },
    banner: { job: ['พร้อมเริ่ม', 'รอบแรก: 2 ตัวทำงาน', 'รอบสอง: 2 ตัวทำงาน', 'รอบสาม: 2 ตัวทำงาน', 'ครบ 6 ชิ้น'], cron: ['รอเวลา', 'ถึงเวลา', 'Job ทำงาน', 'รอเวลาอีกรอบ', 'Job ที่สองทำงาน'], ds: ['เริ่ม', 'Worker ได้ Pod ครบ', 'มี Toleration', 'ครบทุก Node'], sts: ['เริ่ม', 'สร้างทีละตัว', 'db-1 ถูกลบ', 'db-1 กลับมาพร้อมข้อมูล'] },
  },
  en: {
    title: 'Pick a workload and press play, and see what each one does over time and what its Pods keep',
    caption: `Numbers from a real run of exercise 06: Job completions ${J.completions}, parallelism ${J.parallelism} (at most ${J.peak} Pods at once), a DaemonSet on the two workers and then on the control plane too once it has a toleration, a StatefulSet with ${data.stateful.pods.join(', ')} and claims ${data.stateful.claims.join(', ')}. The times in the picture are shortened.`,
    kind: 'workload', kinds: { job: 'Job', cron: 'CronJob', ds: 'DaemonSet', sts: 'StatefulSet' }, node: 'Node', disk: 'disk', done: 'done',
    marks: {
      job: [
        { at: 0, name: 'Start', title: 'The Job wants 6 pieces of work done, 2 at a time', text: 'completions: 6 is how many must succeed. parallelism: 2 is how many Pods run together.' },
        { at: 3.5, name: 'Round two', title: 'The first two are done and the next two start', text: 'A Pod that finishes is marked Completed and is not run again.' },
        { at: 8.5, name: 'Done', title: 'All 6 done, the Job is Complete', text: 'Finished Pods are kept so you can read their logs. If a Pod fails, the Job retries up to backoffLimit times and then gives up.' },
      ],
      cron: [
        { at: 0, name: 'Schedule', title: 'A CronJob has a schedule and a Job template', text: 'It runs nothing itself. Its job is to create Jobs on time.' },
        { at: 3, name: 'Time comes', title: 'The time comes: the first Job is made from the template', text: 'In the real run the schedule "* * * * *" created a Job within the first minute. The Job creates a Pod and the Pod runs to the end.' },
        { at: 8, name: 'Next round', title: 'The next round gets a new Job, and older Jobs are kept up to the history limit', text: 'concurrencyPolicy: Forbid skips a round if the last one has not finished.' },
      ],
      ds: [
        { at: 0, name: 'Start', title: 'A DaemonSet wants one Pod per node', text: 'The count is not set by hand. It depends on how many nodes qualify.' },
        { at: 3, name: 'On workers', title: 'Pods on the 2 workers, none on the control plane', text: 'The control plane has the taint node-role.kubernetes.io/control-plane, so it refuses a Pod that does not tolerate it.' },
        { at: 8, name: 'Add toleration', title: 'With a toleration the control plane gets a Pod too', text: 'This is how kube-proxy and kindnet run on the control plane.' },
      ],
      sts: [
        { at: 0, name: 'Start', title: 'A StatefulSet wants 3 Pods that have names', text: 'The names are db-0, db-1, db-2, not random ones.' },
        { at: 5.5, name: 'In order', title: 'Created one at a time, in order, each with a disk of its own', text: 'db-1 starts after db-0 is ready. Each Pod gets a PersistentVolumeClaim named after it.' },
        { at: 8, name: 'Delete db-1', title: 'db-1 is deleted', text: 'The disk data-db-1 stays.' },
        { at: 10.5, name: 'Comes back', title: 'db-1 returns with the same name and finds its data', text: 'The file it wrote is still there, because a StatefulSet ties the Pod name to the claim.' },
      ],
    },
    banner: { job: ['Ready to start', 'Round 1: 2 Pods working', 'Round 2: 2 Pods working', 'Round 3: 2 Pods working', 'All 6 done'], cron: ['Waiting for the time', 'The time has come', 'The Job is running', 'Waiting for the next round', 'The second Job is running'], ds: ['Start', 'Workers have their Pods', 'A toleration is added', 'Every node has one'], sts: ['Start', 'Created one by one', 'db-1 is deleted', 'db-1 is back with its data'] },
  },
};

export default function WorkloadsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState<Kind>('job');
  const clock = useClock(D);
  const t = clock.t;
  const marks = T.marks[k];
  let bi = 0;
  const bounds = k === 'job' ? [0, 0.3, 3, 6, 9] : k === 'cron' ? [0, 3, 4, 7.5, 9] : k === 'ds' ? [0, 2.5, 8, 9.5] : [0, 1, 8, 10.5];
  bounds.forEach((b, i) => { if (t >= b) bi = i; });
  const body: ReactNode[] = [];
  if (k === 'job') {
    for (let i = 0; i < 6; i++) {
      const start = Math.floor(i / 2) * 3 + 0.3;
      const st = t < start ? 'skip' : t < start + 2.7 ? 'on' : 'ok';
      body.push(<Tile key={i} x={30 + i * 140} y={100} w={120} h={70} title={`Pod ${i + 1}`} sub={t < start ? '…' : t < start + 2.7 ? 'Running' : 'Completed'} state={st} />);
    }
    const succ = [0, 1, 2, 3, 4, 5].filter((i) => t >= Math.floor(i / 2) * 3 + 3).length;
    const act = [0, 1, 2, 3, 4, 5].filter((i) => t >= Math.floor(i / 2) * 3 + 0.3 && t < Math.floor(i / 2) * 3 + 3).length;
    body.push(<text key="c" x={30} y={230} className="ib-n">{`Active ${act}  ·  Succeeded ${succ} / ${J.completions}`}</text>);
    body.push(<rect key="b" x={30} y={246} width={820} height={18} rx={6} style={{ fill: 'var(--surface-2)', stroke: 'var(--line-strong)' }} />);
    body.push(<rect key="b2" x={30} y={246} width={820 * succ / 6} height={18} rx={6} style={{ fill: 'var(--k2)' }} />);
  } else if (k === 'cron') {
    body.push(<Tile key="cr" x={30} y={90} w={200} h={80} title="CronJob nightly" sub={'"* * * * *"'} state="on" />);
    [3, 8].forEach((at, i) => {
      const p = smooth(prog(t, at, at + 0.8));
      const x = 330 + i * 270;
      if (p > 0) {
        body.push(<Arrow key={`a${i}`} x1={230} y1={130} x2={x - 6} y2={130} op={p} />);
        body.push(<Tile key={`j${i}`} x={x} y={90} w={120} h={80} title={`Job ${i + 1}`} sub={t < at + 1.2 ? '…' : t < at + 3.5 ? 'Running' : T.done} state={t < at + 3.5 ? 'on' : 'ok'} op={p} />);
        body.push(<Tile key={`p${i}`} x={x + 20} y={210} w={80} h={44} title="Pod" state={t < at + 3.5 ? 'on' : 'ok'} op={prog(t, at + 1, at + 1.8)} />);
      }
    });
    body.push(<text key="tk" x={30} y={230} className="ib-s">{lang === 'th' ? 'เส้นเวลา: ' : 'timeline: '}{t < 3 ? '…' : t < 8 ? '1 tick' : '2 ticks'}</text>);
  } else if (k === 'ds') {
    const nodes = [{ n: 'garden', cp: true }, { n: 'garden-m02', cp: false }, { n: 'garden-m03', cp: false }];
    nodes.forEach((nd, i) => {
      const x = 30 + i * 286;
      const has = nd.cp ? t >= 8 : t >= 3 + i * 0.4;
      body.push(<rect key={nd.n} className="ib-node" x={x} y={70} width={268} height={160} rx={14} style={nd.cp && t < 8 ? { strokeDasharray: '9 6', stroke: 'var(--ib-bad)' } : undefined} />);
      body.push(<text key={nd.n + 't'} x={x + 14} y={98} className="ib-n">{nd.n}</text>);
      if (nd.cp) body.push(<text key="lock" x={x + 254} y={98} textAnchor="end" className="ib-s" style={{ fill: t < 8 ? 'var(--ib-bad)' : 'var(--k2)' }}>{t < 8 ? '🔒 NoSchedule' : '✓ toleration'}</text>);
      if (has) body.push(<Tile key={nd.n + 'p'} x={x + 74} y={130} w={120} h={60} title="agent" state={nd.cp ? 'on' : 'ok'} op={smooth(prog(t, nd.cp ? 8 : 3 + i * 0.4, (nd.cp ? 8 : 3 + i * 0.4) + 0.8))} />);
    });
  } else {
    [0, 1, 2].forEach((i) => {
      const at = 1 + i * 2;
      const x = 30 + i * 286;
      const dead = i === 1 && t >= 8 && t < 10.5;
      const pOp = i === 1 && t >= 8 ? (t < 10.5 ? 1 - smooth(prog(t, 8, 8.8)) : smooth(prog(t, 10.5, 11.3))) : smooth(prog(t, at, at + 0.8));
      body.push(<rect key={`d${i}`} className="ib-node" x={x} y={190} width={268} height={52} rx={26} style={{ opacity: smooth(prog(t, at, at + 0.8)) }} />);
      body.push(<text key={`dt${i}`} x={x + 134} y={222} textAnchor="middle" className="ib-m" style={{ opacity: smooth(prog(t, at, at + 0.8)) }}>data-db-{i}{i === 1 && t >= 10.5 ? ' · precious' : ''}</text>);
      body.push(<Tile key={`p${i}`} x={x + 74} y={88} w={120} h={64} title={`db-${i}`} sub={dead ? 'Terminating' : i === 1 && t >= 10.5 ? 'new uid' : 'Ready'} state={dead ? 'bad' : i === 1 && t >= 10.5 ? 'on' : 'ok'} op={pOp} />);
      body.push(<Arrow key={`l${i}`} x1={x + 134} y1={152} x2={x + 134} y2={188} op={Math.min(pOp, smooth(prog(t, at, at + 0.8)))} dashed />);
    });
    body.push(<text key="h" x={30} y={70} className="ib-s">{lang === 'th' ? 'ชื่อไม่สุ่ม และแต่ละตัวผูกกับดิสก์ของตัวเอง' : 'stable names, each tied to a disk of its own'}</text>);
  }
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.kind} options={(Object.keys(T.kinds) as Kind[]).map((x) => ({ id: x, text: T.kinds[x] }))} value={k} onChange={(v) => { setK(v); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {body}
          <Banner y={278} text={T.banner[k][bi]} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
