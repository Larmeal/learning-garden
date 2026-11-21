import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend, Lines } from '../iceberg/ib';
import data from './containers.json';

// Shows:      three containers drawn as three rooms on one Linux kernel. Pick where you stand: inside room a, b or c, or outside, in the engine.
//             From inside a room the other rooms and every other process are gone and your program is PID 1. From outside every program has an ordinary number.
// Because:    "a container is just a process that sees a small world" is about who can see what. A table of ps outputs would not show that the other rooms are still
//             there, only hidden.
// Control:    the viewpoint (inside a, inside b, inside c, outside).
// Conclusion: the program in a container is one ordinary process of the kernel, and the container only decides what it is allowed to see.
//
// Numbers (PIDs, hostnames, images, kernel) come from exercises/01_containers.py --write (containers.json). The PIDs change on every run.

type Key = 'a' | 'b' | 'c' | 'out';
const KEYS: Key[] = ['a', 'b', 'c', 'out'];
const C = data.containers;
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; stand: string; room: string; from: (k: Key) => string;
  others: string; hidden: string; kernel: string; kernelSub: string; ps: string; readout: (k: Key, n: number, pids: string) => string; caption: string;
}> = {
  th: {
    title: 'เลือกว่าจะยืนอยู่ในห้องของ Container ไหน หรือยืนข้างนอก แล้วดูว่า ps เห็น Process อะไรบ้าง',
    legend: [{ kind: 'new', text: 'ห้องที่เรายืนอยู่' }, { kind: 'use', text: 'มองเห็น' }, { kind: 'skip', text: 'มองไม่เห็นจากตรงนี้' }],
    stand: 'ยืนที่',
    room: 'ห้อง',
    from: (k) => (k === 'out' ? 'ข้างนอก (Engine)' : `ในห้อง ${k}`),
    others: 'Process อื่นของ Engine',
    hidden: 'มองไม่เห็นจากข้างใน',
    kernel: 'Kernel ของ Linux ตัวเดียว',
    kernelSub: `ทุกห้องเรียกใช้ตัวนี้ตัวเดียว (${data.kernel})`,
    ps: 'ps เห็น',
    readout: (k, n, pids) =>
      k === 'out'
        ? `จากข้างนอกเห็น Process ทั้งหมด ${n} ตัว Container ทั้งสามห้องใช้เลข ${pids} และไม่มีตัวไหนเป็น PID 1`
        : `ในห้อง ${k} เห็น Process แค่ ${n} ตัว และโปรแกรมของเราคือ PID 1 ทั้งที่ข้างนอกมันเป็นเลข ${pids}`,
    caption: 'PID, Hostname และ Image มาจากแบบฝึก 01 (รัน ps ใน Container แล้วรันอีกรอบด้วย --pid=host) เลข PID ข้างนอกจะเปลี่ยนทุกครั้งที่รัน ส่วน Engine บนเครื่อง Windows ก็คือ Linux ที่ Docker Desktop เปิดไว้ให้',
  },
  en: {
    title: 'Choose whether to stand inside the room of one container or outside, and see which processes ps can see',
    legend: [{ kind: 'new', text: 'the room we stand in' }, { kind: 'use', text: 'visible' }, { kind: 'skip', text: 'not visible from here' }],
    stand: 'Stand',
    room: 'room',
    from: (k) => (k === 'out' ? 'outside (the engine)' : `inside room ${k}`),
    others: 'Other processes of the engine',
    hidden: 'not visible from inside',
    kernel: 'One Linux kernel',
    kernelSub: `Every room uses this one (${data.kernel})`,
    ps: 'ps sees',
    readout: (k, n, pids) =>
      k === 'out'
        ? `From outside there are ${n} processes in all. The three containers have the numbers ${pids}, and none of them is PID 1.`
        : `Inside room ${k} there is only ${n} process, and our program is PID 1, although outside it has the number ${pids}.`,
    caption: 'PIDs, hostnames and images come from exercise 01 (ps inside a container, then again with --pid=host). The outside PIDs change on every run. On a Windows computer the engine is the Linux that Docker Desktop starts.',
  },
};

