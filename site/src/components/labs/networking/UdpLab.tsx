import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Lost, Pk, PacketBar, Wire, ease, lerp } from './nw';
import data from './udpDns.json';

// Shows:      six datagrams of different sizes leaving a client one after another. The network drops the third and the sixth, the other four arrive each as one piece with its own
//             size, and the sender never hears about the two that were lost.
// Because:    "UDP does not tell you when something is lost" is about what the sender does NOT see. A picture with a sender counter that reaches 6 and a receiver counter that stops at 4
//             shows the gap, and the 8-byte header shows how little UDP adds.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: UDP sends independent messages with no connection, no acknowledgement and no resending, so loss is the application's problem.
//
// The sizes, the 8-byte header (ports, length, checksum) and which datagrams arrived are the real ones of exercises/06_udp_dns.py (udpDns.json).

const D = 22;
const START = (i: number) => 1 + 2.6 * i;
const A: [number, number] = [190, 150], B: [number, number] = [690, 150];

type T = { title: string; caption: string; client: string; server: string; sent: string; got: string; lost: string; marks: Mark[]; header: string[]; none: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Datagram ของ UDP หกอันออกจาก Client ไป Server โดยที่เครือข่ายทิ้งอันที่สามกับอันที่หก และคนส่งไม่รู้เลย',
    caption: 'ขนาด 10 ถึง 60 ไบต์ Header ขนาด 8 ไบต์ (Port, Length, Checksum) และการที่ Server ได้รับแค่ 4 อัน เป็นผลจริงของแบบฝึก 06 ส่วนการทิ้งทำโดยกฎของ iptables ที่ฝั่ง Server',
    client: 'Client', server: 'Server', sent: 'ส่งไปแล้ว', got: 'Server ได้รับ', lost: 'หายระหว่างทาง', none: 'ไม่มีใครบอกคนส่ง',
    header: ['Port ต้นทาง', 'Port ปลายทาง', 'Length', 'Checksum'],
    marks: [
      { at: START(0), name: 'ส่งอันแรก', title: 'ส่ง Datagram ได้เลย ไม่ต้อง Handshake', text: 'UDP ไม่มีการจับมือ Client เรียก sendto แล้ว Datagram แรกก็ออกสาย มี Header แค่ 8 ไบต์ คือ Port ต้นทาง Port ปลายทาง ความยาว และ Checksum' },
      { at: START(2), name: 'อันที่ 3 หาย', title: 'Datagram ที่ 3 ถูกทิ้ง', text: 'กฎบนฝั่ง Server ทิ้งทุก Datagram ที่สามที่เข้ามา คนส่งเรียก sendto สำเร็จทุกครั้ง และไม่มีข้อความแจ้งว่าอันที่ 3 ไม่ถึง' },
      { at: START(5), name: 'อันที่ 6 หาย', title: 'หกอันส่งไป สี่อันถึง', text: 'Datagram ที่หกถูกทิ้งเช่นกัน Server ได้รับ 1, 2, 4 และ 5 ซึ่งแต่ละอันมาเป็นก้อนเดียว ขนาดตรงกับที่ส่ง (10, 20, 40, 50 ไบต์) UDP รักษาขอบเขตของข้อความไว้ ถ้าต้องการให้ครบ ต้องให้โปรแกรมชั้นบนเป็นคนนับเอง' },
    ],
  },
  en: {
    title: 'Press play and watch six UDP datagrams leave a client for a server while the network drops the third and the sixth, and the sender never knows',
    caption: 'The sizes of 10 to 60 bytes, the 8-byte header (ports, length, checksum) and the fact that the server got only 4 are the real results of exercise 06. The dropping is done by an iptables rule on the server side.',
    client: 'Client', server: 'Server', sent: 'sent', got: 'the server got', lost: 'lost on the way', none: 'nobody tells the sender',
    header: ['source port', 'destination port', 'length', 'checksum'],
    marks: [
      { at: START(0), name: 'First one', title: 'A datagram can go at once, with no handshake', text: 'UDP has no handshake. The client calls sendto and the first datagram leaves at once, with a header of only 8 bytes: source port, destination port, length and checksum.' },
      { at: START(2), name: 'Number 3 lost', title: 'Datagram 3 is dropped', text: 'A rule on the server side drops every third datagram that arrives. The sender\'s sendto succeeds every time, and no message says that number 3 did not arrive.' },
      { at: START(5), name: 'Number 6 lost', title: 'Six sent, four arrived', text: 'Datagram 6 is dropped as well. The server got 1, 2, 4 and 5, each as one piece of the same size as sent (10, 20, 40, 50 bytes). UDP keeps the boundaries of messages. If we want all of them, the program above has to count them itself.' },
    ],
  },
};

export default function UdpLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const sent = data.udp.sent as { n: number; size: number; lost: boolean }[];
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const h = data.udp.header;
  const sentCount = sent.filter((s, i) => t >= START(i) + 0.4).length;
  const gotCount = sent.filter((s, i) => !s.lost && t >= START(i) + 2.2).length;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={['l4', 'app']} lang={lang} extra={[{ cls: 'bad', text: T.lost }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <Wire x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} />
          <Dev x={20} y={115} w={170} kind="host" title={T.client} sub="10.0.1.2:40000" />
          <Dev x={690} y={115} w={170} kind="server" title={T.server} sub="10.0.1.4:9999" />
          {sent.map((s, i) => {
            const t0 = START(i);
            if (t < t0 || t > t0 + 2.6) return null;
            const stop = s.lost ? 0.62 : 1;
            const p = ease(t, t0 + 0.2, t0 + 2.2) * stop;
            const [x, y] = lerp(A, B, p);
            const dropped = s.lost && t > t0 + 1.5;
            return dropped
              ? <Lost key={i} x={lerp(A, B, 0.62)[0]} y={y - 26} label={`#${s.n}`} op={Math.max(0, 1 - (t - (t0 + 1.5)) / 1.0)} />
              : <Pk key={i} x={x} y={y - 26} label={`#${s.n} · ${s.size} B`} kind="data" w={96} />;
          })}
          <text x={20} y={236} className="ib-n">{T.sent}: {sentCount}</text>
          <text x={690} y={236} className="ib-n">{T.got}: {gotCount}</text>
          {sentCount >= 3 && <text x={440} y={236} textAnchor="middle" className="ib-s" style={{ fill: 'var(--ib-bad)', fontWeight: 700 }}>{T.none}</text>}
          <PacketBar x={40} y={276} parts={[
            { layer: 'l4', label: `${T.header[0]} ${h.sport}`, w: 170 },
            { layer: 'l4', label: `${T.header[1]} ${h.dport}`, w: 170 },
            { layer: 'l4', label: `${T.header[2]}`, w: 100 },
            { layer: 'l4', label: `${T.header[3]}`, w: 110 },
            { layer: 'app', label: 'data', w: 240 },
          ]} h={40} />
          <text x={40} y={340} className="ib-s">UDP header = 8 {lang === 'th' ? 'ไบต์' : 'bytes'} (2 + 2 + 2 + 2)</text>
          <Banner y={400} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
