import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, ease, mix } from './nw';
import data from './sockets.json';

// Shows:      three writes of 5 bytes ('aaaaa', 'bbbbb', 'ccccc') leaving a program, travelling as three segments, and landing in the receiver's buffer as one run of 15 bytes. The receiver then reads
//             it, either with recv(100), which returns all 15 at once, or with recv(4), which returns 4, 4, 4 and 3 bytes and cuts straight through the middle of the messages.
// Because:    "TCP has no message boundaries" is a statement about what disappears between the writes and the reads. Only a picture of the three writes next to the reads shows that the number of writes
//             and the number of reads have nothing to do with each other.
// Control:    the switch recv(100) / recv(4) (each one changes the brackets drawn over the buffer), plus play, the scrub bar and the jump buttons (the clock).
// Conclusion: a TCP socket gives a stream of bytes. Messages must be framed by the program (a length or a delimiter), because a read can return any piece.
//
// The writes (5, 5, 5), the segments on the wire (5, 5, 5), the read sizes ([15] and [4, 4, 4, 3]) and the letters are the real results of exercises/10_sockets.py (sockets.json).

type Mode = 'big' | 'small';
const D = 14;
const CELL = 38;
const BX = 90;
const letters = data.stream.chunks[0].split('');

type T = { title: string; caption: string; mode: Record<Mode, string>; sender: string; wire: string; buffer: string; reads: string; write: string; seg: string; read: string; marks: Record<Mode, Mark[]>; legendA: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือกวิธีอ่านแล้วกดเล่น ดูข้อมูลที่เขียนสามครั้ง กลายเป็นสายไบต์ก้อนเดียวที่ผู้รับตัดอ่านตรงไหนก็ได้',
    caption: 'ขนาดการเขียน (5 ไบต์สามครั้ง) ขนาด Segment บนสาย (5, 5, 5) และขนาดที่อ่านได้ (15 หรือ 4, 4, 4, 3) เป็นผลจริงของแบบฝึก 10 ผู้ส่งตั้ง TCP_NODELAY ไว้ จึงเห็นเป็นสาม Segment บนสาย',
    mode: { big: 'recv(100)', small: 'recv(4)' }, sender: 'โปรแกรมผู้ส่ง: write', wire: 'บนสาย: Segment', buffer: 'Buffer ของ Socket ฝั่งผู้รับ', reads: 'โปรแกรมผู้รับ: recv', write: 'write', seg: 'Segment', read: 'recv', legendA: 'ข้อความที่เขียนครั้งที่ 1',
    marks: {
      big: [
        { at: 1, name: 'เขียนสามครั้ง', title: 'โปรแกรมเขียน 5 ไบต์สามครั้ง ห่างกัน 1 มิลลิวินาที', text: 'ทั้งสามครั้งเรียก sendall แยกกัน และบน Linux เครื่องนี้เราตั้ง TCP_NODELAY ไว้ จึงออกสายเป็นสาม Segment ขนาด 5 ไบต์ ตามที่จับได้' },
        { at: 5, name: 'รวมใน Buffer', title: 'ไบต์ต่อกันเป็นสายเดียวใน Buffer ฝั่งผู้รับ', text: 'Segment ทั้งสามถึง และ Kernel ของผู้รับต่อไบต์ไว้ใน Buffer ของ Socket เป็น aaaaabbbbbccccc ตรงนี้ขอบเขตของการเขียนแต่ละครั้งหายไปแล้ว' },
        { at: 9, name: 'อ่านครั้งเดียว', title: 'recv(100) ได้ทั้ง 15 ไบต์ในครั้งเดียว', text: 'ผู้รับหลับไป 0.6 วินาทีก่อนอ่าน พอเรียก recv(100) ได้ทุกอย่างที่อยู่ใน Buffer ทันที ซึ่งคือ 15 ไบต์ โปรแกรมที่คิดว่า "การอ่านหนึ่งครั้งเท่ากับข้อความหนึ่งอัน" จะเข้าใจผิดตรงนี้' },
      ],
      small: [
        { at: 1, name: 'เขียนสามครั้ง', title: 'โปรแกรมเขียน 5 ไบต์สามครั้ง ห่างกัน 1 มิลลิวินาที', text: 'ทั้งสามครั้งเรียก sendall แยกกัน และบน Linux เครื่องนี้เราตั้ง TCP_NODELAY ไว้ จึงออกสายเป็นสาม Segment ขนาด 5 ไบต์ ตามที่จับได้' },
        { at: 5, name: 'รวมใน Buffer', title: 'ไบต์ต่อกันเป็นสายเดียวใน Buffer ฝั่งผู้รับ', text: 'Segment ทั้งสามถึง และ Kernel ของผู้รับต่อไบต์ไว้ใน Buffer ของ Socket เป็น aaaaabbbbbccccc ตรงนี้ขอบเขตของการเขียนแต่ละครั้งหายไปแล้ว' },
        { at: 8.5, name: 'อ่านทีละ 4', title: 'recv(4) ได้ 4, 4, 4 แล้ว 3 ไบต์', text: 'การอ่านครั้งที่สองได้ "abbb" ซึ่งคือไบต์สุดท้ายของข้อความแรก (a) ต่อด้วยสามไบต์แรกของข้อความที่สอง และครั้งที่สามได้ "bbcc" ข้อความถูกตัดผ่ากลางตามขนาดที่ผู้รับขอ ไม่เกี่ยวกับที่ผู้ส่งเขียน ผู้ส่งเขียนสามครั้ง ผู้รับอ่านสี่ครั้ง' },
      ],
    },
  },
  en: {
    title: 'Pick how to read and press play, and see three writes become a single run of bytes that the receiver can cut anywhere',
    caption: 'The sizes of the writes (three of 5 bytes), the segments on the wire (5, 5, 5) and the reads (15, or 4, 4, 4, 3) are the real results of exercise 10. The sender set TCP_NODELAY, which is why there are three segments on the wire.',
    mode: { big: 'recv(100)', small: 'recv(4)' }, sender: 'the sender program: write', wire: 'on the wire: segments', buffer: 'the receiving socket\'s buffer', reads: 'the receiving program: recv', write: 'write', seg: 'segment', read: 'recv', legendA: 'the message of write 1',
    marks: {
      big: [
        { at: 1, name: 'Three writes', title: 'The program writes 5 bytes three times, 1 millisecond apart', text: 'Each time it calls sendall separately, and on this Linux we set TCP_NODELAY, so they leave as three segments of 5 bytes, as captured.' },
        { at: 5, name: 'Joined in the buffer', title: 'The bytes join into one run in the receiver\'s buffer', text: 'The three segments arrive, and the receiver\'s kernel keeps the bytes in the socket buffer as aaaaabbbbbccccc. At this point the boundary between the writes has gone.' },
        { at: 9, name: 'One read', title: 'recv(100) returns all 15 bytes at once', text: 'The receiver slept for 0.6 seconds before reading. When it calls recv(100) it gets everything in the buffer at once, 15 bytes. A program that thinks "one read is one message" is mistaken here.' },
      ],
      small: [
        { at: 1, name: 'Three writes', title: 'The program writes 5 bytes three times, 1 millisecond apart', text: 'Each time it calls sendall separately, and on this Linux we set TCP_NODELAY, so they leave as three segments of 5 bytes, as captured.' },
        { at: 5, name: 'Joined in the buffer', title: 'The bytes join into one run in the receiver\'s buffer', text: 'The three segments arrive, and the receiver\'s kernel keeps the bytes in the socket buffer as aaaaabbbbbccccc. At this point the boundary between the writes has gone.' },
        { at: 8.5, name: 'Read 4 at a time', title: 'recv(4) returns 4, 4, 4 and then 3 bytes', text: 'The second read gets "abbb", the last byte of the first message (a) followed by the first three bytes of the second, and the third gets "bbcc". The messages are cut through the middle by the size the receiver asked for, not by what the sender wrote. The sender wrote three times and the receiver read four times.' },
      ],
    },
  },
};

