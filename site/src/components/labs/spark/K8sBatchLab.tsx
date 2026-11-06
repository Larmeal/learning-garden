import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// How the driver asks Kubernetes for executor pods: ExecutorPodsAllocator.onNewSnapshots (lines 405-430) creates
// min(missing pods, spark.kubernetes.allocation.batch.size, free pending slots) pods per round, one round every
// spark.kubernetes.allocation.batch.delay. Defaults: batch size 20, delay 1 s, maxPendingPods unlimited. Read from the
// source of Spark 4.2.0, not run (there is no Kubernetes cluster here). How long a pod takes to go from Pending to Running
// depends on the cluster and on the image pull, so the 2.5 seconds in the picture is made up.

const DELAY = 1;
const RUN_AFTER = 2.5;
const TOTALS = [10, 45, 100];
const BATCHES = [20, 5];

interface Txt {
  need: (total: number) => { name: string; title: string; text: string };
  round1: (batch: number) => { name: string; title: string; text: string };
  next: (rs: number[], total: number) => { name: string; title: string; text: string };
  done: { name: string; title: string; text: string };
  title: string;
  totalAria: string;
  totalBtn: (n: number) => string;
  batchDefault: string;
  svgAria: (total: number, batch: number) => string;
  roundOf: (r: number, n: number) => string;
  status: (made: number, running: number, missing: number) => string;
  slotsNote: string;
  pending: string;
  running: string;
  caption: string;
}

const TEXT: Record<Lang, Txt> = {
  th: {
    need: (total) => ({ name: 'ต้องการ', title: `Driver ต้องการ executor ${total} ตัว`, text: 'ตัวเลขนี้มาจาก spark.executor.instances หรือจาก dynamic allocation ที่ขอเพิ่มตามจำนวน task ค้าง ExecutorPodsAllocator เทียบกับจำนวน pod ที่รู้อยู่แล้วว่ามีกี่ตัว (จาก snapshot ที่ได้จากการ watch)' }),
    round1: (batch) => ({ name: 'รอบ 1', title: `รอบแรกสร้างได้ไม่เกิน ${batch} pod (spark.kubernetes.allocation.batch.size)`, text: `แต่ละรอบสร้าง pod = ค่าต่ำสุดของ (ที่ยังขาด, ${batch}, ที่นั่งว่างตาม maxPendingPods) แล้วรอ spark.kubernetes.allocation.batch.delay (1 วินาที) ก่อนรอบถัดไป` }),
    next: (rs, total) => ({ name: 'รอบต่อไป', title: `ทุก 1 วินาทีสร้างต่อ ${rs.map((n) => n).join(' + ')} = ${total} ตัว`, text: `ครบใน ${rs.length} รอบ ใช้เวลาสร้างคำขอ ${((rs.length - 1) * DELAY).toFixed(0)} วินาที ตั้งแต่รอบแรก ยังไม่รวมเวลาที่ pod ต้องรอ scheduler วางและดึง image` }),
    done: { name: 'ครบ', title: 'pod ทุกตัวเป็น Running แล้ว executor พร้อมรับ task', text: 'เวลาจาก Pending เป็น Running ในภาพ (2.5 วินาที) เป็นตัวอย่าง จริงขึ้นกับ cluster: ถ้า node เต็มต้องรอ autoscaler หรือ pod ค้างที่ Pending เลย (spark.kubernetes.allocation.executor.timeout 600 วินาที จะลบ pod ที่ไม่ถึง Pending)' },
    title: 'Driver ขอ executor pod ทีละกี่ตัว',
    totalAria: 'จำนวน executor ที่ขอ',
    totalBtn: (n) => `ต้องการ ${n} ตัว`,
    batchDefault: ' (ค่าเริ่มต้น)',
    svgAria: (total, batch) => `ขอ executor pod ${total} ตัวทีละ ${batch}`,
    roundOf: (r, n) => `รอบที่ ${r} จาก ${n}`,
    status: (made, running, missing) => `สร้างแล้ว ${made} · Running แล้ว ${running} · ขาดอีก ${missing}`,
    slotsNote: 'แต่ละช่องด้านบนคือหนึ่งรอบ (จำนวน pod ที่สร้างในรอบนั้น) ห่างกันรอบละ 1 วินาที',
    pending: 'สีส้ม = Pending',
    running: 'สีเขียว = Running',
    caption: 'กติกาแบ่งเป็นรอบอ่านจาก ExecutorPodsAllocator และ Config.scala (Spark 4.2.0) ค่าเริ่มต้น batch.size = 20, batch.delay = 1 วินาที, maxPendingPods ไม่จำกัด ยังไม่ได้รันบน Kubernetes จริง และเวลา Pending เป็น Running ในภาพ (2.5 วินาที) เป็นค่าสมมติ',
  },
  en: {
    need: (total) => ({ name: 'Need', title: `The driver needs ${total} executors`, text: 'This number comes from spark.executor.instances, or from dynamic allocation, which asks for more according to the number of waiting tasks. ExecutorPodsAllocator compares it with the number of pods it already knows about (from the snapshot it gets by watching).' }),
    round1: (batch) => ({ name: 'Round 1', title: `The first round creates at most ${batch} pods (spark.kubernetes.allocation.batch.size)`, text: `Each round creates pods = the minimum of (still missing, ${batch}, free slots under maxPendingPods). Then it waits spark.kubernetes.allocation.batch.delay (1 second) before the next round.` }),
    next: (rs, total) => ({ name: 'Next rounds', title: `Every 1 second it creates more: ${rs.map((n) => n).join(' + ')} = ${total}`, text: `It finishes in ${rs.length} rounds. Sending the requests takes ${((rs.length - 1) * DELAY).toFixed(0)} seconds from the first round. This does not include the time a pod waits for the scheduler to place it and to pull the image.` }),
    done: { name: 'Done', title: 'Every pod is Running and the executors can take tasks', text: 'The time from Pending to Running in the picture (2.5 seconds) is only an example. In reality it depends on the cluster: if the nodes are full, the pod waits for the autoscaler or stays in Pending (spark.kubernetes.allocation.executor.timeout, 600 seconds, deletes pods that never reach Pending).' },
    title: 'How many executor pods does the driver ask for at a time',
    totalAria: 'Number of executors requested',
    totalBtn: (n) => `Need ${n}`,
    batchDefault: ' (default)',
    svgAria: (total, batch) => `Requesting ${total} executor pods, ${batch} at a time`,
    roundOf: (r, n) => `Round ${r} of ${n}`,
    status: (made, running, missing) => `Created ${made} · Running ${running} · Still missing ${missing}`,
    slotsNote: 'Each box above is one round (the number of pods created in that round), 1 second apart.',
    pending: 'Orange = Pending',
    running: 'Green = Running',
    caption: 'The rules for the rounds are read from ExecutorPodsAllocator and Config.scala (Spark 4.2.0). Defaults: batch.size = 20, batch.delay = 1 second, maxPendingPods unlimited. Not run on a real Kubernetes cluster, and the time from Pending to Running in the picture (2.5 seconds) is an assumed value.',
  },
};

