import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Wire, ease, lerp } from './nw';
import data from './proxies.json';

// Shows:      eight requests from one client, flying one after another through a load balancer to two backends (k1, k2). A switch picks the kind of balancer (layer 4, which balances connections,
//             or layer 7, which balances requests), whether the client keeps one connection or opens a new one for every request, and whether k2 is alive. Each request is a dot coloured by the backend
//             that answered, or a red cross when the connection was refused. A panel shows what the backend saw as the address of its peer.
// Because:    the difference between layer 4 and layer 7 is invisible in a diagram of boxes. It shows only in WHAT is balanced (a connection or a request), in WHO the backend thinks it is talking to, and in
//             what happens when a backend dies. Eight dots in a row make the pattern (alternating, or stuck) visible.
// Control:    the three switches. Each one changes the sequence of dots and the panel.
// Conclusion: layer 4 spreads connections and keeps the client's address but cannot see a dead backend; layer 7 spreads requests, shows the client only in a header, and can try another backend.
//
// The sequences of backends (k1, k2, k1... or k1 only) and the refused connections are the real results of exercises/13_proxies_containers.py (proxies.json).

type Layer = 'l4' | 'l7';
type Conn = 'new' | 'same';
const D = 22;
const START = (i: number) => 1 + i * 2.2;

type T = { title: string; caption: string; layer: Record<Layer, string>; conn: Record<Conn, string>; alive: string[]; client: string; balancer: Record<Layer, string>; sees: string; peer: string; xff: string; none: string; refused: string; marks: Mark[]; legend: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือกชนิดของ Load Balancer แล้วกดเล่น ดูว่ามันกระจายอะไร (Connection หรือคำขอ) และ Backend เห็นใครเป็นคนเรียก',
    caption: 'ลำดับ Backend ที่ตอบ (k1, k2 สลับกัน หรือ k1 ตัวเดียว), Connection ที่ถูกปฏิเสธ และที่อยู่ที่ Backend เห็น เป็นผลจริงของแบบฝึก 13 Layer 4 ในแบบฝึกคือกฎ iptables (DNAT แบบ round robin) ส่วน Layer 7 คือ Proxy ที่เขียนเองด้วย Python ไม่ใช่ HAProxy หรือ Nginx',
    layer: { l4: 'Layer 4 (iptables)', l7: 'Layer 7 (Proxy)' }, conn: { new: 'Connection ใหม่ทุกคำขอ', same: 'Connection เดียวทั้งหมด' }, alive: ['k2 ปกติ', 'k2 ตายแล้ว'],
    client: 'Client', balancer: { l4: 'iptables DNAT', l7: 'Reverse Proxy' }, sees: 'Backend เห็นว่าคนที่เรียกคือ', peer: 'ที่อยู่ปลายทาง (peer)', xff: 'X-Forwarded-For', none: 'ไม่มี', refused: 'ถูกปฏิเสธ', legend: 'คำขอที่ k1 ตอบ',
    marks: [
      { at: START(0), name: 'คำขอแรก', title: 'คำขอแรกเข้ามาที่ Load Balancer', text: 'Client ไม่ได้ต่อไปที่ k1 หรือ k2 โดยตรง มันต่อไปที่ที่อยู่เดียวของบริการ (10.96.0.10 หรือ Proxy) แล้ว Load Balancer เลือก Backend ให้' },
      { at: START(4), name: 'ครึ่งทาง', title: 'ดูรูปแบบของ Backend ที่ตอบ', text: 'Layer 4 สลับ k1 กับ k2 ตามจำนวน Connection ใหม่ ถ้าใช้ Connection เดียว ทุกคำขอไป Backend เดิมเพราะ Connection ถูกตรึงไว้ ส่วน Layer 7 สลับตามคำขอ แม้อยู่ใน Connection เดียวกัน' },
      { at: START(7) + 1.5, name: 'สรุป', title: 'อ่านแผงด้านล่าง: Backend เห็นอะไร', text: 'Layer 4 เปลี่ยนแค่ที่อยู่ปลายทาง Backend จึงเห็นที่อยู่จริงของ Client Layer 7 เปิด Connection ใหม่ไปหา Backend เอง Backend จึงเห็นที่อยู่ของ Proxy และต้องดู X-Forwarded-For เพื่อรู้ว่า Client คือใคร ถ้า k2 ตาย Layer 4 ปฏิเสธทุก Connection ที่สอง ส่วน Layer 7 ลอง Backend อีกตัวให้เอง' },
    ],
  },
  en: {
    title: 'Pick the kind of load balancer and press play, and see what it spreads (connections or requests) and who the backend thinks is calling',
    caption: 'The sequence of backends that answered (k1 and k2 alternating, or only k1), the refused connections and the address the backend saw are the real results of exercise 13. Layer 4 in the exercise is an iptables rule (round-robin DNAT), and layer 7 is a proxy written in Python for the exercise, not HAProxy or Nginx.',
    layer: { l4: 'Layer 4 (iptables)', l7: 'Layer 7 (proxy)' }, conn: { new: 'a new connection for each request', same: 'one connection for all' }, alive: ['k2 healthy', 'k2 is dead'],
    client: 'Client', balancer: { l4: 'iptables DNAT', l7: 'reverse proxy' }, sees: 'the backend thinks the caller is', peer: 'peer address', xff: 'X-Forwarded-For', none: 'none', refused: 'refused', legend: 'a request answered by k1',
    marks: [
      { at: START(0), name: 'First request', title: 'The first request reaches the load balancer', text: 'The client does not connect to k1 or k2 directly. It connects to the one address of the service (10.96.0.10 or the proxy), and the load balancer picks a backend for it.' },
      { at: START(4), name: 'Halfway', title: 'Look at the pattern of the backends that answered', text: 'Layer 4 alternates k1 and k2 with each new connection. With one connection, every request goes to the same backend, because the connection is pinned. Layer 7 alternates by request, even inside one connection.' },
      { at: START(7) + 1.5, name: 'Summary', title: 'Read the panel below: what the backend sees', text: 'Layer 4 changes only the destination address, so the backend sees the real address of the client. Layer 7 opens a new connection to the backend by itself, so the backend sees the proxy\'s address and has to read X-Forwarded-For to know who the client is. If k2 dies, layer 4 refuses every second connection, while layer 7 tries the other backend by itself.' },
    ],
  },
};

