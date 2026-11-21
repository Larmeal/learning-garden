import { useState } from 'react';
import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, type Lang } from '../devops/dv';
import data from './rollout.json';

// Shows:      two shelves, the old ReplicaSet and the new one, each with up to five slots for Pods (green = Ready, dashed = starting, orange = stuck). A meter under them counts the Ready Pods
//             against the line that the update promised never to cross. The reader steps through a rolling update, a Recreate update and an update with a bad image.
// Because:    "maxSurge" and "maxUnavailable" are numbers that only mean something as a count of Pods on two shelves at the same moment, and the bad image only makes sense when the old shelf is still full.
// Control:    the strategy; the step buttons.
// Conclusion: a Deployment moves Pods from one ReplicaSet to the other in small steps and never leaves fewer Ready Pods than it promised, unless you chose Recreate. A bad image stops the move half way, with the old Pods still serving.
//
// The counts at each step are the ReplicaSet counts printed by exercises/04_deployments.py (rollout.json): peak 5 Pods at once, 3 Ready at least, Recreate dropped to 0 Ready, and the stuck update left 3 old Pods Ready.

type Strat = 'rolling' | 'recreate' | 'bad';
type St = { o: [number, number]; n: [number, number]; stuck?: boolean };
const R = data.rolling.samples;
const first = (i: number) => R[i].rs;
const STEPS: Record<Strat, St[]> = {
  rolling: [
    { o: [4, 4], n: [0, 0] },
    { o: [first(0)[0].total, first(0)[0].ready], n: [first(0)[1].total, first(0)[1].ready] },
    { o: [first(1)[0].total, first(1)[0].ready], n: [first(1)[1].total, first(1)[1].ready] },
    { o: [0, 0], n: [R[2].rs[0].total, R[2].rs[0].ready] },
  ],
  recreate: [
    { o: [4, 4], n: [0, 0] },
    { o: [0, 0], n: [0, 0] },
    ...data.recreate.samples.slice(1).map((s) => ({ o: [0, 0] as [number, number], n: [s.rs[0].total, s.rs[0].ready] as [number, number] })),
  ],
  bad: [
    { o: [4, 4], n: [0, 0] },
    { o: [data.stuck.readyWhileStuck, data.stuck.readyWhileStuck], n: [2, 0], stuck: true },
    { o: [data.stuck.readyWhileStuck, data.stuck.readyWhileStuck], n: [2, 0], stuck: true },
    { o: [4, 4], n: [0, 0] },
  ],
};

