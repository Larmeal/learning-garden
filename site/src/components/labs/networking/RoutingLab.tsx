import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Pk, Wire, ease, lerp } from './nw';
import data from './routing.json';

// Shows:      a ping to 10.0.4.2 crossing three routers. At every router the packet stops, and the router goes down its own table row by row asking "is the destination
//             inside this network?". The row that says yes tells which cable to use and who to hand the packet to; the TTL on the packet goes down by one.
// Because:    the table is different at every router and the choice is made again at every hop. Only a picture that moves from router to router, and keeps the TTL left
//             behind at each stop, shows both.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: each router decides alone from its own table and the destination address, and every router costs one TTL (64 left the client, 61 reached the server).
//
// The tables are the real `ip route` output of the three routers and the TTL values are the ones captured on every link in exercises/04_ip_routing.py (routing.json).

const DEST = '10.0.4.2';
const D = 20;
const W = 110;
const X = [10, 198, 386, 574, 762];
const CX = X.map((x) => x + W / 2);
const Y = 20;
const LANE = 146;
const ROUTERS = ['r1', 'r2', 'r3'] as const;
const ARRIVE = [0, 3, 7.5, 12, 16.5];
const LEAVE = [1, 5.5, 10, 14.5, 99];
const NAME_OF: Record<string, string> = { '10.0.2.1': 'R1', '10.0.2.2': 'R2', '10.0.3.1': 'R2', '10.0.3.2': 'R3' };

const ip2n = (s: string) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0);
const inNet = (ip: string, cidr: string) => {
  const [net, len] = cidr.split('/');
  const l = Number(len);
  const mask = l === 0 ? 0 : (0xffffffff << (32 - l)) >>> 0;
  return ((ip2n(ip) & mask) >>> 0) === ((ip2n(net) & mask) >>> 0);
};

