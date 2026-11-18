import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Lifelines, Msg, Note, Legend, ease } from './nw';
import data from './tcpConn.json';

// Shows:      the first six segments of one real TCP connection, as arrows between the client and the server, with the sequence and acknowledgement numbers on each arrow, the state of each
//             side changing (CLOSED, SYN-SENT, ESTABLISHED and LISTEN, SYN-RCVD, ESTABLISHED), and the options that the two SYN segments carry.
// Because:    the handshake is an exchange of numbers in a fixed order, and "a SYN uses up one sequence number" is only convincing when the numbers are visible on the arrows (0, then 1, then 1...).
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: three segments before any data: the first two agree on each side's starting number and options, the third lets the client send; the first byte of data leaves one round trip after the start.
//
// Every number, every flag, the time (0, 20 and 30 milliseconds) and the options come from the capture of exercises/07_tcp_connections.py (tcpConn.json). Sequence numbers are relative to each
// side's own random first number.

const D = 20;
const XS = { c: 170, s: 710 };
const START = (i: number) => 1 + 2.5 * i;
const Y = (i: number) => 92 + i * 52;
const flow = (data.flow as { t: number; dir: string; flags: string; seq: number; ack: number | null; len: number; win: number; opts: Record<string, unknown> }[]).slice(0, 6);

type T = { title: string; caption: string; client: string; server: string; opts: string; ms: string; marks: Mark[]; cState: string[]; sState: string[]; bytes: string; legendC: string; legendS: string; legendD: string; why: string[] };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Handshake สามจังหวะของ TCP ตามตัวเลข Sequence และ Acknowledgement จริง แล้วดู Request ตัวแรกที่ออกไปได้หลังจาก 1 รอบเวลา',
    caption: 'ธง ตัวเลข (นับจากเลขเริ่มต้นของแต่ละฝั่ง) ขนาด เวลา 0, 20 และ 30 มิลลิวินาที และ Option มาจาก Packet ที่จับได้จริงในแบบฝึก 07 สายถูกหน่วงไว้ทิศละ 10 มิลลิวินาที',
    client: 'Client', server: 'Server', opts: 'Option: MSS 1460 · SACK · Timestamp · Window Scale ×1024', ms: 'ms', bytes: 'ไบต์',
    cState: ['CLOSED', 'SYN-SENT', 'ESTABLISHED'], sState: ['LISTEN', 'SYN-RCVD', 'ESTABLISHED'],
    legendC: 'ควบคุมการเชื่อมต่อ (SYN)', legendS: 'ตอบรับ (ACK)', legendD: 'ข้อมูล',
    why: ['', '', '', '', '', ''],
    marks: [
      { at: START(0), name: 'SYN', title: 'SYN: ขอเปิด Connection พร้อมเลขเริ่มต้น', text: 'Client เลือกเลขเริ่มต้นของตัวเอง (สุ่ม แต่ในภาพนับเป็น 0) ส่ง SYN พร้อม Option ที่อยากใช้ คือ MSS 1460, SACK, Timestamp และ Window Scale 10 ตอนนี้ Client อยู่ในสถานะ SYN-SENT' },
      { at: START(1), name: 'SYN,ACK', title: 'SYN,ACK: ตกลง พร้อมเลขเริ่มต้นของ Server', text: 'Server ส่งเลขเริ่มต้นของตัวเอง และตอบรับด้วย ack=1 เพราะ SYN ใช้เลข Sequence ไปหนึ่งตัว จึงขอไบต์ต่อไปเป็นเลข 1 ใช้เวลา 20 มิลลิวินาที ซึ่งเป็นหนึ่งรอบเวลา' },
      { at: START(2), name: 'ACK', title: 'ACK: จบ Handshake', text: 'Client ตอบรับเลขของ Server (ack=1) ทั้งสองฝั่งอยู่ในสถานะ ESTABLISHED ข้อมูลส่งได้แล้ว ตั้งแต่ตรงนี้ Option ไม่ถูกส่งซ้ำ เหลือแค่ Timestamp ใน Header' },
      { at: START(3), name: 'ส่ง Request', title: 'ข้อมูลชุดแรก ออกไปพร้อม ACK', text: 'Request 65 ไบต์ออกไปทันที (ที่ seq=1) เป็นก้อนแรกของข้อมูลจริง ซึ่งออกได้หลังจาก 1 รอบเวลาของ Handshake นี่คือค่าใช้จ่ายของ TCP ก่อนส่งอะไรได้' },
      { at: START(4), name: 'ACK ข้อมูล', title: 'Server ตอบรับ: ack=66', text: 'ack=66 แปลว่า "ได้รับถึงไบต์ที่ 65 แล้ว ต่อไปฉันรอไบต์ที่ 66" ตัวเลข Acknowledgement คือไบต์ถัดไปที่ผู้รับต้องการเสมอ' },
      { at: START(5), name: 'Response', title: 'Server ส่ง Response 98 ไบต์', text: 'Server ตอบด้วยข้อมูล 98 ไบต์ที่ seq=1 (เลขเริ่มต้นของฝั่ง Server เริ่มนับจาก 1 เช่นกัน) และ ack=66 ที่ยังยืนยันของฝั่ง Client เหมือนเดิม' },
    ],
  },
  en: {
    title: 'Press play and watch the three-step TCP handshake with the real sequence and acknowledgement numbers, then the first request that can leave one round trip later',
    caption: 'The flags, the numbers (counted from each side\'s own first number), the sizes, the times 0, 20 and 30 milliseconds and the options come from the real capture of exercise 07. The cable is delayed 10 milliseconds each way.',
    client: 'Client', server: 'Server', opts: 'Options: MSS 1460 · SACK · Timestamp · Window Scale ×1024', ms: 'ms', bytes: 'bytes',
    cState: ['CLOSED', 'SYN-SENT', 'ESTABLISHED'], sState: ['LISTEN', 'SYN-RCVD', 'ESTABLISHED'],
    legendC: 'controls the connection (SYN)', legendS: 'acknowledgement (ACK)', legendD: 'data',
    why: ['', '', '', '', '', ''],
    marks: [
      { at: START(0), name: 'SYN', title: 'SYN: ask to open a connection, with a starting number', text: 'The client picks its own starting number (random, but counted as 0 in the picture) and sends a SYN with the options it would like: MSS 1460, SACK, timestamps and window scale 10. The client is now in the state SYN-SENT.' },
      { at: START(1), name: 'SYN,ACK', title: 'SYN,ACK: agreed, with the server\'s starting number', text: 'The server sends its own starting number and acknowledges with ack=1, because a SYN uses up one sequence number, so the next byte it wants is number 1. It took 20 milliseconds, one round trip.' },
      { at: START(2), name: 'ACK', title: 'ACK: the handshake is done', text: 'The client acknowledges the server\'s number (ack=1). Both sides are in the state ESTABLISHED and data can flow. From here the options are not repeated, only the timestamp stays in the header.' },
      { at: START(3), name: 'Request', title: 'The first data leaves with an ACK', text: 'The 65-byte request goes out at once (at seq=1), the first real data, after one round trip of handshake. That is the price of TCP before anything can be sent.' },
      { at: START(4), name: 'ACK of data', title: 'The server acknowledges: ack=66', text: 'ack=66 means "I have received up to byte 65, next I wait for byte 66". An acknowledgement number is always the next byte the receiver wants.' },
      { at: START(5), name: 'Response', title: 'The server sends a 98-byte response', text: 'The server answers with 98 bytes of data at seq=1 (the server\'s own numbering also starts from 1) and ack=66, which still confirms the client\'s side as before.' },
    ],
  },
};

