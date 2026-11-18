import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, mix } from './nw';
import data from './cong.json';

// Shows:      one real TCP transfer over a bottleneck of 8 Mbit/s, as three things moving together over time: (top) the congestion window cwnd, with its slow start threshold; (middle) how the data
//             in flight splits into "on the wire" (the bandwidth-delay product, 14 segments) and "waiting in the queue"; (bottom) the round trip time. A switch picks a 30 KB queue or a 600 KB one.
// Because:    congestion control is a loop: the window grows, the queue fills, a packet is dropped, the window is cut. The cause (cwnd) and the price (round trip) only make sense on the same time axis,
//             and the two queue sizes only differ in how long the loop takes and how much delay it costs.
// Control:    the switch of queue size, plus play, the scrub bar and the jump buttons (the clock).
// Conclusion: TCP finds the capacity by growing until something is dropped; a short queue gives a sawtooth with a small delay, a long queue gives the same throughput with a delay of more than half a second.
//
// Every point of the curves is a real sample of `ss -ti` of exercises/09_tcp_congestion.py (cong.json), Reno on a 20 ms path. Slow start is stretched in time so that it can be followed.

type Q = 'small' | 'big';
const D = 17;
const MSS = data.mss, BDP = data.bdp;
const X0 = 70, X1 = 840;

// clock seconds -> seconds of the experiment, stretched at the beginning
const MAP: Record<Q, [number, number][]> = {
  small: [[0, 0], [5.5, 0.42], [17, 3.0]],
  big: [[0, 0], [7.5, 1.2], [17, 3.0]],
};
const at = (q: Q, c: number) => {
  const m = MAP[q];
  for (let i = 1; i < m.length; i++) if (c <= m[i][0]) return mix(m[i - 1][1], m[i][1], (c - m[i - 1][0]) / (m[i][0] - m[i - 1][0]));
  return m[m.length - 1][1];
};

