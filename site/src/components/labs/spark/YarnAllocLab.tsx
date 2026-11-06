import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// The "Reporter" thread of the YARN ApplicationMaster (ApplicationMaster.allocationThreadImpl, lines 564-645, and
// YarnAllocator.allocateResources, line 439): it calls allocate() on the ResourceManager, sleeps, and calls again. While
// containers are still pending it sleeps 200 ms, then doubles, up to the heartbeat; with nothing pending it sleeps the
// heartbeat. Defaults: spark.yarn.scheduler.initial-allocation.interval = 200ms, spark.yarn.scheduler.heartbeat.interval-ms = 3s.
// The intervals come from the source and were not run on YARN. WHEN the ResourceManager hands out the containers depends
// on how busy the cluster is, so that choice is made up.

const HEARTBEAT = 3;
const INITIAL = 0.2;
const END = 13;

function calls(grantAt: number) {
  const out: number[] = [0];
  let t = 0;
  let next = INITIAL;
  let k = 1;
  while (t < END) {
    const pending = k < grantAt; // after call number `grantAt` nothing is pending any more
    let sleep: number;
    if (pending) {
      sleep = Math.min(HEARTBEAT, next);
      next = sleep * 2;
    } else {
      next = INITIAL;
      sleep = HEARTBEAT;
    }
    t += sleep;
    k += 1;
    if (t <= END) out.push(Number(t.toFixed(2)));
  }
  return out;
}

const CASES = [{ id: 2 }, { id: 5 }, { id: 7 }];

interface Txt {
  cases: Record<number, string>;
  ask: { name: string; title: string; text: string };
  often: { name: string; title: string; text: string };
  got: { name: string; title: string; text: string };
  beat: { name: string; title: string; text: string };
  title: string; pick: string; svgAria: string; pendingNow: string; idleNow: string;
  called: (n: number) => string; note: string; caption: string;
}

const TEXT: Record<Lang, Txt> = {
  th: {
    cases: {
      2: 'cluster ว่าง: ได้ container ตอนเรียกครั้งที่ 2',
      5: 'ได้ตอนเรียกครั้งที่ 5',
      7: 'cluster เต็ม: ได้ตอนเรียกครั้งที่ 7',
    },
    ask: { name: 'ขอ', title: 'AM เรียก allocate() ครั้งแรก พร้อมคำขอ container', text: 'allocateResources() ส่งคำขอที่ค้างไปที่ ResourceManager (updateResourceRequests) แล้วอ่านคำตอบ ครั้งแรกมักยังไม่ได้อะไร เพราะ RM ต้องหาที่ว่างก่อน' },
    often: { name: 'ถามถี่', title: 'ยังมี container ค้างขอ: AM ถามถี่ แล้วห่างขึ้นเป็นเท่าตัว', text: 'รอ 0.2 วินาที ตามด้วย 0.4, 0.8, 1.6 แล้วชนเพดาน 3 วินาที (spark.yarn.scheduler.heartbeat.interval-ms) ช่วงแรกถามถี่เพื่อให้ได้ container เร็ว โดยไม่รัวถ้า cluster ติด' },
    got: { name: 'ได้ container', title: 'RM ตอบรายการ container ที่จัดให้ AM เอาไปเปิด executor', text: 'AM เรียก runAllocatedContainers แล้วสั่ง NodeManager เปิด executor (ดูภาพด้านบน) ได้ครบแล้วจึงไม่มีอะไรค้าง' },
    beat: { name: 'heartbeat', title: 'ไม่มีอะไรค้างแล้ว: AM ยังเรียก allocate() ทุก 3 วินาที', text: 'ไม่มีคำขอ ก็ยังต้องเรียก เพราะการเรียกนี้ทำหน้าที่เป็น heartbeat ให้ RM รู้ว่า AM ยังอยู่ และเป็นทางที่ RM แจ้งว่า container ไหนจบหรือตาย (completed containers)' },
    title: 'AM ถาม ResourceManager บ่อยแค่ไหนตอนขอ container',
    pick: 'เมื่อไรที่ได้ container',
    svgAria: 'เส้นเวลาที่ ApplicationMaster เรียก allocate ไปที่ ResourceManager',
    pendingNow: 'มี container ค้างขอ: ถามถี่ แล้วห่างขึ้น',
    idleNow: 'ไม่มีอะไรค้าง: ถามทุก 3 วินาที',
    called: (n) => `เรียกแล้ว ${n} ครั้ง`,
    note: 'ขีดหนึ่งอันคือการเรียก allocate() หนึ่งครั้ง แท่งคือช่วงที่ AM รอก่อนเรียกครั้งถัดไป ยิ่งสูงยิ่งรอนาน (เรียงตามลำดับการเรียก ไม่ใช่ตามสเกลเวลา)',
    caption: 'ช่วงรอ 0.2, 0.4, 0.8, 1.6 แล้ว 3 วินาที และ heartbeat 3 วินาที อ่านจากซอร์ส Spark 4.2.0 (ApplicationMaster.scala, config/package.scala) ยังไม่ได้รันบน YARN จริง ส่วนว่า RM ให้ container ตอนไหนขึ้นกับความว่างของ cluster ภาพจึงให้เลือกเองสามแบบ จำนวน container (3 ตัว) เป็นตัวอย่าง',
  },
  en: {
    cases: {
      2: 'Idle cluster: containers come at call 2',
      5: 'Containers come at call 5',
      7: 'Busy cluster: containers come at call 7',
    },
    ask: { name: 'Ask', title: 'The ApplicationMaster (AM) calls allocate() for the first time, with a request for containers', text: 'allocateResources() sends the pending requests to the ResourceManager (RM) with updateResourceRequests and reads the answer. The first call usually gets nothing, because the RM must first look for free space.' },
    often: { name: 'Ask often', title: 'Containers are still pending: the AM asks often, then the gap doubles', text: 'It waits 0.2 seconds, then 0.4, 0.8, 1.6, and then hits the ceiling of 3 seconds (spark.yarn.scheduler.heartbeat.interval-ms). At the start it asks often to get containers fast, but it does not flood the RM with calls if the cluster is busy.' },
    got: { name: 'Got containers', title: 'The RM answers with the containers it assigned, and the AM uses them to start executors', text: 'The AM calls runAllocatedContainers and tells the NodeManager to start the executors (see the picture above). All containers arrived, so nothing is pending.' },
    beat: { name: 'heartbeat', title: 'Nothing is pending: the AM still calls allocate() every 3 seconds', text: 'Even with no request it must still call, because the call works as a heartbeat that tells the RM the AM is alive. It is also how the RM reports which containers finished or died (completed containers).' },
    title: 'How often the AM asks the ResourceManager when it requests containers',
    pick: 'When the containers arrive',
    svgAria: 'Timeline of the ApplicationMaster calling allocate on the ResourceManager',
    pendingNow: 'Containers pending: ask often, then wider gaps',
    idleNow: 'Nothing pending: ask every 3 seconds',
    called: (n) => `${n} ${n === 1 ? 'call' : 'calls'} so far`,
    note: 'Each dot is one allocate() call. Each bar is the wait before the next call: taller = longer (in call order, not to time scale).',
    caption: 'The waits 0.2, 0.4, 0.8, 1.6 and then 3 seconds, and the 3 second heartbeat, are read from the Spark 4.2.0 source (ApplicationMaster.scala, config/package.scala). Not run on a real YARN cluster. When the RM gives the containers depends on how free the cluster is, so the picture lets you pick three cases. The number of containers (3) is an example.',
  },
};

