import { useState, type ReactNode } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, Arrow, Dot, type Lang } from '../devops/dv';
import data from './services.json';

// Shows:      a client Pod sending requests, one dot each, to a Service that has a fixed address, and the Service passing every dot on to one of three web Pods. A card beside the Service lists
//             its endpoints (the addresses of the Ready Pods that its selector matches). The reader changes the situation: all fine, one Pod not Ready, a selector with a typo, or a request from outside to a NodePort.
// Because:    "a Service gives a stable address to Pods that come and go" is about who is on the list at each moment, and a dot that is refused or lands on a different Pod shows it better than a definition.
// Control:    the situation (normal, one Pod not Ready, selector typo, NodePort); play, scrub and jump.
// Conclusion: the address of the Service never changes, while the list behind it follows the Pods that are Ready and match the labels. Nothing on the list means a refused connection.
//
// Real values from exercises/07_services.py (services.json): the ClusterIP, the three Pod IPs, DNS server 10.96.0.10, the 60 request spread, and NodePort 3xxxx. Which Pod each dot lands on is a fixed pattern (the real
// choice is random per connection), and the picture only has 12 dots.

type Sit = 'ok' | 'sick' | 'typo' | 'nodeport';
const D = 12;
const PODS = data.service.podIPs;
const PATTERN = [0, 2, 1, 2, 0, 1, 1, 2, 0, 2, 1, 0];
const SICK = 1;