export default function StreamLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('big');
  const clock = useClock(D);
  const { t } = clock;
  const marks = T.marks[mode];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const pick = (m: Mode) => { setMode(m); clock.restart(); };
  const reads = mode === 'big' ? data.stream.reads : data.stream.small;
  const starts = reads.map((_, i) => reads.slice(0, i).reduce((x, y) => x + y, 0));
  const readAt = (i: number) => (mode === 'big' ? 9 : 8.5 + i * 1.6);
  const wy = 96, sy = 196, by = 292, ry = 384;
  const colorOf = (i: number) => ['nw-l3', 'nw-l4', 'nw-app'][Math.floor(i / 5)];
  const arrived = (k: number) => t >= 3 + k * 0.6;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="recv">
          {(['big', 'small'] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pick(m)}>{T.mode[m]}</button>
          ))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'l3', text: 'aaaaa' }, { cls: 'l4', text: 'bbbbb' }, { cls: 'app', text: 'ccccc' }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={20} y={wy - 22} className="ib-layer">{T.sender}</text>
          {[0, 1, 2].map((k) => t >= 1 + k * 0.5 && (
            <g key={k} style={{ opacity: ease(t, 1 + k * 0.5, 1.4 + k * 0.5) }}>
              <rect className={['nw-l3', 'nw-l4', 'nw-app'][k]} x={BX + k * 190} y={wy - 14} width={170} height={36} rx={7} />
              <text x={BX + k * 190 + 85} y={wy + 10} className="nw-txt">{T.write} {k + 1}: {['aaaaa', 'bbbbb', 'ccccc'][k]}</text>
            </g>
          ))}
          <text x={20} y={sy - 22} className="ib-layer">{T.wire}</text>
          {[0, 1, 2].map((k) => {
            const p = ease(t, 2 + k * 0.5, 3.4 + k * 0.5);
            const cx = mix(BX + k * 190 + 85, BX + 300, p);
            return p > 0.01 && p < 0.99 && (
              <g key={k}>
                <rect className={['nw-l3', 'nw-l4', 'nw-app'][k]} x={cx - 62} y={sy - 12} width={124} height={34} rx={7} />
                <text x={cx} y={sy + 10} textAnchor="middle" className="nw-txt">{T.seg} {k + 1}: 5 B</text>
              </g>
            );
          })}
          <text x={20} y={by - 22} className="ib-layer">{T.buffer}</text>
          {letters.map((ch, i) => (
            <g key={i} style={{ opacity: arrived(Math.floor(i / 5)) ? 1 : 0.12 }}>
              <rect className={colorOf(i)} x={BX + i * CELL} y={by - 12} width={CELL - 3} height={38} rx={5} />
              <text x={BX + i * CELL + (CELL - 3) / 2} y={by + 13} className="nw-txt" style={{ fontSize: 17 }}>{ch}</text>
            </g>
          ))}
          <text x={20} y={ry - 30} className="ib-layer">{T.reads}</text>
          {reads.map((n, i) => t >= readAt(i) && (
            <g key={i} style={{ opacity: ease(t, readAt(i), readAt(i) + 0.5) }}>
              <rect x={BX + starts[i] * CELL - 2} y={by - 18} width={n * CELL - 1} height={50} rx={9} className="ib-sel" style={{ stroke: 'var(--ib-bad)', strokeWidth: 3.5 }} />
              <path className="ib-line" d={`M${BX + starts[i] * CELL + (n * CELL) / 2},${by + 34} L${BX + starts[i] * CELL + (n * CELL) / 2},${ry - 4}`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 2.5 }} />
              <rect className="nw-cell bad" x={BX + starts[i] * CELL + (n * CELL) / 2 - 56} y={ry - 2} width={112} height={32} rx={8} />
              <text x={BX + starts[i] * CELL + (n * CELL) / 2} y={ry + 19} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 13 }}>{T.read} {i + 1}: {n} B</text>
            </g>
          ))}
          <Banner y={424} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
