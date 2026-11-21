import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Cell } from './kf';
import { kraftCreate, kraftInit, kraftKill, kraftStart, type KraftState } from './models';

// Shows:      three controllers, each with its copy of the metadata log (one letter per record), the quorum leader with its epoch, and whether a majority is alive.
// Because:    "the cluster's own state is a log that needs a majority" is about which nodes hold which records and how many of them are alive. A sentence cannot show a node that falls behind and catches up.
// Control:    stop or start any controller, and create a topic (which appends records to the log).
// Conclusion: with two of three controllers alive the cluster elects a new leader (the epoch goes up) and still changes metadata; with one it can change nothing.
//
// Rules are the ones that exercise 07 ran on a real cluster: the leader's epoch went up (1 to 2 in one run, to 4 in another) when the leader was killed, creating a topic appended one TOPIC_RECORD and two PARTITION_RECORDs, and with only one of three alive the topic was not created.

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; create: string; stop: (n: number) => string; start: (n: number) => string; reset: string;
  leader: string; follower: string; dead: string; epoch: string; majority: (alive: number) => string; key: string; event: (e: string, s: KraftState) => string; caption: string;
}> = {
  th: {
    title: 'หยุด Controller ทีละตัว แล้วสร้าง Topic ดู ว่า Quorum เลือก Leader ใหม่เมื่อไร และเมื่อไรที่ Cluster เปลี่ยนแปลงอะไรไม่ได้เลย',
    legend: [{ kind: 'new', text: 'Controller ที่เป็น Leader ของ Quorum' }, { kind: 'use', text: 'Controller ที่ยังทำงาน' }, { kind: 'skip', text: 'Controller ที่หยุดอยู่' }],
    create: 'สร้าง Topic (เพิ่ม Record ลง Log)', stop: (n) => `หยุด Controller ${n}`, start: (n) => `เริ่ม Controller ${n}`, reset: 'เริ่มใหม่',
    leader: 'Leader ★', follower: 'Follower', dead: 'หยุดอยู่', epoch: 'Epoch', majority: (a) => `ทำงานอยู่ ${a} จาก 3 ${a >= 2 ? '✓ มีเสียงข้างมาก' : '✗ ไม่มีเสียงข้างมาก'}`,
    key: 'F = FEATURE_LEVEL_RECORD · R = REGISTER_BROKER_RECORD · T = TOPIC_RECORD · P = PARTITION_RECORD',
    event: (e, s) => ({
      start: 'เริ่มจาก Controller 1 เป็น Leader ใน Epoch 1 ทุกตัวมี Log เหมือนกัน',
      elected: `เลือก Leader ใหม่ได้ คือ Controller ${s.leader} ใน Epoch ${s.epoch} (ตัวที่ Log ยาวที่สุดในกลุ่มที่เหลือ)`,
      noquorum: 'เหลือ Controller ตัวเดียว ไม่มีเสียงข้างมาก จึงไม่มีใครเป็น Leader ได้ Cluster เปลี่ยน Metadata ไม่ได้',
      killed: 'Controller หยุด ที่เหลือยังมีเสียงข้างมาก Quorum ทำงานต่อ',
      started: 'Controller กลับมา และคัดลอก Log ที่ขาดไปจาก Leader จนเท่ากับตัวอื่น',
      created: 'Leader เพิ่ม TOPIC_RECORD หนึ่งตัวกับ PARTITION_RECORD สองตัว แล้วทุก Controller ที่ทำงานอยู่คัดลอกตาม',
      nomajority: 'สร้าง Topic ไม่ได้ เพราะไม่มี Leader (ไม่มีเสียงข้างมาก) คำสั่งจะค้างจน Timeout',
    } as Record<string, string>)[e] ?? '',
    caption: 'กติกามาจากแบบฝึก 07 ที่รันบน Cluster จริง: Epoch ของ Leader เพิ่มขึ้นเมื่อฆ่า Leader (เพิ่มจาก 1 เป็น 2 ในการรันหนึ่ง และเป็น 4 ในอีกรอบ ไม่ได้ตรวจว่าทำไม), การสร้าง Topic เพิ่ม TOPIC_RECORD 1 ตัวกับ PARTITION_RECORD 2 ตัว และเมื่อเหลือ Controller ตัวเดียวจาก 3 สร้าง Topic ไม่สำเร็จ Log จริงมี Record ชนิดอื่นอีกมาก ในรูปย่อไว้เฉพาะที่เห็นในบทนี้',
  },
  en: {
    title: 'Stop controllers one at a time and create a topic. See when the quorum elects a new leader and when the cluster can change nothing at all',
    legend: [{ kind: 'new', text: 'controller that leads the quorum' }, { kind: 'use', text: 'controller that is running' }, { kind: 'skip', text: 'controller that is stopped' }],
    create: 'create a topic (append records to the log)', stop: (n) => `stop controller ${n}`, start: (n) => `start controller ${n}`, reset: 'start over',
    leader: 'leader ★', follower: 'follower', dead: 'stopped', epoch: 'epoch', majority: (a) => `${a} of 3 running ${a >= 2 ? '✓ majority' : '✗ no majority'}`,
    key: 'F = FEATURE_LEVEL_RECORD · R = REGISTER_BROKER_RECORD · T = TOPIC_RECORD · P = PARTITION_RECORD',
    event: (e, s) => ({
      start: 'We start with controller 1 as leader in epoch 1, and every log is the same.',
      elected: `A new leader was elected: controller ${s.leader} in epoch ${s.epoch} (the one with the longest log among those that are left).`,
      noquorum: 'Only one controller is left, which is not a majority, so nobody can lead. The cluster cannot change its metadata.',
      killed: 'A controller stopped. The rest still form a majority, so the quorum carries on.',
      started: 'The controller is back and copied the records it missed from the leader until its log equals the others.',
      created: 'The leader appended one TOPIC_RECORD and two PARTITION_RECORDs, and every running controller copied them.',
      nomajority: 'The topic cannot be created because there is no leader (no majority). The command hangs until it times out.',
    } as Record<string, string>)[e] ?? '',
    caption: 'The rules come from exercise 07 on a real cluster: the leader epoch went up when the leader was killed (from 1 to 2 in one run and to 4 in another, and the reason was not looked into), creating a topic appended one TOPIC_RECORD and two PARTITION_RECORDs, and with one controller of three left the topic was not created. The real log has many more record types; the picture keeps those used in the lesson.',
  },
};

