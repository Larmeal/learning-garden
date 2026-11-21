import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './networks.json';

// Shows:      containers drawn inside the network they are attached to, and a request drawn as an arrow. Pick how the containers are set up (default bridge,
//             a network we made, two separate networks) and who calls whom (A by name, A by IP, our computer to a container without -p, our computer to one with -p).
//             The arrow reaches its target or stops at the edge of the network, with the reason under it.
// Because:    "who can reach whom" depends on which network each container sits in and whether a port is published. It is a picture of walls, and a table of
//             ticks would not show where the request stops.
// Control:    the setup and the request.
// Conclusion: containers reach each other by IP on a shared network, by name only on a network we made, and the computer reaches a container only through a published port.
//
// Every result comes from exercises/08_networks.py --write (networks.json): each is a real ping, wget or socket connect.

type Setup = 'bridge' | 'user' | 'separate';
type Req = 'name' | 'ip' | 'outNo' | 'outYes';
const SETUPS: Setup[] = ['bridge', 'user', 'separate'];
const REQS: Req[] = ['name', 'ip', 'outNo', 'outYes'];

function result(setup: Setup, req: Req): boolean {
  if (req === 'outNo') return data.port.unpublished;
  if (req === 'outYes') return data.port.published;
  return data[setup][req];
}

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; setup: string; setups: Record<Setup, string>; req: string; reqs: Record<Req, string>;
  net: Record<Setup, string>; sub: Record<Setup, string>; host: string; hostSub: string; ok: string; no: string; why: (s: Setup, r: Req, ok: boolean) => string; caption: string;
}> = {
  th: {
    title: 'เลือกการวางเครือข่ายกับคนที่เป็นฝ่ายเรียก แล้วดูว่าลูกศรไปถึง Container ปลายทางหรือหยุดที่ขอบเครือข่าย',
    legend: [{ kind: 'use', text: 'ถึงปลายทาง' }, { kind: 'skip', text: 'ถูกกั้น' }, { kind: 'new', text: 'ผู้เรียก' }],
    setup: 'การวางเครือข่าย',
    setups: { bridge: 'Default Bridge', user: 'Network ที่เราสร้างเอง', separate: 'สอง Network แยกกัน' },
    req: 'ใครเรียกใคร',
    reqs: { name: 'A เรียก B ด้วยชื่อ', ip: 'A เรียก B ด้วย IP', outNo: 'คอมพิวเตอร์เราเรียก (ไม่ใส่ -p)', outYes: 'คอมพิวเตอร์เราเรียก (ใส่ -p)' },
    net: { bridge: 'Default Bridge', user: 'Network ที่เราสร้างเอง', separate: 'Network 1' },
    sub: { bridge: `${data.subnets.default} · ไม่มี DNS`, user: `${data.subnets.user} · มี DNS ของ Docker`, separate: 'แยกจาก Network 2' },
    host: 'คอมพิวเตอร์ของเรา',
    hostSub: 'Host',
    ok: 'ถึง',
    no: 'ถูกกั้น',
    why: (s, r, ok) => {
      if (r === 'outNo') return 'พอร์ตของ Container ไม่ได้ถูก Publish คอมพิวเตอร์ของเราจึงเข้าไม่ถึง แต่ Container อื่นในเครือข่ายเดียวกันยังเรียกได้';
      if (r === 'outYes') return 'ตัวเลือก -p เปิดช่องบนคอมพิวเตอร์ของเราให้ส่งต่อเข้า Container จึงถึง';
      if (s === 'separate') return 'A กับ C อยู่คนละ Network ถูกกั้นทั้งด้วยชื่อและด้วย IP จนกว่า A จะเข้าร่วม Network ของ C';
      if (r === 'name') return ok ? 'Network ที่เราสร้างมี DNS ของ Docker ที่แปลงชื่อ Container เป็น IP' : 'Default Bridge ไม่มีการแปลงชื่อ จึงหาชื่อ B ไม่เจอ';
      return 'อยู่ใน Network เดียวกัน เรียกด้วย IP ได้เสมอ';
    },
    caption: 'ผลทุกช่องมาจากแบบฝึก 08 (ping, wget และการเปิด Socket จริง) พอร์ตที่ Publish ผูกกับ 127.0.0.1 ตามที่ -p ระบุ ในเครื่องนี้ Host คือ Windows ซึ่ง Container อยู่ในเครือข่ายของ Linux ที่ Docker Desktop เปิดไว้ ที่อยู่ IP ของ Container จึงเรียกจาก Windows ตรง ๆ ไม่ได้',
  },
  en: {
    title: 'Choose how the networks are laid out and who makes the request, and see whether the arrow reaches the target container or stops at the edge of the network',
    legend: [{ kind: 'use', text: 'reaches the target' }, { kind: 'skip', text: 'blocked' }, { kind: 'new', text: 'the caller' }],
    setup: 'network layout',
    setups: { bridge: 'default bridge', user: 'a network we made', separate: 'two separate networks' },
    req: 'who calls whom',
    reqs: { name: 'A calls B by name', ip: 'A calls B by IP', outNo: 'our computer calls (no -p)', outYes: 'our computer calls (with -p)' },
    net: { bridge: 'Default bridge', user: 'A network we made', separate: 'Network 1' },
    sub: { bridge: `${data.subnets.default} · no DNS`, user: `${data.subnets.user} · Docker DNS`, separate: 'apart from Network 2' },
    host: 'Our computer',
    hostSub: 'Host',
    ok: 'reached',
    no: 'blocked',
    why: (s, r, ok) => {
      if (r === 'outNo') return 'The port of the container was not published, so our computer cannot reach it, but another container on the same network still can.';
      if (r === 'outYes') return 'The option -p opens a door on our computer that forwards into the container, so it is reached.';
      if (s === 'separate') return 'A and C are on different networks, blocked by name and by IP until A joins the network of C.';
      if (r === 'name') return ok ? 'A network we made has Docker DNS, which turns the name of a container into its IP.' : 'The default bridge has no name resolution, so the name of B is not found.';
      return 'They share one network, so the IP always works.';
    },
    caption: 'Every result comes from exercise 08 (a real ping, wget and socket connect). The published port is bound to 127.0.0.1 as -p said. On this computer the host is Windows, and the containers live in the network of the Linux that Docker Desktop starts, so a container IP cannot be called from Windows directly.',
  },
};

