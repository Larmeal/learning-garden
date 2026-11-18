import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Lifelines, Msg, Note, Legend, ease } from './nw';
import data from './tcpConn.json';

// Shows:      three endings of a TCP story side by side in one picture, chosen with a switch: (1) a normal close, with the four segments and the states of both sides, ending with the
//             server holding TIME-WAIT; (2) a connect to a port where nobody listens, answered with a reset; (3) a connect to a server that says nothing, where the same SYN is sent
//             again and again until the program gives up.
// Because:    states and timers (TIME-WAIT, the retransmission of a SYN) are about what each side does as time passes. The three endings share one drawing so that the reader compares them.
// Control:    the switch of three scenarios. Each one changes the arrows and the states, and restarts the clock.
// Conclusion: closing takes four segments and the side that closes first pays with TIME-WAIT; a closed port answers at once with RST; a silent server is only found out by waiting.
//
// The segments, the states, the 59-second TIME-WAIT timer and the times of the SYN retransmissions (0, 1, 2, 3.1, 4.1, 5.1, 7.1 seconds) are real: exercises/07_tcp_connections.py (tcpConn.json).

type Scen = 'close' | 'refused' | 'silent';
const XS = { c: 170, s: 710 };
const D = 16;
const flow = data.flow as { t: number; dir: string; flags: string; seq: number; ack: number | null; len: number }[];
const closing = flow.slice(-4);
const syn = data.synRetries as number[];

