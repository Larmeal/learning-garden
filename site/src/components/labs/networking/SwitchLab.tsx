import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Pk, Wire, ease, lerp } from './nw';
import data from './linkLayer.json';

// Shows:      three computers (a, b, c) on one switch, and a table inside the switch that fills up. The first frame a sends to b is copied to every other port
//             (so c sees it), the reply goes to one port only, and from then on a and b talk without c seeing anything.
// Because:    "a switch learns where each MAC address is, and floods what it does not know" is a rule about a table changing over time and about which cable
//             carries a copy. A sentence cannot show the table filling and the copies leaving.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: a switch is a table of MAC address to port that it fills by itself from the sender of every frame, and a frame to an unknown address goes everywhere.
//
// Who saw each frame (seenBy) is the real result of the capture in exercises/03_link_layer.py (linkLayer.json). The rule of learning is drawn from it,
// and the final table is the real `bridge fdb show` of the exercise.

const D = 26;
type Host = 'a' | 'b' | 'c';
const HOSTS: Record<Host, { box: [number, number]; edge: [number, number]; ip: string }> = {
  a: { box: [30, 155], edge: [200, 190], ip: '10.0.1.2' },
  b: { box: [680, 155], edge: [680, 190], ip: '10.0.1.3' },
  c: { box: [355, 330], edge: [440, 330], ip: '10.0.1.4' },
};
const SW: [number, number] = [440, 190];
const PORT: Record<Host, string> = { a: 'p1', b: 'p2', c: 'p3' };
const swEdge: Record<Host, [number, number]> = { a: [365, 190], b: [515, 190], c: [440, 225] };
const START = (i: number) => 1 + 6 * i;

type T = { title: string; caption: string; names: Record<Host, string>; table: string; mac: string; port: string; empty: string; drop: string; got: string; marks: Mark[]; legendFlood: string; steps: string[] };

