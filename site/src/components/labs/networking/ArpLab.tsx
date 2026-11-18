import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Lifelines, Msg, Note, Legend, ease } from './nw';
import data from './linkLayer.json';

// Shows:      a ping from a to c when a does not know c's MAC address. a shouts "who has 10.0.1.4?" to everybody on the cable (broadcast), b ignores it, c answers a only,
//             a writes the answer into its neighbour cache, and only then is the real packet sent, to c's MAC.
// Because:    ARP is a conversation in time with a broadcast (many receivers) and a unicast (one receiver) and a cache that changes. A sentence cannot show who hears what.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: IP says "which computer", but the cable needs a MAC address, so before the first packet to a neighbour there is a broadcast question and a unicast answer, and the answer is remembered.
//
// Who saw the request and the reply, the 42-byte size, the MAC addresses and the cache line are the real results of exercises/03_link_layer.py (linkLayer.json).

const D = 17;
const X = { a: 110, b: 440, c: 770 };

type T = { title: string; caption: string; names: string[]; cache: string; empty: string; marks: Mark[]; req: string; rep: string; ping: string; notMe: string; me: string; bc: string; uni: string; legendBc: string; legendUni: string };

const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู ARP ถามหา MAC ของ 10.0.1.4 ก่อนที่ a จะส่งอะไรไปหาจริง ๆ',
    caption: 'ขนาด 42 ไบต์ ที่อยู่ MAC ใครเห็น Request และ Reply (b เห็นแค่ Request) และบรรทัดใน Cache เป็นผลจริงของแบบฝึก 03',
    names: ['a', 'b', 'c'], cache: 'Neighbour Cache ของ a', empty: 'ว่าง',
    req: `ARP Request: ใครคือ ${data.arp.request.who}? ตอบ ${data.arp.request.tell}`, rep: `ARP Reply: ${data.arp.reply.ip} อยู่ที่ …:0c`, ping: 'Ping ไป MAC …:0c',
    notMe: 'ไม่ใช่ฉัน เงียบ', me: 'ฉันเอง', bc: 'ส่งถึงทุกคน (ff:ff:ff:ff:ff:ff)', uni: 'ส่งถึง a คนเดียว', legendBc: 'Broadcast ถึงทุกคนในสายเดียวกัน', legendUni: 'Unicast ถึงคนเดียว',
    marks: [
      { at: 0, name: 'ยังไม่รู้', title: 'a อยากส่ง Packet ไป 10.0.1.4 แต่ไม่รู้ MAC', text: 'IP บอกว่าปลายทางคือ 10.0.1.4 และอยู่ในเครือข่ายเดียวกัน แต่ Frame ต้องมี MAC ปลายทาง Cache ของ a ยังไม่มีแถวของ 10.0.1.4 จึงต้องถามก่อน' },
      { at: 1.2, name: 'ถามทุกคน', title: 'ARP Request ส่งไปทั้งสาย (Broadcast)', text: 'a ส่ง Frame ที่ปลายทางเป็น ff:ff:ff:ff:ff:ff สวิตช์ส่งต่อให้ทุก Port ในข้อความมี IP กับ MAC ของ a (เพื่อให้คนตอบรู้ว่าจะตอบไปที่ไหน) และถามหา MAC ของ 10.0.1.4 โดยช่อง MAC ปลายทางเป็นศูนย์ทั้งหมด' },
      { at: 5, name: 'ใครตอบ', title: 'b ไม่ใช่เจ้าของ ส่วน c ใช่', text: 'ทั้ง b และ c ได้ Request แต่มีแค่ c ที่ถือที่อยู่ 10.0.1.4 b เงียบ' },
      { at: 6, name: 'ตอบกลับ', title: 'ARP Reply ส่งถึง a คนเดียว (Unicast)', text: 'c ตอบตรงไป MAC ของ a ว่า "10.0.1.4 อยู่ที่ MAC ของฉัน" b ไม่เห็น Frame นี้เลย เพราะสวิตช์รู้แล้วว่า a อยู่ที่ Port ไหน' },
      { at: 9.5, name: 'จำไว้', title: 'a จดคำตอบลง Cache', text: 'ตอนนี้ a มีแถว 10.0.1.4 อยู่ที่ …:0c (REACHABLE) ครั้งหน้าที่ส่งไปหา c ไม่ต้องถามอีกจนกว่าแถวนี้จะหมดอายุ' },
      { at: 11, name: 'ส่งจริง', title: 'Ping ออกไปด้วย MAC ที่ได้มา', text: 'ถึงตอนนี้ a ส่ง Frame ของ IP จริง ๆ ได้แล้ว โดยใส่ MAC ของ c เป็นปลายทาง Frame นี้เป็น Unicast และ b ไม่เห็น' },
    ],
  },
  en: {
    title: 'Press play and watch ARP ask for the MAC address of 10.0.1.4 before a sends anything real',
    caption: 'The 42-byte size, the MAC addresses, who saw the request and the reply (b sees only the request) and the cache line are the real results of exercise 03.',
    names: ['a', 'b', 'c'], cache: 'Neighbour cache of a', empty: 'empty',
    req: `ARP request: who has ${data.arp.request.who}? tell ${data.arp.request.tell}`, rep: `ARP reply: ${data.arp.reply.ip} is at …:0c`, ping: 'Ping to MAC …:0c',
    notMe: 'not me, silent', me: 'that is me', bc: 'to everyone (ff:ff:ff:ff:ff:ff)', uni: 'to a only', legendBc: 'broadcast to everyone on the cable', legendUni: 'unicast to one',
    marks: [
      { at: 0, name: 'Not known', title: 'a wants to send to 10.0.1.4 but has no MAC', text: 'IP says the destination is 10.0.1.4 and it is on the same network, but the frame needs a destination MAC. The cache of a has no row for 10.0.1.4, so it has to ask first.' },
      { at: 1.2, name: 'Ask all', title: 'The ARP request goes to the whole cable (broadcast)', text: 'a sends a frame whose destination is ff:ff:ff:ff:ff:ff and the switch passes it to every port. It carries a\'s IP and MAC (so the owner knows where to answer) and asks for the MAC of 10.0.1.4, with the target MAC field all zeros.' },
      { at: 5, name: 'Who answers', title: 'b is not the owner, c is', text: 'Both b and c got the request, but only c holds the address 10.0.1.4. b stays silent.' },
      { at: 6, name: 'Reply', title: 'The ARP reply goes to a only (unicast)', text: 'c answers straight to a\'s MAC: "10.0.1.4 is at my MAC". b never sees this frame, because the switch already knows which port a is on.' },
      { at: 9.5, name: 'Remember', title: 'a writes the answer into its cache', text: 'Now a has the row 10.0.1.4 is at …:0c (REACHABLE). The next time it sends to c it does not ask again until this row expires.' },
      { at: 11, name: 'Real send', title: 'The ping leaves with the MAC it learned', text: 'Only now can a send the real IP frame, with c\'s MAC as destination. This frame is unicast and b does not see it.' },
    ],
  },
};

