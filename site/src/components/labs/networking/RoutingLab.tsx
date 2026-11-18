import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Pk, Wire, ease, lerp } from './nw';
import data from './routing.json';

// Shows:      a ping to 10.0.4.2 crossing three routers. At every router the packet waits while the router reads the destination, compares it with every row of its
//             routing table, picks the row with the longest matching prefix, lowers the TTL and sends it out of the cable of that row.
// Because:    "a router looks up the destination in its table and lowers the TTL" is a repeated action at each hop, and the table differs at each hop. Only a picture
//             that moves from router to router shows the rows being compared and the TTL going down.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: each router decides alone, from its own table, using only the destination address, and every hop costs one TTL.
//
// The tables are the real `ip route` output of the three routers and the TTL values are the ones captured on every link in exercises/04_ip_routing.py (routing.json).

const DEST = '10.0.4.2';
const D = 20;
const W = 130;
const X = [10, 187.5, 365, 542.5, 720];
const CX = X.map((x) => x + W / 2);
const Y = 28;
const ROUTERS = ['r1', 'r2', 'r3'] as const;
// time at which the packet is at device i (0 = client) and when it leaves
const ARRIVE = [0, 3, 7.5, 12, 16.5];
const LEAVE = [1, 5.5, 10, 14.5, 99];

const ip2n = (s: string) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0);
const inNet = (ip: string, cidr: string) => {
  const [net, len] = cidr.split('/');
  const l = Number(len);
  const mask = l === 0 ? 0 : (0xffffffff << (32 - l)) >>> 0;
  return ((ip2n(ip) & mask) >>> 0) === ((ip2n(net) & mask) >>> 0);
};

type T = { title: string; caption: string; names: string[]; tableOf: string; net: string; via: string; dev: string; direct: string; match: string; ttl: string; marks: Mark[]; legendMatch: string; legendOther: string; lookup: (r: string) => string; sent: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Ping ไปหา 10.0.4.2 ผ่าน Router สามตัว ว่าแต่ละตัวเลือกเส้นทางจากตารางของตัวเองและลด TTL อย่างไร',
    caption: 'ตาราง Route คือผลของ ip route จริงของ Router ทั้งสามตัว และค่า TTL คือค่าที่จับได้บนสายแต่ละเส้นในแบบฝึก 04 (64, 63, 62 และ 61) ส่วนความเร็วของ Packet ในภาพเป็นแค่ภาพวาด',
    names: ['Client', 'R1', 'R2', 'R3', 'Server'], tableOf: 'ตาราง Route ของ', net: 'เครือข่าย', via: 'ส่งต่อให้', dev: 'ออกสาย', direct: 'ต่ออยู่เอง', match: 'ตรงกัน', ttl: 'TTL',
    legendMatch: 'แถวที่ปลายทางอยู่ในเครือข่ายนั้น และถูกเลือก', legendOther: 'แถวที่ไม่ตรง',
    lookup: (r) => `${r} อ่านปลายทาง ${DEST} แล้วเทียบกับทุกแถวของตาราง`, sent: 'ส่งออกแล้ว TTL ลดลงหนึ่ง',
    marks: [
      { at: 0, name: 'Client', title: 'Client ส่ง Ping ด้วย TTL 64', text: 'Client ไม่มีตาราง Route ละเอียด มีแค่ default ให้ส่งไปหา R1 ทุกอย่างที่ไม่ใช่ของสายตัวเอง Packet ออกไปด้วย TTL 64' },
      { at: 3, name: 'R1', title: 'R1 เลือกแถว 10.0.4.0/24', text: 'R1 เทียบ 10.0.4.2 กับทุกแถว มีแถวเดียวที่ครอบมัน คือ 10.0.4.0/24 ซึ่งบอกให้ส่งต่อไปที่ 10.0.2.2 (R2) จากนั้นลด TTL เหลือ 63 แล้วส่งออก' },
      { at: 7.5, name: 'R2', title: 'R2 ทำแบบเดียวกันด้วยตารางของตัวเอง', text: 'R2 มีตารางคนละอันกับ R1 แถวที่ครอบ 10.0.4.2 ชี้ไปที่ R3 TTL ลดเหลือ 62 ไม่มีใครรู้ว่า Packet นี้ผ่านมาทางไหน และจะไปทางไหนต่อ นอกจาก Router ที่ถือมันอยู่ตอนนี้' },
      { at: 12, name: 'R3', title: 'R3 ต่ออยู่กับเครือข่ายปลายทาง', text: 'แถว 10.0.4.0/24 ของ R3 ไม่มีคำว่า "ส่งต่อให้" เพราะ R3 ต่อกับเครือข่ายนี้โดยตรง จึงส่ง Frame ไปหา Server เองได้เลย (ARP ถามหา 10.0.4.2) TTL ลดเหลือ 61' },
      { at: 16.5, name: 'Server', title: 'Server รับด้วย TTL 61', text: 'ตัวเลข 64 ที่ออกไป กลายเป็น 61 เพราะผ่าน Router สามตัว ถ้า Server ส่งตอบกลับ ทางกลับก็ผ่านสามตัวเช่นกัน' },
    ],
  },
  en: {
    title: 'Press play and watch a ping to 10.0.4.2 cross three routers, each choosing a route from its own table and lowering the TTL',
    caption: 'The routing tables are the real ip route output of the three routers, and the TTL values are the ones captured on each link in exercise 04 (64, 63, 62 and 61). The speed of the packet in the picture is only a drawing.',
    names: ['Client', 'R1', 'R2', 'R3', 'Server'], tableOf: 'Routing table of', net: 'network', via: 'next hop', dev: 'out of', direct: 'directly connected', match: 'match', ttl: 'TTL',
    legendMatch: 'the row that contains the destination and is chosen', legendOther: 'a row that does not match',
    lookup: (r) => `${r} reads the destination ${DEST} and compares it with every row of its table`, sent: 'sent out, TTL lowered by one',
    marks: [
      { at: 0, name: 'Client', title: 'The client sends a ping with TTL 64', text: 'The client has no detailed table, only a default that sends everything that is not on its own cable to R1. The packet leaves with TTL 64.' },
      { at: 3, name: 'R1', title: 'R1 picks the row 10.0.4.0/24', text: 'R1 compares 10.0.4.2 with every row. Only one row contains it, 10.0.4.0/24, which says to pass it on to 10.0.2.2 (R2). Then it lowers the TTL to 63 and sends it out.' },
      { at: 7.5, name: 'R2', title: 'R2 does the same with its own table', text: 'R2 has a different table from R1. The row that contains 10.0.4.2 points at R3. The TTL goes down to 62. Nobody knows which way this packet came or where it goes next, except the router that holds it right now.' },
      { at: 12, name: 'R3', title: 'R3 is connected to the destination network', text: 'The 10.0.4.0/24 row of R3 has no next hop, because R3 sits on this network and can send the frame to the server itself (ARP asks for 10.0.4.2). The TTL goes down to 61.' },
      { at: 16.5, name: 'Server', title: 'The server receives it with TTL 61', text: 'The 64 that left has become 61 because three routers were crossed. If the server answers, the way back crosses three as well.' },
    ],
  },
};

