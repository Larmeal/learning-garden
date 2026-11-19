import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Wire, ease, lerp, Card } from './nw';
import data from './proxies.json';

// Shows:      one Linux host that behaves like a Docker or Kubernetes node: a client on the left, an outside server on the right, and inside the host a bridge br0 with two containers (k1, k2). A switch picks
//             one of three trips (container to container, container to the outside, client to a published port). A packet flies along the trip with its source and destination written on it, and the
//             address that changes at a step is drawn highlighted.
// Because:    "a container has its own network" stays abstract until you see which address is on the packet at each hop. The three trips differ only in WHERE an address is rewritten (nowhere, the source
//             on the way out, the destination on the way in), which is what masquerade and a published port are.
// Control:    the three trips, then play and the scrub bar.
// Conclusion: inside the host the containers meet at layer 2 on the bridge; leaving the host the source is rewritten (MASQUERADE); arriving at the host the destination is rewritten (DNAT).
//
// The addresses on the packets (10.0.2.1 seen by the outside server, the SYN that reaches the bridge as 10.244.0.2:80) are the ones captured in exercises/13_proxies_containers.py (proxies.json).

type Trip = 'cc' | 'out' | 'pub';
const D = 12;
const SEG = 3;
type P = [number, number];
type TripDef = { pts: P[]; labels: string[]; chg: boolean[] };

const TRIPS: Record<Trip, TripDef> = {
  cc: { pts: [[305, 330], [430, 250], [555, 330]], labels: ['10.244.0.2 → 10.244.0.3  TTL 64', '10.244.0.2 → 10.244.0.3  TTL 64'], chg: [false, false] },
  out: { pts: [[305, 330], [430, 250], [650, 150], [722, 150]], labels: ['10.244.0.2 → 10.0.2.2:8080', '10.244.0.2 → 10.0.2.2:8080', `${data.egressSrc} → 10.0.2.2:8080`], chg: [false, false, true] },
  pub: { pts: [[150, 110], [210, 150], [430, 250], [305, 330]], labels: [data.publish.client, data.publish.client, data.publish.bridge], chg: [false, false, true] },
};

