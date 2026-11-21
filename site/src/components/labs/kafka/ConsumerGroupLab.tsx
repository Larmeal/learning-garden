import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { rangeAssign } from './models';

// Shows:      the partitions of a topic as a row of boxes, the members of one consumer group below them, and a line from each partition to the member that reads it.
// Because:    "who reads what" changes with every join and leave, and a member that dies without a goodbye leaves its partitions with nobody for a while. That is a picture of lines, not a table.
// Control:    number of partitions (3 or 6), add a member, a member leaves politely, a member crashes (no goodbye), and "session.timeout.ms passes".
// Conclusion: partitions are shared out between the members of a group, one reader per partition; more members than partitions leaves some idle, and a crashed member is only noticed after the session timeout.
//
// The sharing out is the range assignor. Exercise 04 ran 1 to 4 members on 3 partitions and got the same split, and a member killed with kill -9 was noticed after 6.1 s with session.timeout.ms=6000.

interface Member { id: number; dead: boolean }

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; parts: string; add: string; leave: string; crash: string; wait: string; reset: string;
  partition: string; member: string; idle: string; nobody: string; dead: string; readout: (m: number, p: number, idle: number, waiting: boolean) => string; caption: string;
}> = {
  th: {
    title: 'เพิ่ม Consumer เข้า Group ทีละตัว แล้วลองให้ตัวหนึ่งออกไปเฉย ๆ กับให้ล้มกะทันหัน ดูว่าเส้นจาก Partition ไปหา Consumer เปลี่ยนอย่างไร',
    legend: [{ kind: 'use', text: 'Partition ที่มีคนอ่าน' }, { kind: 'skip', text: 'Partition ที่ไม่มีใครอ่าน' }, { kind: 'new', text: 'Consumer ที่เพิ่งได้ Partition ใหม่' }],
    parts: 'จำนวน Partition', add: 'เพิ่ม Consumer', leave: 'Consumer ตัวแรกลาออกเรียบร้อย', crash: 'Consumer ตัวแรกล้มกะทันหัน', wait: 'ผ่านไป session.timeout.ms แล้ว', reset: 'เริ่มใหม่',
    partition: 'Partition', member: 'Consumer', idle: 'ว่าง ไม่มี Partition', nobody: 'ไม่มีใครอ่าน', dead: 'ล้มแล้ว',
    readout: (m, p, idle, waiting) => waiting ? 'Consumer ที่ล้มไม่ได้บอกลา Broker ยังรอ Heartbeat อยู่ ระหว่างนี้ Partition ของมันไม่มีใครอ่าน Record ใหม่จะกองอยู่ใน Log จนกว่าจะครบ session.timeout.ms' : `Group มี ${m} Consumer อ่าน ${p} Partition${idle ? ` มี ${idle} ตัวที่ว่างเพราะ Partition ไม่พอแบ่ง` : ' ทุกตัวมีงานทำ'}`,
    caption: 'การแบ่งใช้ Range Assignor แบบฝึก 04 ลอง 1 ถึง 4 Consumer กับ 3 Partition ได้การแบ่งเหมือนในรูป และ Consumer ที่ถูก kill -9 ถูกจับได้หลัง 6.1 วินาที เมื่อตั้ง session.timeout.ms=6000',
  },
  en: {
    title: 'Add consumers to the group one by one, then let one leave politely and another crash. See how the lines from partitions to consumers change',
    legend: [{ kind: 'use', text: 'partition with a reader' }, { kind: 'skip', text: 'partition nobody reads' }, { kind: 'new', text: 'consumer that just got a new partition' }],
    parts: 'partitions', add: 'add a consumer', leave: 'first consumer leaves politely', crash: 'first consumer crashes', wait: 'session.timeout.ms has passed', reset: 'start over',
    partition: 'partition', member: 'consumer', idle: 'idle, no partition', nobody: 'nobody reads', dead: 'crashed',
    readout: (m, p, idle, waiting) => waiting ? 'The crashed consumer did not say goodbye. The broker is still waiting for a heartbeat, so nobody reads its partitions and new records pile up in the log until session.timeout.ms is over.' : `The group has ${m} consumers reading ${p} partitions${idle ? `; ${idle} of them idle because there are not enough partitions` : ', and everyone has work'}`,
    caption: 'The split is the range assignor. Exercise 04 ran 1 to 4 consumers on 3 partitions and got the same split, and a consumer killed with kill -9 was noticed after 6.1 s with session.timeout.ms=6000.',
  },
};

