import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './kernel.json';

// Shows:      three things a container can look at in the kernel: the table of processes, the network interfaces and the hostname. For each one, choose whether the
//             container gets a namespace of its own or looks at the engine's Linux (the options --pid=host, --net=host, --uts=host). The panel changes to what the
//             container then sees. A strip of the seven namespaces below shows which are the container's own.
// Because:    "namespaces decide what a process can see" is about the same kernel showing different tables to different processes. The size of the process list
//             (1 against all of them) and the list of interfaces say it better than a sentence.
// Control:    three switches, one per namespace (own or the engine's).
// Conclusion: a container is an ordinary process whose kernel gives it its own view of processes, network and hostname, and each view can be given back with one option.
//
// The counts and names come from exercises/10_namespaces_cgroups.py --write (kernel.json), measured with containers that were alive at the same time.

type Which = 'pid' | 'net' | 'uts';
const WHICH: Which[] = ['pid', 'net', 'uts'];
const K = data.ns.kinds;
const OWN_DEFAULT = K.filter((k) => data.ns.container[k as keyof typeof data.ns.container] !== data.ns.host[k as keyof typeof data.ns.host]);

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; own: string; host: string; names: Record<Which, string>; sees: Record<Which, string>;
  panelOwn: string; panelHost: string; procs: (n: number) => string; ifaces: string; strip: string; user: string; flags: string; caption: string;
}> = {
  th: {
    title: 'เลือกว่าแต่ละอย่างให้ Container มีของตัวเองหรือไปใช้ของ Linux ที่รัน Engine แล้วดูว่า Container เห็นอะไรต่างไป',
    legend: [{ kind: 'new', text: 'Namespace ของ Container เอง' }, { kind: 'skip', text: 'ใช้ของ Host ร่วมกัน' }, { kind: 'use', text: 'ใช้ร่วมกันตั้งแต่แรก' }],
    pick: 'ให้ Container',
    own: 'มีของตัวเอง',
    host: 'ใช้ของ Host',
    names: { pid: 'Process (pid)', net: 'เครือข่าย (net)', uts: 'ชื่อเครื่อง (uts)' },
    sees: { pid: 'ตาราง Process ที่เห็น', net: 'Interface ที่เห็น', uts: 'Hostname ที่เห็น' },
    panelOwn: 'ของ Container เอง',
    panelHost: 'ของ Host (Linux ที่รัน Engine)',
    procs: (n) => `${n} Process`,
    ifaces: 'Interface',
    strip: 'Namespace ทั้งเจ็ดของ Container ตัวนี้',
    user: 'user ใช้ของ Host เสมอ ถ้าไม่เปิดเอง',
    flags: 'ตัวเลือกที่ต้องใส่',
    caption: 'ตัวเลขและชื่อมาจากแบบฝึก 10 (ดู /proc/self/ns, ps, ls /sys/class/net และ hostname ใน Container ที่รันพร้อมกัน) ตัวเลือก --pid=host และพวกเดียวกันให้ Namespace ของ Linux ที่ Docker Desktop เปิดไว้ ซึ่งไม่ใช่ Windows',
  },
  en: {
    title: 'Choose for each thing whether the container gets a namespace of its own or uses that of the Linux that runs the engine, and see what the container sees differently',
    legend: [{ kind: 'new', text: "the container's own namespace" }, { kind: 'skip', text: "shared with the host's" }, { kind: 'use', text: 'shared from the start' }],
    pick: 'Give the container',
    own: 'its own',
    host: "the host's",
    names: { pid: 'processes (pid)', net: 'network (net)', uts: 'host name (uts)' },
    sees: { pid: 'the process table it sees', net: 'the interfaces it sees', uts: 'the hostname it sees' },
    panelOwn: "the container's own",
    panelHost: "the host's (the Linux that runs the engine)",
    procs: (n) => `${n} process${n === 1 ? '' : 'es'}`,
    ifaces: 'interfaces',
    strip: 'The seven namespaces of this container',
    user: 'user is the host\'s unless we turn it on',
    flags: 'options to add',
    caption: "The numbers and names come from exercise 10 (/proc/self/ns, ps, ls /sys/class/net and hostname in containers that ran at the same time). The option --pid=host and its relatives give the namespaces of the Linux that Docker Desktop starts, which is not Windows.",
  },
};

