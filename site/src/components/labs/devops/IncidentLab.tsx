import { useState } from 'react';
import { ClockControls, useClock, prog, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Seg, type Lang } from './dv';
import data from './incident.json';

// Shows:      the same bad deploy (14:00, 20% of the requests fail) in three ways of working: no alert so a customer has to write in, an alert and a rollback decided by hand, an alert and a one-command rollback.
//             A timeline of 50 minutes with flags for what happens, an orange band while requests fail, and a bar that fills with the share of the monthly error budget the incident eats.
// Because:    time to detect and time to recover are lengths of a line. The reader sees the orange band stop at three different places, and the bar stop at 34, 16 and 9 percent.
// Control:    the way of working (three); play, scrub, jump.
// Conclusion: the bug is the same, the damage is not: what shortens it is how soon somebody is told and how short the way back is.
//
// The deploy and rollback times are the tags of a real Git repository, the page time is the burn rate alert of exercise 09 on the same data, the shares come from the real counts of requests of the month.
// The times a person needs (5 minutes to look, 10 to decide, 35 for a customer to write in, 3 for a one-command rollback) are assumptions of exercises/10_incident_postmortem.py and are said so in the lesson.

type Way = 'none' | 'hand' | 'one';
const D = 12, MIN = 50;
const sc = data.scenarios as Record<Way, { recovered: number; share: number }>;
const cum = data.cumulative as number[];
const flags = (w: Way): { at: number; key: string }[] =>
  w === 'none' ? [{ at: 0, key: 'deploy' }, { at: 35, key: 'customer' }, { at: sc.none.recovered, key: 'ok' }]
  : w === 'hand' ? [{ at: 0, key: 'deploy' }, { at: data.pageMinute, key: 'page' }, { at: data.ackMinute, key: 'ack' }, { at: data.rollbackTagMinute, key: 'rollback' }, { at: sc.hand.recovered, key: 'ok' }]
  : [{ at: 0, key: 'deploy' }, { at: data.pageMinute, key: 'page' }, { at: data.ackMinute, key: 'ack' }, { at: sc.one.recovered, key: 'ok' }];

