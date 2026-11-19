import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Lifelines, Msg, Pk, Legend, ease, mix } from './nw';
import data from './routing.json';

// Shows:      traceroute as a series of probes. Probe k is a packet with TTL k. It dies at the k-th router, which sends back "time exceeded". The last probe reaches the server,
//             which answers "port unreachable". The lines of the traceroute output appear one by one, with the real round-trip times.
// Because:    traceroute only makes sense when we see the TTL run out at a different hop each time. Without the picture it looks like magic.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: traceroute is not a special protocol: it is ordinary packets with a rising TTL, and the routers that drop them introduce themselves by the error message.
//
// The addresses, the ICMP types and the round trips are the real output of the traceroute of exercises/04_ip_routing.py (routing.json), on a path with 5 ms of delay on every cable.

const D = 21;
const XS = [70, 250, 430, 610, 790];
const START = (k: number) => 1 + 4.5 * k;
const Y0 = 100;
const PITCH = 80;

type T = { title: string; caption: string; names: string[]; out: string; exceeded: string; unreach: string; head: string; marks: Mark[]; legendProbe: string; legendBack: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Traceroute ส่ง Probe ด้วย TTL 1, 2, 3 และ 4 แต่ละอันตายที่ Router คนละตัว แล้ว Router นั้นบอกชื่อตัวเองกลับมา',
    caption: 'ที่อยู่ ชนิดของ ICMP และเวลาไปกลับในภาพคือผลจริงของ Traceroute ในแบบฝึก 04 บนเส้นทางที่ทุกสายถูกหน่วงไว้ 5 มิลลิวินาที',
    names: ['Client', 'R1', 'R2', 'R3', 'Server'], out: 'ผลที่ Traceroute พิมพ์', exceeded: 'time exceeded', unreach: 'port unreachable', head: 'TTL   ที่อยู่ที่ตอบ     ชนิด               ไปกลับ',
    legendProbe: 'Probe ที่ส่งออกไป (UDP พร้อม TTL)', legendBack: 'คำตอบ ICMP ที่ส่งกลับ',
    marks: [
      { at: START(0), name: 'TTL 1', title: 'Probe แรก TTL 1 ตายที่ R1', text: 'Client ส่ง UDP ไปหา 10.0.4.2 ด้วย TTL 1 R1 ลด TTL เหลือ 0 จึงทิ้ง Packet แล้วส่ง ICMP Time Exceeded กลับมา ซึ่งมีที่อยู่ของ R1 เป็นต้นทาง Client จึงรู้ว่าฮอปแรกคือ 10.0.1.2' },
      { at: START(1), name: 'TTL 2', title: 'Probe ที่สอง TTL 2 ตายที่ R2', text: 'ครั้งนี้ R1 ส่งต่อ (TTL เหลือ 1) และ R2 เป็นตัวที่ลดเหลือ 0 จึงตอบกลับ ใช้เวลาไปกลับนานขึ้นราว 10 มิลลิวินาที เพราะผ่านสายเพิ่มอีกเส้น' },
      { at: START(2), name: 'TTL 3', title: 'Probe ที่สาม TTL 3 ตายที่ R3', text: 'R3 เป็นตัวที่ทำให้ TTL หมด และตอบกลับด้วยที่อยู่ของมันเอง' },
      { at: START(3), name: 'TTL 4', title: 'Probe ที่สี่ถึง Server', text: 'TTL 4 พอสำหรับผ่าน R1, R2, R3 ไปถึง Server แต่ Server ไม่มีโปรแกรมฟัง Port ที่เราสุ่มไว้ มันจึงตอบ ICMP Port Unreachable ซึ่ง Traceroute ถือว่าเป็นสัญญาณว่าถึงปลายทางแล้ว' },
    ],
  },
  en: {
    title: 'Press play and watch traceroute send probes with TTL 1, 2, 3 and 4. Each dies at a different router, which introduces itself in its answer',
    caption: 'The addresses, the ICMP types and the round trips are the real result of the traceroute of exercise 04, on a path where every cable is delayed by 5 milliseconds.',
    names: ['Client', 'R1', 'R2', 'R3', 'Server'], out: 'What traceroute prints', exceeded: 'time exceeded', unreach: 'port unreachable', head: 'TTL   answered from    type               round trip',
    legendProbe: 'a probe sent out (UDP with a TTL)', legendBack: 'the ICMP answer coming back',
    marks: [
      { at: START(0), name: 'TTL 1', title: 'The first probe, TTL 1, dies at R1', text: 'The client sends UDP to 10.0.4.2 with TTL 1. R1 lowers it to 0, so it drops the packet and sends back an ICMP Time Exceeded with its own address as the source. The client now knows the first hop is 10.0.1.2.' },
      { at: START(1), name: 'TTL 2', title: 'The second probe, TTL 2, dies at R2', text: 'This time R1 forwards it (TTL becomes 1) and R2 is the one that lowers it to 0 and answers. The round trip is about 10 milliseconds longer because it crossed one more cable.' },
      { at: START(2), name: 'TTL 3', title: 'The third probe, TTL 3, dies at R3', text: 'R3 is the router that runs the TTL out, and it answers with its own address.' },
      { at: START(3), name: 'TTL 4', title: 'The fourth probe reaches the server', text: 'TTL 4 is enough to cross R1, R2 and R3 and reach the server. But nothing listens on the port we chose, so the server answers ICMP Port Unreachable, which traceroute takes as the sign that it has arrived.' },
    ],
  },
};