const TEXT: Record<Lang, { title: string; caption: string; sit: string; sits: Record<Sit, string>; client: string; svc: string; ep: string; none: string; marks: Record<Sit, Mark[]>; banner: Record<Sit, string> }> = {
  th: {
    title: 'เลือกสถานการณ์แล้วกดเล่น ดูว่าคำขอแต่ละตัวไปลงที่ Pod ไหน และรายการ Endpoint เปลี่ยนไปอย่างไร',
    caption: `ClusterIP ${data.service.clusterIP}, IP ของ Pod ทั้งสาม, DNS Server ${data.dns.server} และ NodePort ${data.nodePort} มาจากการรันจริงในแบบฝึก 07 ส่วนการกระจายจริง 60 คำขอได้ ${data.spread.join(' / ')} (สุ่มต่อ Connection) ภาพนี้วาดแค่ 12 คำขอและ Pod ที่แต่ละคำขอไปลงเป็นแบบที่กำหนดไว้ ไม่ใช่ผลสุ่มจริง`,
    sit: 'สถานการณ์', sits: { ok: 'ปกติ', sick: 'Pod หนึ่งตัวไม่ Ready', typo: 'Selector พิมพ์ผิด', nodeport: 'เรียกจากข้างนอกผ่าน NodePort' },
    client: 'Pod client', svc: 'Service web', ep: 'รายการ Endpoint', none: '(ว่าง)',
    marks: {
      ok: [
        { at: 0, name: 'เริ่ม', title: 'Client เรียก web ด้วยชื่อ ไม่ได้เรียก IP ของ Pod', text: 'ชื่อ web ถูก DNS แปลงเป็น ClusterIP ซึ่งเป็น IP เสมือนที่ไม่ตรงกับ Pod ตัวไหน' },
        { at: 4, name: 'กระจาย', title: 'คำขอไปลงทั้งสาม Pod', text: 'kube-proxy มีกฎ iptables หนึ่งกฎต่อ Pod โดยเลือกแบบสุ่มด้วยความน่าจะเป็น 0.33333, 0.5 แล้วตัวสุดท้าย แล้ว DNAT ไปที่ IP ของ Pod' },
        { at: 11, name: 'จบ', title: 'จำนวนต่อ Pod ใกล้เคียงกันแต่ไม่เท่ากัน', text: 'การสุ่มเลือกเป็นต่อ Connection ไม่ใช่สลับทีละตัว จึงไม่มีรับประกันว่าจะเท่ากันพอดี' },
      ],
      sick: [
        { at: 0, name: 'เริ่ม', title: 'Pod ตัวกลางไม่ผ่าน Readiness Probe', text: 'Pod ยังรันอยู่ ไม่ถูก Restart แต่บอก Kubernetes ว่ายังไม่พร้อมรับคำขอ' },
        { at: 1.5, name: 'ออกจากรายการ', title: 'IP ของมันหายไปจาก EndpointSlice', text: 'ภายในไม่กี่วินาที กฎใน kube-proxy ก็ไม่ส่งอะไรไปให้มัน' },
        { at: 8, name: 'ผลลัพธ์', title: 'คำขอทั้งหมดไปลงสอง Pod ที่เหลือ (20 กับ 20 ในการรันจริง)', text: 'พอ Probe ผ่านอีกครั้ง IP ก็กลับเข้ารายการเอง' },
      ],
      typo: [
        { at: 0, name: 'เริ่ม', title: 'Selector เขียนว่า app=nobody แต่ Pod ใช้ app=web', text: 'Service ถูกสร้างได้สำเร็จเพราะ Selector ไม่ใช่เรื่องผิด มันแค่ไม่เจออะไร' },
        { at: 1.5, name: 'รายการว่าง', title: 'EndpointSlice ว่าง', text: 'ไม่มี Pod ที่ Label ตรง' },
        { at: 6, name: 'ปฏิเสธ', title: 'ทุกคำขอถูกปฏิเสธ: Connection refused', text: 'ในการรันจริงใช้เวลาประมาณ 1.3 วินาทีก่อนจะล้ม อาการนี้เจอบ่อยมากเวลาพิมพ์ Label ผิด' },
      ],
      nodeport: [
        { at: 0, name: 'เริ่ม', title: `คำขอจากข้างนอกเรียกที่ IP ของ Node พอร์ต ${data.nodePort}`, text: 'Service แบบ NodePort เปิดพอร์ตเดียวกันบนทุก Node' },
        { at: 3, name: 'Node ที่ไม่มี Pod', title: 'Node ที่รับคำขอไม่มี Pod ของ web เลย', text: 'ในการรันจริง Control Plane ซึ่งไม่มี Pod ของ web ตอบได้เหมือน Worker' },
        { at: 8, name: 'ส่งต่อ', title: 'kube-proxy บน Node นั้นส่งต่อไปยัง Pod บน Node อื่น', text: 'ผู้เรียกไม่ต้องรู้ว่า Pod อยู่ที่ไหน' },
      ],
    },
    banner: { ok: 'ที่อยู่ของ Service ไม่เปลี่ยน คำขอไปลงที่ Pod ใดก็ได้ในรายการ', sick: 'รายการ Endpoint ตามตัวที่ Ready เท่านั้น', typo: 'รายการว่าง = ไม่มีใครรับ', nodeport: 'ทุก Node เป็นทางเข้า' },
  },
  en: {
    title: 'Pick a situation and press play, and see which Pod each request lands on and how the endpoint list changes',
    caption: `The ClusterIP ${data.service.clusterIP}, the three Pod IPs, the DNS server ${data.dns.server} and NodePort ${data.nodePort} are from a real run of exercise 07. The real spread of 60 requests was ${data.spread.join(' / ')} (random per connection). This picture draws only 12 requests, and the Pod each one lands on is a fixed pattern, not a real random draw.`,
    sit: 'situation', sits: { ok: 'normal', sick: 'one Pod not Ready', typo: 'selector typo', nodeport: 'from outside, via NodePort' },
    client: 'client Pod', svc: 'Service web', ep: 'endpoint list', none: '(empty)',
    marks: {
      ok: [
        { at: 0, name: 'Start', title: 'The client calls web by name, not by a Pod IP', text: 'DNS turns the name web into the ClusterIP, a virtual IP that belongs to no Pod.' },
        { at: 4, name: 'Spread', title: 'Requests land on all three Pods', text: 'kube-proxy has one iptables rule per Pod, choosing at random with probability 0.33333, then 0.5, then the last one, and then does a DNAT to the Pod IP.' },
        { at: 11, name: 'End', title: 'Counts per Pod are close but not equal', text: 'The random choice is per connection, not a strict rotation, so an exact split is not promised.' },
      ],
      sick: [
        { at: 0, name: 'Start', title: 'The middle Pod fails its readiness probe', text: 'The Pod is still running and is not restarted, but it tells Kubernetes it is not ready for requests.' },
        { at: 1.5, name: 'Leaves the list', title: 'Its IP disappears from the EndpointSlice', text: 'Within seconds the rules in kube-proxy stop sending it anything.' },
        { at: 8, name: 'Result', title: 'All requests go to the two Pods that are left (20 and 20 in the real run)', text: 'When the probe passes again the IP returns to the list by itself.' },
      ],
      typo: [
        { at: 0, name: 'Start', title: 'The selector says app=nobody but the Pods use app=web', text: 'The Service is created fine, because a selector is not an error. It just finds nothing.' },
        { at: 1.5, name: 'Empty list', title: 'The EndpointSlice is empty', text: 'No Pod has a matching label.' },
        { at: 6, name: 'Refused', title: 'Every request is refused: Connection refused', text: 'In the real run it failed after about 1.3 s. This is the usual symptom of a mistyped label.' },
      ],
      nodeport: [
        { at: 0, name: 'Start', title: `A request from outside calls a node IP on port ${data.nodePort}`, text: 'A NodePort Service opens the same port on every node.' },
        { at: 3, name: 'Node with no Pod', title: 'The node that gets the request runs no web Pod', text: 'In the real run the control plane, which has no web Pod, answered just like a worker.' },
        { at: 8, name: 'Forwarded', title: 'kube-proxy on that node forwards it to a Pod on another node', text: 'The caller does not need to know where the Pods are.' },
      ],
    },
    banner: { ok: 'The Service address never changes; a request can land on any Pod in the list', sick: 'The endpoint list follows only the Ready Pods', typo: 'An empty list means nobody answers', nodeport: 'Every node is an entrance' },
  },
};

