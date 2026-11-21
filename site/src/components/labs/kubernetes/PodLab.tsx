import { useState } from 'react';
import { Seg, type Lang } from '../devops/dv';

// Shows:      one Pod drawn as a box with two containers inside (web and sidecar). The reader picks one thing (IP, files, processes ...) and sees whether the two containers
//             share it (one band across both, with one value) or each has its own (two bands, two different values).
// Because:    "a Pod is a group of containers that share some things and not others" is a list of six yes/no answers, and a reader remembers the picture of one band against two bands.
// Control:    the thing to look at; for processes a second switch (shareProcessNamespace off or on).
// Conclusion: the network (IP, localhost) and the volumes are shared, files and processes are not unless you ask.
//
// Every value printed in the picture was printed by exercises/02_pods.py (pods.json says which things were shared).

type Thing = 'ip' | 'localhost' | 'files' | 'folder' | 'procs';
type Row = { shared: boolean; web: string; side: string; shareLabel?: string; cmd: string; note: string };

const TEXT: Record<Lang, { title: string; caption: string; thing: string; things: Record<Thing, string>; sp: string; spOpts: [string, string]; shared: string; own: string; pod: string; rows: (t: Thing, sp: boolean) => Row }> = {
  th: {
    title: 'เลือกสิ่งที่อยากดู แล้วดูว่า Container สองตัวใน Pod เดียวกันใช้ร่วมกันหรือต่างคนต่างมี',
    caption: 'ค่าทุกตัวในภาพถูกพิมพ์ออกมาจากการรันจริงในแบบฝึก 02 (Pod ชื่อ pair กับ shared, busybox:1.37 บน Kubernetes v1.31.0) หนึ่งแถบที่พาดผ่านทั้งสอง Container คือของที่ใช้ร่วมกัน สองแถบแยกกันคือต่างคนต่างมี',
    thing: 'สิ่งที่ดู', things: { ip: 'IP Address', localhost: 'localhost', files: 'ไฟล์ใน /tmp', folder: 'โฟลเดอร์ emptyDir', procs: 'รายการ Process' },
    sp: 'shareProcessNamespace', spOpts: ['ปิด (ค่าเริ่มต้น)', 'เปิด'], shared: 'ใช้ร่วมกัน', own: 'ต่างคนต่างมี', pod: 'Pod pair',
    rows: (t, sp) => ({
      ip: { shared: true, web: '10.244.1.2', side: '10.244.1.2', cmd: 'hostname -i  (ในแต่ละ Container)', note: 'ทั้งสอง Container เห็น IP ตัวเดียวกัน คือ IP ของ Pod', shareLabel: '10.244.1.2' },
      localhost: { shared: true, web: 'httpd :8080', side: 'wget localhost:8080', shareLabel: 'localhost', cmd: 'wget -qO- http://localhost:8080/  (จาก sidecar)', note: 'Sidecar เรียก localhost แล้วได้คำตอบ hello-from-web จาก Container web เพราะอยู่ใน Network Namespace เดียวกัน' },
      files: { shared: false, web: '/tmp/web-only', side: '(ว่าง)', cmd: 'ls /tmp/web-only  (จาก sidecar)', note: 'Sidecar ไม่เห็นไฟล์ที่ web เขียนไว้ เพราะแต่ละ Container มีระบบไฟล์ของ Image ตัวเอง: ls: No such file or directory', shareLabel: '' },
      folder: { shared: true, web: '/drop/note', side: '/seen/note', shareLabel: 'emptyDir "drop"', cmd: 'cat /seen/note  (จาก reader)', note: 'Volume ชนิด emptyDir ถูก Mount เข้าทั้งสอง Container (คนละ Path) จึงเห็นไฟล์เดียวกัน from-writer' },
      procs: sp
        ? { shared: true, web: 'sleep 3600 (PID 7)', side: 'sleep 3600 (PID 13)', shareLabel: 'PID 1 = /pause', cmd: 'ps  (จาก reader)', note: 'เมื่อเปิด shareProcessNamespace Container เห็น Process ของกันและกัน และ PID 1 เปลี่ยนเป็น /pause' }
        : { shared: false, web: 'httpd', side: 'sleep 3600 (PID 1)', cmd: 'ps  (จาก sidecar)', note: 'ค่าเริ่มต้นคือแต่ละ Container เห็นเฉพาะ Process ของตัวเอง และ Process ของมันเป็น PID 1' },
    })[t] as Row,
  },
  en: {
    title: 'Pick a thing to look at, and see whether the two containers of one Pod share it or each has its own',
    caption: 'Every value in the picture was printed by a real run of exercise 02 (Pods pair and shared, busybox:1.37 on Kubernetes v1.31.0). One band across both containers is something they share; two separate bands mean each has its own.',
    thing: 'thing', things: { ip: 'IP address', localhost: 'localhost', files: 'files in /tmp', folder: 'emptyDir folder', procs: 'process list' },
    sp: 'shareProcessNamespace', spOpts: ['off (default)', 'on'], shared: 'shared', own: 'each its own', pod: 'Pod pair',
    rows: (t, sp) => ({
      ip: { shared: true, web: '10.244.1.2', side: '10.244.1.2', cmd: 'hostname -i  (in each container)', note: 'Both containers see the same IP, the IP of the Pod.', shareLabel: '10.244.1.2' },
      localhost: { shared: true, web: 'httpd :8080', side: 'wget localhost:8080', shareLabel: 'localhost', cmd: 'wget -qO- http://localhost:8080/  (from the sidecar)', note: 'The sidecar calls localhost and gets hello-from-web from the web container, because they are in one network namespace.' },
      files: { shared: false, web: '/tmp/web-only', side: '(empty)', cmd: 'ls /tmp/web-only  (from the sidecar)', note: 'The sidecar does not see the file that web wrote, because each container has the file system of its own image: ls: No such file or directory', shareLabel: '' },
      folder: { shared: true, web: '/drop/note', side: '/seen/note', shareLabel: 'emptyDir "drop"', cmd: 'cat /seen/note  (from reader)', note: 'An emptyDir volume is mounted into both containers (at different paths), so both see the same file, from-writer.' },
      procs: sp
        ? { shared: true, web: 'sleep 3600 (PID 7)', side: 'sleep 3600 (PID 13)', shareLabel: 'PID 1 = /pause', cmd: 'ps  (from reader)', note: 'With shareProcessNamespace on, the containers see each other\'s processes, and PID 1 becomes /pause.' }
        : { shared: false, web: 'httpd', side: 'sleep 3600 (PID 1)', cmd: 'ps  (from the sidecar)', note: 'By default each container sees only its own processes, and its own process is PID 1.' },
    })[t] as Row,
  },
};

