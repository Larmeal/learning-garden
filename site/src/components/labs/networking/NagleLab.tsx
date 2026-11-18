import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, ease } from './nw';
import data from './tcpRel.json';

// Shows:      five small writes of 10 bytes from a program, 1 ms apart, on a time axis, and below them the segments that TCP really puts on the wire. With Nagle (the default) the first
//             write goes out alone and the other four wait until the ACK of the first one is back, then leave as one segment of 40 bytes. With TCP_NODELAY every write is its own segment.
// Because:    Nagle is a rule about WAITING for an ACK, and the cost of not waiting is the 66 bytes of headers on every small segment. A time axis shows the wait and a counter shows the cost.
// Control:    the switch Nagle on / TCP_NODELAY (each one changes the segments drawn and the counters), plus the clock.
// Conclusion: Nagle trades a delay of up to one round trip for fewer packets; a program that cannot accept the delay (a game, a prompt) turns it off, at the price of more headers.
//
// The segment sizes ([10, 40] and [10, 10, 10, 10, 10]) and the 20 ms between the two segments with Nagle are real: exercises/08_tcp_reliability.py (tcpRel.json). The header of 66 bytes is
// 14 (Ethernet) + 20 (IP) + 32 (TCP with timestamps), measured in lesson 1.

type Mode = 'nagle' | 'nodelay';
const D = 14;
const HDR = 66;
const X0 = 60, X1 = 840;
const MS = 24; // ms shown on the axis
const px = (ms: number) => X0 + (ms / MS) * (X1 - X0);
const T0 = 1, K = 0.4; // animation seconds = T0 + ms * K

type T = { title: string; caption: string; mode: Record<Mode, string>; writes: string; wire: string; seg: string; wait: string; segs: string; bytes: string; hdr: string; ack: string; ms: string; marks: Record<Mode, Mark[]> };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือก Nagle หรือ TCP_NODELAY แล้วกดเล่น ดูโปรแกรมเขียนข้อมูลเล็ก ๆ ห้าครั้ง แล้ว TCP ส่งออกสายกี่ Segment',
    caption: 'ขนาด Segment (10 กับ 40 ไบต์ เทียบกับ 10 ไบต์ห้าอัน) และช่วงห่าง 20 มิลลิวินาทีของ Nagle มาจากแบบฝึก 08 ส่วน Header 66 ไบต์ต่อ Segment คือ 14 + 20 + 32 ที่เราวัดได้ในบท 1',
    mode: { nagle: 'Nagle (ค่าเริ่มต้น)', nodelay: 'TCP_NODELAY' }, writes: 'โปรแกรมเขียน (ครั้งละ 10 ไบต์)', wire: 'Segment ที่ออกสายจริง', seg: 'Segment', wait: 'รอ ACK ของตัวแรก', segs: 'Segment ที่ส่ง', bytes: 'ข้อมูล', hdr: 'Header รวม', ack: 'ACK', ms: 'มิลลิวินาที',
    marks: {
      nagle: [
        { at: T0, name: 'เขียนห้าครั้ง', title: 'โปรแกรมเขียน 10 ไบต์ ห้าครั้งติดกัน', text: 'เขียนทุก 1 มิลลิวินาที ครั้งแรกไม่มี Segment ค้างอยู่ จึงออกสายทันที' },
        { at: T0 + 4 * K + 0.3, name: 'ตัวอื่นต้องรอ', title: 'อีกสี่ครั้งรอ ACK ของตัวแรก', text: 'กฎของ Nagle คือถ้ายังมีข้อมูลที่ส่งไปแล้วและยังไม่ได้ ACK ข้อมูลเล็กที่เหลือให้รอรวมกันก่อน ตอนนี้ TCP เก็บ 40 ไบต์ไว้ที่ผู้ส่ง' },
        { at: T0 + 20 * K, name: 'ACK กลับมา', title: 'ACK มาถึง แล้วส่ง 40 ไบต์ในก้อนเดียว', text: 'หลังหนึ่งรอบเวลา (20 มิลลิวินาที) ACK ตัวแรกกลับมา TCP ส่งที่เก็บไว้ทั้ง 40 ไบต์ออกไปใน Segment เดียว รวมสองตัว ใช้ Header 66 ไบต์สองชุด' },
      ],
      nodelay: [
        { at: T0, name: 'เขียนห้าครั้ง', title: 'เปิด TCP_NODELAY: ทุกการเขียนออกสายทันที', text: 'โปรแกรมบอก TCP ว่าไม่ต้องรอ ทุก 10 ไบต์จึงกลายเป็นหนึ่ง Segment ภายใน 1 มิลลิวินาทีหลังเขียน' },
        { at: T0 + 12 * K, name: 'ACK ทีละตัว', title: 'ผู้รับตอบ ACK ทีละ Segment', text: 'ห้า Segment ได้ ACK ห้าอัน การไม่รอทำให้ข้อมูลไปถึงเร็วกว่า แต่ทุก 10 ไบต์ต้องแบก Header 66 ไบต์ไปด้วย ข้อมูลจริงเป็นสัดส่วนแค่ราว 13% ของที่ส่ง' },
      ],
    },
  },
  en: {
    title: 'Pick Nagle or TCP_NODELAY and press play, and see how many segments TCP puts on the wire when a program writes small pieces five times',
    caption: 'The segment sizes (10 and 40 bytes, against five of 10 bytes) and the 20 millisecond gap with Nagle come from exercise 08. The header of 66 bytes per segment is 14 + 20 + 32, as we measured in lesson 1.',
    mode: { nagle: 'Nagle (the default)', nodelay: 'TCP_NODELAY' }, writes: 'the program writes (10 bytes each)', wire: 'the segments really on the wire', seg: 'segment', wait: 'waiting for the ACK of the first', segs: 'segments sent', bytes: 'data', hdr: 'headers', ack: 'ACK', ms: 'ms',
    marks: {
      nagle: [
        { at: T0, name: 'Five writes', title: 'The program writes 10 bytes five times in a row', text: 'It writes every 1 millisecond. For the first write nothing is waiting, so it leaves at once.' },
        { at: T0 + 4 * K + 0.3, name: 'The rest wait', title: 'The other four wait for the ACK of the first', text: 'Nagle\'s rule: if data has been sent and not yet acknowledged, the small data that follows has to wait and be joined together. TCP now keeps 40 bytes at the sender.' },
        { at: T0 + 20 * K, name: 'ACK is back', title: 'The ACK arrives and the 40 bytes go in one block', text: 'After one round trip (20 milliseconds) the ACK of the first returns, and TCP sends the 40 bytes it kept in a single segment. Two segments in all, with two sets of 66-byte headers.' },
      ],
      nodelay: [
        { at: T0, name: 'Five writes', title: 'TCP_NODELAY is on: every write leaves at once', text: 'The program tells TCP not to wait, so every 10 bytes become one segment within a millisecond of being written.' },
        { at: T0 + 12 * K, name: 'One ACK each', title: 'The receiver acknowledges each segment', text: 'Five segments get five ACKs. Not waiting gets the data there sooner, but every 10 bytes carry 66 bytes of headers with them. The real data is only about 13% of what is sent.' },
      ],
    },
  },
};