const TEXT: Record<Lang, { title: string; caption: string; strat: string; strats: Record<Strat, string>; old: string; nw: string; ready: string; line: string; steps: Record<Strat, StepInfo[]>; banner: Record<Strat, string[]> }> = {
  th: {
    title: 'เลือกวิธีอัปเดตแล้วกดถัดไปทีละขั้น ดูว่าจำนวน Pod ที่ Ready ตกต่ำกว่าเส้นที่สัญญาไว้หรือเปล่า',
    caption: `ตัวเลขในแต่ละขั้นคือจำนวน Pod ของ ReplicaSet ที่พิมพ์ออกมาจากการรันจริงในแบบฝึก 04 (Deployment 4 ตัว, maxSurge 1, maxUnavailable 1): ที่เดียวกันสูงสุด ${data.rolling.peak} Pod และ Ready ต่ำสุด ${data.rolling.low} ตัว ส่วน Recreate ต่ำสุด ${data.recreate.low} ตัว ขั้นที่ภาพแสดงเป็นภาพถ่ายที่เก็บตอนจำนวนเปลี่ยน ระหว่างสองภาพอาจมีขั้นเล็ก ๆ ที่ไม่ได้เก็บ`,
    strat: 'วิธีอัปเดต', strats: { rolling: 'Rolling Update', recreate: 'Recreate', bad: 'Image ผิด' },
    old: 'ReplicaSet เก่า', nw: 'ReplicaSet ใหม่', ready: 'Ready', line: 'ต้อง Ready อย่างน้อย 3',
    steps: {
      rolling: [
        { name: 'ก่อนอัปเดต', title: 'Pod เก่า 4 ตัว Ready หมด', text: 'Deployment มี ReplicaSet เดียวและเลขรุ่นของ Template คือ 1' },
        { name: 'เริ่มทยอย', title: 'ลดเก่าเหลือ 3 และเพิ่มใหม่ 2', text: 'maxSurge 1 อนุญาตให้มี Pod เกินเป้าได้ 1 ตัว (รวมเป็น 5) และ maxUnavailable 1 อนุญาตให้ Ready ต่ำลงได้ 1 ตัว Pod ใหม่ยังไม่ผ่าน Readiness Probe จึงยังไม่นับ' },
        { name: 'ครึ่งทาง', title: 'เก่าเหลือ 1 ใหม่ 4 (Ready 2)', text: 'Pod เก่าถูกลดลงตามจำนวน Pod ใหม่ที่ Ready แล้ว รวม Ready ยังเป็น 3 ไม่ต่ำกว่าเส้น' },
        { name: 'จบ', title: 'ใหม่ 4 ตัว Ready ReplicaSet เก่าเหลือ 0', text: 'ReplicaSet เก่าไม่ถูกลบ มันถูกเก็บไว้ที่ 0 ตัวเพื่อให้ rollout undo ใช้ได้' },
      ],
      recreate: [
        { name: 'ก่อนอัปเดต', title: 'Pod เก่า 4 ตัว Ready หมด', text: 'strategy: Recreate' },
        { name: 'หยุดทั้งหมด', title: 'ไม่มี Pod เลย', text: 'Recreate หยุด Pod เก่าทุกตัวก่อนจะสร้างตัวใหม่ จึงมีช่วงที่ไม่มี Pod ให้บริการเลย' },
        { name: 'สร้างใหม่', title: 'Pod ใหม่ 4 ตัว ยังไม่ Ready', text: 'ช่วงนี้ Service ไม่มี Endpoint ให้ส่งคำขอไป' },
        { name: 'เริ่ม Ready', title: 'Ready 1 ตัว', text: 'Pod ใหม่ผ่าน Readiness Probe ทีละตัว' },
        { name: 'จบ', title: 'ใหม่ 4 ตัว Ready', text: 'วิธีนี้เหมาะเมื่อ Pod เก่ากับใหม่ห้ามรันพร้อมกัน (เช่น Schema ของข้อมูลไม่เข้ากัน) โดยยอมรับว่ามีช่วงหยุด' },
      ],
      bad: [
        { name: 'ก่อนอัปเดต', title: 'Pod เก่า 4 ตัว Ready หมด', text: 'ต่อไปเราจะเปลี่ยน Image เป็น busybox:no-such-tag ที่ไม่มีอยู่จริง' },
        { name: 'ค้าง', title: 'ใหม่ 2 ตัวค้างที่ ImagePullBackOff เก่ายัง Ready 3', text: 'Pod ใหม่ดึง Image ไม่ได้จึงไม่มีวัน Ready Deployment จึงไม่ลด Pod เก่าต่ออีก เพราะ Ready จะต่ำกว่าที่สัญญา' },
        { name: 'รอจนหมดเวลา', title: 'Deployment รายงาน ProgressDeadlineExceeded', text: 'rollout status ไม่รายงานสำเร็จและออกด้วยรหัสไม่ใช่ 0 แต่ Pod เก่า 3 ตัวยังรับคำขออยู่ ผู้ใช้ยังใช้งานได้' },
        { name: 'rollout undo', title: 'กลับเป็น Pod เก่า 4 ตัว', text: 'undo กลับไปใช้ Template ของรุ่นก่อน และ Pod เก่าที่เหลือ 3 ตัวถูกเติมให้เป็น 4' },
      ],
    },
    banner: { rolling: ['ยังไม่เริ่ม', 'ทยอยเปลี่ยน: ไม่เกิน 5 ตัว ไม่ต่ำกว่า 3 Ready', 'ทยอยเปลี่ยน: ไม่เกิน 5 ตัว ไม่ต่ำกว่า 3 Ready', 'อัปเดตสำเร็จ'], recreate: ['ยังไม่เริ่ม', 'ไม่มี Ready เลย', 'ไม่มี Ready เลย', 'Ready เริ่มกลับมา', 'อัปเดตสำเร็จ'], bad: ['ยังไม่เริ่ม', 'ค้าง แต่ยังให้บริการด้วยตัวเก่า', 'ค้าง แต่ยังให้บริการด้วยตัวเก่า', 'กู้คืนแล้ว'] },
  },
  en: {
    title: 'Pick an update strategy and press Next one step at a time, and watch whether the number of Ready Pods drops below the line that was promised',
    caption: `The counts in each step are the ReplicaSet counts printed by a real run of exercise 04 (a Deployment of 4, maxSurge 1, maxUnavailable 1): at most ${data.rolling.peak} Pods at once and at least ${data.rolling.low} Ready, while Recreate went down to ${data.recreate.low} Ready. The steps are snapshots taken when the counts changed, so a small step between two pictures may not have been captured.`,
    strat: 'strategy', strats: { rolling: 'Rolling update', recreate: 'Recreate', bad: 'bad image' },
    old: 'old ReplicaSet', nw: 'new ReplicaSet', ready: 'Ready', line: 'at least 3 must be Ready',
    steps: {
      rolling: [
        { name: 'Before', title: '4 old Pods, all Ready', text: 'The Deployment has one ReplicaSet and the template revision is 1.' },
        { name: 'Starting', title: 'Old down to 3 and new up to 2', text: 'maxSurge 1 allows one Pod over the target (5 in all) and maxUnavailable 1 allows one fewer Ready. The new Pods have not passed the readiness probe, so they do not count yet.' },
        { name: 'Half way', title: 'Old 1, new 4 (2 Ready)', text: 'Old Pods are removed as new ones become Ready. The Ready total is still 3, never under the line.' },
        { name: 'Done', title: '4 new Pods Ready, old ReplicaSet at 0', text: 'The old ReplicaSet is not deleted. It is kept at 0 so that rollout undo can use it.' },
      ],
      recreate: [
        { name: 'Before', title: '4 old Pods, all Ready', text: 'strategy: Recreate' },
        { name: 'Stop all', title: 'No Pods at all', text: 'Recreate stops every old Pod before it creates a new one, so there is a moment with nothing serving.' },
        { name: 'Create', title: '4 new Pods, none Ready', text: 'During this time the Service has no endpoint to send requests to.' },
        { name: 'First Ready', title: '1 Ready', text: 'The new Pods pass the readiness probe one by one.' },
        { name: 'Done', title: '4 new Pods Ready', text: 'Use it when old and new Pods must not run together (for example incompatible data schemas), and accept the gap.' },
      ],
      bad: [
        { name: 'Before', title: '4 old Pods, all Ready', text: 'Next we change the image to busybox:no-such-tag, which does not exist.' },
        { name: 'Stuck', title: '2 new Pods stuck in ImagePullBackOff, old still 3 Ready', text: 'The new Pods cannot pull the image so they never become Ready. The Deployment does not remove more old Pods, because Ready would fall below the promise.' },
        { name: 'Deadline', title: 'The Deployment reports ProgressDeadlineExceeded', text: 'rollout status does not report success and exits non-zero, but the 3 old Pods still take requests. Users can still work.' },
        { name: 'rollout undo', title: 'Back to 4 old Pods', text: 'undo goes back to the previous template, and the old ReplicaSet is filled up from 3 to 4.' },
      ],
    },
    banner: { rolling: ['Not started', 'Rolling: never more than 5, never fewer than 3 Ready', 'Rolling: never more than 5, never fewer than 3 Ready', 'Update done'], recreate: ['Not started', 'Nothing Ready at all', 'Nothing Ready at all', 'Ready is coming back', 'Update done'], bad: ['Not started', 'Stuck, but the old Pods still serve', 'Stuck, but the old Pods still serve', 'Recovered'] },
  },
};