const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูตารางในสวิตช์ค่อย ๆ เต็ม Frame ครั้งแรกถูกส่งไปทุก Port แต่ครั้งต่อ ๆ ไปไปแค่ Port เดียว',
    caption: 'ใครเห็น Frame ไหน (c เห็นแค่ Echo Request ครั้งแรก) เป็นผลจริงของการจับ Packet ในแบบฝึก 03 ส่วนตารางตอนท้ายตรงกับ bridge fdb show ที่รันจริง ชื่อ a, b, c ย่อมาจากคอมพิวเตอร์สามตัวในแบบฝึก',
    names: { a: 'a', b: 'b', c: 'c' }, table: 'ตาราง MAC ในสวิตช์', mac: 'MAC', port: 'Port', empty: 'ว่าง ยังไม่รู้จักใครเลย',
    drop: 'ไม่ใช่ MAC ของฉัน ทิ้ง', got: 'รับ', legendFlood: 'สำเนาที่ถูกส่งไป Port ที่ไม่ใช่ปลายทาง (Flood)',
    steps: [
      'สวิตช์รับ Frame จาก {s} แล้วจดว่า MAC ต้นทางอยู่ที่ Port {p}',
      'MAC ปลายทางยังไม่เคยเห็น สวิตช์ไม่รู้ว่าอยู่ Port ไหน จึงส่งสำเนาออกทุก Port ยกเว้น Port ที่รับมา (Flood)',
      'MAC ปลายทางอยู่ที่ Port {p} ตามตาราง สวิตช์ส่ง Frame ออก Port นั้นเพียงอันเดียว',
    ],
    marks: [
      { at: START(0), name: 'a ส่งหา b', title: 'Frame แรก: a ส่ง Ping ไปหา b', text: 'สวิตช์เพิ่งเปิด ตารางยังว่าง มันได้ Frame จาก a จึงจด MAC ของ a ว่าอยู่ที่ p1 แต่ยังไม่รู้ว่า b อยู่ตรงไหน เลยส่งสำเนาไปทั้ง b และ c ซึ่ง c ได้รับ Frame ที่ไม่ใช่ของตัวเองแล้วทิ้ง' },
      { at: START(1), name: 'b ตอบ', title: 'b ตอบกลับหา a', text: 'ตอนนี้สวิตช์รู้ MAC ของ a จากข้อที่แล้ว จึงส่งคำตอบไป p1 ที่เดียว c ไม่เห็นเลย และสวิตช์จด MAC ของ b ว่าอยู่ที่ p2' },
      { at: START(2), name: 'a ส่งอีกครั้ง', title: 'a ส่ง Ping ครั้งที่สอง', text: 'คราวนี้สวิตช์รู้จักทั้ง a และ b Frame ไปที่ p2 ที่เดียว c เงียบสนิท' },
      { at: START(3), name: 'b ตอบอีกครั้ง', title: 'ตารางนิ่งแล้ว', text: 'ตารางมีสองแถว คือ a ที่ p1 และ b ที่ p2 ไม่มีแถวของ c เลย เพราะ c ยังไม่เคยส่งอะไรออกมา (ตรงกับ bridge fdb show ที่รันจริง)' },
    ],
  },
  en: {
    title: 'Press play and watch the table in the switch fill up. The first frame goes out of every port, the later ones out of one port only',
    caption: 'Who saw which frame (c sees only the first echo request) is the real result of the capture in exercise 03. The final table matches the real bridge fdb show. The names a, b and c are the three computers of the exercise.',
    names: { a: 'a', b: 'b', c: 'c' }, table: 'MAC table in the switch', mac: 'MAC', port: 'Port', empty: 'empty, nobody known yet',
    drop: 'not my MAC, drop', got: 'got it', legendFlood: 'a copy sent to a port that is not the destination (flood)',
    steps: [
      'The switch receives the frame from {s} and notes that the source MAC is on port {p}',
      'It has never seen the destination MAC, so it does not know the port. It sends a copy out of every port except the one it came in on (flood)',
      'The table says the destination MAC is on port {p}, so the switch sends the frame out of that one port',
    ],
    marks: [
      { at: START(0), name: 'a to b', title: 'First frame: a pings b', text: 'The switch has just started and its table is empty. It gets a frame from a, so it notes that a\'s MAC is on p1, but it does not know where b is. It sends a copy to both b and c, and c drops a frame that is not for it.' },
      { at: START(1), name: 'b replies', title: 'b replies to a', text: 'Now the switch knows a\'s MAC from the last frame, so it sends the reply to p1 only. c sees nothing, and the switch notes that b\'s MAC is on p2.' },
      { at: START(2), name: 'a again', title: 'a pings b a second time', text: 'This time the switch knows both a and b. The frame goes to p2 only and c stays silent.' },
      { at: START(3), name: 'b again', title: 'The table is stable', text: 'The table has two rows, a on p1 and b on p2, and no row for c, because c has not sent anything yet (it matches the real bridge fdb show).' },
    ],
  },
};

const ev = data.switch.events as { kind: string; n: number; src: Host; dst: Host; seenBy: Host[] }[];