export default function NamespaceLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [shared, setShared] = useState<Record<Which, boolean>>({ pid: false, net: false, uts: false });
  const toggle = (w: Which, v: boolean) => setShared((s) => ({ ...s, [w]: v }));
  const flags = WHICH.filter((w) => shared[w]).map((w) => `--${w === 'uts' ? 'uts' : w}=host`).join(' ');
  const PW = 276;
  const px = (i: number) => 14 + i * (PW + 14);
  const nIface = shared.net ? data.net.hostCount : data.net.container.length;
  const ifaceChips = shared.net ? ['br-…', 'docker0', 'eth0', 'lo', '…'] : data.net.container;
  const stripState = (k: string) => (k === 'user' ? 'use' : shared[k as Which] ? 'skip' : OWN_DEFAULT.includes(k) ? 'new' : 'use');
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      {WHICH.map((w) => (
        <div className="ib-controls" key={w}>
          <span className="ib-lbl">{`${T.pick} ${T.names[w]}`}</span>
          <span className="seg" role="group" aria-label={T.names[w]}>
            <button type="button" aria-pressed={!shared[w]} onClick={() => toggle(w, false)}>{T.own}</button>
            <button type="button" aria-pressed={shared[w]} onClick={() => toggle(w, true)}>{T.host}</button>
          </span>
        </div>
      ))}
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {WHICH.map((w, i) => (
            <g key={w}>
              <text x={px(i)} y={24} className="ib-t">{T.sees[w]}</text>
              <rect className={shared[w] ? 'ib-skip' : 'ib-new'} x={px(i)} y={36} width={PW} height={150} rx={12} />
              <text x={px(i) + 14} y={62} className="ib-s">{shared[w] ? T.panelHost : T.panelOwn}</text>
              {w === 'pid' && (
                <g>
                  <text x={px(i) + 14} y={130} className="ib-big" style={{ fontSize: 44 }}>{shared.pid ? data.pid.hostProcesses : data.pid.isolatedProcesses}</text>
                  <text x={px(i) + 14} y={160} className="ib-n">{T.procs(shared.pid ? data.pid.hostProcesses : data.pid.isolatedProcesses)}</text>
                </g>
              )}
              {w === 'net' && (
                <g>
                  <text x={px(i) + 14} y={112} className="ib-big" style={{ fontSize: 36 }}>{nIface}</text>
                  <text x={px(i) + 70} y={112} className="ib-n">{T.ifaces}</text>
                  {ifaceChips.slice(0, 5).map((c, j) => (
                    <g key={c + j}>
                      <rect className="ib-node" x={px(i) + 14 + (j % 3) * 84} y={126 + Math.floor(j / 3) * 28} width={78} height={24} rx={7} />
                      <text x={px(i) + 24 + (j % 3) * 84} y={143 + Math.floor(j / 3) * 28} className="ib-m" style={{ fontSize: 13 }}>{c}</text>
                    </g>
                  ))}
                </g>
              )}
              {w === 'uts' && (
                <g>
                  <text x={px(i) + 14} y={116} className="ib-m" style={{ fontSize: 22, fill: 'var(--fg)' }}>{shared.uts ? data.uts.host : data.uts.container}</text>
                  <text x={px(i) + 14} y={150} className="ib-s">{shared.uts ? 'docker run --uts=host' : lang === 'th' ? 'เท่ากับ 12 ตัวแรกของ Container ID' : 'the first 12 characters of the container id'}</text>
                </g>
              )}
            </g>
          ))}
          <text x={14} y={220} className="ib-t">{T.strip}</text>
          {K.map((k, i) => {
            const st = stripState(k);
            return (
              <g key={k}>
                <rect className={st === 'new' ? 'ib-new' : st === 'skip' ? 'ib-skip' : 'ib-use'} x={14 + i * 122} y={232} width={112} height={42} rx={9} />
                <text x={14 + i * 122 + 56} y={259} textAnchor="middle" className="ib-n">{k}</text>
              </g>
            );
          })}
          <text x={14} y={298} className="ib-s">{T.user}</text>
          <text x={14} y={320} className="ib-m" style={{ fontSize: 15, fill: 'var(--fg)' }}>{`${T.flags}: ${flags || '–'}`}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
