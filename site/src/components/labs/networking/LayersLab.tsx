import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend, type Layer } from './nw';

// Shows:      the OSI model (seven layers) and the TCP/IP model (four layers) drawn as two stacks side by side, so each TCP/IP box spans the OSI layers that it covers.
//             The reader picks a protocol, a device or something a data engineer calls every day (HTTP, TLS, a switch, an L7 balancer, Kafka), or clicks a layer, and the layers
//             that the thing lives in light up in BOTH stacks, with a card beside them and a few sentences below.
// Because:    "L4", "L7", "a layer 2 switch" and "Application" mean different things in the two models, and a table of seven rows does not show that three OSI layers sit
//             inside one TCP/IP box. Two stacks of boxes show it at a glance, and picking things shows where they live.
// Control:    one of fourteen things in three groups, or a click on a layer.
// Conclusion: every protocol, device and tool has a place in the stack, the L-number of a device is the highest layer it reads, and TLS and the like do not fit one box exactly.
//
// No capture numbers here. The seven layers, their names and the table are from the book (AIO Book 2 chapter 1, pages 80 to 81 and 88 to 89); the names L4 and L7 of the balancers follow
// exercises/13_proxies_containers.py; the place of JDBC, S3 and Kafka is the author's understanding and was not run.

type Id = 'http' | 'dns' | 'tls' | 'tcp' | 'ip' | 'eth' | 'hub' | 'switch' | 'router' | 'lb4' | 'lb7' | 'jdbc' | 's3' | 'kafka';
interface Thing { rows: number[]; uses?: number[] }
// rows are OSI layer numbers (1 to 7); uses are the layers underneath that the thing relies on
const THING: Record<Id, Thing> = {
  http: { rows: [7], uses: [4] }, dns: { rows: [7] }, tls: { rows: [6], uses: [4] },
  tcp: { rows: [4] }, ip: { rows: [3] }, eth: { rows: [2] },
  hub: { rows: [1] }, switch: { rows: [2] }, router: { rows: [3] }, lb4: { rows: [4] }, lb7: { rows: [7] },
  jdbc: { rows: [7] }, s3: { rows: [7], uses: [4] }, kafka: { rows: [7], uses: [4] },
};
const GROUPS: { key: 'proto' | 'dev' | 'de'; ids: Id[] }[] = [
  { key: 'proto', ids: ['http', 'dns', 'tls', 'tcp', 'ip', 'eth'] },
  { key: 'dev', ids: ['hub', 'switch', 'router', 'lb4', 'lb7'] },
  { key: 'de', ids: ['jdbc', 's3', 'kafka'] },
];
const LAYER_OF: Record<number, Layer> = { 7: 'app', 6: 'app', 5: 'app', 4: 'l4', 3: 'l3', 2: 'l2', 1: 'l2' };
const TCPIP: { key: 'app' | 'transport' | 'network' | 'link'; from: number; to: number; layer: Layer }[] = [
  { key: 'app', from: 7, to: 5, layer: 'app' }, { key: 'transport', from: 4, to: 4, layer: 'l4' },
  { key: 'network', from: 3, to: 3, layer: 'l3' }, { key: 'link', from: 2, to: 1, layer: 'l2' },
];

type Sel = { t: 'item'; id: Id } | { t: 'layer'; n: number };
type ThingText = { name: string; where: string; body: string };
interface S {
  title: string; caption: string; legend: string[]; osi: string; tcpip: string; pick: string; groupName: Record<'proto' | 'dev' | 'de', string>;
  layers: Record<number, { name: string; ex: string; body: string }>;
  tcpipName: Record<'app' | 'transport' | 'network' | 'link', { name: string; sub: string }>;
  things: Record<Id, ThingText>; uses: string; layerWord: string;
}