type T = { title: string; caption: string; trips: Record<Trip, string>; client: string; host: string; outside: string; legend: string[]; marks: Record<Trip, Mark[]> };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือกเส้นทางของ Packet แล้วกดเล่น ดูว่าที่อยู่บน Packet เปลี่ยนตรงไหนของ Host',
    caption: 'ที่อยู่บน Packet เป็นผลที่จับได้จริงในแบบฝึก 13 (Container ในแบบฝึกคือ Network Namespace สองใบกับ veth และ Bridge ไม่ได้ใช้ Docker หรือ Kubernetes จริง) กล่องเหลืองคือที่อยู่ที่เพิ่งถูกเขียนใหม่',
    trips: { cc: 'Container ไปหา Container', out: 'Container ออกไปข้างนอก', pub: 'Client เรียก Port ที่ Publish' },
    client: 'Client', host: 'Host (Router ของ Container)', outside: 'Server ข้างนอก',
    legend: ['ที่อยู่เดิม', 'ที่อยู่ที่เพิ่งถูกเขียนใหม่'],
    marks: {
      cc: [
        { at: 0.2, name: 'ออกจาก k1', title: 'k1 ส่งไปหา k2 ที่อยู่ในซับเน็ตเดียวกัน', text: 'k2 อยู่ใน 10.244.0.0/24 เหมือน k1 จึงไม่ต้องผ่าน Router ถามหา MAC ของ k2 ด้วย ARP แล้วส่งเข้าสาย veth ไปที่ Bridge' },
        { at: 3.2, name: 'ที่ Bridge', title: 'Bridge ทำงานเหมือน Switch ที่เราเห็นมาแล้ว', text: 'Bridge ดู MAC ปลายทางแล้วส่งออกอีกพอร์ตหนึ่ง ไม่ได้ลดค่า TTL เลย' },
        { at: 6.2, name: 'ถึง k2', title: 'TTL ยังเป็น 64', text: 'ค่า TTL ที่ ping เห็นคือ 64 เท่าตอนส่ง แปลว่าไม่ได้ผ่าน Router ข้ามไปสักตัว' },
      ],
      out: [
        { at: 0.2, name: 'ออกจาก k1', title: 'k1 ส่งไปหา Server ข้างนอกด้วยที่อยู่ส่วนตัว', text: '10.244.0.2 เป็นที่อยู่ที่ใช้ได้เฉพาะในซับเน็ตของ Bridge ปลายทางไม่อยู่ในซับเน็ตนี้ k1 จึงส่งให้ Gateway ซึ่งคือ Bridge (10.244.0.1) บน Host' },
        { at: 3.2, name: 'ที่ Host', title: 'Host ส่งต่อเหมือน Router และจดลง conntrack', text: 'กฎ MASQUERADE ที่ POSTROUTING จะเขียนที่อยู่ต้นทางเป็นที่อยู่ของสาย 10.0.2.1 และบันทึกคู่ที่อยู่ไว้ใน conntrack เพื่อแปลงขากลับ เหมือน NAT Router ที่เราเห็นมาแล้ว' },
        { at: 6.2, name: 'ถึง Server', title: 'Server เห็นแค่ที่อยู่ของ Host', text: 'ในแบบฝึก Server เห็นต้นทางเป็น 10.0.2.1 และไม่เห็น 10.244.0.2 เลย' },
      ],
      pub: [
        { at: 0.2, name: 'ถึง Host', title: 'Client เรียก Host ที่ Port 8080', text: 'Client รู้จักแค่ที่อยู่ของ Host (10.0.1.1) ไม่รู้ว่ามี Container อยู่ข้างใน' },
        { at: 3.2, name: 'DNAT', title: 'กฎ DNAT ที่ PREROUTING เขียนที่อยู่ปลายทางใหม่', text: 'Port ที่ Publish คือกฎ iptables ข้อเดียว: ถ้าปลายทางคือ 10.0.1.1:8080 ให้เปลี่ยนเป็น 10.244.0.2:80 ต้นทางยังเป็น Client ตัวเดิม' },
        { at: 6.2, name: 'ถึง k1', title: 'k1 ได้รับ SYN สำหรับพอร์ต 80', text: 'ที่ Bridge จับได้ SYN ไป 10.244.0.2:80 ส่วนที่สายของ Client เป็น 10.0.1.1:8080 คำตอบกลับไปทางเดิมด้วยการแปลงกลับจาก conntrack' },
      ],
    },
  },
  en: {
    title: 'Pick a trip and press play, and watch where the addresses on the packet change inside the host',
    caption: 'The addresses on the packet are the ones captured in exercise 13 (a container in the exercise is two network namespaces with veth pairs and a bridge, not real Docker or Kubernetes). A yellow box is an address that was just rewritten.',
    trips: { cc: 'container to container', out: 'container to the outside', pub: 'client calls a published port' },
    client: 'Client', host: 'Host (the containers\' router)', outside: 'outside server',
    legend: ['original address', 'address just rewritten'],
    marks: {
      cc: [
        { at: 0.2, name: 'Leaving k1', title: 'k1 sends to k2 in the same subnet', text: 'k2 is in 10.244.0.0/24 like k1, so no router is needed. k1 asks for the MAC of k2 with ARP and sends the frame down its veth to the bridge.' },
        { at: 3.2, name: 'At the bridge', title: 'The bridge works like the switch we already saw', text: 'It looks at the destination MAC and forwards out of the other port. It does not lower the TTL at all.' },
        { at: 6.2, name: 'Reaching k2', title: 'The TTL is still 64', text: 'The ping saw TTL 64, the value it was sent with, so no router was crossed on the way.' },
      ],
      out: [
        { at: 0.2, name: 'Leaving k1', title: 'k1 sends to the outside server with its private address', text: '10.244.0.2 is only valid in the bridge\'s subnet. The destination is not in this subnet, so k1 hands the packet to its gateway, the bridge (10.244.0.1) on the host.' },
        { at: 3.2, name: 'At the host', title: 'The host forwards like a router and writes to conntrack', text: 'The MASQUERADE rule at POSTROUTING rewrites the source to the address of the outgoing link, 10.0.2.1, and keeps the pair of addresses in conntrack so that it can translate the way back, like the NAT router we already saw.' },
        { at: 6.2, name: 'Reaching the server', title: 'The server sees only the host\'s address', text: 'In the exercise the server saw 10.0.2.1 as the source and never saw 10.244.0.2.' },
      ],
      pub: [
        { at: 0.2, name: 'Reaching the host', title: 'The client calls the host at port 8080', text: 'The client knows only the host\'s address (10.0.1.1) and does not know that containers exist inside.' },
        { at: 3.2, name: 'DNAT', title: 'A DNAT rule at PREROUTING rewrites the destination', text: 'A published port is one iptables rule: if the destination is 10.0.1.1:8080, change it to 10.244.0.2:80. The source stays the same client.' },
        { at: 6.2, name: 'Reaching k1', title: 'k1 receives a SYN for port 80', text: 'On the bridge the capture shows a SYN to 10.244.0.2:80, while on the client\'s cable it is 10.0.1.1:8080. The answer goes back the same way by reversing the translation from conntrack.' },
      ],
    },
  },
};

