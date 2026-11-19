import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Envelope, Legend, Wire, ease, mix, type EnvLayer } from './nw';
import data from './bigPicture.json';

// Shows:      one HTTP request put into a TCP envelope, then an IP envelope, then an Ethernet envelope at the client; the envelope travels to a router, which tears the
//             outer (Ethernet) envelope off and puts on a new one; at the server the envelopes are opened one by one until the original message is left.
// Because:    "each layer adds its own header, and the router only rewrites the link layer" is about which wrapper changes and which does not. Letters inside letters
//             show that at a glance, and the same envelope can be seen at two places.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: the IP and TCP envelopes and the message arrive exactly as they left; only the Ethernet envelope (and the TTL inside the IP one) is made new at a router.
//
// The MAC addresses, the TTL, the ports and the 131 bytes are the real ones of exercises/01_big_picture.py (bigPicture.json).

const D = 34;
const CX = { client: 200, router: 440, server: 680 };
const W = 380;

type T = {
  title: string; caption: string; client: string; router: string; server: string;
  eth: string; ip: string; tcp: string; msg: string; newTag: string; ttlTag: string;
  changed: string; changedWhat: string; same: string; sameWhat: string; delivered: string; marks: Mark[];
};

const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูข้อความหนึ่งข้อความถูกห่อเป็นซองซ้อนกันที่ Client เดินทางผ่าน Router แล้วถูกแกะออกทีละชั้นที่ Server',
    caption: 'MAC Address, TTL, Port และขนาด 131 ไบต์มาจากแบบฝึก 01 ซึ่งจับ Packet จริงทั้งฝั่ง Client และ Server ใน Linux Network Namespace ส่วนขนาดของซองในภาพเป็นแค่ภาพวาด',
    client: 'Client', router: 'Router', server: 'Server',
    eth: 'Ethernet · ไปที่ใครบนสายนี้', ip: 'IP · ไปคอมพิวเตอร์เครื่องไหน', tcp: 'TCP · ไปโปรแกรมตัวไหน', msg: 'ข้อความ HTTP', newTag: 'ใหม่', ttlTag: 'TTL ลด 1',
    changed: 'เปลี่ยนที่ Router', changedWhat: 'ซอง Ethernet และ TTL', same: 'ไม่เปลี่ยนตลอดทาง', sameWhat: 'ซอง IP, ซอง TCP และข้อความ', delivered: 'โปรแกรมได้ข้อความเดิมทุกตัวอักษร ✓',
    marks: [
      { at: 0, name: 'ข้อความ', title: 'เริ่มจากข้อความธรรมดา', text: 'โปรแกรมของเราเขียน HTTP Request ออกมายาว 65 ไบต์ ตอนนี้มันเป็นแค่ข้อความ ยังไม่มีใครรู้เลยว่าต้องส่งไปที่ไหน' },
      { at: 3, name: 'TCP', title: 'TCP เอาข้อความใส่ซองชั้นแรก', text: 'TCP เอาข้อความใส่ซอง แล้วเขียนหน้าซองว่าต้องส่งให้โปรแกรมตัวไหน ในที่นี้คือ Port 8080 ของ Server' },
      { at: 6, name: 'IP', title: 'IP ห่อซองอีกชั้น', text: 'IP เอาซอง TCP ใส่ซองใหม่ แล้วเขียนว่ามาจาก 10.0.1.2 ไปหา 10.0.2.2 พร้อมกับใส่ TTL 64 ไว้ด้วย' },
      { at: 9, name: 'Ethernet', title: 'Ethernet ห่อชั้นนอกสุด', text: 'Client ส่งตรงถึง Server ไม่ได้ เราจึงเขียนชื่อ MAC ของ Router เป็นปลายทางบนซองชั้นนอก ตอนนี้ได้ Frame ขนาด 131 ไบต์ที่พร้อมออกจากสาย' },
      { at: 12, name: 'สายแรก', title: 'ซองวิ่งไปหา Router', text: 'ชื่อที่เขียนบนซอง Ethernet มีความหมายเฉพาะสายเส้นนี้เท่านั้น' },
      { at: 17, name: 'Router', title: 'Router ลอกซองนอกทิ้ง แล้วห่อใหม่', text: 'Router แกะซอง Ethernet ออก แล้วอ่านหน้าซอง IP เห็นว่าไปที่ 10.0.2.2 จึงเลือกสายขาออก มันลด TTL ลงหนึ่ง (64 เหลือ 63) แล้วห่อซอง Ethernet ใหม่ ซึ่งใช้ MAC ของ Router เป็นต้นทางและ MAC ของ Server เป็นปลายทาง ส่วนซอง TCP กับข้อความไม่ถูกแตะเลย' },
      { at: 21, name: 'สายที่สอง', title: 'ซองใหม่วิ่งไปหา Server', text: 'ลองเทียบกับตอนออกจาก Client ดู ซอง IP กับซอง TCP เหมือนเดิมทุกตัวอักษร ที่เปลี่ยนมีแค่ซอง Ethernet กับ TTL' },
      { at: 26, name: 'Server', title: 'Server แกะซองทีละชั้น', text: 'Server แกะ Ethernet ออก ดูว่า IP เป็นของตัวเองไหม แล้วแกะ IP ออก ดู Port 8080 แล้วส่งข้อความให้โปรแกรมที่ฟัง Port นั้นอยู่ ซึ่งได้ข้อความเดียวกับที่ Client เขียนทุกตัวอักษร' },
    ],
  },
  en: {
    title: 'Press play and watch one message get wrapped in envelopes inside envelopes at the client, cross a router, and be opened layer by layer at the server',
    caption: 'The MAC addresses, TTL, ports and the 131 bytes come from exercise 01, which captured the real packets at both ends in Linux network namespaces. The size of the envelopes in the picture is only a drawing.',
    client: 'Client', router: 'Router', server: 'Server',
    eth: 'Ethernet · who on this cable', ip: 'IP · which computer', tcp: 'TCP · which program', msg: 'HTTP message', newTag: 'new', ttlTag: 'TTL down 1',
    changed: 'Changed at the router', changedWhat: 'the Ethernet envelope and the TTL', same: 'Never changed', sameWhat: 'the IP envelope, the TCP envelope and the message', delivered: 'The program gets the same text, letter for letter ✓',
    marks: [
      { at: 0, name: 'Message', title: 'It starts as plain text', text: 'Our program writes an HTTP request, 65 bytes long. For now it is only text, and nobody knows yet where it should go.' },
      { at: 3, name: 'TCP', title: 'TCP puts the message in the first envelope', text: 'TCP puts the message in an envelope and writes on it which program it is for. Here that is port 8080 on the server.' },
      { at: 6, name: 'IP', title: 'IP wraps another envelope', text: 'IP puts the TCP envelope in a new one and writes that it comes from 10.0.1.2 and goes to 10.0.2.2, with a TTL of 64.' },
      { at: 9, name: 'Ethernet', title: 'Ethernet is the outermost envelope', text: 'The client cannot reach the server directly, so we write the MAC of the router as the destination on the outer envelope. Now there is a 131-byte frame ready for the wire.' },
      { at: 12, name: 'Link 1', title: 'The envelope travels to the router', text: 'The name written on the Ethernet envelope means something only on this one cable.' },
      { at: 17, name: 'Router', title: 'The router tears the outer envelope off and wraps a new one', text: 'The router opens the Ethernet envelope and reads the IP one, which says 10.0.2.2, and picks the outgoing cable. It lowers the TTL by one (64 to 63) and wraps a new Ethernet envelope with its own MAC as source and the server\'s MAC as destination. The TCP envelope and the message are not touched.' },
      { at: 21, name: 'Link 2', title: 'The new envelope travels to the server', text: 'Compare with what left the client. The IP and TCP envelopes are the same, letter for letter. Only the Ethernet envelope and the TTL are different.' },
      { at: 26, name: 'Server', title: 'The server opens the envelopes one by one', text: 'The server opens the Ethernet envelope and checks that the IP address is its own, opens the IP one, reads port 8080, and hands the message to the program listening there, which sees exactly the text the client wrote.' },
    ],
  },
};