export default function PodLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [thing, setThing] = useState<Thing>('ip');
  const [sp, setSp] = useState(false);
  const r = T.rows(thing, sp);
  const webName = thing === 'folder' ? 'writer' : thing === 'files' || thing === 'localhost' || thing === 'ip' ? 'web' : 'writer';
  const sideName = thing === 'folder' ? 'reader' : thing === 'procs' ? 'reader' : 'sidecar';
  const col = r.shared ? 'var(--k2)' : 'var(--ib-bad)';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.thing} options={(Object.keys(T.things) as Thing[]).map((k) => ({ id: k, text: T.things[k] }))} value={thing} onChange={setThing} />
      {thing === 'procs' && <Seg label={T.sp} options={[{ id: 'off', text: T.spOpts[0] }, { id: 'on', text: T.spOpts[1] }]} value={sp ? 'on' : 'off'} onChange={(v) => setSp(v === 'on')} />}
      <div className="viz-box">
        <svg viewBox="0 0 880 326" role="img" aria-label={T.title}>
          <rect className="ib-node" x={20} y={20} width={840} height={256} rx={16} style={{ strokeDasharray: '10 6' }} />
          <text x={40} y={52} className="ib-n">{T.pod}</text>
          {[{ x: 50, n: webName, v: r.web }, { x: 470, n: sideName, v: r.side }].map((c) => (
            <g key={c.n}>
              <rect className="ib-node" x={c.x} y={76} width={360} height={176} rx={12} />
              <text x={c.x + 16} y={104} className="ib-n">{lang === 'th' ? 'Container' : 'container'} {c.n}</text>
              {!r.shared && (
                <g>
                  <rect className="nw-cell bad" x={c.x + 20} y={146} width={320} height={56} rx={10} />
                  <text x={c.x + 180} y={181} textAnchor="middle" className="ib-m" style={{ fontSize: 16 }}>{c.v}</text>
                </g>
              )}
            </g>
          ))}
          {r.shared && (
            <g>
              <rect className="nw-cell ok" x={70} y={140} width={740} height={68} rx={12} style={{ strokeWidth: 3 }} />
              <text x={440} y={168} textAnchor="middle" className="ib-n" style={{ fontSize: 20 }}>{r.shareLabel}</text>
              <text x={440} y={194} textAnchor="middle" className="ib-s">{T.shared}</text>
              <text x={90} y={232} className="ib-m">{r.web}</text>
              <text x={790} y={232} className="ib-m" textAnchor="end">{r.side}</text>
            </g>
          )}
          {!r.shared && <text x={440} y={268} textAnchor="middle" className="ib-n" style={{ fill: col }}>{T.own}</text>}
          <text x={20} y={310} className="ib-m">$ {r.cmd}</text>
        </svg>
      </div>
      <p className="viz-now"><strong>{r.shared ? T.shared : T.own}</strong><span>{r.note}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