function rounds(total: number, batch: number) {
  const out: number[] = [];
  let left = total;
  while (left > 0) {
    const n = Math.min(left, batch);
    out.push(n);
    left -= n;
  }
  return out;
}

export default function K8sBatchLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [total, setTotal] = useState(45);
  const [batch, setBatch] = useState(20);
  const rs = useMemo(() => rounds(total, batch), [total, batch]);
  const start = 0.8;
  const duration = start + (rs.length - 1) * DELAY + RUN_AFTER + 1.6;
  const clock = useClock(duration);
  const { t } = clock;

  // pod k (0-based) is created in the round that holds it
  const created: number[] = [];
  rs.forEach((n, r) => { for (let i = 0; i < n; i += 1) created.push(start + r * DELAY); });
  const nCreated = created.filter((c) => t >= c).length;
  const nRunning = created.filter((c) => t >= c + RUN_AFTER).length;
  const round = Math.min(rs.length, Math.max(0, Math.floor((t - start) / DELAY) + 1));
  const lastRound = start + (rs.length - 1) * DELAY;

  const cols = 20;
  const cell = 34;

  const marks: Mark[] = [
    { at: 0, ...T.need(total) },
    { at: start, ...T.round1(batch) },
    ...(rs.length > 1 ? [{ at: start + DELAY, ...T.next(rs, total) }] : []),
    { at: lastRound + RUN_AFTER, ...T.done },
  ];

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.totalAria}>
        {TOTALS.map((n) => <button key={n} type="button" aria-pressed={total === n} onClick={() => { setTotal(n); clock.restart(); }}>{T.totalBtn(n)}</button>)}
      </div>
      <div className="viz-steps" role="group" aria-label="batch size">
        {BATCHES.map((n) => <button key={n} type="button" aria-pressed={batch === n} onClick={() => { setBatch(n); clock.restart(); }}>batch.size = {n}{n === 20 ? T.batchDefault : ''}</button>)}
      </div>
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${150 + Math.ceil(total / cols) * cell + 16}`} role="img" aria-label={T.svgAria(total, batch)}>
          <rect className="band" x="10" y="10" width="860" height={130 + Math.ceil(total / cols) * cell + 16} rx="12" />
          <text className="b" x="30" y="40">{T.roundOf(round, rs.length)}</text>
          <text className="s" x="30" y="62">{T.status(nCreated, nRunning, total - nCreated)}</text>
          {rs.map((n, r) => {
            const on = t >= start + r * DELAY;
            return (
              <g key={r} opacity={on ? 1 : 0.35}>
                <rect x={30 + r * (Math.min(44, 800 / rs.length))} y="78" width={Math.min(40, 800 / rs.length - 4)} height="22" rx="5" fill={on ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth="1.6" />
                <text className="s m" x={30 + r * Math.min(44, 800 / rs.length) + Math.min(40, 800 / rs.length - 4) / 2} y="93" textAnchor="middle" style={{ fontSize: 11, fill: on ? 'var(--on-accent, #fff)' : undefined }}>{n}</text>
              </g>
            );
          })}
          <text className="s" x="30" y="122">{T.slotsNote}</text>
          <g transform="translate(30 140)">
            {Array.from({ length: total }, (_, k) => {
              const c = created[k];
              const made = smooth(prog(t, c, c + 0.35));
              const run = t >= c + RUN_AFTER;
              return (
                <g key={k} transform={`translate(${(k % cols) * (cell + 5)} ${Math.floor(k / cols) * (cell + 5)})`}>
                  <rect width={cell} height={cell} rx="6" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
                  {made > 0 && (
                    <rect width={cell} height={cell} rx="6" fill={run ? 'var(--k2)' : 'var(--accent)'} fillOpacity={run ? 1 : 0.45} stroke={run ? 'var(--k2)' : 'var(--accent)'} strokeWidth="2" opacity={made} />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="viz-steps" aria-hidden="true" style={{ pointerEvents: 'none' }}>
        <span style={{ color: 'var(--accent)' }}>{T.pending}</span>
        <span style={{ color: 'var(--k2)' }}>{T.running}</span>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