export default function ElectionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<KraftState>(kraftInit);
  const alive = s.nodes.filter((n) => n.alive).length;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {s.nodes.map((n, i) => {
            const x = 14 + i * 290;
            const lead = s.leader === n.id;
            return (
              <g key={n.id} style={!n.alive ? { opacity: 0.5 } : undefined}>
                <rect className={!n.alive ? 'ib-skip' : lead ? 'ib-new' : 'ib-use'} x={x} y={14} width={270} height={196} rx={12} />
                <text x={x + 14} y={42} className="ib-n">{`Controller ${n.id}`}</text>
                <text x={x + 14} y={64} className="ib-s">{!n.alive ? T.dead : lead ? T.leader : T.follower}</text>
                {n.log.map((r, j) => (
                  <Cell key={j} x={x + 14 + (j % 6) * 40} y={90 + Math.floor(j / 6) * 50} w={34} h={34} text={r} state={r === 'T' || r === 'P' ? 'new' : 'plain'} />
                ))}
                {!n.alive && <text x={x + 224} y={120} className="ib-bad" style={{ fontSize: 60 }}>✗</text>}
              </g>
            );
          })}
          <rect className="ib-banner" x={14} y={224} width={852} height={96} rx={10} />
          <text x={28} y={254} className="ib-n">{`${T.epoch} ${s.epoch} · ${s.leader === null ? '—' : `Controller ${s.leader}`}`}</text>
          <text x={28} y={280} className="ib-s" style={{ fill: alive >= 2 ? 'var(--brand)' : 'var(--ib-bad)', fontWeight: 700 }}>{T.majority(alive)}</text>
          <text x={28} y={306} className="ib-s">{T.key}</text>
        </svg>
      </div>
      <div className="lab-controls">
        <button type="button" className="btn sm" disabled={Math.max(...s.nodes.map((n) => n.log.length)) >= 13} onClick={() => setS(kraftCreate(s))}>{T.create}</button>
        {s.nodes.map((n) => (
          <button key={n.id} type="button" className="btn sm" onClick={() => setS(n.alive ? kraftKill(s, n.id) : kraftStart(s, n.id))}>{n.alive ? T.stop(n.id) : T.start(n.id)}</button>
        ))}
        <button type="button" className="btn sm" onClick={() => setS(kraftInit())}>{T.reset}</button>
      </div>
      <div className="readout" aria-live="polite"><div>{T.event(s.event, s)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
