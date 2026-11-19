import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, Dev } from './nw';
import data from './tcpRel.json';

// Shows:      the receive window of a receiver that does not read for two seconds, as a line over time, and under it what the sender does. The window shrinks while data piles up in the
//             receiver's buffer, reaches 0, the sender stops and only sends tiny probes that are further apart each time, and the moment the receiver starts reading the window opens and the sender continues.
// Because:    flow control is a feedback loop between two sides, which is a story about a number that changes with time. A line chart of the window and a lane of what the sender does show the cause
//             (the window) next to the effect (the sender stops) at the same moment.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: the window is the receiver telling the sender how much room it has left; at 0 the sender must stop, and it finds out about new room from the window in an ACK or from its own probes.
//
// The window values, the moment it reached 0 (about 140 ms), the probes (about 396, 892 and 1856 ms) and the reopening (about 2033 ms) are real: exercises/08_tcp_reliability.py (tcpRel.json).
// The receiver's buffer was set to 8 KB on purpose, and the program slept for 2 seconds before its first read.

const D = 14;
const MS_END = 2300;
const SPEED = MS_END / 12.5; // ms per animation second
const T0 = 0.6;
const X0 = 70, X1 = 840;
const px = (ms: number) => X0 + (ms / MS_END) * (X1 - X0);
const WMAX = 8688;
const win = data.zero.win as [number, number][];
const wy = (w: number) => 250 - (w / WMAX) * 110;

type T = { title: string; caption: string; chart: string; sender: string; send: string; stop: string; probe: string; now: string; bytes: string; ms: string; marks: Mark[]; ready: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูหน้าต่างรับ (Window) ของผู้รับที่ไม่ยอมอ่านข้อมูล ค่อย ๆ ลดจนเป็น 0 ทำให้ผู้ส่งหยุด และกลับมาส่งต่อทันทีที่ผู้รับเริ่มอ่าน',
    caption: 'ค่า Window จุดที่เป็น 0 (ราว 140 มิลลิวินาที) Probe ที่ 396, 892 และ 1856 มิลลิวินาที และจุดที่ Window เปิดอีกครั้ง (ราว 2033 มิลลิวินาที) เป็นผลจริงของแบบฝึก 08 โดยผู้รับตั้ง Buffer ไว้ 8 KB และโปรแกรมของผู้รับหยุดนอน 2 วินาทีก่อนอ่านครั้งแรก',
    chart: 'Window ที่ผู้รับประกาศ (ไบต์)', sender: 'ผู้ส่งทำอะไร', send: 'ส่งข้อมูล', stop: 'หยุด Window เป็น 0', probe: 'Probe', now: 'ตอนนี้', bytes: 'ไบต์', ms: 'มิลลิวินาที', ready: 'ส่งต่อ',
    marks: [
      { at: T0, name: 'ส่งไป', title: 'ผู้ส่งส่งได้เต็มความเร็ว', text: 'Window ตอนต้นคือ 7,240 ไบต์ ผู้ส่งส่งข้อมูลเข้าไปเรื่อย ๆ แต่โปรแกรมของผู้รับยังไม่เรียก recv จึงไม่มีใครเอาข้อมูลออกจาก Buffer' },
      { at: T0 + 137 / SPEED, name: 'Buffer เต็ม', title: 'Window ลดเหลือ 0', text: 'ข้อมูลที่รับมาแต่ยังไม่ถูกอ่านกินพื้นที่ Buffer จน Window ที่ผู้รับประกาศใน ACK ลดลงทีละขั้น (7,240, 5,792, 2,896) แล้วเหลือ 0 ที่ราว 140 มิลลิวินาที ผู้ส่งต้องหยุดส่งข้อมูล' },
      { at: T0 + 396 / SPEED, name: 'Probe', title: 'ผู้ส่งส่ง Probe เบา ๆ เพื่อถามว่าว่างหรือยัง', text: 'ผู้ส่งไม่รอเฉย ๆ เพราะถ้า ACK ที่บอกว่า Window เปิดแล้วหายไป ทั้งสองฝั่งจะรอกันตลอดไป มันจึงส่ง Segment เปล่า ๆ ไปถามเป็นระยะ ห่างกันขึ้นเรื่อย ๆ (ราว 0.5 วินาที แล้ว 1 วินาที) ผู้รับตอบด้วย Window 0 เหมือนเดิม' },
      { at: T0 + 2033 / SPEED, name: 'เปิดอีกครั้ง', title: 'ผู้รับเริ่มอ่าน Window เปิด', text: 'หลังผ่านไป 2 วินาที โปรแกรมของผู้รับเริ่มอ่าน Buffer ว่างขึ้น ผู้รับส่ง ACK ที่ประกาศ Window ใหม่ (7,240) และผู้ส่งส่งข้อมูลชุดใหม่ออกไปภายในไม่กี่มิลลิวินาที' },
    ],
  },
  en: {
    title: 'Press play and watch the receive window of a receiver that does not read shrink to 0, making the sender stop, and open again the moment the receiver starts to read',
    caption: 'The window values, the point where it reaches 0 (about 140 milliseconds), the probes at 396, 892 and 1856 milliseconds and the reopening (about 2033 milliseconds) are the real results of exercise 08. The receiver\'s buffer was set to 8 KB and its program slept for 2 seconds before the first read.',
    chart: 'window the receiver announces (bytes)', sender: 'what the sender does', send: 'sending data', stop: 'stopped, window is 0', probe: 'probe', now: 'now', bytes: 'bytes', ms: 'ms', ready: 'sending again',
    marks: [
      { at: T0, name: 'Sending', title: 'The sender can go at full speed', text: 'The window at the start is 7,240 bytes. The sender pushes data in, but the receiver\'s program has not called recv yet, so nobody takes data out of the buffer.' },
      { at: T0 + 137 / SPEED, name: 'Buffer full', title: 'The window falls to 0', text: 'Data that arrived and was not yet read takes up the buffer, so the window announced in the ACKs falls step by step (7,240, 5,792, 2,896) and reaches 0 at about 140 milliseconds. The sender has to stop sending data.' },
      { at: T0 + 396 / SPEED, name: 'Probe', title: 'The sender sends light probes to ask whether there is room yet', text: 'The sender does not just wait, because if the ACK that says the window has opened were lost, both sides would wait for ever. So it sends an empty segment now and then, with growing gaps (about 0.5 seconds, then 1 second). The receiver answers with window 0 as before.' },
      { at: T0 + 2033 / SPEED, name: 'Open again', title: 'The receiver starts to read and the window opens', text: 'After 2 seconds the receiver\'s program starts to read and the buffer has room. The receiver sends an ACK announcing the new window (7,240), and the sender sends a new burst within a few milliseconds.' },
    ],
  },
};