type T = { title: string; caption: string; client: string; server: string; scen: Record<Scen, string>; marks: Record<Scen, Mark[]>; tw: string; closed: string; gaveUp: string; left: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือกตอนจบของ Connection แล้วกดเล่น เทียบการปิดตามปกติ, Port ที่ไม่มีใครฟัง และ Server ที่ไม่ตอบอะไรเลย',
    caption: 'Segment สถานะ TIME-WAIT 59 วินาที และเวลาส่ง SYN ซ้ำที่ 0, 1, 2, 3.1, 4.1, 5.1 และ 7.1 วินาที เป็นผลจริงของแบบฝึก 07 (ระยะเวลาของการปิดตามปกติในภาพยืดออกให้อ่านได้ ของจริงใช้ 20 มิลลิวินาที)',
    client: 'Client', server: 'Server', scen: { close: 'ปิดตามปกติ', refused: 'Port ที่ไม่มีใครฟัง', silent: 'Server ไม่ตอบ' },
    tw: 'TIME-WAIT เหลือ', closed: 'CLOSED', gaveUp: 'โปรแกรมยอมแพ้เอง (Timeout 9 วินาที)', left: 'วินาที',
    marks: {
      close: [
        { at: 1, name: 'Server ปิดก่อน', title: 'Server ส่ง FIN: ฉันส่งหมดแล้ว', text: 'หลังส่ง Response เสร็จ Server ปิดฝั่งของตัวเอง (Request บอก Connection: close) FIN ใช้เลข Sequence ไปหนึ่งตัวเหมือน SYN Server เข้าสถานะ FIN-WAIT-1' },
        { at: 4, name: 'Client ตอบรับ', title: 'Client ตอบรับ FIN', text: 'Client รับ FIN แล้วตอบ ACK ทันที (Kernel ทำเอง) Server เข้า FIN-WAIT-2 ส่วน Client เข้า CLOSE-WAIT รอให้โปรแกรมเรียก close() ซึ่งเป็นช่วงที่ Client ยังส่งข้อมูลได้ ถ้าต้องการ' },
        { at: 7, name: 'Client ปิดเอง', title: 'Client ส่ง FIN ของตัวเอง', text: 'โปรแกรมของ Client เรียก close() จึงส่ง FIN ออกไป และเข้า LAST-ACK การปิดทั้งสองทิศจึงต้องแยกกัน ได้สี่ Segment' },
        { at: 10, name: 'จบ', title: 'ACK สุดท้าย แล้ว Server ค้างใน TIME-WAIT', text: 'Server ตอบ ACK แล้ว Client เป็น CLOSED ส่วน Server ต้องค้างใน TIME-WAIT ราว 60 วินาที ในแบบฝึก ss เห็น timer เหลือ 59 วินาที และอีก 14 วินาทีต่อมาเหลือ 45 เหตุผลคือถ้า ACK สุดท้ายหาย Client จะส่ง FIN ซ้ำ และ Server ต้องยังอยู่เพื่อตอบ' },
      ],
      refused: [
        { at: 1, name: 'SYN', title: 'Client ส่ง SYN ไปที่ Port 8099', text: 'ไม่มีโปรแกรมฟัง Port นี้บน Server Client อยู่ในสถานะ SYN-SENT' },
        { at: 4, name: 'RST', title: 'Server ตอบ RST,ACK ทันที', text: 'Kernel ของ Server รู้ว่าไม่มีใครฟัง จึงตอบ RST (Reset) ที่ ack=ISN+1 ไม่มีข้อมูล Client เห็นทันทีว่าปฏิเสธ (refused) และกลับเป็น CLOSED ทั้งหมดใช้เวลาเท่าหนึ่งรอบเวลา' },
      ],
      silent: [
        { at: 1, name: 'SYN แรก', title: 'Client ส่ง SYN แต่ไม่มีใครตอบ', text: 'Server ทิ้ง Packet ไปเฉย ๆ (กฎไฟร์วอลล์) ไม่มี RST ไม่มี SYN,ACK Client ไม่รู้ว่าเกิดอะไรขึ้น จึงรอ' },
        { at: 2, name: 'ส่งซ้ำ', title: 'ส่ง SYN เดิมซ้ำเมื่อครบเวลา', text: 'หลัง 1 วินาที Client ส่ง SYN ตัวเดิม (เลข Sequence เดิม) อีกครั้ง แล้วอีกครั้ง ที่ Linux ตัวนี้ห่าง 1 วินาทีสี่ครั้งแรก (tcp_syn_linear_timeouts=4) แล้วค่อยห่างขึ้นเป็นสองเท่า' },
        { at: 8, name: 'ยอมแพ้', title: 'โปรแกรมยอมแพ้ตาม Timeout ของมัน', text: 'ในแบบฝึกโปรแกรมตั้ง Timeout ไว้ 9 วินาที ส่ง SYN ไปเจ็ดครั้ง ไม่มีข้อความจาก Server เลย การรอแบบนี้คือสาเหตุของคำว่า "ค้าง" เวลาปลายทางมีไฟร์วอลล์ที่ทิ้ง Packet' },
      ],
    },
  },
  en: {
    title: 'Pick an ending of a connection and press play, comparing a normal close, a port nobody listens on and a server that says nothing',
    caption: 'The segments, the 59-second TIME-WAIT, and the times of the repeated SYN at 0, 1, 2, 3.1, 4.1, 5.1 and 7.1 seconds are the real results of exercise 07 (the normal close is stretched in the picture to be readable, in reality it takes 20 milliseconds).',
    client: 'Client', server: 'Server', scen: { close: 'a normal close', refused: 'a port nobody listens on', silent: 'a server that does not answer' },
    tw: 'TIME-WAIT left', closed: 'CLOSED', gaveUp: 'the program gives up (its own 9-second timeout)', left: 'seconds',
    marks: {
      close: [
        { at: 1, name: 'Server first', title: 'The server sends FIN: I am done sending', text: 'After sending the response the server closes its own side (the request said Connection: close). A FIN uses up one sequence number like a SYN. The server enters FIN-WAIT-1.' },
        { at: 4, name: 'Client acks', title: 'The client acknowledges the FIN', text: 'The client receives the FIN and acknowledges it at once (the kernel does that by itself). The server enters FIN-WAIT-2 and the client enters CLOSE-WAIT, waiting for the program to call close(), a period in which the client can still send data if it wants to.' },
        { at: 7, name: 'Client closes', title: 'The client sends its own FIN', text: 'The client program calls close(), so it sends its FIN and enters LAST-ACK. Closing the two directions is separate, so there are four segments.' },
        { at: 10, name: 'The end', title: 'The last ACK, and the server stays in TIME-WAIT', text: 'The server answers with an ACK and the client becomes CLOSED, while the server has to stay in TIME-WAIT for about 60 seconds. In the exercise ss showed a timer of 59 seconds, and 14 seconds later 45. The reason is that if the last ACK is lost the client will send its FIN again, and the server must still be there to answer.' },
      ],
      refused: [
        { at: 1, name: 'SYN', title: 'The client sends a SYN to port 8099', text: 'No program listens on this port on the server. The client is in the state SYN-SENT.' },
        { at: 4, name: 'RST', title: 'The server answers RST,ACK at once', text: 'The server\'s kernel knows nobody listens, so it answers RST (reset) with ack=ISN+1 and no data. The client sees refused at once and goes back to CLOSED. It all takes one round trip.' },
      ],
      silent: [
        { at: 1, name: 'First SYN', title: 'The client sends a SYN and nobody answers', text: 'The server drops the packet silently (a firewall rule). There is no RST and no SYN,ACK. The client does not know what happened, so it waits.' },
        { at: 2, name: 'Resend', title: 'The same SYN is sent again when time is up', text: 'After 1 second the client sends the same SYN (the same sequence number) again, and again. On this Linux the gap is 1 second for the first four tries (tcp_syn_linear_timeouts=4) and then doubles.' },
        { at: 8, name: 'Gives up', title: 'The program gives up on its own timeout', text: 'In the exercise the program set a 9-second timeout. Seven SYNs went out and there was no message from the server at all. This kind of wait is why a connection "hangs" when the destination has a firewall that drops packets.' },
      ],
    },
  },
};