export default function RoutingLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const tables = data.tables as Record<string, { net: string; via: string | null; dev: string }[]>;

  // where the packet is
  let dev = 0;
  ARRIVE.forEach((a, i) => { if (t >= a) dev = i; });
  const moving = dev < 4 && t >= LEAVE[dev];
  const nextDev = dev + 1;
  const pos: [number, number] = moving
    ? lerp([CX[dev] + W / 2, Y + 80], [CX[nextDev] - W / 2, Y + 80], ease(t, LEAVE[dev], ARRIVE[nextDev]))
    : [CX[dev], Y + 108];
  const u = t - ARRIVE[dev];
  const req = data.ttl.request;
  const ttlShown = moving ? req[dev] : dev === 0 ? req[0] : dev === 4 ? req[3] : u < 1.8 ? req[dev - 1] : req[dev];

  const r = dev >= 1 && dev <= 3 ? ROUTERS[dev - 1] : null;
  const rows = r ? tables[r] : null;
  const best = rows ? rows.filter((x) => inNet(DEST, x.net)).sort((a, b) => Number(b.net.split('/')[1]) - Number(a.net.split('/')[1]))[0] : null;
  const scanning = !!rows && !moving && u < 1.2;
  const chosen = !!rows && !moving && u >= 1.2;

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const banner = !r ? T.marks[current].title : moving ? T.sent : scanning ? T.lookup(T.names[dev]) : T.marks[current].title;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.legendMatch }, { cls: 'same', text: T.legendOther }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          {[0, 1, 2, 3].map((i) => (<Wire key={i} x1={X[i] + W} y1={Y + 35} x2={X[i + 1]} y2={Y + 35} hot={moving && dev === i} />))}
          {T.names.map((n, i) => (
            <Dev key={n} x={X[i]} y={Y} w={W} h={70} kind={i === 0 ? 'host' : i === 4 ? 'server' : 'router'} title={n} sub={['10.0.1.1', '', '', '', '10.0.4.2'][i] || undefined} hot={dev === i && !moving} />
          ))}
          <g>
            <Pk x={pos[0]} y={pos[1]} label={`TTL ${ttlShown}`} kind="data" w={96} h={30} />
          </g>
          {rows && (
            <g>
              <text x={20} y={176} className="ib-layer">{T.tableOf} {T.names[dev]}  ·  {DEST}</text>
              <text x={30} y={206} className="ib-s">{T.net}</text>
              <text x={250} y={206} className="ib-s">{T.via}</text>
              <text x={470} y={206} className="ib-s">{T.dev}</text>
              {rows.map((row, i) => {
                const hit = chosen && best && row.net === best.net;
                const y = 216 + i * 38;
                return (
                  <g key={row.net}>
                    <rect className={hit ? 'nw-cell on' : 'nw-cell'} x={20} y={y} width={640} height={32} rx={8} />
                    <text x={30} y={y + 22} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{row.net}</text>
                    <text x={250} y={y + 22} className="ib-m" style={{ fill: 'var(--fg)' }}>{row.via ?? T.direct}</text>
                    <text x={470} y={y + 22} className="ib-m" style={{ fill: 'var(--fg)' }}>{row.dev}</text>
                    {scanning && inNet(DEST, row.net) && <text x={620} y={y + 22} textAnchor="end" className="ib-s" style={{ fill: 'var(--k2)', fontWeight: 700 }}>{T.match}</text>}
                    {hit && <text x={650} y={y + 22} textAnchor="end" className="ib-n" style={{ fill: 'var(--accent)' }}>✓</text>}
                  </g>
                );
              })}
            </g>
          )}
          {!rows && (
            <text x={20} y={206} className="ib-s">{dev === 0 ? (lang === 'th' ? 'Client: default via 10.0.1.2 (R1)' : 'Client: default via 10.0.1.2 (R1)') : (lang === 'th' ? 'Server: ตอบรับ Packet ถึงปลายทางแล้ว' : 'Server: the packet has arrived')}</text>
          )}
          <Banner y={400} text={banner} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
