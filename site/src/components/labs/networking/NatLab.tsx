import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Pk, Wire, ease, lerp } from './nw';
import data from './natDhcp.json';

// Shows:      two computers with private addresses (both using source port 50000) reaching the same server through a router that does NAT. The packet label changes at the router,
//             the router's table fills with a row per connection, the second connection gets another source port because 50000 is taken, and the answers are changed back.
//             At the end the server tries to start a conversation with the router's address and finds no row.
// Because:    NAT is about what the SAME packet looks like on each side of the router, and what the router remembers so that it can undo the change. A sentence cannot show one packet
//             wearing two names, or a row that has to exist before an answer can come back.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: NAT rewrites the source (address and sometimes port), remembers a row per connection, and that memory is the only reason answers get back and unsolicited packets do not.
//
// The addresses, the ports and the translated port of the second client are the real ones of exercises/05_nat_dhcp.py (natDhcp.json). The translated port is chosen by the kernel and
// differs from run to run.

const D = 34;
const N1 = data.nat[0], N2 = data.nat[1];
const SERVER = '10.0.2.2:8080';
const C1: [number, number] = [190, 75], C2: [number, number] = [190, 285], RL1: [number, number] = [355, 170], RL2: [number, number] = [355, 200], RR: [number, number] = [525, 185], SL: [number, number] = [690, 185];

type T = { title: string; caption: string; table: string; inside: string; outside: string; taken: string; refused: string; empty: string; marks: Mark[]; c1: string; c2: string; router: string; server: string; legendPriv: string; legendPub: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Client สองตัวที่ใช้ Port 50000 เหมือนกัน ออกไปหา Server ตัวเดียวผ่าน Router ที่ทำ NAT',
    caption: 'ที่อยู่ Port และเลข Port ที่ถูกเปลี่ยนของ Client ตัวที่สอง เป็นของจริงจากแบบฝึก 05 (เลขนี้ Kernel เป็นคนเลือก จึงต่างกันทุกรอบ) ส่วนตาราง NAT คือ conntrack ของ Router ที่ย่อให้เหลือสองฝั่ง',
    table: 'ตาราง NAT ของ Router', inside: 'ข้างใน (ก่อนแปลง)', outside: 'ข้างนอก (หลังแปลง)', taken: 'Port 50000 ถูกใช้ไปแล้วกับ Server นี้', refused: 'ไม่มีแถวไหนตรง Router ปฏิเสธ', empty: 'ว่าง',
    c1: 'Client 1', c2: 'Client 2', router: 'Router (NAT)', server: 'Server', legendPriv: 'ที่อยู่ส่วนตัว (ก่อนแปลง)', legendPub: 'ที่อยู่ที่ Server เห็น (หลังแปลง)',
    marks: [
      { at: 1, name: 'Client 1 ออก', title: 'Client 1 ส่ง SYN ออกไป', text: 'Packet ออกจาก Client 1 ด้วยที่อยู่ส่วนตัว 10.0.1.2 พอผ่าน Router ที่อยู่ต้นทางถูกแทนด้วย 10.0.2.1 (ที่อยู่ของ Router ฝั่ง Server) ส่วน Port ยังเป็น 50000 เพราะยังไม่มีใครใช้ และ Router จดแถวหนึ่งลงตารางไว้' },
      { at: 8.5, name: 'ตอบ Client 1', title: 'Server ตอบกลับ แล้วแปลงกลับ', text: 'Server ตอบไปที่ 10.0.2.1:50000 ซึ่งเป็นสิ่งเดียวที่มันเห็น Router เปิดตาราง เจอแถวที่ตรง แล้วเปลี่ยนปลายทางกลับเป็น 10.0.1.2:50000 ก่อนส่งให้ Client 1' },
      { at: 15, name: 'Client 2 ชน', title: 'Client 2 ใช้ Port 50000 เหมือนกัน', text: 'Client 2 ก็เลือก Port 50000 เช่นกัน ถ้า Router แปลงแค่ที่อยู่ Server จะเห็นสอง Connection ที่เหมือนกันทุกตัวอักษร (10.0.2.1:50000 ไป 10.0.2.2:8080) จึงแยกกันไม่ได้ Router เลยต้องเปลี่ยน Port ของตัวที่สองด้วย' },
      { at: 22.5, name: 'ตอบ Client 2', title: 'ตอบกลับมาที่ Port ที่ถูกเปลี่ยน', text: 'Server ตอบไปที่ Port ใหม่ Router ใช้ตารางหาว่าเป็นของ Client 2 แล้วแปลงกลับเป็น 10.0.3.2:50000 ซึ่งเป็น Port ที่ Client 2 เข้าใจ Client ไม่รู้เลยว่าเกิดการแปลง' },
      { at: 29, name: 'ฝั่งนอกเริ่มเอง', title: 'ฝั่งนอกเริ่มคุยก่อนไม่ได้', text: 'ถ้า Server ลองส่งเข้าไปหา 10.0.2.1:50000 ด้วยตัวเอง Router ไม่มีแถวที่ตรงกับ Packet นี้ (ต้นทางต้องเป็น 10.0.2.2:8080 ตามแถว) มันจึงไม่รู้ว่าจะส่งต่อให้ใคร และปฏิเสธ แถวในตารางเกิดจากฝั่งในออกไปก่อนเท่านั้น' },
    ],
  },
  en: {
    title: 'Press play and watch two clients that both use port 50000 reach one server through a router that does NAT',
    caption: 'The addresses, the ports and the translated port of the second client are the real ones of exercise 05 (the kernel chooses that number, so it differs on every run). The NAT table is the router\'s conntrack, shortened to two sides.',
    table: 'NAT table of the router', inside: 'inside (before)', outside: 'outside (after)', taken: 'port 50000 is already used with this server', refused: 'no row matches, the router refuses', empty: 'empty',
    c1: 'Client 1', c2: 'Client 2', router: 'Router (NAT)', server: 'Server', legendPriv: 'private address (before)', legendPub: 'the address the server sees (after)',
    marks: [
      { at: 1, name: 'Client 1 out', title: 'Client 1 sends a SYN', text: 'The packet leaves Client 1 with the private address 10.0.1.2. When it crosses the router the source is replaced by 10.0.2.1 (the router\'s address on the server side). The port is still 50000 because nobody uses it yet, and the router writes one row into its table.' },
      { at: 8.5, name: 'Answer 1', title: 'The server answers and the router changes it back', text: 'The server answers 10.0.2.1:50000, the only address it can see. The router looks in its table, finds the matching row and changes the destination back to 10.0.1.2:50000 before passing it to Client 1.' },
      { at: 15, name: 'Client 2 clash', title: 'Client 2 uses port 50000 as well', text: 'Client 2 also picks port 50000. If the router changed only the address, the server would see two connections identical in every character (10.0.2.1:50000 to 10.0.2.2:8080) and could not tell them apart. So the router has to change the port of the second one too.' },
      { at: 22.5, name: 'Answer 2', title: 'The answer comes back to the new port', text: 'The server answers the new port. The router uses its table to find that it belongs to Client 2 and changes it back to 10.0.3.2:50000, the port Client 2 understands. The client never knows a translation happened.' },
      { at: 29, name: 'Outside starts', title: 'The outside cannot start a conversation', text: 'If the server tries to send to 10.0.2.1:50000 by itself, the router has no row that matches this packet (the source would have to be 10.0.2.2:8080, as in the row). It does not know whom to pass it to, and refuses. A row exists only because the inside went out first.' },
    ],
  },
};

