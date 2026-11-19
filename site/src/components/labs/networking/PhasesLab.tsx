import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend } from './nw';
import data from './debug.json';

// Shows:      the same request timed three times, as three horizontal bars that grow at the same speed on one time axis: on a normal path (20 ms round trip), on a slow network (200 ms round trip) and
//             with a slow application (300 ms of work). Each bar is cut into three phases: connect (one round trip), wait (a round trip plus the server's work) and transfer (the body).
// Because:    "it is slow" has two very different causes. A slow network makes every phase longer, a slow application makes only the wait longer. Three bars one under the other on one axis show it at once.
// Control:    play and the scrub bar (the clock). The bars grow like a stopwatch, and a marker names the phase that is running.
// Conclusion: when connect is long the network is slow, when only wait is long the program on the other end is slow, and transfer is the part that grows with size and round trips.
//
// The three medians of each case are the real results of exercises/14_debugging.py (debug.json), taken over 7 requests each.

const D = 9;
const MAX_MS = 900;
const X0 = 150, W = 690;
type Ph = { connect: number; wait: number; transfer: number };
const P = data.phases as Record<'base' | 'slow_net' | 'slow_app', Ph>;
const ROWS: ('base' | 'slow_net' | 'slow_app')[] = ['base', 'slow_net', 'slow_app'];
const PH: ('connect' | 'wait' | 'transfer')[] = ['connect', 'wait', 'transfer'];
const CLS = { connect: 'nw-l3', wait: 'nw-l4', transfer: 'nw-app' } as const;
const CL = { connect: 'l3', wait: 'l4', transfer: 'app' } as const;

type T = { title: string; caption: string; rows: Record<string, string>; ph: Record<string, string>; ms: string; marks: Mark[] };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูว่าคำขอเดียวกันใช้เวลาใน 3 ช่วงอย่างไร เมื่อ Network ช้า และเมื่อโปรแกรมช้า',
    caption: 'ตัวเลขของแต่ละช่วงเป็นค่ามัธยฐานของ 7 คำขอจากแบบฝึก 14 ทางปกติ RTT 20 มิลลิวินาที Server ทำงาน 50 มิลลิวินาที และส่งข้อมูล 50 KB ทางช้า RTT 200 มิลลิวินาที ส่วนโปรแกรมช้าให้ Server ทำงาน 300 มิลลิวินาที',
    rows: { base: 'ปกติ', slow_net: 'Network ช้า', slow_app: 'โปรแกรมช้า' },
    ph: { connect: 'Connect (จับมือ)', wait: 'Wait (รอ Byte แรก)', transfer: 'Transfer (รับข้อมูล)' }, ms: 'มิลลิวินาที',
    marks: [
      { at: 0.4, name: 'Connect', title: 'ช่วงแรกคือการจับมือ ใช้เวลาเท่ากับ RTT หนึ่งรอบ', text: 'ทางปกติ 20 มิลลิวินาที ทาง Network ช้า 200 มิลลิวินาที ส่วนโปรแกรมช้าก็ยัง 20 เพราะการจับมือเกิดที่ Kernel ไม่เกี่ยวกับโปรแกรม' },
      { at: 2.6, name: 'Wait', title: 'ช่วงรอ Byte แรก คือ RTT หนึ่งรอบบวกเวลาทำงานของ Server', text: 'ถ้าช่วงนี้ยาวขึ้นโดยที่ Connect เท่าเดิม แปลว่า Network ปกติ โปรแกรมปลายทางเป็นฝ่ายช้า' },
      { at: 5.8, name: 'Transfer', title: 'ช่วงรับข้อมูล 50 KB ใช้ราว 2 RTT เพราะ Slow Start ส่งเป็นหลายชุด', text: 'บน Network ช้าช่วงนี้ยาวเป็น 10 เท่า เพราะทุกชุดต้องรอ RTT ที่ใหญ่ขึ้น' },
    ],
  },
  en: {
    title: 'Press play and see how the same request spends its time in three phases when the network is slow and when the program is slow',
    caption: 'The numbers of each phase are the medians of 7 requests from exercise 14. The normal path has a 20 ms round trip, the server works 50 ms and sends 50 KB. The slow network has a 200 ms round trip. The slow program makes the server work 300 ms.',
    rows: { base: 'normal', slow_net: 'slow network', slow_app: 'slow program' },
    ph: { connect: 'connect (handshake)', wait: 'wait (first byte)', transfer: 'transfer (body)' }, ms: 'ms',
    marks: [
      { at: 0.4, name: 'Connect', title: 'The first phase is the handshake, one round trip long', text: '20 ms on the normal path, 200 ms on the slow network, and still 20 ms with the slow program, because the handshake is done by the kernel and has nothing to do with the program.' },
      { at: 2.6, name: 'Wait', title: 'The wait for the first byte is a round trip plus the server\'s work', text: 'If this phase grows while connect stays the same, the network is fine and the program at the far end is the slow one.' },
      { at: 5.8, name: 'Transfer', title: 'Receiving 50 KB takes about 2 round trips because slow start sends it in several flights', text: 'On the slow network this phase is ten times longer, because every flight waits for the larger round trip.' },
    ],
  },
};

export default function PhasesLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const now = Math.min(MAX_MS, (t / 8.4) * MAX_MS);
  let cur = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) cur = i; });
  const sx = (ms: number) => (ms / MAX_MS) * W;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={PH.map((p) => ({ cls: CL[p], text: T.ph[p] }))} />
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          {[0, 200, 400, 600, 800].map((m) => (
            <g key={m}>
              <line x1={X0 + sx(m)} y1={52} x2={X0 + sx(m)} y2={288} className="nw-wire" />
              <text x={X0 + sx(m)} y={44} className="ib-s" textAnchor="middle">{m}</text>
            </g>
          ))}
          <text x={X0 + W} y={26} className="ib-s" textAnchor="end">{T.ms}</text>
          {ROWS.map((r, i) => {
            const y = 70 + i * 74;
            let a = 0;
            return (
              <g key={r}>
                <text x={X0 - 12} y={y + 24} className="ib-n" textAnchor="end" style={{ fill: 'var(--fg)', fontSize: 18 }}>{T.rows[r]}</text>
                {now >= PH.reduce((q, p) => q + P[r][p], 0) && <text x={X0 + sx(PH.reduce((q, p) => q + P[r][p], 0)) + 10} y={y + 26} className="ib-n" style={{ fontSize: 22 }}>{PH.reduce((q, p) => q + P[r][p], 0)} {T.ms}</text>}
                {PH.map((p) => {
                  const start = a;
                  a += P[r][p];
                  const shown = Math.max(0, Math.min(P[r][p], now - start));
                  if (shown <= 0) return null;
                  const w = sx(shown);
                  return (
                    <g key={p}>
                      <rect className={CLS[p]} x={X0 + sx(start)} y={y} width={w} height={36} rx={4} />
                      {w > 44 && shown >= P[r][p] && <text x={X0 + sx(start) + w / 2} y={y + 23} className="nw-txt" style={{ fontSize: 17 }}>{P[r][p]}</text>}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <line x1={X0 + sx(now)} y1={52} x2={X0 + sx(now)} y2={288} style={{ stroke: 'var(--accent)', strokeWidth: 2 }} />
          <Banner y={330} text={T.marks[cur].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