export default function BalancerLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [layer, setLayer] = useState<Layer>('l4');
  const [conn, setConn] = useState<Conn>('new');
  const [dead, setDead] = useState(0);
  const clock = useClock(D);
  const { t } = clock;
  const restart = () => clock.restart();
  const seq: string[] = dead
    ? (layer === 'l4' ? data.deadL4 : data.deadL7)
    : layer === 'l4' ? (conn === 'new' ? data.l4New : data.l4Same) : (conn === 'new' ? data.l7New : data.l7Same);
  const marks = T.marks;
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const seen = layer === 'l4' ? data.l4Seen : data.l7Seen;
  const C: [number, number] = [190, 150], B: [number, number] = [430, 150];
  const K: Record<string, [number, number]> = { k1: [680, 90], k2: [680, 220] };
  const done = t >= START(7) + 1.5;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="layer">
          {(['l4', 'l7'] as Layer[]).map((x) => (<button key={x} type="button" aria-pressed={layer === x} onClick={() => { setLayer(x); restart(); }}>{T.layer[x]}</button>))}
        </div>
        {layer === 'l4' && !dead && (
          <div className="seg" role="group" aria-label="connection">
            {(['new', 'same'] as Conn[]).map((x) => (<button key={x} type="button" aria-pressed={conn === x} onClick={() => { setConn(x); restart(); }}>{T.conn[x]}</button>))}
          </div>
        )}
        <div className="seg" role="group" aria-label="backend">
          {T.alive.map((x, i) => (<button key={x} type="button" aria-pressed={dead === i} onClick={() => { setDead(i); restart(); }}>{x}</button>))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'l3', text: T.legend }, { cls: 'l4', text: lang === 'th' ? 'คำขอที่ k2 ตอบ' : 'a request answered by k2' }, { cls: 'bad', text: T.refused }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <Wire x1={C[0]} y1={C[1]} x2={B[0] - 20} y2={B[1]} />
          <Wire x1={B[0] + 20} y1={B[1]} x2={K.k1[0] - 20} y2={K.k1[1]} />
          <Wire x1={B[0] + 20} y1={B[1]} x2={K.k2[0] - 20} y2={K.k2[1]} dashed={!!dead} />
          {seq.map((r, i) => {
            const s = START(i);
            if (t < s || t > s + 2.0) return null;
            const p = ease(t, s, s + 1.0);
            const q = ease(t, s + 1.0, s + 2.0);
            const bad = r !== 'k1' && r !== 'k2';
            const target = bad ? K.k2 : K[r];
            const pos = q > 0 ? lerp([B[0] + 146, B[1]], [target[0] - 36, target[1]], bad ? Math.min(q, 0.55) : q) : lerp([C[0] + 16, C[1]], [B[0] - 36, B[1]], p);
            return (
              <g key={i}>
                <circle cx={pos[0]} cy={pos[1] - 18} r={13} className={bad ? 'nw-lost' : r === 'k1' ? 'nw-l3' : 'nw-l4'} style={bad ? { fill: 'var(--surface)' } : undefined} />
                <text x={pos[0]} y={pos[1] - 13} className="nw-txt" style={{ fontSize: 13 }}>{bad && q > 0.5 ? '✗' : i + 1}</text>
              </g>
            );
          })}
          <Dev x={20} y={115} w={170} kind="host" title={T.client} sub="10.0.1.2" />
          <Dev x={B[0] - 20} y={115} w={150} kind="router" title={T.balancer[layer]} />
          <Dev x={K.k1[0] - 20} y={K.k1[1] - 35} w={190} kind="server" title="k1" sub="10.244.0.2" />
          <Dev x={K.k2[0] - 20} y={K.k2[1] - 35} w={190} kind="server" title="k2" sub={dead ? '✗' : '10.244.0.3'} op={dead ? 0.55 : 1} />
          <g>
            {seq.map((r, i) => (
              <g key={i} style={{ opacity: t >= START(i) + 2 ? 1 : 0.2 }}>
                <rect className={r === 'k1' ? 'nw-l3' : r === 'k2' ? 'nw-l4' : 'nw-lost'} x={20 + i * 52} y={300} width={46} height={32} rx={7} style={r !== 'k1' && r !== 'k2' ? { fill: 'var(--surface)' } : undefined} />
                <text x={20 + i * 52 + 23} y={321} textAnchor="middle" className="nw-txt" style={{ fontSize: 14, fill: r !== 'k1' && r !== 'k2' ? 'var(--ib-bad)' : undefined }}>{r === 'k1' || r === 'k2' ? r : '✗'}</text>
              </g>
            ))}
          </g>
          <rect className={done ? 'nw-cell on' : 'nw-cell'} x={450} y={292} width={410} height={80} rx={10} />
          <text x={464} y={314} className="ib-s">{T.sees}</text>
          <text x={464} y={338} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.peer}: {done ? seen.peer : '…'}</text>
          <text x={464} y={360} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{T.xff}: {done ? (seen.xff ?? T.none) : '…'}</text>
          <Banner y={400} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