const leg = (t: number, a: [number, number], b: [number, number], t0: number, t1: number) => lerp(a, b, ease(t, t0, t1));

export default function NatLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const priv1 = `10.0.1.2:50000 → ${SERVER}`;
  const pub1 = `${N1.natIp}:${N1.natPort} → ${SERVER}`;
  const privB1 = `${SERVER} → ${N1.natIp}:${N1.natPort}`;
  const backB1 = `${SERVER} → 10.0.1.2:50000`;
  const priv2 = `10.0.3.2:50000 → ${SERVER}`;
  const pub2 = `${N2.natIp}:${N2.natPort} → ${SERVER}`;
  const privB2 = `${SERVER} → ${N2.natIp}:${N2.natPort}`;
  const backB2 = `${SERVER} → 10.0.3.2:50000`;

  // the packet on screen: [position, label, kind]
  let pk: { pos: [number, number]; label: string; pub: boolean } | null = null;
  const dy = -26;
  if (t >= 1 && t < 4) pk = { pos: leg(t, C1, RL1, 1, 4), label: priv1, pub: false };
  else if (t >= 4 && t < 5.5) pk = { pos: [RL1[0] + 80, 150], label: t < 4.8 ? priv1 : pub1, pub: t >= 4.8 };
  else if (t >= 5.5 && t < 8) pk = { pos: leg(t, RR, SL, 5.5, 8), label: pub1, pub: true };
  else if (t >= 8.5 && t < 11) pk = { pos: leg(t, SL, RR, 8.5, 11), label: privB1, pub: true };
  else if (t >= 11 && t < 12) pk = { pos: [RL1[0] + 80, 150], label: t < 11.5 ? privB1 : backB1, pub: t < 11.5 };
  else if (t >= 12 && t < 14.5) pk = { pos: leg(t, RL1, C1, 12, 14.5), label: backB1, pub: false };
  else if (t >= 15 && t < 17.5) pk = { pos: leg(t, C2, RL2, 15, 17.5), label: priv2, pub: false };
  else if (t >= 17.5 && t < 19.5) pk = { pos: [RL2[0] + 80, 240], label: t < 18.8 ? priv2 : pub2, pub: t >= 18.8 };
  else if (t >= 19.5 && t < 22) pk = { pos: leg(t, RR, SL, 19.5, 22), label: pub2, pub: true };
  else if (t >= 22.5 && t < 25) pk = { pos: leg(t, SL, RR, 22.5, 25), label: privB2, pub: true };
  else if (t >= 25 && t < 26) pk = { pos: [RL2[0] + 80, 240], label: t < 25.5 ? privB2 : backB2, pub: t < 25.5 };
  else if (t >= 26 && t < 28.5) pk = { pos: leg(t, RL2, C2, 26, 28.5), label: backB2, pub: false };
  else if (t >= 29 && t < 31.5) pk = { pos: leg(t, SL, RR, 29, 31.5), label: `x → ${N1.natIp}:50000`, pub: true };

  const rows = [
    { at: 5, i: `10.0.1.2:50000`, o: `${N1.natIp}:${N1.natPort}` },
    { at: 19.5, i: `10.0.3.2:50000`, o: `${N2.natIp}:${N2.natPort}` },
  ].filter((r) => t >= r.at);
  const clash = t >= 17.5 && t < 19.5;
  const refused = t >= 31.5;

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const banner = clash ? T.taken : refused ? T.refused : T.marks[current].title;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'same', text: T.legendPriv }, { cls: 'chg', text: T.legendPub }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 480" role="img" aria-label={T.title}>
          <Wire x1={C1[0]} y1={C1[1]} x2={RL1[0]} y2={RL1[1]} />
          <Wire x1={C2[0]} y1={C2[1]} x2={RL2[0]} y2={RL2[1]} />
          <Wire x1={RR[0]} y1={RR[1]} x2={SL[0]} y2={SL[1]} />
          <Dev x={20} y={40} w={170} kind="host" title={T.c1} sub="10.0.1.2" />
          <Dev x={20} y={250} w={170} kind="host" title={T.c2} sub="10.0.3.2" />
          <Dev x={355} y={145} w={170} h={80} kind="router" title={T.router} sub="10.0.2.1" hot={t >= 4 && t < 6 || clash} />
          <Dev x={690} y={145} w={170} kind="server" title={T.server} sub="10.0.2.2:8080" />
          <g>
            <rect className="nw-cell" x={230} y={262} width={420} height={140} rx={10} />
            <text x={244} y={284} className="ib-layer">{T.table}</text>
            <text x={244} y={308} className="ib-s">{T.inside}</text>
            <text x={452} y={308} className="ib-s">{T.outside}</text>
            {rows.length === 0 && <text x={244} y={340} className="ib-s">{T.empty}</text>}
            {rows.map((r, i) => (
              <g key={r.i}>
                <rect className={clash && i === 0 ? 'nw-cell bad' : t - r.at < 1.5 ? 'nw-cell on' : 'nw-cell'} x={240} y={316 + i * 40} width={400} height={32} rx={7} />
                <text x={252} y={338 + i * 40} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{r.i}</text>
                <text x={400} y={338 + i * 40} className="ib-m" style={{ fill: 'var(--fg)' }}>→</text>
                <text x={452} y={338 + i * 40} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{r.o}</text>
              </g>
            ))}
          </g>
          {pk && <Pk x={pk.pos[0]} y={pk.pos[1] + dy} label={pk.label} kind={pk.pub ? 'data' : 'ack'} w={Math.max(150, pk.label.length * 8.6 + 16)} />}
          {refused && <g><circle cx={RR[0] + 4} cy={RR[1]} r={16} style={{ fill: 'var(--surface)', stroke: 'var(--ib-bad)', strokeWidth: 4 }} /><path d={`M${RR[0] - 6},${RR[1] - 6} l20,12 m0,-12 l-20,12`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 4, fill: 'none', strokeLinecap: 'round' }} /></g>}
          <Banner y={420} text={banner} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