export default function NagleLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('nagle');
  const clock = useClock(D);
  const { t } = clock;
  const marks = T.marks[mode];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const pick = (m: Mode) => { setMode(m); clock.restart(); };

  const sizes = mode === 'nagle' ? data.nagle.on : data.nagle.off;
  const sendMs = mode === 'nagle' ? [0, data.nagle.gap] : [0, 1.1, 2.2, 3.3, 4.4];
  const ackMs = mode === 'nagle' ? [10 + 0, data.nagle.gap + 10] : [10, 11.1, 12.2, 13.3, 14.4];
  const writeMs = [0, 1, 2, 3, 4];
  const seen = (ms: number) => t >= T0 + ms * K;
  const sentSegs = sizes.filter((_, i) => seen(sendMs[i])).length;
  const sentBytes = sizes.filter((_, i) => seen(sendMs[i])).reduce((a, b) => a + b, 0);
  const wy = 130, sy = 270;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="mode">
          {(['nagle', 'nodelay'] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pick(m)}>{T.mode[m]}</button>
          ))}
        </div>
      </div>
      <Legend layers={['l4', 'app']} lang={lang} extra={[{ cls: 'same', text: T.ack }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={X0} y={wy - 36} className="ib-layer">{T.writes}</text>
          <path className="ib-line" d={`M${X0},${wy + 20} L${X1},${wy + 20}`} />
          {[0, 5, 10, 15, 20].map((ms) => (<g key={ms}><path className="ib-line" d={`M${px(ms)},${wy + 14} L${px(ms)},${wy + 26}`} /><text x={px(ms)} y={wy + 44} textAnchor="middle" className="ib-s">{ms} {ms === 20 ? T.ms : ''}</text></g>))}
          {writeMs.map((ms, i) => seen(ms) && (<g key={i}><circle cx={px(ms)} cy={wy - 8} r={9} className="nw-app" /><text x={px(ms)} y={wy - 4} className="nw-txt" style={{ fontSize: 11 }}>10</text></g>))}
          <text x={X0} y={sy - 36} className="ib-layer">{T.wire}</text>
          <path className="ib-line" d={`M${X0},${sy + 20} L${X1},${sy + 20}`} />
          {mode === 'nagle' && t >= T0 + 4 * K && t < T0 + 20 * K && (
            <g>
              <rect className="nw-cell bad" x={px(0.6)} y={sy - 12} width={px(data.nagle.gap - 0.6) - px(0.6)} height={26} rx={7} />
              <text x={(px(0.6) + px(data.nagle.gap - 0.6)) / 2} y={sy + 6} textAnchor="middle" className="ib-s" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.wait} (40 {T.bytes})</text>
            </g>
          )}
          {sizes.map((sz, i) => seen(sendMs[i]) && (
            <g key={i}>
              <rect className="nw-pk data" x={px(sendMs[i]) - (sz > 10 ? 36 : 10)} y={sy - 12} width={sz > 10 ? 72 : 20} height={26} rx={6} style={{ opacity: ease(t, T0 + sendMs[i] * K, T0 + sendMs[i] * K + 0.3) }} />
              <text x={px(sendMs[i])} y={sy + 6} textAnchor="middle" className="ib-m" style={{ fontSize: sz > 10 ? 14 : 11, fontWeight: 700, fill: 'var(--fg)' }}>{sz}</text>
            </g>
          ))}
          {ackMs.map((ms, i) => i < sizes.length && seen(ms + 10) && (
            <g key={'a' + i}><path d={`M${px(ms + 10)},${sy + 44} l-7,-10 h14 z`} style={{ fill: 'var(--k2)' }} /></g>
          ))}
          <g>
            {[[T.segs, String(sentSegs)], [T.bytes, `${sentBytes} B`], [T.hdr, `${sentSegs * HDR} B`]].map(([l, v], i) => (
              <g key={l}>
                <rect className="nw-cell" x={60 + i * 270} y={330} width={250} height={64} rx={10} />
                <text x={74 + i * 270} y={352} className="ib-s">{l}</text>
                <text x={74 + i * 270} y={384} className="ib-n" style={{ fontSize: 24 }}>{v}</text>
              </g>
            ))}
          </g>
          <Banner y={414} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