export default function ServiceLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<Sit>('ok');
  const clock = useClock(D);
  const t = clock.t;
  const sickNow = s === 'sick' && t >= 1.5;
  const listed = s === 'typo' ? [] : PODS.filter((_, i) => !(sickNow && i === SICK));
  const podY = [70, 150, 230];
  const cx = s === 'nodeport' ? 110 : 90;
  const dots: ReactNode[] = [];
  PATTERN.forEach((target0, i) => {
    const at = 0.8 + i * 0.8;
    let target = target0;
    if (s === 'sick' && at > 1.5 && target === SICK) target = target0 === SICK ? (i % 2 ? 0 : 2) : target0;
    const p1 = smooth(prog(t, at, at + 0.5));
    const p2 = smooth(prog(t, at + 0.5, at + 1.0));
    if (t < at) return;
    const sx = s === 'typo' ? 206 : 250, sy = 150;
    const bad = s === 'typo' && at > 1.5;
    const ty = podY[target] + 20;
    const x = p2 > 0 && !bad ? mix(sx, 600, p2) : mix(cx + 100, sx, p1);
    const y = p2 > 0 && !bad ? mix(sy, ty, p2) : mix(150, sy, p1);
    const fade = bad ? 1 - prog(t, at + 0.6, at + 1.3) : 1 - prog(t, at + 1.4, at + 1.9);
    dots.push(<Dot key={i} x={x} y={y} r={8} kind={bad ? 'bad' : 'none'} op={Math.max(0, fade)} />);
  });
  const counts = [0, 0, 0];
  PATTERN.forEach((tg, i) => { if (t >= 0.8 + i * 0.8 + 1.0) { let g = tg; if (s === 'sick' && 0.8 + i * 0.8 > 1.5 && g === SICK) g = i % 2 ? 0 : 2; if (s !== 'typo') counts[g]++; } });
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.sit} options={(Object.keys(T.sits) as Sit[]).map((k) => ({ id: k, text: T.sits[k] }))} value={s} onChange={(v) => { setS(v); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 390" role="img" aria-label={T.title}>
          <Tile x={20} y={118} w={150} h={64} title={s === 'nodeport' ? (lang === 'th' ? 'ข้างนอกคลัสเตอร์' : 'outside') : T.client} sub={s === 'nodeport' ? `:${data.nodePort}` : 'wget http://web/'} state="plain" />
          <Arrow x1={172} y1={150} x2={215} y2={150} />
          <Tile x={216} y={104} w={170} h={92} title={T.svc} sub={s === 'nodeport' ? 'NodePort' : `ClusterIP ${data.service.clusterIP}`} state={s === 'typo' ? 'bad' : 'on'} />
          <rect className="ib-node" x={216} y={214} width={170} height={118} rx={10} />
          <text x={228} y={238} className="ib-n">{T.ep}</text>
          {listed.length === 0 && <text x={228} y={266} className="ib-m">{T.none}</text>}
          {listed.map((ip, i) => <text key={ip} x={228} y={262 + i * 22} className="ib-m" style={{ fill: 'var(--fg)' }}>{ip}</text>)}
          {s === 'typo' && <text x={228} y={324} className="ib-s" style={{ fill: 'var(--ib-bad)' }}>selector: app=nobody</text>}
          {PODS.map((ip, i) => {
            const out = (sickNow && i === SICK) || s === 'typo';
            return <Tile key={ip} x={600} y={podY[i]} w={250} h={56} title={`web Pod ${i + 1}`} sub={`${ip}${out ? '  ✗ Not Ready' : ''}${!out ? `  ·  ${counts[i]}` : ''}`} state={out ? 'skip' : 'ok'} op={s === 'typo' ? 0.6 : 1} />;
          })}
          {dots}
          <Banner y={338} text={T.banner[s]} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks[s]} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