export default function ArpLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const y0 = 100;
  const pReq = ease(t, 1.2, 4.2);
  const pRep = ease(t, 6, 9);
  const pPing = ease(t, 11, 14.5);
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const seenReq = data.arp.request.seenBy as string[];
  const seenRep = data.arp.reply.seenBy as string[];
  const cacheOn = t >= 9.5;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'bad', text: T.legendBc }, { cls: 'chg', text: T.legendUni }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 480" role="img" aria-label={T.title}>
          <Lifelines xs={[X.a, X.b, X.c]} y1={y0 - 40} y2={340} names={T.names} subs={['10.0.1.2', '10.0.1.3', '10.0.1.4']} />
          <Msg x1={X.a} y1={y0} x2={X.b} y2={y0 + 40} p={seenReq.includes('b') ? pReq : 0} kind="retx" n={1} />
          <Msg x1={X.a} y1={y0} x2={X.c} y2={y0 + 80} p={seenReq.includes('c') ? pReq : 0} kind="retx" />
          {pReq > 0.4 && <text x={X.a + 14} y={y0 - 12} className="ib-s" style={{ fontWeight: 700, fill: 'var(--fg)' }}>{T.req}</text>}
          {pReq > 0.9 && <text x={X.b - 16} y={y0 + 66} textAnchor="end" className="ib-s" style={{ fill: 'var(--muted)' }}>{T.bc}</text>}
          <Note x={X.b - 86} y={y0 + 92} w={172} text={T.notMe} op={ease(t, 4.4, 5) * (t < 20 ? 1 : 0)} />
          <Note x={X.c - 86} y={y0 + 92} w={172} text={T.me} tone="ok" op={ease(t, 4.4, 5)} />
          <Msg x1={X.c} y1={y0 + 134} x2={X.a} y2={y0 + 174} p={seenRep.includes('a') ? pRep : 0} kind="ack" n={2} />
          {pRep > 0.4 && <text x={(X.a + X.c) / 2} y={y0 + 140} textAnchor="middle" className="ib-s" style={{ fontWeight: 700, fill: 'var(--fg)' }}>{T.rep}</text>}
          {pRep > 0.9 && <text x={X.a + 16} y={y0 + 168} className="ib-s" style={{ fill: 'var(--muted)' }}>{T.uni}</text>}
          {/* the cache of a */}
          <g>
            <rect className="nw-cell" x={20} y={y0 + 250} width={400} height={66} rx={10} />
            <text x={32} y={y0 + 272} className="ib-layer">{T.cache}</text>
            {!cacheOn && <text x={32} y={y0 + 302} className="ib-s">{T.empty}</text>}
            {cacheOn && (
              <g>
                <rect className="nw-cell on" x={30} y={y0 + 280} width={380} height={28} rx={7} />
                <text x={40} y={y0 + 300} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>10.0.1.4  →  02:00:00:00:00:0c  REACHABLE</text>
              </g>
            )}
          </g>
          <Msg x1={X.a} y1={y0 + 196} x2={X.c} y2={y0 + 236} p={pPing} kind="data" n={3} />
          {pPing > 0.4 && <text x={(X.a + X.c) / 2 + 40} y={y0 + 204} textAnchor="middle" className="ib-s" style={{ fontWeight: 700, fill: 'var(--fg)' }}>{T.ping}</text>}
          <Banner y={426} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
