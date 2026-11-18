import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Lifelines, Msg, Note, Legend, ease } from './nw';
import data from './natDhcp.json';

// Shows:      a computer that starts with no address at all (0.0.0.0) and gets one in four messages: DISCOVER, OFFER, REQUEST, ACK. Each arrow carries the real source and
//             destination of that message, and under the arrows the fields that matter (the address offered, the mask, the router, the lease).
// Because:    DHCP is a chicken-and-egg problem (how do you talk when you have no address?) that is solved by broadcasts, and that is a story told in time. A table of fields does not show
//             why the first two messages go to 255.255.255.255.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: DHCP is four UDP messages, two of them from a computer that has no address yet, and the answer carries everything the computer needs (address, mask, router, DNS, lease).
//
// Everything on the arrows is read from the capture of the real dhclient talking to the small server of exercises/05_nat_dhcp.py (natDhcp.json).

const D = 20;
const XS = { c: 150, s: 730 };
const START = [1, 5, 9, 13];
const Y = [100, 196, 292, 388];

type T = { title: string; caption: string; client: string; server: string; noAddr: string; hasAddr: (a: string, s: number) => string; what: string[]; fields: string[]; marks: Mark[]; legendBc: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูคอมพิวเตอร์ที่ยังไม่มีที่อยู่อะไรเลย ได้ที่อยู่ IP มาใน DHCP สี่ข้อความ',
    caption: 'ที่อยู่ Port และค่าในแต่ละข้อความมาจากการจับ Packet ของ dhclient จริงที่คุยกับ DHCP Server ตัวเล็กในแบบฝึก 05 (Server ตัวนี้เขียนเองด้วย Python ไม่ใช่ของจริงที่ใช้ในเครือข่ายทั่วไป)',
    client: 'Client', server: 'DHCP Server', noAddr: 'ยังไม่มีที่อยู่ (0.0.0.0)', hasAddr: (a, s) => `ได้ ${a} ใช้ได้ ${s} วินาที`,
    what: ['DISCOVER: มี DHCP Server ไหม', 'OFFER: เสนอที่อยู่ให้', 'REQUEST: ขอใช้ที่อยู่ที่เสนอ', 'ACK: ยืนยัน ใช้ได้'],
    fields: ['ถามทุกคนในสาย เพราะยังไม่รู้ว่า Server อยู่ไหน และยังไม่มีที่อยู่ของตัวเอง', 'เสนอที่อยู่ พร้อม Subnet Mask, Router, DNS และอายุการเช่า', 'เลือกข้อเสนอของ Server นี้ และบอกที่อยู่ที่ขอ (เผื่อมี Server หลายตัวเสนอมา)', 'ยืนยัน จากนี้คอมพิวเตอร์ตั้งที่อยู่ให้ตัวเองได้'],
    legendBc: 'ข้อความที่ส่งแบบ Broadcast ไป 255.255.255.255',
    marks: [
      { at: 1, name: 'DISCOVER', title: 'DISCOVER: ถามหา Server', text: 'คอมพิวเตอร์เพิ่งต่อสายและยังไม่มีที่อยู่ IP จึงส่งจาก 0.0.0.0 พอร์ต 68 ไปที่ 255.255.255.255 พอร์ต 67 (และ MAC ปลายทางเป็น ff:ff:ff:ff:ff:ff) ทุกคนในสายได้ยิน ใครเป็น DHCP Server ก็จะตอบ' },
      { at: 5, name: 'OFFER', title: 'OFFER: Server เสนอที่อยู่', text: 'Server เสนอ 10.0.1.100 พร้อมข้อมูลที่เครือข่ายนี้ต้องใช้ คือ Subnet Mask, Router (ทางออก), DNS Server และอายุการเช่า 3600 วินาที ในแบบฝึก Server ตอบแบบ Broadcast เพราะ Client ยังไม่มีที่อยู่ให้ส่งตรง' },
      { at: 9, name: 'REQUEST', title: 'REQUEST: ขอใช้ที่อยู่นั้น', text: 'Client ส่งต่อกลับไปว่าขอใช้ที่อยู่ที่เสนอมา โดยระบุที่อยู่ที่ต้องการ และชื่อ Server ที่รับข้อเสนอ ข้อความนี้ยังส่งจาก 0.0.0.0 เพราะการเช่ายังไม่จบ' },
      { at: 13, name: 'ACK', title: 'ACK: ยืนยัน', text: 'Server ยืนยันที่อยู่เดิมและอายุการเช่า ตอนนี้ Client ตั้งที่อยู่ 10.0.1.100 ให้ตัวเอง ตั้ง Router เป็นทางออก และเริ่มใช้เครือข่ายได้ ก่อนอายุ 3600 วินาทีหมดมันจะขอต่ออายุเอง' },
    ],
  },
  en: {
    title: 'Press play and watch a computer with no address at all get an IP address in four DHCP messages',
    caption: 'The addresses, ports and values in each message come from the capture of the real dhclient talking to the small DHCP server of exercise 05 (that server is written in Python for the exercise, not a production one).',
    client: 'Client', server: 'DHCP server', noAddr: 'no address yet (0.0.0.0)', hasAddr: (a, s) => `has ${a}, valid ${s} s`,
    what: ['DISCOVER: is there a DHCP server?', 'OFFER: here is an address', 'REQUEST: I would like that address', 'ACK: confirmed, it is yours'],
    fields: ['asks everyone on the cable, because it does not know where the server is and has no address of its own', 'offers an address together with the subnet mask, router, DNS and the lease time', 'picks this server\'s offer and names the address it wants (in case several servers offered)', 'confirms. From now on the computer can configure the address on itself'],
    legendBc: 'a message sent as a broadcast to 255.255.255.255',
    marks: [
      { at: 1, name: 'DISCOVER', title: 'DISCOVER: ask for a server', text: 'The computer has just been plugged in and has no IP address, so it sends from 0.0.0.0 port 68 to 255.255.255.255 port 67 (with destination MAC ff:ff:ff:ff:ff:ff). Everyone on the cable hears it, and any DHCP server will answer.' },
      { at: 5, name: 'OFFER', title: 'OFFER: the server offers an address', text: 'The server offers 10.0.1.100 with what this network needs: the subnet mask, the router (the way out), a DNS server and a lease of 3600 seconds. In the exercise the server answers by broadcast, because the client has no address to send to directly.' },
      { at: 9, name: 'REQUEST', title: 'REQUEST: asking for that address', text: 'The client replies that it wants the address it was offered, naming the address and the server whose offer it accepts. This message still comes from 0.0.0.0 because the lease is not finished yet.' },
      { at: 13, name: 'ACK', title: 'ACK: confirmed', text: 'The server confirms the same address and the lease. Now the client configures 10.0.1.100 on itself, sets the router as its way out, and can use the network. Before the 3600 seconds run out it asks to renew by itself.' },
    ],
  },
};