export default function YarnAllocLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [grant, setGrant] = useState(5);
  const ticks = useMemo(() => calls(grant), [grant]);
  const clock = useClock(END + 1);
  const { t } = clock;
  const n = ticks.length;
  const X0 = 70;
  const W = 740;
  const x = (i: number) => X0 + (i / (n - 1)) * W;
  const grantT = ticks[grant - 1];
  const nCalls = ticks.filter((c) => c <= t).length;
  const pendingNow = t < grantT;
  const BASE = 196; // the line the calls stand on
  const barH = (sec: number) => 8 + (sec / HEARTBEAT) * 70;

  const marks: Mark[] = [
    { at: 0, ...T.ask },
    { at: 0.25, ...T.often },
    { at: grantT, ...T.got },
    { at: grantT + 0.3, ...T.beat },
  ].sort((a, b) => a.at - b.at);

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label={T.pick}>
        {CASES.map((c) => (
          <button key={c.id} type="button" aria-pressed={grant === c.id} onClick={() => { setGrant(c.id); clock.restart(); }}>{T.cases[c.id]}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.svgAria}>
          <rect className="band" x="10" y="10" width="860" height="280" rx="12" />
          <text className="b" x="30" y="38">ApplicationMaster (Reporter thread)</text>
          <text className="s" x="30" y="58">{pendingNow ? T.pendingNow : T.idleNow} ({T.called(nCalls)})</text>

          <line x1={X0 - 20} x2={X0 + W + 20} y1={BASE} y2={BASE} stroke="var(--line-strong)" strokeWidth="2" />
          {ticks.map((c, i) => {
            const seen = t >= c;
            const next = ticks[i + 1];
            const isGrant = i === grant - 1;
            const pend = i < grant - 1;
            const fresh = smooth(prog(t, c, c + 0.4));
            return (
              <g key={i}>
                {/* the wait that follows this call: a bar as tall as the wait */}
                {next !== undefined && t >= next && (
                  <g>
                    <rect x={x(i) + 8} y={BASE - barH(next - c)} width={Math.max(10, x(i + 1) - x(i) - 16)} height={barH(next - c)} rx="5" fill={pend ? 'var(--accent)' : 'var(--k2)'} opacity="0.35" />
                    <text className="s m b" x={(x(i) + x(i + 1)) / 2} y={BASE - barH(next - c) - 6} textAnchor="middle" style={{ fontSize: 12 }}>{(next - c).toFixed(1)}s</text>
                  </g>
                )}
                {seen && (
                  <g>
                    <circle cx={x(i)} cy={BASE} r={isGrant ? 9 : 7} fill={isGrant ? 'var(--k2)' : 'var(--accent)'} opacity={0.4 + 0.6 * fresh} stroke="var(--surface)" strokeWidth="2" />
                    <text className="s m" x={x(i)} y={BASE + 28} textAnchor="middle" style={{ fontSize: 11.5 }}>#{i + 1}</text>
                    <text className="s m" x={x(i)} y={BASE + 44} textAnchor="middle" style={{ fontSize: 11 }}>{c.toFixed(1)}s</text>
                  </g>
                )}
                {isGrant && seen && (
                  <g opacity={fresh}>
                    {/* kept below the title and the status line, which sit at the top left, where an early grant would cover them */}
                    {[0, 1, 2].map((k) => <rect key={k} x={x(i) - 31 + k * 22} y={BASE - 110} width="18" height="18" rx="4" fill="var(--k2)" />)}
                    <line x1={x(i)} x2={x(i)} y1={BASE - 90} y2={BASE - 12} stroke="var(--k2)" strokeWidth="3" />
                    <text className="s b" x={x(i)} y={BASE - 118} textAnchor="middle" style={{ fill: 'var(--k2)' }}>container x3</text>
                  </g>
                )}
              </g>
            );
          })}
          <text className="s" x="30" y="280">{T.note}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
