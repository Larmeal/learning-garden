import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, PacketBar, Wire, ease, mix, type Part } from './nw';
import data from './bigPicture.json';

// Shows:      one HTTP request being wrapped in a TCP header, an IP header and an Ethernet header at the client, travelling to a router, losing its Ethernet header
//             there and getting a new one, and being unwrapped layer by layer at the server. A table under the packet shows which fields stayed the same at both ends.
// Because:    "each layer adds its own header and the router only rewrites the link layer" is a statement about order and about which bytes change. A sentence cannot show
//             the same bytes at two places.
// Control:    play, the scrub bar and the jump buttons (the clock). Nothing else: the picture is one packet's story.
// Conclusion: the IP addresses and ports stay the same from end to end; the Ethernet addresses and the TTL are made new at every router.
//
// The sizes (14, 20, 32 and 65 bytes), the MAC addresses, the TTL and the ports are the real ones of exercises/01_big_picture.py (bigPicture.json).
// The lengths of the bars are drawn, not proportional to the bytes.

const D = 35;
const CX = { client: 228, router: 440, server: 652 };

type T = {
  title: string; caption: string; client: string; router: string; server: string; fieldH: string; sentH: string; gotH: string;
  fields: string[]; bytes: string; same: string; changed: string; marks: Mark[];
};

