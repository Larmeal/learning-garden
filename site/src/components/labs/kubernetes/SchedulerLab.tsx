import { useState } from 'react';
import { Seg, Tile, type Lang } from '../devops/dv';
import data from './scheduling.json';

// Shows:      six Pods waiting in a queue and three nodes drawn as bins. Each worker bin has a bar for its CPU (what is free after the system Pods) and each Pod is a block of the size it REQUESTS.
//             The reader changes the request size and the taints, and watches blocks drop into bins or stay in the queue with the reason the scheduler gives.
// Because:    the scheduler adds up requests, not real use, and a taint closes a bin to Pods that do not carry the key. Both are about blocks and bins and are hard to feel from a sentence.
// Control:    the CPU request of each Pod (1000m, 6360m, 64 CPUs); the taint on the workers (none, tainted, tainted and tolerated).
// Conclusion: a Pod is placed on a node whose free requests can hold it and whose taints it tolerates. If no node qualifies it waits, and the event says which test each node failed.
//
// The worker figures (15,900m free of 16,000m), the 6360m case (2 per worker, 2 waiting), the 64 CPU case (Pending with the message shown) and the taint cases come from exercises/05_scheduling.py (scheduling.json).
// The 1000m case is computed the same way and was not run.

type Size = 1000 | 6360 | 64000;
type Taint = 'none' | 'taint' | 'tol';
const FREE = 15900;
const WORKERS = ['garden-m02', 'garden-m03'];
const PEND_MSG = data.pending.message.split(' preemption:')[0];

const TEXT: Record<Lang, { title: string; caption: string; size: string; sizes: Record<Size, string>; taint: string; taints: Record<Taint, string>; queue: string; cp: string; free: string; used: string; why: (placed: number, tn: Taint, size: Size) => string }> = {
  th: {
    title: 'เลือกขนาด CPU ที่ Pod ขอ และ Taint ของ Worker แล้วดูว่า Pod ลงถังไหนได้บ้าง ตัวที่ไม่มีที่ลงจะรออยู่ในคิว',
    caption: 'Worker มี CPU ว่าง 15,900m จาก 16,000m (หัก 100m ที่ Pod ของระบบขอไว้) ผลของกรณี 6360m (ลงได้ Worker ละ 2 ตัว คิวเหลือ 2), กรณี 64 CPU (Pending พร้อมข้อความที่เห็น) และกรณี Taint มาจากการรันจริงในแบบฝึก 05 กรณี 1000m คำนวณด้วยวิธีเดียวกันและไม่ได้รัน Node Control Plane มี Taint ตั้งแต่แรกจึงไม่รับ Pod ทั่วไป',
    size: 'CPU ที่ Pod ขอ', sizes: { 1000: '1000m', 6360: '6360m', 64000: '64 CPU' }, taint: 'Taint บน Worker', taints: { none: 'ไม่มี', taint: 'klab-team=data:NoSchedule', tol: 'มี Taint และ Pod ทนได้' },
    queue: 'คิว Pod ที่รอ (Pending)', cp: 'Control Plane', free: 'CPU ที่ขอรวม', used: 'ว่าง',
    why: (placed, tn, size) => placed === 6 ? 'Pod ทั้ง 6 ตัวมีที่ลง' : tn === 'taint' ? 'ทุก Worker มี Taint ที่ Pod ไม่ทน และ Control Plane ก็มี Taint จึงไม่มีที่ไหนรับ' : size === 64000 ? `${PEND_MSG}` : `Worker แต่ละตัวรับได้ ${Math.floor(FREE / size)} ตัว ที่เหลือรอจนกว่ามีตัวไหนจบ`,
  },
  en: {
    title: 'Pick the CPU a Pod asks for and the taint on the workers, and see which bins the Pods fit in; the ones with no room wait in the queue',
    caption: 'A worker has 15,900m of CPU free out of 16,000m (100m is requested by system Pods). The 6360m case (2 per worker, 2 left waiting), the 64 CPU case (Pending, with the message shown) and the taint cases are from a real run of exercise 05. The 1000m case is computed the same way and was not run. The control plane node has a taint from the start, so it takes no ordinary Pod.',
    size: 'CPU a Pod asks for', sizes: { 1000: '1000m', 6360: '6360m', 64000: '64 CPU' }, taint: 'taint on the workers', taints: { none: 'none', taint: 'klab-team=data:NoSchedule', tol: 'tainted, Pod tolerates it' },
    queue: 'queue of waiting Pods (Pending)', cp: 'Control Plane', free: 'CPU requested', used: 'free',
    why: (placed, tn, size) => placed === 6 ? 'All 6 Pods found a place' : tn === 'taint' ? 'Both workers have a taint the Pod does not tolerate, and the control plane has one too, so nothing can take it' : size === 64000 ? `${PEND_MSG}` : `Each worker can take ${Math.floor(FREE / size)}; the rest wait until one finishes`,
  },
};