type T = {
  title: string; caption: string; names: string[]; tableOf: string; hNet: string; hIn: string; hVia: string; hDev: string; direct: string; yes: string; no: string;
  left: string; right: string; ttlRow: string; clientCard: string[]; serverCard: string[]; marks: Mark[]; scan: (r: string) => string; chose: (r: string, to: string) => string; sent: string;
};
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Ping ที่ไปหา 10.0.4.2 หยุดที่ Router ทีละตัว แต่ละตัวไล่ดูตารางของตัวเองทีละแถว แล้วเลือกสายส่งต่อ พร้อมกับลด TTL ลงหนึ่ง',
    caption: 'ตาราง Route คือผลของ ip route จริงของ Router ทั้งสามตัว และค่า TTL คือค่าที่จับได้บนสายแต่ละเส้นในแบบฝึก 04 (64, 63, 62 และ 61) ส่วนความเร็วของ Packet ในภาพเป็นแค่ภาพวาด',
    names: ['Client', 'R1', 'R2', 'R3', 'Server'], tableOf: 'ตารางของ', hNet: 'เครือข่าย', hIn: `${DEST} อยู่ในนี้ไหม`, hVia: 'ส่งต่อให้', hDev: 'ออกทางสาย',
    direct: 'ส่งเองเลย (ต่ออยู่)', yes: 'ใช่ ✓', no: 'ไม่ใช่', left: 'สายซ้าย', right: 'สายขวา', ttlRow: 'TTL ที่ออกจากแต่ละตัว',
    clientCard: ['Client ไม่มีตารางละเอียด', 'ของที่ไม่ได้อยู่บนสายตัวเอง ส่งให้ R1 หมด'], serverCard: ['Server รับ Packet ถึงปลายทางแล้ว', 'TTL ที่เหลือคือ 61'],
    scan: (r) => `${r} ไล่ดูตารางทีละแถว ว่า ${DEST} อยู่ในเครือข่ายไหน`, chose: (r, to) => `${r} เลือกแถวนี้ ส่งต่อให้ ${to} และลด TTL ลงหนึ่ง`, sent: 'ส่งออกแล้ว',
    marks: [
      { at: 0, name: 'Client', title: 'Client ส่ง Ping ออกไปด้วย TTL 64', text: 'Client ไม่มีตารางละเอียด มีแค่ข้อเดียวคือของที่ไม่ได้อยู่บนสายของตัวเอง ให้ส่งไปหา R1 Packet จึงออกไปด้วย TTL 64' },
      { at: 3, name: 'R1', title: 'R1 เลือกแถว 10.0.4.0/24', text: 'R1 เอา 10.0.4.2 ไปเทียบกับทุกแถว มีแถวเดียวที่ครอบมันอยู่ คือ 10.0.4.0/24 ซึ่งบอกให้ส่งต่อไปที่ R2 จากนั้นลด TTL เหลือ 63 แล้วส่งออกสายขวา' },
      { at: 7.5, name: 'R2', title: 'R2 ทำแบบเดียวกัน แต่ใช้ตารางของตัวเอง', text: 'R2 มีตารางคนละอันกับ R1 แถวที่ครอบ 10.0.4.2 ชี้ไปที่ R3 และ TTL ลดเหลือ 62 ไม่มี Router ตัวไหนรู้ว่า Packet นี้มาจากทางไหน หรือจะไปไกลแค่ไหน มันรู้แค่ว่าจะส่งต่อให้ใครในก้าวถัดไป' },
      { at: 12, name: 'R3', title: 'R3 ต่ออยู่กับเครือข่ายปลายทางโดยตรง', text: 'แถว 10.0.4.0/24 ของ R3 ไม่มีคำว่าส่งต่อให้ใคร เพราะ R3 ต่อกับเครือข่ายนี้อยู่แล้ว มันจึงส่งไปหา Server เองได้เลย (ถาม ARP หา 10.0.4.2) TTL ลดเหลือ 61' },
      { at: 16.5, name: 'Server', title: 'Server รับ Packet ด้วย TTL 61', text: 'เลข 64 ที่ออกจาก Client กลายเป็น 61 เพราะผ่าน Router มาสามตัว ถ้า Server ตอบกลับ ทางกลับก็ต้องผ่านสามตัวเช่นกัน' },
    ],
  },
  en: {
    title: 'Press play and watch a ping to 10.0.4.2 stop at each router, which goes down its own table row by row, picks a cable and lowers the TTL by one',
    caption: 'The routing tables are the real ip route output of the three routers, and the TTL values are the ones captured on each link in exercise 04 (64, 63, 62 and 61). The speed of the packet in the picture is only a drawing.',
    names: ['Client', 'R1', 'R2', 'R3', 'Server'], tableOf: 'Table of', hNet: 'network', hIn: `is ${DEST} inside?`, hVia: 'hand it to', hDev: 'out of',
    direct: 'send it itself (connected)', yes: 'yes ✓', no: 'no', left: 'left cable', right: 'right cable', ttlRow: 'TTL leaving each stop',
    clientCard: ['The client has no detailed table', 'Everything not on its own cable goes to R1'], serverCard: ['The server has received the packet', 'The TTL left is 61'],
    scan: (r) => `${r} goes down its table row by row to see which network contains ${DEST}`, chose: (r, to) => `${r} takes this row, hands it to ${to} and lowers the TTL by one`, sent: 'sent out',
    marks: [
      { at: 0, name: 'Client', title: 'The client sends the ping with TTL 64', text: 'The client has no detailed table, only one rule: whatever is not on its own cable goes to R1. The packet leaves with TTL 64.' },
      { at: 3, name: 'R1', title: 'R1 picks the row 10.0.4.0/24', text: 'R1 compares 10.0.4.2 with every row. Only one row contains it, 10.0.4.0/24, which says to hand it to R2. Then the TTL goes down to 63 and the packet leaves by the right cable.' },
      { at: 7.5, name: 'R2', title: 'R2 does the same with its own table', text: 'R2 has a different table from R1. The row that contains 10.0.4.2 points at R3, and the TTL goes down to 62. No router knows where the packet came from or how far it will go. It knows only who to hand it to next.' },
      { at: 12, name: 'R3', title: 'R3 is connected to the destination network', text: 'The 10.0.4.0/24 row of R3 names nobody to hand it to, because R3 sits on that network and can send the frame to the server itself (ARP asks for 10.0.4.2). The TTL goes down to 61.' },
      { at: 16.5, name: 'Server', title: 'The server receives it with TTL 61', text: 'The 64 that left the client has become 61 because three routers were crossed. If the server answers, the way back crosses three as well.' },
    ],
  },
};