const kindOf = (f: { flags: string; len: number }) => (f.len > 0 ? 'data' : f.flags.includes('SYN') ? 'ctl' : 'ack');

export default function TcpHandshakeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const arrived = (i: number) => t >= START(i) + 1.6;
  const cState = arrived(1) ? 2 : t >= START(0) + 0.2 ? 1 : 0;
  const sState = arrived(2) ? 2 : arrived(0) ? 1 : 0;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.legendD }, { cls: 'same', text: T.legendS }, { cls: 'bad', text: T.legendC }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 490" role="img" aria-label={T.title}>
          <Lifelines xs={[XS.c, XS.s]} y1={54} y2={390} names={[T.client, T.server]} />
          <Note x={XS.c - 60} y={392} w={120} text={T.cState[cState]} tone={cState === 2 ? 'ok' : undefined} />
          <Note x={XS.s - 60} y={392} w={120} text={T.sState[sState]} tone={sState === 2 ? 'ok' : undefined} />
          {flow.map((f, i) => {
            const toServer = f.dir === 'c2s';
            const p = ease(t, START(i), START(i) + 1.6);
            const label = `${f.flags}  seq=${f.seq}${f.ack !== null ? ` ack=${f.ack}` : ''}${f.len ? `  (${f.len} ${T.bytes})` : ''}`;
            return (
              <g key={i}>
                <Msg x1={toServer ? XS.c : XS.s} y1={Y(i)} x2={toServer ? XS.s : XS.c} y2={Y(i) + 22} p={p} kind={kindOf(f) === 'ctl' ? 'retx' : kindOf(f) === 'data' ? 'data' : 'ack'} n={i + 1} label={label} labelDy={-8} />
                {p > 0.9 && <text x={toServer ? XS.c - 30 : XS.s + 30} y={Y(i) + 5} textAnchor={toServer ? 'end' : 'start'} className="ib-s">{f.t} {T.ms}</text>}
              </g>
            );
          })}
          {t >= START(0) + 0.8 && <text x={XS.c + 10} y={Y(0) - 22} className="ib-s" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.opts}</text>}
          <Banner y={438} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