type T = { title: string; caption: string; scen: Record<Q, string>; cw: string; thr: string; flight: string; wire: string; queue: string; rtt: string; sec: string; seg: string; ms: string; now: string; marks: Record<Q, Mark[]> };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือกขนาดคิวที่คอขวดแล้วกดเล่น ดู cwnd เพิ่มขึ้น คิวเต็ม Packet ถูกทิ้ง และ RTT ที่ต้องจ่าย',
    caption: 'ทุกจุดของเส้นเป็นตัวอย่างจริงจาก ss -ti ของแบบฝึก 09 (Reno, คอขวด 8 Mbit/s, RTT เปล่า 20 มิลลิวินาที) ช่วง Slow Start ถูกยืดเวลาให้ตามดูทัน ส่วนอัลกอริทึมเริ่มต้นของ Linux เครื่องนี้คือ CUBIC ซึ่งเราไม่ได้วัดในบทนี้',
    scen: { small: 'คิวสั้น 30 KB', big: 'คิวยาว 600 KB' }, cw: 'cwnd (Segment)', thr: 'ssthresh', flight: 'ข้อมูลที่อยู่ระหว่างทาง', wire: 'อยู่ในสาย (BDP)', queue: 'ต่อคิวรอ', rtt: 'RTT (มิลลิวินาที)', sec: 'วินาที', seg: 'Segment', ms: 'มิลลิวินาที', now: 'ตอนนี้',
    marks: {
      small: [
        { at: 0.2, name: 'Slow Start', title: 'Slow Start: cwnd เป็นสองเท่าทุกรอบเวลา', text: 'เริ่มที่ 10 Segment แล้วเป็น 20, 40 เพราะทุก ACK ที่กลับมาเปิดทางให้ส่งเพิ่มอีกสองตัว TCP ยังไม่รู้ว่าสายรับได้เท่าไร จึงลองเพิ่มเร็วที่สุดจนกว่าจะมีอะไรหาย' },
        { at: 2.4, name: 'Loss แรก', title: 'คิวเต็ม Packet ถูกทิ้ง: ssthresh ลงมาครึ่งหนึ่ง', text: 'ข้อมูลที่ส่งออกไปเกินกว่าที่สายกับคิวจะรับได้ (BDP 14 Segment บวกคิว 30 KB ราว 21 Segment) Router ทิ้ง Packet cwnd ตกจากราว 60 เหลือ 32 และ ssthresh ตั้งที่ครึ่งหนึ่งของค่าก่อนหน้านั้น' },
        { at: 5.8, name: 'บวกทีละหนึ่ง', title: 'Congestion Avoidance: บวกทีละ 1 Segment ต่อรอบเวลา', text: 'cwnd หลังจากนี้โตเป็นเส้นตรง ราว 1 Segment ต่อ RTT ในการวัดคือ 0.99 ระหว่างโตขึ้น คิวที่คอขวดค่อย ๆ ยาวขึ้น แถบสีส้มจึงขยาย และ RTT ไต่จาก 22 ไปถึง 49 มิลลิวินาที' },
        { at: 9, name: 'ฟันเลื่อย', title: 'ถึงขีดจำกัดอีกครั้ง: ตัดครึ่ง แล้วเริ่มบวกใหม่', text: 'ทุกครั้งที่ cwnd ราว 33 Segment (BDP บวกคิวเล็ก) คิวเต็มและมีการทิ้ง cwnd ถูกตัดครึ่งเหลือ 17 แล้วบวกกลับขึ้นไป ได้รูปฟันเลื่อยทุก 0.7 วินาที ส่วน RTT แกว่งอยู่ระหว่าง 20 ถึง 49 มิลลิวินาที และ Throughput เกือบเต็มคอขวด (7.66 จาก 8 Mbit/s)' },
      ],
      big: [
        { at: 0.2, name: 'Slow Start', title: 'Slow Start ไม่เจอขีดจำกัด จึงไม่หยุดโต', text: 'คิวยาว 600 KB รับข้อมูลได้มาก Packet จึงไม่ถูกทิ้งสักที cwnd พุ่งขึ้นต่อเนื่องเกินสิบเท่าของที่สายจำเป็นต้องใช้' },
        { at: 3, name: 'คิวสะสม', title: 'ข้อมูลที่เกิน BDP ไปต่อคิวรอ RTT พุ่ง', text: 'สายส่งได้แค่ 8 Mbit/s ข้อมูลที่เกิน 14 Segment ของ BDP จึงต้องรอในคิว แถบสีส้มโตขึ้นทุกขณะ และทุก Packet ที่เข้าคิวท้ายต้องรอคนข้างหน้าทั้งหมด RTT จึงไต่จาก 20 ไปเกิน 600 มิลลิวินาที ทั้งที่ Throughput ไม่ได้ดีขึ้นเลย' },
        { at: 6.6, name: 'Loss ก้อนใหญ่', title: 'ในที่สุดคิวเต็ม: ทิ้งไปหลายร้อย Packet พร้อมกัน', text: 'cwnd ถึงราว 800 Segment ก่อนคิวจะเต็ม จึงทิ้ง 412 Packet ในจังหวะเดียว (เทียบกับ 40 ในกรณีคิวสั้น) ssthresh ตั้งที่ราว 409 และผู้ส่งต้องส่งซ้ำเป็นร้อย ๆ ตัว' },
        { at: 11, name: 'ผลที่ได้', title: 'ส่งเสร็จเวลาเดียวกับคิวสั้น แต่ RTT ราว 20 เท่า', text: 'ทั้งสองกรณีส่ง 3 MB เสร็จที่ประมาณ 3.1 วินาทีเท่ากัน แต่ RTT เฉลี่ยของคิวยาวคือ 476 มิลลิวินาที เทียบกับ 39 ของคิวสั้น และ ping จากโปรแกรมอื่นก็ต้องรอคิวนี้ด้วย (ราว 372 มิลลิวินาทีโดยเฉลี่ย) นี่คือ Bufferbloat' },
      ],
    },
  },
  en: {
    title: 'Pick the size of the queue at the bottleneck and press play to watch cwnd grow, the queue fill, packets get dropped and the round trip we pay',
    caption: 'Every point on the curves is a real sample of ss -ti from exercise 09 (Reno, an 8 Mbit/s bottleneck, an idle round trip of 20 milliseconds). Slow start is stretched in time so that it can be followed. The default algorithm of this Linux is CUBIC, which we did not measure in this lesson.',
    scen: { small: 'short queue, 30 KB', big: 'long queue, 600 KB' }, cw: 'cwnd (segments)', thr: 'ssthresh', flight: 'data in flight', wire: 'on the wire (BDP)', queue: 'waiting in the queue', rtt: 'round trip (ms)', sec: 'seconds', seg: 'segments', ms: 'ms', now: 'now',
    marks: {
      small: [
        { at: 0.2, name: 'Slow start', title: 'Slow start: cwnd doubles every round trip', text: 'It starts at 10 segments, then 20, 40, because every ACK that comes back opens room for two more. TCP does not yet know how much the path can take, so it grows as fast as it can until something is lost.' },
        { at: 2.4, name: 'First loss', title: 'The queue is full and a packet is dropped: ssthresh comes down to half', text: 'More data was sent than the cable and the queue can hold (the BDP of 14 segments plus the 30 KB queue, about 21 segments). The router drops a packet, cwnd falls from about 60 to 32 and ssthresh is set to half of what it was.' },
        { at: 5.8, name: 'Add one', title: 'Congestion avoidance: add one segment per round trip', text: 'From now on cwnd grows in a straight line, about 1 segment per RTT (measured 0.99). As it grows the queue at the bottleneck gets longer, so the orange bar widens and the round trip climbs from 22 to 49 milliseconds.' },
        { at: 9, name: 'Sawtooth', title: 'The limit is reached again: halve, then start adding again', text: 'Every time cwnd reaches about 33 segments (the BDP plus a small queue) the queue is full and something is dropped. cwnd is cut to half, 17, and climbs again, which makes a sawtooth every 0.7 seconds. The round trip swings between 20 and 49 milliseconds, and the throughput is almost the whole bottleneck (7.66 of 8 Mbit/s).' },
      ],
      big: [
        { at: 0.2, name: 'Slow start', title: 'Slow start finds no limit, so it does not stop', text: 'A 600 KB queue takes a lot of data, so no packet is dropped for a long time. cwnd shoots up to more than ten times what the cable needs.' },
        { at: 3, name: 'Queue builds', title: 'Data beyond the BDP waits in the queue and the round trip shoots up', text: 'The cable carries only 8 Mbit/s, so anything beyond the 14 segments of the BDP has to wait in the queue. The orange bar grows all the time, and every packet that joins the end waits for everything ahead of it. The round trip climbs from 20 to over 600 milliseconds, while the throughput does not improve at all.' },
        { at: 6.6, name: 'A huge loss', title: 'Finally the queue is full: hundreds of packets dropped at once', text: 'cwnd reached about 800 segments before the queue filled, so 412 packets were dropped in one go (against 40 with the short queue). ssthresh is set to about 409 and the sender has to resend hundreds of segments.' },
        { at: 11, name: 'The result', title: 'Finished at the same time as the short queue, with a round trip about 20 times longer', text: 'Both cases delivered 3 MB in about 3.1 seconds, but the mean round trip with the long queue was 476 milliseconds against 39 with the short one, and the ping of another program has to wait in this queue too (about 372 milliseconds on average). This is bufferbloat.' },
      ],
    },
  },
};