export default function TracerouteLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const rows = data.traceroute as { ttl: number; from: string; type: number; code: number; rtt: number }[];
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.legendProbe }, { cls: 'same', text: T.legendBack }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 574" role="img" aria-label={T.title}>
          <Lifelines xs={XS} y1={74} y2={420} names={T.names} subs={['', '10.0.1.2', '10.0.2.2', '10.0.3.2', '10.0.4.2']} />
          {rows.map((r, k) => {
            const s = START(k);
            const y = Y0 + k * PITCH;
            const pOut = ease(t, s, s + 1.6);
            const pBack = ease(t, s + 2, s + 3.4);
            const x2 = XS[k + 1];
            const last = r.type === 3;
            const say = `${r.from}  ${last ? T.unreach : T.exceeded}`;
            return (
              <g key={k}>
                <Msg x1={XS[0]} y1={y} x2={x2} y2={y} p={pOut} kind="data" lost={!last} n={k + 1} />
                {pOut > 0.02 && pOut < 0.99 && <Pk x={mix(XS[0] + 56, x2 - 56, pOut)} y={y} label={`TTL ${r.ttl}`} kind="data" w={86} h={30} />}
                {pOut >= 0.99 && !last && <Pk x={x2 - 58} y={y} label={`TTL ${r.ttl}`} kind="retx" w={86} h={30} op={1 - pBack} />}
                <Msg x1={x2} y1={y + 36} x2={XS[0]} y2={y + 36} p={pBack} kind="ack" />
                {pBack > 0.02 && pBack < 0.99 && <Pk x={mix(x2 - 44, XS[0] + 44, pBack)} y={y + 36} label="ICMP" kind="ack" w={66} h={26} />}
                {pBack > 0.5 && <text x={last ? x2 - 16 : x2 + 16} y={y + 23} textAnchor={last ? 'end' : 'start'} className="ib-n" style={{ fill: 'var(--fg)' }}>{say}</text>}
              </g>
            );
          })}
          <rect className="nw-cell" x={20} y={430} width={840} height={132} rx={10} />
          <text x={32} y={452} className="ib-layer">{T.out}</text>
          <text x={32} y={474} className="ib-m" style={{ fill: 'var(--muted)', whiteSpace: 'pre' }}>{T.head}</text>
          {rows.map((r, k) => t >= START(k) + 3.4 && (
            <text key={k} x={32} y={498 + k * 20} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, whiteSpace: 'pre' }}>
              {`${r.ttl}      ${r.from.padEnd(14, ' ')}${(r.type === 3 ? T.unreach : T.exceeded).padEnd(19, ' ')}${r.rtt} ms`}
            </text>
          ))}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