const TEXT: Record<Lang, S> = {
  th: {
    title: 'เลือกของที่เราเจอบ่อยหรือกดที่ชั้น แล้วดูว่ามันอยู่ชั้นไหนของ OSI และของ TCP/IP',
    caption: 'เจ็ดชั้น ชื่อชั้น และตารางเทียบมาจากหนังสือ AIO Book 2 บทที่ 1 หน้า 80 ถึง 81 และ 88 ถึง 89 ชื่อ L4 กับ L7 ของ Load Balancer เป็นชื่อเรียกของผู้เขียน ส่วนพฤติกรรมรันจริงในแบบฝึก 13 ที่อยู่ของ JDBC, S3 และ Kafka เป็นความเข้าใจของผู้เขียนเอง ไม่ได้รัน',
    legend: ['Application (OSI ชั้น 7, 6, 5)', 'Transport (ชั้น 4)', 'Network (ชั้น 3)', 'Link (ชั้น 2, 1)'],
    osi: 'OSI เจ็ดชั้น', tcpip: 'TCP/IP สี่ชั้น', pick: 'ตัวที่เลือก',
    groupName: { proto: 'โปรโตคอล', dev: 'อุปกรณ์', de: 'ที่ DE เรียกใช้' },
    layers: {
      7: { name: 'Application', ex: 'HTTP, DNS', body: 'ชั้นที่โปรแกรมของเราคุยด้วยโดยตรง เป็นข้อความที่มีความหมายกับโปรแกรม เช่น คำขอ HTTP หรือคำถามของ DNS' },
      6: { name: 'Presentation', ex: 'แปลงรูปแบบ บีบอัด เข้ารหัส', body: 'แปลงข้อมูลให้อยู่ในรูปที่อีกฝั่งอ่านได้ บีบอัดให้เล็กลง และเข้ารหัสให้คนกลางอ่านไม่ออก' },
      5: { name: 'Session', ex: 'เปิดและดูแลบทสนทนา', body: 'เปิดบทสนทนาระหว่างสองคอมพิวเตอร์ ดูแลให้คุยกันต่อได้ และปิดเมื่อจบ' },
      4: { name: 'Transport', ex: 'TCP, UDP, Port', body: 'ส่งข้อมูลจากโปรแกรมหนึ่งไปถึงโปรแกรมที่ถูกตัวในอีกคอมพิวเตอร์หนึ่ง ใช้ Port ระบุ TCP เพิ่มการเรียงลำดับและส่งซ้ำ' },
      3: { name: 'Network', ex: 'IP Address, Router', body: 'พา Packet ข้ามหลายเครือข่ายไปถึงคอมพิวเตอร์ที่ถูกเครื่อง ใช้ IP Address และมี Router เป็นตัวเลือกทาง' },
      2: { name: 'Data Link', ex: 'MAC, Ethernet, Switch', body: 'ส่ง Frame ข้ามสายเส้นเดียวไปให้เพื่อนบ้านที่อยู่ปลายสาย ใช้ MAC Address ระบุ และมี Switch ส่งต่อให้' },
      1: { name: 'Physical', ex: 'สาย สัญญาณ Hub', body: 'ตัวสายและสัญญาณที่วิ่งบนสาย ยังไม่รู้จักว่าอะไรคือ Frame หรือที่อยู่' },
    },
    tcpipName: {
      app: { name: 'Application', sub: 'ชั้นเดียวแทนสามชั้นบน' },
      transport: { name: 'Transport', sub: '' }, network: { name: 'Network', sub: '' },
      link: { name: 'Link', sub: 'สายกับ Frame อยู่ชั้นเดียว' },
    },
    layerWord: 'ชั้น', uses: 'ใช้ TCP รองรับ',
    things: {
      http: { name: 'HTTP', where: 'Application', body: 'ข้อความคำขอและคำตอบที่โปรแกรมอ่านรู้เรื่อง จึงอยู่ชั้นบนสุด ส่วนการส่งให้ถึงมือ HTTP ใช้ TCP รองรับอยู่ข้างล่าง' },
      dns: { name: 'DNS', where: 'Application', body: 'DNS เป็นข้อความถามชื่อกับตอบ IP Address จึงอยู่ชั้น Application เหมือน HTTP แม้ตัวมันเองจะทำหน้าที่ช่วยให้ชั้นล่างหาปลายทางเจอ' },
      tls: { name: 'TLS', where: 'Presentation ตามตาราง', body: 'ตาราง OSI วางหน้าที่เข้ารหัสไว้ที่ Presentation แต่ TLS ตัวจริงนั่งอยู่ระหว่าง TCP กับ HTTP ซึ่งไม่ตรงกับกล่องไหนเป๊ะ ถ้ามีใครเถียงว่า TLS ชั้นเท่าไหร่ ก็ไม่ต้องจริงจังนะ' },
      tcp: { name: 'TCP / UDP / Port', where: 'Transport', body: 'Port บอกว่าข้อมูลนี้เป็นของโปรแกรมตัวไหน TCP ดูแลเรื่องเรียงลำดับและส่งซ้ำ ส่วน UDP ส่งไปเลย ทั้งสองอยู่ชั้นเดียวกัน' },
      ip: { name: 'IP Address', where: 'Network', body: 'ที่อยู่ที่ใช้พา Packet ข้ามหลายเครือข่าย Router ทุกตัวระหว่างทางอ่านชั้นนี้เพื่อเลือกสายขาออก' },
      eth: { name: 'Ethernet / MAC Address', where: 'Data Link', body: 'MAC Address มีความหมายเฉพาะสายเส้นเดียว ตอน Packet ผ่าน Router Frame ใหม่จะถูกสร้างขึ้นทุกครั้ง' },
      hub: { name: 'Hub', where: 'Physical', body: 'Hub แค่ส่งสัญญาณต่อไปทุกพอร์ต ไม่ดูเนื้อหา จึงเป็นอุปกรณ์ชั้น 1' },
      switch: { name: 'Switch', where: 'L2', body: 'Switch ดูแค่ MAC Address แล้วเลือกพอร์ตที่จะส่ง จึงเรียกว่าอุปกรณ์ L2 ไม่เปิดดู IP Address เลย' },
      router: { name: 'Router', where: 'L3', body: 'Router อ่าน IP Address เพื่อเลือกสายขาออก จึงเรียกว่าอุปกรณ์ L3 และสร้าง Frame ใหม่ให้สายเส้นถัดไปเอง' },
      lb4: { name: 'Load Balancer แบบ L4', where: 'L4', body: 'ดูแค่ IP กับ Port แล้วกระจายทีละ Connection ไม่เปิดอ่านข้อความ HTTP จึงเร็วและเรียบง่าย แต่ทุกคำขอใน Connection เดียวไปที่ Backend ตัวเดียวกัน' },
      lb7: { name: 'Load Balancer แบบ L7', where: 'L7', body: 'อ่านข้อความ HTTP แล้วเลือก Backend ให้แต่ละคำขอ จึงแยกตามเส้นทางหรือ Header ได้ แต่ต้องรับ Connection มาปิดเองก่อน (ดูแบบฝึกของบท 13)' },
      jdbc: { name: 'JDBC', where: 'Application', body: 'โค้ด DE ที่ต่อเข้า Database เขียนกันอยู่ที่ชั้นบนสุด ชั้นล่างที่ไม่ได้เขียนโค้ดเกี่ยวด้วยก็ยังเป็นสาเหตุที่พังได้' },
      s3: { name: 'S3 (ผ่าน HTTP)', where: 'Application', body: 'การอ่านไฟล์จาก S3 เป็นคำขอ HTTP ธรรมดา จึงอยู่ชั้น Application และใช้ TCP รองรับเหมือน HTTP ทั่วไป' },
      kafka: { name: 'Kafka', where: 'Application', body: 'Producer กับ Consumer ของ Kafka ส่งข้อความผ่าน TCP โปรแกรมเรามองเห็นแค่ชั้นบนสุด' },
    },
  },
  en: {
    title: 'Pick something we meet often, or click a layer, and see which layer of OSI and of TCP/IP it lives in',
    caption: 'The seven layers, their names and the comparison come from the book AIO Book 2 chapter 1, pages 80 to 81 and 88 to 89. The names L4 and L7 for balancers are the author\'s, and the behaviour was run in exercise 13. Where JDBC, S3 and Kafka sit is the author\'s own understanding and was not run.',
    legend: ['Application (OSI layers 7, 6, 5)', 'Transport (layer 4)', 'Network (layer 3)', 'Link (layers 2, 1)'],
    osi: 'OSI, seven layers', tcpip: 'TCP/IP, four layers', pick: 'what you picked',
    groupName: { proto: 'protocols', dev: 'devices', de: 'what DE calls' },
    layers: {
      7: { name: 'Application', ex: 'HTTP, DNS', body: 'The layer our program talks to directly. It is the message that means something to the program, such as an HTTP request or a DNS question.' },
      6: { name: 'Presentation', ex: 'convert, compress, encrypt', body: 'Converts data into a form the other side can read, compresses it, and encrypts it so that the middle cannot read it.' },
      5: { name: 'Session', ex: 'open and keep a conversation', body: 'Opens a conversation between two computers, keeps it going, and closes it when it is done.' },
      4: { name: 'Transport', ex: 'TCP, UDP, port', body: 'Gets data from one program to the right program on another computer, named by a port. TCP adds ordering and resending.' },
      3: { name: 'Network', ex: 'IP address, router', body: 'Carries a packet across many networks to the right computer. It uses IP addresses, and routers choose the way.' },
      2: { name: 'Data Link', ex: 'MAC, Ethernet, switch', body: 'Moves a frame across one cable to the neighbour at the other end, named by a MAC address. A switch forwards it.' },
      1: { name: 'Physical', ex: 'cable, signal, hub', body: 'The cable itself and the signal on it. It does not yet know what a frame or an address is.' },
    },
    tcpipName: {
      app: { name: 'Application', sub: 'one layer for the top three' },
      transport: { name: 'Transport', sub: '' }, network: { name: 'Network', sub: '' },
      link: { name: 'Link', sub: 'cable and frame in one layer' },
    },
    layerWord: 'layer', uses: 'relies on TCP',
    things: {
      http: { name: 'HTTP', where: 'Application', body: 'The request and answer text that a program can read, so it sits at the top. To get it delivered, HTTP relies on TCP below it.' },
      dns: { name: 'DNS', where: 'Application', body: 'DNS is a message that asks for a name and answers with an IP address, so it sits at the Application layer like HTTP, even though its job is to help the lower layers find the destination.' },
      tls: { name: 'TLS', where: 'Presentation, by the table', body: 'The OSI table puts encrypting at the Presentation layer, but the real TLS sits between TCP and HTTP, which matches no single box. If people argue about which layer TLS is, you do not need to take it seriously.' },
      tcp: { name: 'TCP / UDP / port', where: 'Transport', body: 'The port says which program this data is for. TCP looks after ordering and resending, and UDP just sends. Both sit on the same layer.' },
      ip: { name: 'IP address', where: 'Network', body: 'The address that carries a packet across many networks. Every router on the way reads this layer to pick the outgoing cable.' },
      eth: { name: 'Ethernet / MAC address', where: 'Data Link', body: 'A MAC address means something on one cable only. When a packet crosses a router, a new frame is built each time.' },
      hub: { name: 'Hub', where: 'Physical', body: 'A hub just repeats the signal out of every port and does not look at the content, so it is a layer 1 device.' },
      switch: { name: 'Switch', where: 'L2', body: 'A switch reads only the MAC address and picks the port to send to, so it is called a layer 2 device. It never opens the IP address.' },
      router: { name: 'Router', where: 'L3', body: 'A router reads the IP address to pick the outgoing cable, so it is called a layer 3 device, and it builds a new frame for the next cable itself.' },
      lb4: { name: 'Load balancer, L4 kind', where: 'L4', body: 'Looks only at the IP address and the port, and spreads whole connections. It does not read the HTTP message, so it is fast and simple, but every request in one connection goes to the same backend.' },
      lb7: { name: 'Load balancer, L7 kind', where: 'L7', body: 'Reads the HTTP message and picks a backend for each request, so it can split by path or header. It has to accept and end the connection itself first (see exercise 13).' },
      jdbc: { name: 'JDBC', where: 'Application', body: 'The DE code that connects to a database is written at the top layer. The lower layers that we never write code for can still be what breaks.' },
      s3: { name: 'S3 (over HTTP)', where: 'Application', body: 'Reading a file from S3 is a plain HTTP request, so it sits at the Application layer and relies on TCP like any HTTP.' },
      kafka: { name: 'Kafka', where: 'Application', body: 'Kafka producers and consumers send messages over TCP. Our program sees only the top layer.' },
    },
  },
};

