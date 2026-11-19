import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Dev, Legend, Wire, ease } from './nw';
import data from './debug.json';

// Shows:      the first packet of a connection (a SYN) in seven different situations: a normal service, nothing listening, a firewall that rejects, a firewall that drops, a router with no route, a cut cable
//             and a lossy link. The clock runs in real seconds, so a drop really takes 3.5 s on the bar. The packet flies from the client; a red cross marks where it disappears; a returning packet (SYN-ACK,
//             RST, ICMP) is drawn when the real fault produces one. A panel on the right says what the program sees and how long it took.
// Because:    the error message of a failed connection is the best clue a developer has, and it is a function of WHERE the packet stopped and WHO answered. Reading it needs a picture of the path, not a list.
// Control:    the choice of fault, then play and the scrub bar.
// Conclusion: an answer (refused, unreachable) means something answered, so the path works up to there; silence (timeout) means the packet or its answer was dropped and only a capture can say where.
//
// The result and the number of seconds for each fault, and the times at which the SYN was sent again, are the real results of exercises/14_debugging.py (debug.json).

type K = 'ok' | 'nothing_listening' | 'firewall_reject_rst' | 'firewall_drop' | 'route_gone' | 'cable_cut' | 'lossy_link';
const ORDER: K[] = ['ok', 'nothing_listening', 'firewall_reject_rst', 'firewall_drop', 'route_gone', 'cable_cut', 'lossy_link'];
const D = 5;
const X = { c: 130, r: 440, s: 750 }, Y = 150;
const pos = (f: number) => X.c + (X.s - X.c) * f;
type Pk = { t0: number; from: number; to: number; label: string; lost?: boolean; ret?: boolean };
const syns = data.synTimes as number[];
const PK: Record<K, Pk[]> = {
  ok: [{ t0: 0.2, from: 0, to: 1, label: 'SYN' }, { t0: 1.0, from: 1, to: 0, label: 'SYN-ACK', ret: true }],
  nothing_listening: [{ t0: 0.2, from: 0, to: 1, label: 'SYN' }, { t0: 1.0, from: 1, to: 0, label: 'RST', ret: true }],
  firewall_reject_rst: [{ t0: 0.2, from: 0, to: 1, label: 'SYN' }, { t0: 1.0, from: 1, to: 0, label: 'RST', ret: true }],
  firewall_drop: syns.map((s) => ({ t0: 0.2 + s, from: 0, to: 1, label: 'SYN', lost: true })),
  route_gone: [{ t0: 0.2, from: 0, to: 0.5, label: 'SYN' }, { t0: 0.8, from: 0.5, to: 0, label: 'ICMP', ret: true }],
  cable_cut: syns.map((s) => ({ t0: 0.2 + s, from: 0, to: 0.75, label: 'SYN', lost: true })),
  lossy_link: [{ t0: 0.2, from: 0, to: 0.3, label: 'SYN', lost: true }, { t0: 1.2, from: 0, to: 1, label: 'SYN' }, { t0: 2.0, from: 1, to: 0, label: 'SYN-ACK', ret: true }],
};
const FAULT = data.faults as Record<string, { result: string; secs: number }>;
const SHOWN: Record<K, number> = { ok: 0.0, nothing_listening: 0.0, firewall_reject_rst: 0.0, firewall_drop: FAULT.firewall_drop.secs, route_gone: 0.0, cable_cut: FAULT.cable_cut.secs, lossy_link: 1.0 };