export default function WindowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const ms = Math.max(0, Math.min(MS_END, (t - T0) * SPEED));
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const pts = win.filter(([m]) => m <= ms);
  let d = '';
  let last = win[0][1];
  pts.forEach(([m, w], i) => { d += i === 0 ? `M${px(m)},${wy(w)}` : ` L${px(m)},${wy(last)} L${px(m)},${wy(w)}`; last = w; });
  if (pts.length) d += ` L${px(ms)},${wy(last)}`;
  const curW = pts.length ? pts[pts.length - 1][1] : win[0][1];
  const { zeroAt, reopen, probes } = data.zero as { zeroAt: number; reopen: number; probes: number[] };
  const stopped = ms >= zeroAt && ms < reopen;
  const laneY = 310;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'same', text: T.send }, { cls: 'bad', text: T.stop }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 646" role="img" aria-label={T.title}>
          {(() => {
            const th = lang === 'th';
            const used = (WMAX - curW) / WMAX;
            const TX0 = 520, TY0 = 84, TW = 330, TH = 150;
            const flowing = curW > 0;
            const phase = (ms / 45) % 1;
            return (
              <g>
                <Dev x={30} y={TY0 + 38} w={190} kind="host" title={th ? 'ผู้ส่ง' : 'Sender'} hot={flowing} />
                <path d={`M220,${TY0 + 75} L${TX0},${TY0 + 75}`} className="nw-wire" />
                {flowing && [0, 1, 2, 3, 4].map((i) => (<rect key={i} x={240 + ((i + phase) / 5) * 250} y={TY0 + 66} width={22} height={18} rx={4} className="nw-l4" />))}
                {!flowing && !probes.some((p) => Math.abs(p - ms) < 40) && <text x={370} y={TY0 + 66} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{th ? 'หยุดส่ง ✗' : 'stopped ✗'}</text>}
                {!flowing && probes.some((p) => Math.abs(p - ms) < 40) && <rect x={370} y={TY0 + 70} width={10} height={10} rx={2} style={{ fill: 'var(--ib-bad)' }} />}
                <rect className="nw-cell" x={TX0} y={TY0} width={TW} height={TH} rx={14} />
                <rect className={curW === 0 ? 'nw-cell bad' : 'nw-cell ok'} x={TX0 + 8} y={TY0 + TH - 8 - used * (TH - 16)} width={TW - 16} height={Math.max(0, used * (TH - 16))} rx={8} />
                <text x={TX0 + 14} y={TY0 - 10} className="ib-layer">{th ? 'Buffer ของผู้รับ' : 'Receive buffer'}</text>
                <text x={TX0 + TW / 2} y={TY0 + 28} textAnchor="middle" className="ib-n" style={{ fontSize: 18, fill: 'var(--fg)' }}>{th ? 'ที่ว่างเหลือ (Window)' : 'free space (window)'}</text>
                <text x={TX0 + TW / 2} y={TY0 + 88} textAnchor="middle" style={{ fontSize: 40, fontWeight: 700, fill: curW === 0 ? 'var(--ib-bad)' : 'var(--fg)' }}>{curW.toLocaleString('en-US')}</text>
                <text x={TX0 + TW / 2} y={TY0 + 130} textAnchor="middle" className="ib-s">{T.bytes}</text>
                <text x={TX0 + TW / 2} y={TY0 + TH + 20} textAnchor="middle" className="ib-s">{th ? 'ส่วนที่ระบายสี = ข้อมูลที่ค้างอยู่ใน Buffer' : 'the coloured part = data waiting in the buffer'}</text>
                {ms >= reopen && ms < reopen + 700 && <text x={TX0 + TW / 2} y={TY0 + TH + 44} textAnchor="middle" className="ib-n" style={{ fill: 'var(--k2)' }}>{th ? 'โปรแกรมผู้รับอ่านข้อมูลออกแล้ว ที่ว่างกลับมา' : 'the receiving program read the data, space is back'}</text>}
              </g>
            );
          })()}
          <g transform="translate(0,200)">
          <text x={X0} y={96} className="ib-layer">{T.chart}</text>
          <path className="ib-line" d={`M${X0},${wy(0)} L${X1},${wy(0)}`} />
          {[0, 4344, 8688].map((w) => (<g key={w}><path className="ib-line" d={`M${X0 - 6},${wy(w)} L${X0},${wy(w)}`} /><text x={X0 - 10} y={wy(w) + 5} textAnchor="end" className="ib-s">{w.toLocaleString('en-US')}</text></g>))}
          <path d={d} fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 4, strokeLinejoin: 'round' }} />
          <text x={X0} y={laneY - 16} className="ib-layer">{T.sender}</text>
          <rect x={px(0)} y={laneY} width={px(Math.min(ms, zeroAt)) - px(0)} height={34} rx={6} className="nw-cell ok" />
          {ms >= zeroAt && <rect x={px(zeroAt)} y={laneY} width={px(Math.min(ms, reopen)) - px(zeroAt)} height={34} rx={6} className="nw-cell bad" />}
          {stopped && ms > zeroAt + 400 && <text x={(px(zeroAt) + px(Math.min(ms, reopen))) / 2} y={laneY + 22} textAnchor="middle" className="ib-s" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.stop}</text>}
          {probes.filter((p) => p <= ms).map((p) => (<g key={p}><path d={`M${px(p)},${laneY + 34} l-8,14 h16 z`} style={{ fill: 'var(--ib-bad)' }} /><text x={px(p)} y={laneY + 70} textAnchor="middle" className="ib-s">{p} {T.ms}</text></g>))}
          {ms >= reopen && <rect x={px(reopen)} y={laneY} width={px(ms) - px(reopen)} height={34} rx={6} className="nw-cell ok" />}
          {ms >= reopen + 150 && <text x={px(reopen) - 8} y={laneY + 22} textAnchor="end" className="ib-s" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.ready}</text>}
          <path className="ib-arrow" d={`M${px(ms)},${wy(WMAX) - 6} L${px(ms)},${laneY + 40}`} style={{ strokeDasharray: '6 5', strokeWidth: 2.5, opacity: 0.6 }} />
          <g>
            <rect className="nw-cell" x={X1 - 220} y={78} width={220} height={62} rx={10} />
            <text x={X1 - 208} y={98} className="ib-s">{T.now}: {Math.round(ms)} {T.ms}</text>
            <text x={X1 - 208} y={129} className="ib-n" style={{ fontSize: 20, fill: curW === 0 ? 'var(--ib-bad)' : 'var(--fg)' }}>{curW.toLocaleString('en-US')} {T.bytes}</text>
          </g>
          </g>
          <Banner y={594} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