export default function ConsumerGroupLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [P, setP] = useState(3);
  const [members, setMembers] = useState<Member[]>([{ id: 1, dead: false }]);
  const [next, setNext] = useState(2);
  const [owners, setOwners] = useState<Map<number, number[]>>(() => rangeAssign([1], 3));
  const [fresh, setFresh] = useState<number[]>([]);
  const assign = (ms: Member[], parts: number, before?: Map<number, number[]>) => {
    const a = rangeAssign(ms.filter((m) => !m.dead).map((m) => m.id), parts);
    setOwners(a);
    setFresh([...a].filter(([id, ps]) => ps.length && JSON.stringify(before?.get(id) ?? []) !== JSON.stringify(ps)).map(([id]) => id));
  };
  const reset = (parts: number) => { setP(parts); const ms = [{ id: 1, dead: false }]; setMembers(ms); setNext(2); setOwners(rangeAssign([1], parts)); setFresh([]); };
  const waiting = members.some((m) => m.dead);
  const ownerOf = (p: number) => [...owners].find(([, ps]) => ps.includes(p))?.[0];
  const idle = members.filter((m) => !m.dead && !(owners.get(m.id)?.length)).length;
  const pw = 836 / P;
  const mw = Math.min(150, 836 / Math.max(members.length, 1) - 12);
  const mx = (i: number) => 22 + i * (836 / Math.max(members.length, 1)) + 6;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.parts}</span>
        <span className="seg" role="group" aria-label={T.parts}>
          {[3, 6].map((c) => (<button key={c} type="button" aria-pressed={P === c} onClick={() => reset(c)}>{c}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {Array.from({ length: P }, (_, p) => {
            const o = ownerOf(p);
            return (
              <g key={p}>
                <rect className={o === undefined ? 'ib-skip' : 'ib-use'} x={22 + p * pw + 4} y={20} width={pw - 8} height={64} rx={10} />
                <text x={22 + p * pw + pw / 2} y={48} textAnchor="middle" className="ib-n">{`${T.partition} ${p}`}</text>
                <text x={22 + p * pw + pw / 2} y={70} textAnchor="middle" className="ib-s">{o === undefined ? T.nobody : `→ ${T.member} ${o}`}</text>
                {o !== undefined && (() => {
                  const i = members.findIndex((m) => m.id === o);
                  return <path className="ib-line" d={`M${22 + p * pw + pw / 2},84 C${22 + p * pw + pw / 2},150 ${mx(i) + mw / 2},150 ${mx(i) + mw / 2},206`} style={{ stroke: 'var(--accent)', strokeWidth: 3 }} />;
                })()}
              </g>
            );
          })}
          {members.map((m, i) => {
            const mine = owners.get(m.id) ?? [];
            return (
              <g key={m.id} style={m.dead ? { opacity: 0.5 } : undefined}>
                <rect className={m.dead ? 'ib-skip' : fresh.includes(m.id) ? 'ib-new' : mine.length ? 'ib-use' : 'ib-node'} x={mx(i)} y={206} width={mw} height={96} rx={12} />
                <text x={mx(i) + 12} y={234} className="ib-n">{`${T.member} ${m.id}`}</text>
                <text x={mx(i) + 12} y={258} className="ib-s">{m.dead ? T.dead : mine.length ? mine.map((p) => `P${p}`).join(' ') : T.idle}</text>
                {m.dead && <text x={mx(i) + mw - 24} y={240} className="ib-bad" style={{ fontSize: 30 }}>✗</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="lab-controls">
        <button type="button" className="btn sm" disabled={waiting || members.length >= 8} onClick={() => { const ms = [...members, { id: next, dead: false }]; setMembers(ms); setNext(next + 1); assign(ms, P, owners); }}>{T.add}</button>
        <button type="button" className="btn sm" disabled={waiting || members.length < 2} onClick={() => { const ms = members.slice(1); setMembers(ms); assign(ms, P, owners); }}>{T.leave}</button>
        <button type="button" className="btn sm" disabled={waiting || members.length < 2} onClick={() => { setMembers(members.map((m, i) => (i === 0 ? { ...m, dead: true } : m))); setFresh([]); }}>{T.crash}</button>
        <button type="button" className="btn sm" disabled={!waiting} onClick={() => { const ms = members.filter((m) => !m.dead); setMembers(ms); assign(ms, P, owners); }}>{T.wait}</button>
        <button type="button" className="btn sm" onClick={() => reset(P)}>{T.reset}</button>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(members.filter((m) => !m.dead).length, P, idle, waiting)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