type S = { title: string; caption: string; names: Record<K, string>; saw: string; took: string; look: string; hint: Record<K, string>; res: Record<string, string>; client: string; router: string; server: string; rLegend: string[]; marks: Record<K, Mark[]>; sec: string; note: string };
const TEXT: Record<Lang, S> = {
  th: {
    title: 'เลือกความผิดปกติแล้วกดเล่น ดูว่า Packet แรกของ Connection ไปหยุดตรงไหน และโปรแกรมของเราเห็นข้อความแบบไหน',
    caption: 'ผลลัพธ์ จำนวนวินาที และเวลาที่ SYN ถูกส่งซ้ำเป็นผลจริงของแบบฝึก 14 (Client, Router, Server ใน Namespace ของ Linux) นาฬิกาของ Lab เดินเท่าเวลาจริง ตัวอย่าง Lossy เป็นชุดสุ่ม 20 ครั้ง Lab แสดงตัวอย่างหนึ่งที่ SYN แรกหาย',
    names: { ok: 'บริการปกติ', nothing_listening: 'ไม่มีโปรแกรม Listen', firewall_reject_rst: 'Firewall REJECT', firewall_drop: 'Firewall DROP', route_gone: 'Router ไม่มี Route', cable_cut: 'สายขาด', lossy_link: 'สายหายบางส่วน' },
    saw: 'โปรแกรมเห็น', took: 'ใช้เวลา', look: 'ควรดูต่อที่',
    hint: {
      ok: 'ไม่มีอะไรผิด', nothing_listening: 'ที่ Server: โปรแกรมรันอยู่ไหม Port ถูกไหม (ss -ltn)', firewall_reject_rst: 'Firewall ของปลายทาง (กฎ REJECT) ดูเหมือน Port ที่ไม่มีใคร Listen',
      firewall_drop: 'จับ Packet ที่ปลายทางด้วย tcpdump ถ้าเห็น SYN แต่ไม่มีคำตอบ ให้ดูกฎ Firewall', route_gone: 'ตาราง Route ของ Router ตัวที่ตอบ ICMP กลับมา', cable_cut: 'จับ Packet ที่ปลายทาง ถ้าไม่เห็น SYN ให้ไล่ย้อนกลับมาทีละฮอป', lossy_link: 'ping ดู Packet Loss แล้วไล่ดูแต่ละฮอป',
    },
    res: { connected: 'เชื่อมต่อได้', refused: 'ถูกปฏิเสธ (refused)', timeout: 'หมดเวลา (timeout)', unreachable: 'ไปไม่ถึง (unreachable)' },
    client: 'Client', router: 'Router', server: 'Server', rLegend: ['Packet ที่ส่งออก', 'Packet ที่ตอบกลับ', 'Packet ที่หายไป'], sec: 'วินาที',
    note: 'ตัวอย่างที่เห็นเป็นการรันครั้งหนึ่งของแบบฝึก',
    marks: {
      ok: [{ at: 0.2, name: 'SYN', title: 'Client ส่ง SYN', text: 'ปลายทางตอบ SYN-ACK แล้ว Connection เสร็จ' }],
      nothing_listening: [{ at: 0.2, name: 'SYN', title: 'SYN ไปถึง Server ที่ไม่มีโปรแกรม Listen', text: 'Kernel ของ Server ตอบ RST ทันที ฝั่ง Client เห็นว่า Connection ถูกปฏิเสธ แปลว่าเครือข่ายทั้งเส้นใช้ได้ ปัญหาอยู่ที่ปลายทาง' }],
      firewall_reject_rst: [{ at: 0.2, name: 'SYN', title: 'Firewall ตอบปฏิเสธเอง', text: 'กฎ REJECT ตอบ RST (หรือ ICMP) กลับมาทันที ฝั่ง Client เห็นเหมือนไม่มีโปรแกรม Listen จึงแยกสองกรณีนี้จากข้อความ Error อย่างเดียวไม่ได้' }],
      firewall_drop: [{ at: 0.2, name: 'SYN แรก', title: 'SYN ไปถึง Server แล้วเงียบ', text: 'Firewall ทิ้ง Packet โดยไม่ตอบ Client รอแล้วส่ง SYN ซ้ำห่างกันราว 1 วินาที จนครบเวลา Timeout ของโปรแกรม' }, { at: 3.4, name: 'Timeout', title: 'Timeout หลังส่ง SYN 4 ครั้ง', text: 'ไม่มีข้อความ Error ใด ๆ ที่บอกว่าใครทิ้ง ต้องจับ Packet ที่ปลายทางเพื่อดูว่า SYN มาถึงหรือไม่' }],
      route_gone: [{ at: 0.2, name: 'SYN', title: 'SYN หยุดที่ Router', text: 'Router ไม่มี Route ไปหา Server จึงส่ง ICMP Unreachable กลับมาทันที Client เห็นข้อผิดพลาดว่าไปไม่ถึง' }],
      cable_cut: [{ at: 0.2, name: 'SYN แรก', title: 'SYN หายระหว่างทาง', text: 'ไม่มีใครตอบ Client ส่ง SYN ซ้ำเรื่อย ๆ' }, { at: 3.4, name: 'Timeout', title: 'Timeout เหมือน Firewall DROP', text: 'จากฝั่ง Client ดูเหมือนกับ Firewall DROP ทุกอย่าง ต่างกันที่ปลายทางไม่เห็น SYN เลย' }],
      lossy_link: [{ at: 0.2, name: 'SYN แรกหาย', title: 'SYN แรกหายไป', text: 'Client ไม่ได้ตอบกลับ จึงรอแล้วส่งซ้ำ' }, { at: 1.3, name: 'ส่งซ้ำ', title: 'SYN ที่สองไปถึง', text: 'Connection สำเร็จ แต่ช้ากว่าปกติหนึ่งวินาที โปรแกรมไม่เห็น Error เลย เห็นแค่ว่าบางครั้งช้า' }],
    },
  },
  en: {
    title: 'Pick a fault and press play, and see where the first packet of the connection stops and what message our program gets',
    caption: 'The result, the number of seconds and the times at which the SYN is sent again are the real results of exercise 14 (client, router and server in Linux namespaces). The lab clock runs in real time. The lossy case is one of 20 random tries, and the lab shows one where the first SYN was lost.',
    names: { ok: 'a normal service', nothing_listening: 'nothing listening', firewall_reject_rst: 'firewall REJECT', firewall_drop: 'firewall DROP', route_gone: 'router has no route', cable_cut: 'cable cut', lossy_link: 'lossy link' },
    saw: 'the program sees', took: 'it took', look: 'look next at',
    hint: {
      ok: 'nothing is wrong', nothing_listening: 'at the server: is the program running, is the port right (ss -ltn)', firewall_reject_rst: 'the destination\'s firewall (a REJECT rule), which looks like a port nobody listens on',
      firewall_drop: 'capture at the destination with tcpdump. If the SYN arrives and nothing answers, look at the firewall rules', route_gone: 'the routing table of the router that sent the ICMP back', cable_cut: 'capture at the destination. If no SYN arrives, walk back one hop at a time', lossy_link: 'ping to see the packet loss, then walk the hops',
    },
    res: { connected: 'connected', refused: 'refused', timeout: 'timeout', unreachable: 'unreachable' },
    client: 'Client', router: 'Router', server: 'Server', rLegend: ['packet sent', 'packet answering', 'packet lost'], sec: 'seconds',
    note: 'the example shown is one run of the exercise',
    marks: {
      ok: [{ at: 0.2, name: 'SYN', title: 'The client sends a SYN', text: 'The server answers with SYN-ACK and the connection is done.' }],
      nothing_listening: [{ at: 0.2, name: 'SYN', title: 'The SYN reaches a server with no program listening', text: 'The server\'s kernel answers with a RST at once. The client sees that the connection was refused. So the whole path works and the problem is at the destination.' }],
      firewall_reject_rst: [{ at: 0.2, name: 'SYN', title: 'The firewall refuses by itself', text: 'A REJECT rule answers with a RST (or an ICMP error) immediately. The client sees the same as if nothing listened, so these two cases cannot be told apart from the error message alone.' }],
      firewall_drop: [{ at: 0.2, name: 'First SYN', title: 'The SYN reaches the server and meets silence', text: 'The firewall drops the packet and says nothing. The client waits and sends the SYN again about every second, until the program\'s own timeout.' }, { at: 3.4, name: 'Timeout', title: 'A timeout after four SYNs', text: 'No error message says who dropped it. We have to capture at the destination to see whether the SYN arrives.' }],
      route_gone: [{ at: 0.2, name: 'SYN', title: 'The SYN stops at the router', text: 'The router has no route to the server, so it sends an ICMP unreachable back at once. The client sees an error that the destination is unreachable.' }],
      cable_cut: [{ at: 0.2, name: 'First SYN', title: 'The SYN is lost on the way', text: 'Nobody answers. The client keeps sending the SYN again.' }, { at: 3.4, name: 'Timeout', title: 'A timeout, just like a firewall DROP', text: 'From the client everything looks like a firewall DROP. The difference is that the destination never sees a SYN.' }],
      lossy_link: [{ at: 0.2, name: 'First SYN lost', title: 'The first SYN is lost', text: 'No answer comes back, so the client waits and sends it again.' }, { at: 1.3, name: 'Retry', title: 'The second SYN arrives', text: 'The connection succeeds, one second later than normal. The program sees no error at all, only that it is sometimes slow.' }],
    },
  },
};