const TEXT: Record<Lang, { title: string; caption: string; way: string; ways: Record<Way, string>; flag: Record<string, string>; used: string; ttd: string; ttm: string; min: string; none: string; marks: (w: Way) => Mark[]; clock: string }> = {
  th: {
    title: 'เลือกวิธีทำงาน แล้วกดเล่นดู Deploy ที่พังเดียวกัน ว่าแถบสีส้ม (ช่วงที่คำขอยังล้ม) ยาวแค่ไหนและกินงบของเดือนไปเท่าไร',
    caption: 'เวลา Deploy กับ Rollback มาจาก Tag ใน Git จริง เวลาที่กระดิ่งดังมาจากกฎ Burn Rate ของแบบฝึก 09 ส่วนเวลาที่คนใช้ (5 นาทีดู 10 นาทีตัดสินใจ 35 นาทีกว่าลูกค้าจะแจ้ง 3 นาทีสำหรับ Rollback คำสั่งเดียว) เป็นข้อสมมติของแบบฝึก 10 งบที่ใช้คือส่วนของงบ 30 วันที่คำขอล้ม 20% ในช่วงนั้นกิน',
    way: 'วิธีทำงาน', ways: { none: 'ไม่มีการเตือน ลูกค้าต้องแจ้ง', hand: 'มีการเตือน Rollback ด้วยมือ', one: 'มีการเตือน Rollback คำสั่งเดียว' },
    flag: { deploy: 'Deploy v1.1', customer: 'ลูกค้าแจ้ง', page: 'กระดิ่งดัง', ack: 'คนรับเรื่อง', rollback: 'Tag v1.1.1', ok: 'กลับมาปกติ' },
    used: 'กินงบของเดือนไป', ttd: 'รู้ปัญหาหลัง', ttm: 'กลับมาปกติหลัง', min: 'นาที', none: 'ยังไม่รู้', clock: 'เวลา',
    marks: (w) => [
      { at: 0, name: 'Deploy', title: 'บ่ายสอง Deploy เวอร์ชัน 1.1 และคำขอเริ่มล้ม', text: 'คำขอ 20% ล้มตั้งแต่นาทีแรก แถบสีส้มเริ่มยาวขึ้นและงบของเดือนเริ่มถูกกิน' },
      { at: w === 'none' ? 8.4 : 1, name: w === 'none' ? 'ลูกค้าแจ้ง' : 'กระดิ่งดัง', title: w === 'none' ? 'นาทีที่ 35 ลูกค้าเขียนมาแจ้ง ทีมถึงเพิ่งรู้' : 'นาทีที่ 4 กฎ Burn Rate ปลุกคนที่เข้าเวร', text: w === 'none' ? 'ไม่มีกระดิ่งเลย ปัญหารู้ผ่านลูกค้า ต้องรอถึงนาทีที่ 35 เพราะไม่มีตัวชี้วัดที่ผูกกับงบ' : 'การรู้เร็วคือสิ่งที่ตัดแท่งสีส้มลง คนที่รับเรื่อง (นาทีที่ 9) ดู Dashboard และตัดสินใจ Rollback' },
      { at: (sc[w].recovered / MIN) * D, name: 'กลับปกติ', title: w === 'none' ? 'นาทีที่ 45 กลับมาปกติ ใช้งบ 34% ของเดือน' : w === 'hand' ? 'นาทีที่ 21 กลับมาปกติ ใช้งบ 16% ของเดือน' : 'นาทีที่ 12 กลับมาปกติ ใช้งบ 9% ของเดือน', text: 'บั๊กเดียวกัน แต่ความเสียหายต่างกันสี่เท่า สิ่งที่ต่างคือเวลาที่รู้ปัญหา และความยาวของทางย้อนกลับ ไม่ใช่ความสามารถของคนเขียนโค้ด' },
    ],
  },
  en: {
    title: 'Choose a way of working and press play to see the same bad deploy: how long the orange band (while requests still fail) is, and how much of the monthly budget it eats',
    caption: 'The deploy and rollback times are tags in a real Git repository, the time the bell rings comes from the burn rate rule of exercise 09, and the times a person needs (5 minutes to look, 10 to decide, 35 for a customer to write in, 3 for a one-command rollback) are assumptions of exercise 10. The budget used is the part of the 30 day budget that 20% failing requests eat in that time.',
    way: 'way of working', ways: { none: 'no alert, a customer must tell us', hand: 'alert, rollback by hand', one: 'alert, one-command rollback' },
    flag: { deploy: 'deploy v1.1', customer: 'customer writes', page: 'bell rings', ack: 'on-call picks up', rollback: 'tag v1.1.1', ok: 'back to normal' },
    used: 'of the monthly budget eaten', ttd: 'known after', ttm: 'back to normal after', min: 'min', none: 'not known yet', clock: 'time',
    marks: (w) => [
      { at: 0, name: 'Deploy', title: 'At 14:00 version 1.1 is deployed and requests start to fail', text: '20% of the requests fail from the first minute. The orange band starts to grow and the monthly budget starts to be eaten.' },
      { at: w === 'none' ? 8.4 : 1, name: w === 'none' ? 'Customer writes' : 'Bell rings', title: w === 'none' ? 'At minute 35 a customer writes in, and only then does the team know' : 'At minute 4 the burn rate rule wakes whoever is on call', text: w === 'none' ? 'There is no bell at all. The problem becomes known through a customer, at minute 35, because nothing measures the budget.' : 'Knowing early is what cuts the orange band. The person on call (minute 9) looks at the dashboard and decides to roll back.' },
      { at: (sc[w].recovered / MIN) * D, name: 'Back to normal', title: w === 'none' ? 'Minute 45 back to normal, 34% of the month\'s budget used' : w === 'hand' ? 'Minute 21 back to normal, 16% of the month\'s budget used' : 'Minute 12 back to normal, 9% of the month\'s budget used', text: 'The same bug, but the damage differs by a factor of four. What differs is how soon we know and how short the way back is, not how good the programmer is.' },
    ],
  },
};