type Pt = (number | null)[];

export default function CongestionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [q, setQ] = useState<Q>('small');
  const clock = useClock(D);
  const marks = T.marks[q];
  let current = 0;
  marks.forEach((m, i) => { if (clock.t >= m.at - 0.001) current = i; });
  const pick = (s: Q) => { setQ(s); clock.restart(); };

  const series = (data as unknown as Record<string, Pt[]>)[q];
  const sNow = at(q, clock.t);
  const T_END = 3.0;
  const px = (s: number) => X0 + (s / T_END) * (X1 - X0);
  const cmax = q === 'small' ? 70 : 850;
  const rmax = q === 'small' ? 60 : 700;
  const cy = (c: number) => 215 - (c / cmax) * 110;
  const ry = (r: number) => 480 - (r / rmax) * 84;
  const shown = series.filter((p) => (p[0] as number) <= sNow);
  const cur = shown[shown.length - 1] ?? series[0];
  const cwnd = cur[1] as number;
  const inflight = cwnd * MSS;
  const queueBytes = Math.min(data.queues[q === 'small' ? 0 : 1], Math.max(0, inflight - BDP));
  const wireBytes = Math.min(inflight, BDP);
  const path = (idx: number, fy: (v: number) => number) => shown.filter((p) => p[idx] !== null && (p[idx] as number) > 0).map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p[0] as number)},${fy(p[idx] as number)}`).join(' ');
  const thrPath = shown.filter((p) => p[2] !== null).map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p[0] as number)},${cy(p[2] as number)}`).join(' ');
  const maxQ = data.queues[q === 'small' ? 0 : 1];
  const barW = 560;
  const scaleMax = Math.max(BDP + maxQ, 1) * 1.0;
  const bw = (b: number) => (b / scaleMax) * barW;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="queue">
          {(['small', 'big'] as Q[]).map((s) => (
            <button key={s} type="button" aria-pressed={q === s} onClick={() => pick(s)}>{T.scen[s]}</button>
          ))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.cw }, { cls: 'bad', text: T.queue }, { cls: 'same', text: T.wire }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 572" role="img" aria-label={T.title}>
          <text x={X0} y={74} className="ib-layer">{T.cw}</text>
          <path className="ib-line" d={`M${X0},${cy(0)} L${X1},${cy(0)}`} />
          {[0, 1, 2, 3].map((s) => (<g key={s}><path className="ib-line" d={`M${px(s)},${cy(0)} l0,6`} /><text x={px(s)} y={cy(0) + 22} textAnchor="middle" className="ib-s">{s} {s === 3 ? T.sec : ''}</text></g>))}
          {(q === 'small' ? [0, 20, 40, 60] : [0, 200, 400, 600, 800]).map((v) => (<g key={v}><path className="ib-line" d={`M${X0 - 6},${cy(v)} l6,0`} /><text x={X0 - 10} y={cy(v) + 5} textAnchor="end" className="ib-s">{v}</text></g>))}
          <path d={path(1, cy)} fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 3.5, strokeLinejoin: 'round' }} />
          <path d={thrPath} fill="none" style={{ stroke: 'var(--ib-bad)', strokeWidth: 2.5, strokeDasharray: '7 5' }} />
          <text x={X1} y={cy(cmax) + 14} textAnchor="end" className="ib-s" style={{ fill: 'var(--ib-bad)', fontWeight: 700 }}>- - {T.thr}</text>
          <path className="ib-arrow" d={`M${px(sNow)},${cy(cmax) - 6} L${px(sNow)},${ry(0) + 4}`} style={{ strokeDasharray: '6 5', strokeWidth: 2, opacity: 0.55 }} />
          <g>
            <rect className="nw-cell" x={X1 - 230} y={62} width={230} height={32} rx={8} />
            <text x={X1 - 218} y={83} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.now}: cwnd {cwnd} {T.seg}</text>
          </g>

          <text x={X0} y={262} className="ib-layer">{T.flight}: {Math.round(inflight / 1000)} KB</text>
          <rect className="nw-cell" x={X0} y={272} width={barW} height={30} rx={6} />
          <rect className="nw-cell ok" x={X0} y={272} width={Math.max(0, bw(wireBytes))} height={30} rx={6} />
          <rect className="nw-cell bad" x={X0 + bw(wireBytes)} y={272} width={Math.max(0, bw(queueBytes))} height={30} rx={6} />
          <text x={X0} y={326} className="ib-s">{T.wire}: {(BDP / 1000).toFixed(0)} KB · {T.queue}: {Math.round(queueBytes / 1000)} KB</text>

          <text x={X0} y={366} className="ib-layer">{T.rtt}</text>
          <path className="ib-line" d={`M${X0},${ry(0)} L${X1},${ry(0)}`} />
          {(q === 'small' ? [20, 40, 60] : [20, 300, 600]).map((v) => (<g key={v}><path className="ib-line" d={`M${X0 - 6},${ry(v)} l6,0`} /><text x={X0 - 10} y={ry(v) + 5} textAnchor="end" className="ib-s">{v}</text></g>))}
          <path d={path(3, ry)} fill="none" style={{ stroke: 'var(--ib-bad)', strokeWidth: 3.5, strokeLinejoin: 'round' }} />
          <Banner y={512} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