export default function SymptomLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState<K>('firewall_drop');
  const clock = useClock(D);
  const { t } = clock;
  const marks = T.marks[k];
  let cur = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) cur = i; });
  const f = FAULT[k];
  const pks = PK[k];
  const endT = Math.max(...pks.map((p) => p.t0 + 0.8)) + 0.1;
  const done = t >= endT;
  const cls = (p: Pk) => (p.lost ? 'nw-lost' : p.ret ? 'nw-l4' : 'nw-l3');

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="fault">
          {ORDER.map((x) => (<button key={x} type="button" aria-pressed={k === x} onClick={() => { setK(x); clock.restart(); }}>{T.names[x]}</button>))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'l3', text: T.rLegend[0] }, { cls: 'l4', text: T.rLegend[1] }, { cls: 'bad', text: T.rLegend[2] }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <Wire x1={X.c} y1={Y} x2={X.r} y2={Y} />
          <Wire x1={X.r} y1={Y} x2={X.s} y2={Y} dashed={k === 'cable_cut'} />
          <Dev x={X.c - 65} y={Y - 37} w={130} kind="host" title={T.client} sub="10.0.1.2" />
          <Dev x={X.r - 65} y={Y - 37} w={130} kind="router" title={T.router} sub={k === 'route_gone' ? '✗ route' : undefined} />
          <Dev x={X.s - 65} y={Y - 37} w={130} kind="server" title={T.server} sub="10.0.2.2" />
          {pks.map((p, i) => {
            if (t < p.t0 || (p.lost && t > p.t0 + 1.3)) return null;
            const q = ease(t, p.t0, p.t0 + 0.7);
            const x = pos(p.from + (p.to - p.from) * q);
            const lostHere = p.lost && q >= 1;
            return (
              <g key={i}>
                <rect className={cls(p)} x={x - 44} y={Y - 84} width={88} height={32} rx={8} style={p.lost ? { fill: 'var(--surface)' } : undefined} />
                <text x={x} y={Y - 62} className="nw-txt" style={{ fontSize: 16, fill: p.lost ? 'var(--ib-bad)' : undefined }}>{lostHere ? '✗' : p.label}</text>
              </g>
            );
          })}
          {pks.some((q) => q.lost) && (<text x={pos(pks.find((q) => q.lost)!.to)} y={Y + 70} className="ib-s" textAnchor="middle">{`SYN × ${pks.filter((q) => t >= q.t0).length}`}</text>)}
          <text x={X.c} y={260} className="ib-s">{lang === 'th' ? 'เวลาจริง' : 'real time'}: {Math.min(t, endT).toFixed(1)} {T.sec}</text>
          <rect className={done ? 'nw-cell on' : 'nw-cell'} x={60} y={280} width={760} height={110} rx={10} />
          <text x={80} y={308} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 18 }}>{T.saw}: {done ? T.res[f.result] ?? f.result : '…'}</text>
          <text x={80} y={334} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 18 }}>{T.took}: {done ? `${SHOWN[k].toFixed(1)} ${T.sec}` : '…'}</text>
          <text x={80} y={360} className="ib-n" style={{ fontSize: 16 }}>{T.look}: {T.hint[k]}</text>
          <text x={80} y={380} className="ib-s" style={{ opacity: 0.8 }}>{k === 'lossy_link' ? T.note : ''}</text>
          <Banner y={420} text={marks[cur].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