export default function PacketJourneyLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const c = data.client, s = data.server;

  const tcp = ease(t, 3, 4.5) * (1 - ease(t, 30, 31.5));
  const ip = ease(t, 6, 7.5) * (1 - ease(t, 28, 29.5));
  const ethAtRouter = t < 17 ? 1 : t < 18.5 ? 1 - ease(t, 17, 18.5) : t < 20 ? ease(t, 18.5, 20) : 1;
  const eth = ease(t, 9, 10.5) * ethAtRouter * (1 - ease(t, 26, 27.5));
  const afterRouter = t >= 18.5;
  const ttl = afterRouter ? s.ttl : c.ttl;
  const cx = t < 12 ? CX.client : t < 17 ? mix(CX.client, CX.router, ease(t, 12, 17)) : t < 21 ? CX.router : t < 26 ? mix(CX.router, CX.server, ease(t, 21, 26)) : CX.server;
  const justRemade = t >= 19.5 && t < 26;

  const layers: EnvLayer[] = [
    { layer: 'l2', name: T.eth, detail: afterRouter ? `${s.ethSrc} → ${s.ethDst}` : `${c.ethSrc} → ${c.ethDst}`, p: eth, tag: justRemade ? T.newTag : undefined, hot: justRemade },
    { layer: 'l3', name: T.ip, detail: `${c.ipSrc} → ${c.ipDst} · TTL ${ttl}`, p: ip, tag: justRemade ? T.ttlTag : undefined, hot: justRemade },
    { layer: 'l4', name: T.tcp, detail: `Port ${c.sport} → ${c.dport}`, p: tcp },
  ];

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend lang={lang} />
      <div className="viz-box">
        <svg viewBox="0 0 880 524" role="img" aria-label={T.title}>
          <Wire x1={295} y1={49} x2={345} y2={49} hot={t >= 12 && t < 17} />
          <Wire x1={535} y1={49} x2={585} y2={49} hot={t >= 21 && t < 26} />
          <Dev x={105} y={14} w={190} kind="host" title={T.client} sub={c.ipSrc} hot={t < 12} />
          <Dev x={345} y={14} w={190} kind="router" title={T.router} sub="10.0.1.1 | 10.0.2.1" hot={t >= 17 && t < 21} />
          <Dev x={585} y={14} w={190} kind="server" title={T.server} sub={c.ipDst} hot={t >= 26} />
          <Banner y={100} text={T.marks[current].title} />
          <Envelope cx={cx} y={168} w={W} layers={layers} bodyName={T.msg} body="GET /hello.txt HTTP/1.1" />
          {t >= 31.5 && (
            <text x={CX.server} y={444} textAnchor="middle" className="ib-n" style={{ fill: 'var(--brand)', opacity: ease(t, 31.5, 32.5) }}>{T.delivered}</text>
          )}
          <g style={{ opacity: ease(t, 20, 21) }}>
            <rect className="nw-cell on" x={12} y={456} width={420} height={58} rx={10} />
            <text x={26} y={480} className="ib-n">{T.changed}</text>
            <text x={26} y={502} className="ib-s" style={{ fill: 'var(--fg)' }}>{T.changedWhat}</text>
            <rect className="nw-cell ok" x={448} y={456} width={420} height={58} rx={10} />
            <text x={462} y={480} className="ib-n">{T.same}</text>
            <text x={462} y={502} className="ib-s" style={{ fill: 'var(--fg)' }}>{T.sameWhat}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