const X0 = 14, W0 = 318, X1 = 346, W1 = 236, X2 = 600, W2 = 266;
const TOP = 40, RH = 50, GAP = 6;
const rowY = (n: number) => TOP + (7 - n) * (RH + GAP);
const spanY = (hi: number, lo: number) => ({ y: rowY(hi), h: rowY(lo) + RH - rowY(hi) });

export default function LayersLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sel, setSel] = useState<Sel>({ t: 'item', id: 'switch' });
  const lit = sel.t === 'item' ? THING[sel.id].rows : [sel.n];
  const used = sel.t === 'item' ? THING[sel.id].uses ?? [] : [];
  const rows = lit.length ? lit : [];
  const hi = Math.max(...rows), lo = Math.min(...rows);
  const call = spanY(hi, lo);
  const isOn = (n: number) => lit.includes(n);
  const isUse = (n: number) => used.includes(n);
  const title = sel.t === 'item' ? T.things[sel.id].name : `${T.layerWord} ${sel.n}: ${T.layers[sel.n].name}`;
  const where = sel.t === 'item' ? T.things[sel.id].where : '';
  const body = sel.t === 'item' ? T.things[sel.id].body : T.layers[sel.n].body;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls nw-groups">
        {GROUPS.map((g) => (
          <div key={g.key} className="nw-group">
            <span className="nw-group-name">{T.groupName[g.key]}</span>
            <div className="seg" role="group" aria-label={T.groupName[g.key]}>
              {g.ids.map((id) => (
                <button key={id} type="button" aria-pressed={sel.t === 'item' && sel.id === id} onClick={() => setSel({ t: 'item', id })}>{T.things[id].name}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'app', text: T.legend[0] }, { cls: 'l4', text: T.legend[1] }, { cls: 'l3', text: T.legend[2] }, { cls: 'l2', text: T.legend[3] }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 436" role="img" aria-label={T.title}>
          <text x={X0 + 4} y={26} className="ib-n">{T.osi}</text>
          <text x={X1 + 4} y={26} className="ib-n">{T.tcpip}</text>
          <text x={X2 + 4} y={26} className="ib-n">{T.pick}</text>

          {[7, 6, 5, 4, 3, 2, 1].map((n) => {
            const on = isOn(n), use = isUse(n);
            const L = T.layers[n];
            return (
              <g key={n} className="nw-row" onClick={() => setSel({ t: 'layer', n })} style={{ cursor: 'pointer', opacity: on || use ? 1 : 0.62 }}>
                <rect className={`nw-env ${LAYER_OF[n]}${on ? ' hot' : ''}`} x={X0} y={rowY(n)} width={W0} height={RH} rx={10} strokeDasharray={use ? '6 5' : undefined} />
                <text x={X0 + 16} y={rowY(n) + 32} className="ib-n" style={{ fontSize: 22 }}>{n}</text>
                <text x={X0 + 46} y={rowY(n) + 22} className="ib-n" style={{ fontSize: 17 }}>{L.name}</text>
                <text x={X0 + 46} y={rowY(n) + 41} className="ib-s" style={{ fill: 'var(--fg)' }}>{L.ex}</text>
              </g>
            );
          })}

          {TCPIP.map((b) => {
            const { y, h } = spanY(b.from, b.to);
            const on = lit.some((n) => n <= b.from && n >= b.to);
            const use = used.some((n) => n <= b.from && n >= b.to);
            const N = T.tcpipName[b.key];
            const cy = y + h / 2;
            return (
              <g key={b.key} style={{ opacity: on || use ? 1 : 0.62 }}>
                <rect className={`nw-env ${b.layer}${on ? ' hot' : ''}`} x={X1} y={y} width={W1} height={h} rx={10} strokeDasharray={use && !on ? '6 5' : undefined} />
                <text x={X1 + W1 / 2} y={N.sub ? cy - 2 : cy + 6} textAnchor="middle" className="ib-n" style={{ fontSize: 18 }}>{N.name}</text>
                {N.sub && <text x={X1 + W1 / 2} y={cy + 20} textAnchor="middle" className="ib-s" style={{ fill: 'var(--fg)' }}>{N.sub}</text>}
              </g>
            );
          })}

          <g>
            <rect className="nw-cell on" x={X2} y={call.y} width={W2} height={call.h} rx={10} />
            <text x={X2 + 16} y={call.y + 23} className="ib-n" style={{ fontSize: 17 }}>{title.length > 23 ? title.slice(0, 22) + '…' : title}</text>
            {where && <text x={X2 + 16} y={call.y + 42} className="ib-s" style={{ fill: 'var(--fg)' }}>{where}</text>}
          </g>
          {used.length > 0 && (() => {
            const u = spanY(Math.max(...used), Math.min(...used));
            return (
              <g>
                <rect className="nw-cell" x={X2} y={u.y} width={W2} height={u.h} rx={10} strokeDasharray="6 5" />
                <text x={X2 + 16} y={u.y + 30} className="ib-s" style={{ fill: 'var(--fg)' }}>{T.uses}</text>
              </g>
            );
          })()}
        </svg>
      </div>
      <div className="nw-explain" role="status">
        <b>{title}</b>{where ? <span> · {where}</span> : null}
        <p>{body}</p>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