export default function RoomsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [key, setKey] = useState<Key>('a');
  const outside = key === 'out';
  const RW = 276, RH = 132, GAP = 14, Y = 100;
  const stand = C.find((c) => c.name === key);
  const hostPids = C.map((c) => c.hostPid).join(', ');
  const psLines = outside
    ? [...C.map((c) => ({ pid: c.hostPid, cmd: c.cmd })), ...data.others.slice(0, 2)].slice(0, 5).map((p) => `${String(p.pid).padStart(5)}  ${short(p.cmd, 40)}`)
    : [`${String(1).padStart(5)}  ${short(stand?.cmd ?? '', 40)}`];
  const count = outside ? data.totalOutside : 1;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.stand}</span>
        <span className="seg" role="group" aria-label={T.stand}>
          {KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)}>{T.from(k)}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          {C.map((c, i) => {
            const x = 12 + i * (RW + GAP);
            const here = key === c.name;
            const visible = outside || here;
            const cls = here ? 'ib-new' : outside ? 'ib-use' : 'ib-skip';
            return (
              <g key={c.name} style={visible ? undefined : { opacity: 0.55 }}>
                <rect className={cls} x={x} y={Y} width={RW} height={RH} rx={12} />
                <text x={x + 14} y={Y + 26} className="ib-n">{`${T.room} ${c.name}`}</text>
                <text x={x + 14} y={Y + 48} className="ib-m">{c.image}</text>
                {visible ? (
                  <g>
                    <rect className="ib-node" x={x + 14} y={Y + 64} width={RW - 28} height={50} rx={9} />
                    <text x={x + 28} y={Y + 85} className="ib-n">{`PID ${outside ? c.hostPid : 1}`}</text>
                    <text x={x + 28} y={Y + 104} className="ib-m">{short(c.cmd, 28)}</text>
                  </g>
                ) : (
                  <text x={x + RW / 2} y={Y + 96} textAnchor="middle" className="ib-s">{T.hidden}</text>
                )}
                <path className="ib-arrow" d={`M${x + RW / 2},${Y + RH} L${x + RW / 2},${262}`} style={visible ? undefined : { opacity: 0.25 }} />
              </g>
            );
          })}
          <text x={14} y={22} className="ib-layer">{outside ? T.others : `${T.others} · ${T.hidden}`}</text>
          {data.others.slice(0, 4).map((p, i) => {
            const x = 12 + i * 216;
            return (
              <g key={p.pid} style={outside ? undefined : { opacity: 0.4 }}>
                <rect className={outside ? 'ib-use' : 'ib-skip'} x={x} y={30} width={204} height={44} rx={9} />
                <text x={x + 12} y={50} className="ib-n">{`PID ${p.pid}`}</text>
                <text x={x + 12} y={68} className="ib-m">{short(p.cmd, 22)}</text>
              </g>
            );
          })}
          <rect className="ib-banner" x={12} y={262} width={856} height={56} rx={10} />
          <text x={26} y={287} className="ib-n">{T.kernel}</text>
          <text x={26} y={308} className="ib-s">{T.kernelSub}</text>
          <text x={14} y={348} className="ib-layer">{`${T.ps} (${T.from(key)})`}</text>
          <rect className="ib-node" x={12} y={358} width={856} height={104} rx={10} />
          {psLines.map((l, i) => (
            <text key={i} x={28} y={384 + i * 20} className="ib-m" style={{ fontSize: 15 }}>{l}</text>
          ))}
          <text x={852} y={394} textAnchor="end" className="ib-big ib-acc">{count}</text>
          <Lines x={852} y={420} text={lang === 'th' ? 'Process' : count === 1 ? 'process' : 'processes'} max={20} className="ib-s" anchor="end" />
        </svg>
      </div>
      <div className="readout" aria-live="polite">
        <div>{T.readout(key, count, outside ? hostPids : String(stand?.hostPid ?? ''))}</div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