export default function SwitchLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;

  // The table after each frame has been received (learning happens when the frame arrives at the switch, 1.4 s after it left).
  const learned: { mac: Host; at: number }[] = [];
  ev.forEach((e, i) => { if (!learned.some((l) => l.mac === e.src)) learned.push({ mac: e.src, at: START(i) + 1.4 }); });
  const rows = learned.filter((l) => t >= l.at);

  // Which event is on screen, and the sentence for its phase.
  let cur = -1;
  ev.forEach((_, i) => { if (t >= START(i)) cur = i; });
  const e = cur >= 0 ? ev[cur] : null;
  const u = e ? t - START(cur) : 0;
  const knownBefore = e ? learned.filter((l) => l.at <= START(cur) + 1.4 - 0.01 && l.mac !== e.src).some((l) => l.mac === e.dst) : false;
  let banner = lang === 'th' ? 'สวิตช์เพิ่งเปิด ตารางว่าง กดเล่นเพื่อดู Frame แรก' : 'The switch has just started and its table is empty. Press play to see the first frame';
  if (e) {
    const s = T.names[e.src];
    if (u < 2.4) banner = T.steps[0].replace('{s}', s).replace('{p}', PORT[e.src]);
    else banner = knownBefore ? T.steps[2].replace('{p}', PORT[e.dst]) : T.steps[1];
  }

  const label = e ? (e.kind === 'ICMP echo request' ? `Ping ${e.src}→${e.dst}` : `Pong ${e.src}→${e.dst}`) : '';
  const copies: { to: Host; flood: boolean }[] = e ? e.seenBy.filter((h) => h !== e.src).map((h) => ({ to: h, flood: h !== e.dst })) : [];

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const hot = (h: Host) => !!e && ((u < 1.4 && h === e.src) || (u >= 3.8 && u < 5 && copies.some((c) => c.to === h)));

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: lang === 'th' ? 'Frame ที่ส่งถึงปลายทาง' : 'a frame to its destination' }, { cls: 'bad', text: T.legendFlood }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 476" role="img" aria-label={T.title}>
          {(['a', 'b', 'c'] as Host[]).map((h) => (
            <Wire key={h} x1={HOSTS[h].edge[0]} y1={HOSTS[h].edge[1]} x2={swEdge[h][0]} y2={swEdge[h][1]} hot={hot(h)} />
          ))}
          <Dev x={SW[0] - 75} y={SW[1] - 35} w={150} kind="switch" title="Switch" sub={lang === 'th' ? 'Bridge' : 'bridge'} />
          {(['a', 'b', 'c'] as Host[]).map((h) => (
            <Dev key={h} x={HOSTS[h].box[0]} y={HOSTS[h].box[1]} w={170} kind="host" title={T.names[h]} sub={HOSTS[h].ip} hot={hot(h)} />
          ))}
          <text x={228} y={180} className="ib-m">p1</text>
          <text x={528} y={180} className="ib-m">p2</text>
          <text x={452} y={252} className="ib-m">p3</text>
          {/* the MAC table */}
          <g>
            <rect className="nw-cell" x={300} y={6} width={280} height={118} rx={10} />
            <text x={314} y={28} className="ib-layer">{T.table}</text>
            {rows.length === 0 && <text x={314} y={62} className="ib-s">{T.empty}</text>}
            {rows.map((r, i) => (
              <g key={r.mac} style={{ opacity: Math.min(1, (t - r.at) / 0.5 + 0.3) }}>
                <rect className={t - r.at < 1.2 ? 'nw-cell on' : 'nw-cell'} x={310} y={38 + i * 38} width={260} height={32} rx={7} />
                <text x={322} y={60 + i * 38} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>…:0{r.mac === 'a' ? 'a' : r.mac === 'b' ? 'b' : 'c'}  ({r.mac})</text>
                <text x={556} y={60 + i * 38} textAnchor="end" className="ib-n">{PORT[r.mac]}</text>
              </g>
            ))}
          </g>
          {/* the frame: host to switch, then out to the ports */}
          {e && u < 1.4 && (() => { const [x, y] = lerp(HOSTS[e.src].edge, swEdge[e.src], ease(u, 0, 1.4)); return <Pk x={x} y={y - 22} label={label} kind="data" />; })()}
          {e && u >= 2.4 && u < 5 && copies.map((c) => {
            const [x, y] = lerp(swEdge[c.to], HOSTS[c.to].edge, ease(u, 2.4, 3.8));
            const dy = c.to === 'c' ? 0 : -22;
            const dx = c.to === 'c' ? 56 : 0;
            return c.flood
              ? <g key={c.to}><rect className="nw-lost" x={x + dx - 44} y={y + dy - 15} width={88} height={30} rx={8} /><text x={x + dx} y={y + dy + 5} textAnchor="middle" className="ib-m" style={{ fill: 'var(--ib-bad)', fontWeight: 700 }}>{label}</text></g>
              : <Pk key={c.to} x={x + dx} y={y + dy} label={label} kind="data" />;
          })}
          {e && u >= 3.8 && u < 5.8 && copies.filter((c) => c.flood).map((c) => (
            <text key={c.to} x={c.to === 'c' ? 530 : 765} y={c.to === 'c' ? 372 : 262} textAnchor={c.to === 'c' ? 'start' : 'middle'} className="ib-s" style={{ fill: 'var(--ib-bad)', fontWeight: 700 }}>{T.drop}</text>
          ))}
          <Banner y={420} text={banner} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