const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Request หนึ่งอันถูกห่อทีละชั้นที่ Client เดินผ่าน Router และถูกแกะออกที่ Server',
    caption: 'ขนาด Header, MAC Address, TTL และ Port มาจากแบบฝึก 01 ซึ่งจับ Packet จริงทั้งฝั่ง Client และฝั่ง Server ใน Linux Network Namespace ส่วนความกว้างของแท่งในภาพเป็นแค่ภาพวาด ไม่ได้เป็นสัดส่วนกับจำนวนไบต์',
    client: 'Client', router: 'Router', server: 'Server',
    fieldH: 'Field', sentH: 'ตอน Client ส่งออก', gotH: 'ตอนถึง Server',
    fields: ['Ethernet ต้นทาง', 'Ethernet ปลายทาง', 'IP ต้นทาง', 'IP ปลายทาง', 'TTL', 'Port'],
    bytes: 'ไบต์', same: 'เหมือนกันทั้งสองฝั่ง', changed: 'Router เปลี่ยน',
    marks: [
      { at: 0, name: 'Request', title: 'Application เขียน Request เป็นข้อความ', text: 'โปรแกรมของเราเขียน HTTP Request ออกมาเป็นข้อความธรรมดายาว 65 ไบต์ ตอนนี้ยังไม่มีอะไรบอกเลยว่าจะส่งไปที่ไหน' },
      { at: 3, name: 'TCP', title: 'Transport เติม TCP Header', text: 'TCP แปะ Header 32 ไบต์ไว้หน้าข้อมูล ในนั้นมี Port ปลายทาง 8080 ที่บอกว่าข้อมูลนี้เป็นของโปรแกรมตัวไหนบน Server และมีเลข Sequence ให้อีกฝั่งใช้นับ' },
      { at: 6, name: 'IP', title: 'Network เติม IP Header', text: 'IP แปะ Header 20 ไบต์ที่มีที่อยู่ต้นทาง 10.0.1.2 กับปลายทาง 10.0.2.2 และ TTL เริ่มที่ 64' },
      { at: 9, name: 'Ethernet', title: 'Link เติม Ethernet Header', text: 'Client ส่งตรงถึง Server ไม่ได้ จึงเขียน MAC Address ของ Router เป็นปลายทางของ Frame ตอนนี้ได้ Frame ขนาด 131 ไบต์ที่พร้อมออกจากสาย' },
      { at: 12, name: 'สายแรก', title: 'Frame วิ่งไปหา Router', text: 'Frame วิ่งไปตามสายระหว่าง Client กับ Router เฉพาะสายเส้นนี้เท่านั้นที่ MAC Address ในหัว Frame มีความหมาย' },
      { at: 17, name: 'Router', title: 'Router ลอก Ethernet ทิ้งแล้วห่อใหม่', text: 'Router อ่าน IP Header เห็นปลายทาง 10.0.2.2 จึงเลือกสายขาออก มันลด TTL ลงหนึ่ง (64 เป็น 63) แล้วห่อ Ethernet Header ใหม่ ที่มี MAC ของตัวเองเป็นต้นทางและ MAC ของ Server เป็นปลายทาง ส่วน TCP กับข้อมูลไม่ถูกแตะเลย' },
      { at: 20, name: 'สายที่สอง', title: 'Frame ใหม่วิ่งไปหา Server', text: 'ดูตารางด้านล่าง IP กับ Port เหมือนเดิมทุกตัว แต่ Ethernet ทั้งสองช่องกับ TTL ถูกเปลี่ยนไปแล้ว' },
      { at: 25, name: 'Server', title: 'Server แกะทีละชั้น', text: 'Server ลอก Ethernet ออก ดู IP ว่าเป็นของตัวเองไหม ลอก IP ออก ดู Port 8080 แล้วส่งข้อมูลให้โปรแกรมที่ฟัง Port นั้นอยู่ ซึ่งเห็นข้อความเดียวกับที่ Client เขียนทุกตัวอักษร' },
    ],
  },
  en: {
    title: 'Press play and watch one request get wrapped layer by layer at the client, cross a router, and be unwrapped at the server',
    caption: 'The header sizes, MAC addresses, TTL and ports come from exercise 01, which captured the real packets at both ends in Linux network namespaces. The width of the bars is a drawing, not proportional to the bytes.',
    client: 'Client', router: 'Router', server: 'Server',
    fieldH: 'Field', sentH: 'When the client sends', gotH: 'When it reaches the server',
    fields: ['Ethernet source', 'Ethernet destination', 'IP source', 'IP destination', 'TTL', 'Port'],
    bytes: 'bytes', same: 'same at both ends', changed: 'changed by the router',
    marks: [
      { at: 0, name: 'Request', title: 'The application writes a request as text', text: 'Our program writes an HTTP request as plain text, 65 bytes long. Nothing in it says where it should go yet.' },
      { at: 3, name: 'TCP', title: 'Transport adds a TCP header', text: 'TCP puts a 32-byte header in front of the data. It holds the destination port 8080, which says which program on the server the data is for, and a sequence number the other side uses to count.' },
      { at: 6, name: 'IP', title: 'Network adds an IP header', text: 'IP puts a 20-byte header in front, with the source address 10.0.1.2, the destination 10.0.2.2 and a TTL that starts at 64.' },
      { at: 9, name: 'Ethernet', title: 'Link adds an Ethernet header', text: 'The client cannot reach the server directly, so it writes the router\'s MAC address as the destination of the frame. Now there is a 131-byte frame ready for the wire.' },
      { at: 12, name: 'Link 1', title: 'The frame travels to the router', text: 'The frame runs along the cable between the client and the router. The MAC addresses in its header mean something only on this one cable.' },
      { at: 17, name: 'Router', title: 'The router drops Ethernet and wraps again', text: 'The router reads the IP header, sees the destination 10.0.2.2 and picks the outgoing cable. It lowers the TTL by one (64 to 63) and builds a new Ethernet header with its own MAC as source and the server\'s MAC as destination. TCP and the data are not touched.' },
      { at: 20, name: 'Link 2', title: 'The new frame travels to the server', text: 'Look at the table below. The IP addresses and ports are the same, but both Ethernet fields and the TTL were changed.' },
      { at: 25, name: 'Server', title: 'The server unwraps layer by layer', text: 'The server removes Ethernet, checks that the IP address is its own, removes IP, reads port 8080 and hands the data to the program listening there, which sees exactly the text the client wrote.' },
    ],
  },
};