export default function DhcpLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const msgs = data.dhcp as { type: string; src: string; dst: string; yiaddr: string; options: Record<string, unknown> }[];
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const done = t >= START[3] + 2.5;
  const lease = Number(msgs[3].options['lease time']);

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'bad', text: T.legendBc }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 570" role="img" aria-label={T.title}>
          <Lifelines xs={[XS.c, XS.s]} y1={62} y2={470} names={[T.client, T.server]} subs={['02:..:c0', '10.0.1.1']} />
          {msgs.map((m, i) => {
            const toServer = i % 2 === 0;
            const p = ease(t, START[i], START[i] + 2);
            const x1 = toServer ? XS.c : XS.s, x2 = toServer ? XS.s : XS.c;
            return (
              <g key={i}>
                <Msg x1={x1} y1={Y[i]} x2={x2} y2={Y[i] + 26} p={p} kind={i < 2 ? 'retx' : 'data'} n={i + 1} />
                {p > 0.5 && <text x={440} y={Y[i] + 2} textAnchor="middle" className="ib-n" style={{ fill: 'var(--fg)' }}>{T.what[i]}</text>}
                {p > 0.9 && <text x={440} y={Y[i] + 52} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)' }}>{m.src} → {m.dst}</text>}
                {p > 0.9 && <text x={440} y={Y[i] + 70} textAnchor="middle" className="ib-s">{T.fields[i]}</text>}
              </g>
            );
          })}
          <Note x={XS.c - 135} y={474} w={270} text={done ? T.hasAddr(msgs[3].yiaddr, lease) : T.noAddr} tone={done ? 'ok' : undefined} />
          <Banner y={518} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