export default function RoutingLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const tables = data.tables as Record<string, { net: string; via: string | null; dev: string }[]>;
  const req = data.ttl.request;

  let dev = 0;
  ARRIVE.forEach((a, i) => { if (t >= a) dev = i; });
  const moving = dev < 4 && t >= LEAVE[dev];
  const u = t - ARRIVE[dev];
  const pos: [number, number] = moving ? lerp([CX[dev], LANE], [CX[dev + 1], LANE], ease(t, LEAVE[dev], ARRIVE[dev + 1])) : [CX[dev], LANE];

  const r = dev >= 1 && dev <= 3 ? ROUTERS[dev - 1] : null;
  const rows = r ? tables[r] : null;
  const best = rows ? rows.filter((x) => inNet(DEST, x.net)).sort((a, b) => Number(b.net.split('/')[1]) - Number(a.net.split('/')[1]))[0] : null;
  const SCAN0 = 0.4, STEP = 0.35;
  const doneAt = SCAN0 + (rows ? rows.length : 0) * STEP + 0.2;
  const chosen = !!rows && !moving && u >= doneAt;
  const ttlNow = moving ? req[dev] : dev === 0 ? req[0] : dev === 4 ? req[3] : chosen ? req[dev] : req[dev - 1];

  // the cable that the chosen row uses is lit
  const litWire = moving ? dev : chosen && best ? (best.dev === 'l0' ? dev - 1 : dev) : -1;

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const banner = !r ? T.marks[current].title : moving ? T.sent : !chosen ? T.scan(T.names[dev]) : T.chose(T.names[dev], best?.via ? (NAME_OF[best.via] ?? best.via) : T.names[4]);

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} />
      <div className="viz-box">
        <svg viewBox="0 0 880 548" role="img" aria-label={T.title}>
          {[0, 1, 2, 3].map((i) => (<Wire key={i} x1={X[i] + W} y1={Y + 35} x2={X[i + 1]} y2={Y + 35} hot={litWire === i} />))}
          {T.names.map((n, i) => (
            <Dev key={n} x={X[i]} y={Y} w={W} h={70} kind={i === 0 ? 'host' : i === 4 ? 'server' : 'router'} title={n} sub={['10.0.1.2', '', '', '', DEST][i] || undefined} hot={dev === i && !moving} />
          ))}
          <path d={`M${CX[0]},${LANE} L${CX[4]},${LANE}`} className="nw-wire" style={{ strokeDasharray: '2 10', opacity: 0.8 }} />
          <Pk x={pos[0]} y={pos[1]} label={`→ ${DEST}  TTL ${ttlNow}`} kind="data" w={196} h={36} />
          <text x={12} y={188} className="ib-n" style={{ fill: 'var(--muted)' }}>{T.ttlRow}</text>
          {[0, 1, 2, 3].map((i) => (t >= LEAVE[i] ? (<Pk key={i} x={CX[i]} y={218} label={String(req[i])} kind="ack" w={56} h={26} />) : null))}
          {t >= ARRIVE[4] && <Pk x={CX[4]} y={218} label={String(req[3])} kind="ack" w={56} h={26} />}
          {rows && (
            <g>
              <text x={20} y={270} className="ib-t">{T.tableOf} {T.names[dev]}</text>
              <text x={30} y={300} className="ib-s">{T.hNet}</text>
              <text x={250} y={300} className="ib-s">{T.hIn}</text>
              <text x={520} y={300} className="ib-s">{T.hVia}</text>
              <text x={730} y={300} className="ib-s">{T.hDev}</text>
              {rows.map((row, i) => {
                const y = 310 + i * 40;
                const hit = chosen && best && row.net === best.net;
                const revealed = !moving && u >= SCAN0 + i * STEP;
                const inside = inNet(DEST, row.net);
                return (
                  <g key={row.net}>
                    <rect className={hit ? 'nw-cell on' : 'nw-cell'} x={20} y={y} width={840} height={34} rx={8} />
                    <text x={30} y={y + 24} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 16 }}>{row.net}</text>
                    <text x={250} y={y + 24} className="ib-n" style={{ fill: revealed ? (inside ? 'var(--k2)' : 'var(--muted)') : 'var(--muted)' }}>{revealed ? (inside ? T.yes : T.no) : '…'}</text>
                    <text x={520} y={y + 24} className="ib-n">{row.via ? (NAME_OF[row.via] ?? row.via) : T.direct}</text>
                    <text x={730} y={y + 24} className="ib-n">{row.dev === 'l0' ? T.left : T.right}</text>
                  </g>
                );
              })}
            </g>
          )}
          {!rows && (
            <g>
              <rect className="nw-cell" x={20} y={262} width={840} height={78} rx={10} />
              <text x={40} y={295} className="ib-t">{(dev === 0 ? T.clientCard : T.serverCard)[0]}</text>
              <text x={40} y={324} className="ib-n" style={{ fill: 'var(--muted)' }}>{(dev === 0 ? T.clientCard : T.serverCard)[1]}</text>
            </g>
          )}
          <Banner y={490} text={banner} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