const wlen = (s: string) => Math.max(120, s.length * 8.2 + 20);

export default function ContainerNetLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [trip, setTrip] = useState<Trip>('cc');
  const clock = useClock(D);
  const { t } = clock;
  const def = TRIPS[trip];
  const marks = T.marks[trip];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const nseg = def.labels.length;
  const seg = Math.min(nseg - 1, Math.floor(Math.max(0, t - 0.2) / SEG));
  const p = ease(t, 0.2 + seg * SEG, 0.2 + seg * SEG + SEG - 0.4);
  const pos = lerp(def.pts[seg], def.pts[seg + 1], p);
  const lab = def.labels[seg];
  const w = wlen(lab);
  const lx = Math.min(Math.max(pos[0] - w / 2, 8), 872 - w);

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="trip">
          {(['cc', 'out', 'pub'] as Trip[]).map((x) => (<button key={x} type="button" aria-pressed={trip === x} onClick={() => { setTrip(x); clock.restart(); }}>{T.trips[x]}</button>))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'same', text: T.legend[0] }, { cls: 'chg', text: T.legend[1] }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <rect className="nw-cell" x={210} y={20} width={440} height={385} rx={14} />
          <text x={226} y={44} className="ib-s">{T.host}</text>
          <Wire x1={305} y1={330} x2={430} y2={250} />
          <Wire x1={555} y1={330} x2={430} y2={250} />
          <Wire x1={150} y1={110} x2={210} y2={150} />
          <Wire x1={430} y1={250} x2={650} y2={150} />
          <Wire x1={650} y1={150} x2={722} y2={150} />
          <Dev x={20} y={75} w={130} kind="host" title={T.client} sub="10.0.1.2" />
          <Dev x={722} y={113} w={150} kind="server" title={T.outside} sub="10.0.2.2" />
          <Dev x={365} y={215} w={130} h={64} kind="switch" title="br0" sub="10.244.0.1" />
          <Dev x={240} y={330} w={130} kind="server" title="k1" sub="10.244.0.2" />
          <Dev x={490} y={330} w={130} kind="server" title="k2" sub="10.244.0.3" />
          <text x={226} y={168} className="ib-s">10.0.1.1</text>
          <text x={560} y={140} className="ib-s">10.0.2.1</text>
          {t >= 0.2 && (
            <g>
              {(() => { const [from, ...rest] = lab.split(/\s*(?:→|->)\s*/); return <Card x={Math.min(Math.max(pos[0], 135), 745)} y={98} w={250} title={`${lang === 'th' ? 'จาก' : 'from'} ${from}`} sub={`${lang === 'th' ? 'ไป' : 'to'} ${rest.join(' → ')}`} kind={def.chg[seg] ? 'q' : 'a'} />; })()}
              <circle cx={pos[0]} cy={pos[1]} r={10} className="nw-l3" />
            </g>
          )}
          <Banner y={420} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