export default function SchedulerLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [size, setSize] = useState<Size>(6360);
  const [taint, setTaint] = useState<Taint>('none');
  const cap = taint === 'taint' ? 0 : Math.floor(FREE / size);
  // balanced: hand out one Pod at a time to the emptier worker, as the scheduler's scoring tends to do
  const counts = [0, 0];
  for (let k = 0; k < 6; k++) { const i = counts[0] <= counts[1] ? 0 : 1; if (counts[i] < cap) counts[i]++; else if (counts[1 - i] < cap) counts[1 - i]++; }
  const placed = counts[0] + counts[1];
  const waiting = 6 - placed;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.size} options={([1000, 6360, 64000] as Size[]).map((k) => ({ id: String(k), text: T.sizes[k] }))} value={String(size)} onChange={(v) => setSize(Number(v) as Size)} />
      <Seg label={T.taint} options={(Object.keys(T.taints) as Taint[]).map((k) => ({ id: k, text: T.taints[k] }))} value={taint} onChange={setTaint} />
      <div className="viz-box">
        <svg viewBox="0 0 880 350" role="img" aria-label={T.title}>
          <text x={20} y={30} className="ib-n">{T.queue}</text>
          {Array.from({ length: 6 }, (_, i) => (
            <Tile key={i} x={20 + i * 90} y={42} w={76} h={42} title={`p${i + 1}`} state={i >= placed ? 'bad' : 'skip'} op={i >= placed ? 1 : 0.45} />
          ))}
          <text x={570} y={68} className="ib-s">{waiting > 0 ? `${waiting} Pending` : '—'}</text>
          {[{ n: 'garden', title: T.cp, cp: true, c: 0 }, { n: WORKERS[0], title: WORKERS[0], cp: false, c: counts[0] }, { n: WORKERS[1], title: WORKERS[1], cp: false, c: counts[1] }].map((nd, i) => {
            const x = 20 + i * 286;
            const used = nd.cp ? 0 : nd.c * size;
            const frac = Math.min(1, used / FREE);
            const closed = nd.cp || taint === 'taint';
            return (
              <g key={nd.n}>
                <rect className="ib-node" x={x} y={118} width={268} height={216} rx={14} style={{ strokeDasharray: closed ? '9 6' : undefined, stroke: closed ? 'var(--ib-bad)' : undefined }} />
                <text x={x + 14} y={146} className="ib-n">{nd.title}</text>
                {closed && <text x={x + 254} y={146} textAnchor="end" className="ib-s" style={{ fill: 'var(--ib-bad)' }}>🔒 {nd.cp ? 'control-plane' : 'klab-team'}</text>}
                {!nd.cp && (
                  <g>
                    <rect x={x + 14} y={160} width={240} height={18} rx={6} style={{ fill: 'var(--surface-2)', stroke: 'var(--line-strong)' }} />
                    <rect x={x + 14} y={160} width={240 * frac} height={18} rx={6} style={{ fill: 'var(--accent)' }} />
                    <text x={x + 14} y={200} className="ib-m">{T.free} {used}m / {FREE}m</text>
                  </g>
                )}
                {!nd.cp && Array.from({ length: nd.c }, (_, j) => (
                  <Tile key={j} x={x + 14 + (j % 3) * 82} y={218 + Math.floor(j / 3) * 52} w={76} h={42} title="web" state="ok" />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="viz-now"><strong>{placed} / 6</strong><span>{T.why(placed, taint, size)}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