export default function PacketJourneyLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;

  // How much of each header is present (0 to 1): added on the way down at the client, the Ethernet one remade at the router, removed on the way up at the server.
  const eth = ease(t, 9, 10.5) * (t < 17 ? 1 : t < 18.5 ? 1 - ease(t, 17, 18) : ease(t, 18.5, 19.5)) * (1 - ease(t, 26, 27));
  const ip = ease(t, 6, 7.5) * (1 - ease(t, 28, 29));
  const tcp = ease(t, 3, 4.5) * (1 - ease(t, 30, 31));
  const W = { eth: 88, ip: 78, tcp: 94, http: 148 };
  const part = (layer: Part['layer'], label: string, w: number, f: number): Part[] => (f > 0.02 ? [{ layer, label: f > 0.9 ? label : '', w: Math.max(4, w * f) }] : []);
  const parts: Part[] = [
    ...part('l2', 'Eth 14', W.eth, eth),
    ...part('l3', 'IP 20', W.ip, ip),
    ...part('l4', 'TCP 32', W.tcp, tcp),
    { layer: 'app', label: 'HTTP 65', w: W.http },
  ];
  const bytes = 65 + Math.round(14 * eth) + Math.round(20 * ip) + Math.round(32 * tcp);
  const cx = t < 12 ? CX.client : t < 17 ? mix(CX.client, CX.router, ease(t, 12, 17)) : t < 20 ? CX.router : t < 25 ? mix(CX.router, CX.server, ease(t, 20, 25)) : CX.server;
  const total = parts.reduce((a, p) => a + (p.w ?? 0), 0) + 2 * (parts.length - 1);
  const left = cx - total / 2;
  const ipX = left + (eth > 0.02 ? Math.max(4, W.eth * eth) + 2 : 0);
  const ttl = t < 19.5 ? data.client.ttl : data.server.ttl;

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at) current = i; });

  const sent = t >= 10 ? 1 : 0;
  const got = t >= 19.5 ? 1 : 0;
  const rows: [string, string, string, boolean][] = [
    [T.fields[0], data.client.ethSrc, data.server.ethSrc, true],
    [T.fields[1], data.client.ethDst, data.server.ethDst, true],
    [T.fields[2], data.client.ipSrc, data.client.ipSrc, false],
    [T.fields[3], data.client.ipDst, data.client.ipDst, false],
    [T.fields[4], String(data.client.ttl), String(data.server.ttl), true],
    [T.fields[5], `${data.client.sport} → ${data.client.dport}`, `${data.client.sport} → ${data.client.dport}`, false],
  ];

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend lang={lang} extra={[{ cls: 'same', text: T.same }, { cls: 'chg', text: T.changed }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <Wire x1={190} y1={57} x2={345} y2={57} hot={t >= 12 && t < 17} />
          <Wire x1={535} y1={57} x2={690} y2={57} hot={t >= 20 && t < 25} />
          <Dev x={20} y={20} w={170} kind="host" title={T.client} sub="10.0.1.2" hot={t < 12} />
          <Dev x={345} y={20} w={190} kind="router" title={T.router} sub="10.0.1.1 | 10.0.2.1" hot={t >= 17 && t < 20} />
          <Dev x={690} y={20} w={170} kind="server" title={T.server} sub="10.0.2.2" hot={t >= 25} />
          {ip > 0.8 && <text x={ipX + (W.ip * ip) / 2} y={116} textAnchor="middle" className="ib-m" style={{ fontWeight: 700, fill: 'var(--fg)', fontSize: 16 }}>TTL {ttl}</text>}
          <PacketBar x={cx} y={124} parts={parts} h={40} center />
          <text x={cx} y={188} textAnchor="middle" className="ib-s" style={{ fontSize: 15 }}>{bytes} {T.bytes}</text>
          <Banner y={198} text={T.marks[current].title} />
          <text x={226} y={266} className="ib-layer">{T.sentH}</text>
          <text x={552} y={266} className="ib-layer">{T.gotH}</text>
          {rows.map(([name, a, b, changes], i) => {
            const y = 276 + i * 31;
            return (
              <g key={name}>
                <text x={20} y={y + 21} className="ib-n" style={{ fontSize: 15 }}>{name}</text>
                <g style={{ opacity: sent }}>
                  <rect className="nw-cell ok" x={216} y={y} width={320} height={27} rx={7} />
                  <text x={226} y={y + 19} className="ib-m" style={{ fill: 'var(--fg)' }}>{a}</text>
                </g>
                <g style={{ opacity: got }}>
                  <rect className={`nw-cell ${changes ? 'on' : 'ok'}`} x={542} y={y} width={318} height={27} rx={7} />
                  <text x={552} y={y + 19} className="ib-m" style={{ fill: 'var(--fg)' }}>{b}</text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