export default function NetworkLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [setup, setSetup] = useState<Setup>('bridge');
  const [req, setReq] = useState<Req>('name');
  const ok = result(setup, req);
  const outside = req === 'outNo' || req === 'outYes';
  const sep = setup === 'separate';
  const box = (x: number, y: number, name: string, role: 'caller' | 'target' | 'other', sub?: string) => (
    <g>
      <rect className={role === 'caller' ? 'ib-new' : role === 'target' ? (ok ? 'ib-use' : 'ib-skip') : 'ib-node'} x={x} y={y} width={150} height={64} rx={10} style={role === 'target' && !ok ? { opacity: 0.7 } : undefined} />
      <text x={x + 14} y={y + 28} className="ib-n">{name}</text>
      {sub && <text x={x + 14} y={y + 50} className="ib-m">{sub}</text>}
    </g>
  );
  // geometry
  const net1 = { x: 270, y: sep ? 24 : 36, w: 596, h: sep ? 150 : 270 };
  const aPos = { x: 310, y: sep ? 84 : 140 };
  const bPos = { x: 690, y: sep ? 84 : 140 };
  const cPos = { x: 690, y: 236 };
  const targetPos = outside ? bPos : sep ? cPos : bPos;
  const fromPos = outside ? { x: 118, y: 150 } : aPos;
  const x1 = outside ? 210 : aPos.x + 150;
  const y1 = (outside ? 150 : aPos.y) + (outside ? 0 : 32);
  const x2 = targetPos.x;
  const y2 = targetPos.y + 32;
  const stopX = ok ? x2 : outside ? 266 : sep ? 560 : x1 + (x2 - x1) * 0.55;
  const stopY = ok ? y2 : outside ? y1 : sep ? y1 + (y2 - y1) * 0.5 : y1;
  void fromPos;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.setup}</span>
        <span className="seg" role="group" aria-label={T.setup}>
          {SETUPS.map((k) => (
            <button key={k} type="button" aria-pressed={setup === k} onClick={() => setSetup(k)}>{T.setups[k]}</button>
          ))}
        </span>
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.req}</span>
        <span className="seg" role="group" aria-label={T.req}>
          {REQS.map((k) => (
            <button key={k} type="button" aria-pressed={req === k} onClick={() => setReq(k)}>{T.reqs[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          <rect className={outside ? 'ib-new' : 'ib-node'} x={14} y={90} width={200} height={140} rx={12} />
          <text x={30} y={126} className="ib-n">{T.host}</text>
          <text x={30} y={150} className="ib-m">{T.hostSub}</text>
          {outside && <text x={30} y={206} className="ib-s">{req === 'outYes' ? '127.0.0.1:' + 'PORT' : '172.19.x.x'}</text>}
          <rect className="ib-zone" x={net1.x} y={net1.y} width={net1.w} height={net1.h} rx={14} />
          <text x={net1.x + 16} y={net1.y + 28} className="ib-n">{T.net[setup]}</text>
          <text x={net1.x + 16} y={net1.y + 50} className="ib-s">{T.sub[setup]}</text>
          {box(aPos.x, aPos.y, 'A', outside ? 'other' : 'caller')}
          {box(bPos.x, bPos.y, outside ? (req === 'outYes' ? 'B (-p)' : 'B (no -p)') : 'B', outside ? 'target' : sep ? 'other' : 'target', outside ? ':8000' : undefined)}
          {sep && (
            <g>
              <rect className="ib-zone" x={net1.x} y={196} width={net1.w} height={128} rx={14} />
              <text x={net1.x + 16} y={224} className="ib-n">Network 2</text>
              {box(cPos.x, cPos.y + 4, 'C', 'target')}
            </g>
          )}
          {/* the request */}
          <path className={ok ? 'ib-arrow' : 'ib-arrow-bad'} d={`M${x1},${y1} L${stopX},${stopY}`} />
          <g>
            <circle cx={stopX} cy={stopY} r={17} style={{ fill: ok ? 'var(--accent)' : 'var(--ib-bad)' }} />
            <text x={stopX} y={stopY + 6} className="ib-white" style={{ fontSize: 18 }}>{ok ? '✓' : '✗'}</text>
          </g>
          <text x={Math.min(Math.max(stopX, 330), 780)} y={ok ? y2 + 50 : stopY - 26} textAnchor="middle" className="ib-n" style={{ fill: ok ? 'var(--accent)' : 'var(--ib-bad)' }}>{ok ? T.ok : T.no}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.why(setup, req, ok)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