export default function TcpCloseLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [scen, setScen] = useState<Scen>('close');
  const clock = useClock(D);
  const { t } = clock;
  const marks = T.marks[scen];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const pick = (s: Scen) => { setScen(s); clock.restart(); };

  const arrows: { x1: number; y1: number; x2: number; y2: number; at: number; kind: 'data' | 'ack' | 'ctl' | 'retx'; label: string; n: number }[] = [];
  if (scen === 'close') {
    closing.forEach((f, i) => {
      const toServer = f.dir === 'c2s';
      arrows.push({ x1: toServer ? XS.c : XS.s, x2: toServer ? XS.s : XS.c, y1: 110 + i * 70, y2: 132 + i * 70, at: 1 + i * 3, kind: f.flags.includes('FIN') ? 'retx' : 'ack', label: `${f.flags}  seq=${f.seq} ack=${f.ack}`, n: i + 1 });
    });
  } else if (scen === 'refused') {
    arrows.push({ x1: XS.c, y1: 130, x2: XS.s, y2: 152, at: 1, kind: 'retx', label: 'SYN  seq=0', n: 1 });
    arrows.push({ x1: XS.s, y1: 230, x2: XS.c, y2: 252, at: 4, kind: 'ack', label: 'RST,ACK  ack=1', n: 2 });
  } else {
    syn.forEach((s, i) => arrows.push({ x1: XS.c, y1: 96 + i * 40, x2: XS.s - 120, y2: 108 + i * 40, at: 1 + s, kind: 'retx', label: `SYN  seq=0  (${s.toFixed(1)} s)`, n: i + 1 }));
  }

  // states
  const stateC = scen === 'close' ? (t >= 10.2 ? 'CLOSED' : t >= 7.2 ? 'LAST-ACK' : t >= 4.2 ? 'CLOSE-WAIT' : 'ESTABLISHED')
    : scen === 'refused' ? (t >= 5.4 ? 'CLOSED' : t >= 1.2 ? 'SYN-SENT' : 'CLOSED')
    : (t >= 10 ? 'CLOSED' : t >= 1.2 ? 'SYN-SENT' : 'CLOSED');
  const stateS = scen === 'close' ? (t >= 10.2 ? 'TIME-WAIT' : t >= 4.2 ? 'FIN-WAIT-2' : t >= 1.2 ? 'FIN-WAIT-1' : 'ESTABLISHED') : scen === 'refused' ? 'LISTEN: -' : '-';
  const twLeft = scen === 'close' && t >= 10.2 ? Math.max(0, Math.round(data.timeWait[0] - (t - 10.2) * 6)) : null;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="scenario">
          {(['close', 'refused', 'silent'] as Scen[]).map((s) => (
            <button key={s} type="button" aria-pressed={scen === s} onClick={() => pick(s)}>{T.scen[s]}</button>
          ))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'bad', text: 'SYN / FIN / RST' }, { cls: 'same', text: 'ACK' }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 480" role="img" aria-label={T.title}>
          <Lifelines xs={[XS.c, XS.s]} y1={54} y2={346} names={[T.client, T.server]} />
          {arrows.map((a, i) => (
            <Msg key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} p={ease(t, a.at, a.at + 1.6)} kind={a.kind} n={a.n} label={a.label} labelDy={-8} lost={scen === 'silent'} />
          ))}
          <Note x={XS.c - 70} y={352} w={140} text={stateC} tone={stateC === 'ESTABLISHED' ? 'ok' : undefined} />
          {stateS !== '-' && <Note x={XS.s - 80} y={352} w={160} text={stateS} tone={stateS === 'TIME-WAIT' ? 'bad' : undefined} />}
          {twLeft !== null && <text x={XS.s} y={410} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{T.tw} ≈ {twLeft} {T.left}</text>}
          {scen === 'silent' && t >= 10 && <text x={XS.s} y={410} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{T.gaveUp}</text>}
          <Banner y={424} text={marks[current].title} w={856} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