export default function IncidentLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [way, setWay] = useState<Way>('hand');
  const clock = useClock(D);
  const m = prog(clock.t, 0, D) * MIN;
  const rec = sc[way].recovered;
  const X0 = 40, W = 800, px = (x: number) => X0 + (x / MIN) * W;
  const fl = flags(way);
  const upto = Math.min(m, rec);
  const used = cum[Math.min(50, Math.floor(upto))] ?? 0;
  const known = way === 'none' ? (m >= 35 ? 35 : null) : (m >= data.pageMinute ? data.pageMinute : null);
  const back = m >= rec ? rec : null;
  const marks = T.marks(way);
  let cur = 0;
  marks.forEach((mk, i) => { if (clock.t >= mk.at - 0.001) cur = i; });
  const hh = (x: number) => `14:${String(Math.floor(x)).padStart(2, '0')}`;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.way} options={(['none', 'hand', 'one'] as Way[]).map((w) => ({ id: w, text: T.ways[w] }))} value={way} onChange={(w) => { setWay(w); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={T.title}>
          <text x={X0} y={30} className="ib-n">{T.clock} {hh(m)}</text>
          <line className="ib-line" x1={X0} y1={150} x2={X0 + W} y2={150} />
          {[0, 10, 20, 30, 40, 50].map((x) => (
            <g key={x}>
              <path className="ib-line" d={`M${px(x)},150 v8`} />
              <text x={px(x)} y={178} textAnchor="middle" className="ib-s">{hh(x)}</text>
            </g>
          ))}
          <rect x={px(0)} y={128} width={Math.max(0, px(upto) - px(0))} height={22} style={{ fill: 'var(--ib-bad)', opacity: 0.85 }} />
          {m > rec && <rect x={px(rec)} y={128} width={px(m) - px(rec)} height={22} style={{ fill: 'color-mix(in srgb, var(--k2) 45%, var(--surface))' }} />}
          <path d={`M${px(m)},110 V160`} style={{ stroke: 'var(--fg)', strokeWidth: 3 }} />
          {fl.map((f, i) => (m >= f.at ? (
            <g key={f.key}>
              <path d={`M${px(f.at)},${60 + (i % 2) * 28} V128`} style={{ stroke: f.key === 'ok' ? 'var(--k2)' : 'var(--accent)', strokeWidth: 2.5 }} />
              <text x={px(f.at) + (f.key === 'ok' && f.at > 35 ? -4 : 4)} y={56 + (i % 2) * 28} textAnchor={f.key === 'ok' && f.at > 35 ? 'end' : 'start'} className="ib-n" style={{ fontSize: 15 }}>{hh(f.at)} {T.flag[f.key]}</text>
            </g>
          ) : null))}
          <text x={X0} y={218} className="ib-t">{T.used}</text>
          <rect x={X0} y={230} width={W} height={30} rx={8} className="ib-node" />
          <rect x={X0 + 3} y={233} width={Math.max(0, (W - 6) * Math.min(1, used / 0.4))} height={24} rx={6} style={{ fill: 'var(--ib-bad)' }} />
          <text x={X0 + W} y={282} textAnchor="end" className="ib-s">40%</text>
          <text x={X0} y={282} className="ib-s">0%</text>
          <text x={X0 + 10} y={252} className="ib-n" style={{ fill: '#fff' }}>{Math.round(used * 100)}%</text>
          <text x={X0} y={318} className="ib-n">{T.ttd}: {known === null ? T.none : `${known} ${T.min}`}   ·   {T.ttm}: {back === null ? '…' : `${back} ${T.min}`}</text>
          <Banner y={344} text={marks[cur].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