export default function RolloutLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<Strat>('rolling');
  const steps = T.steps[s];
  const sp = useStepper(steps.length, 2600);
  const st = STEPS[s][Math.min(sp.step, STEPS[s].length - 1)];
  const readyTotal = st.o[1] + st.n[1];
  const slot = (x: number, y: number, i: number, tot: number, rdy: number, stuck: boolean, key: string) => {
    if (i >= tot) return <rect key={key} x={x} y={y} width={60} height={44} rx={8} style={{ fill: 'none', stroke: 'var(--line)', strokeDasharray: '4 5' }} />;
    return <Tile key={key} x={x} y={y} w={60} h={44} title={i < rdy ? '✓' : stuck ? '✗' : '…'} state={i < rdy ? 'ok' : stuck ? 'bad' : 'on'} />;
  };
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.strat} options={(Object.keys(T.strats) as Strat[]).map((k) => ({ id: k, text: T.strats[k] }))} value={s} onChange={(v) => { setS(v); sp.reset(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          {[{ y: 16, name: T.old, v: st.o, stuck: false, k: 'o' }, { y: 110, name: T.nw, v: st.n, stuck: !!st.stuck, k: 'n' }].map((r) => (
            <g key={r.k}>
              <rect className="ib-node" x={20} y={r.y} width={840} height={84} rx={12} />
              <text x={36} y={r.y + 32} className="ib-n">{r.name}</text>
              <text x={36} y={r.y + 58} className="ib-m">{r.v[0]} Pod · {r.v[1]} {T.ready}</text>
              {[0, 1, 2, 3, 4].map((i) => slot(300 + i * 100, r.y + 20, i, r.v[0], r.v[1], r.stuck, `${r.k}${i}`))}
            </g>
          ))}
          <text x={36} y={232} className="ib-n">{T.ready}</text>
          <text x={110} y={236} className="ib-big" style={{ fontSize: 34, fill: readyTotal >= 3 ? 'var(--k2)' : 'var(--ib-bad)' }}>{readyTotal}</text>
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={300 + i * 100} y={212} width={60} height={14} rx={4} style={{ fill: i < readyTotal ? 'var(--k2)' : 'var(--surface-2)', stroke: 'var(--line-strong)' }} />)}
          <path d="M580,204 v32" style={{ stroke: 'var(--ib-bad)', strokeWidth: 3, strokeDasharray: '5 4' }} />
          <text x={580} y={256} className="ib-s" style={{ fill: 'var(--ib-bad)' }} textAnchor="middle">{T.line}</text>
          <Banner y={278} text={T.banner[s][sp.step]} />
        </svg>
      </div>
      <StepControls steps={steps} step={sp.step} playing={sp.playing} go={sp.go} toggle={sp.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
