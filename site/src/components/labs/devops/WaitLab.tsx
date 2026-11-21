import { useState } from 'react';
import { Banner } from '../iceberg/ib';
import { Seg, type Lang } from './dv';
import data from './loop.json';

// Shows:      the same change on two roads, drawn to the same scale (hours of work in colour, hours of waiting hatched), and below it 20 finished changes with a line from each one to the release that takes it.
// Because:    "lead time is mostly waiting" and "a rare release makes everything wait" are claims about lengths. A table of numbers says them, a bar that you can SEE is nearly all hatch says them faster.
// Control:    how often a release leaves (every day, week, 2 weeks, 4 weeks). It moves the red lines and changes every wait line.
// Conclusion: what makes a change slow is the queue in front of each step and the wait for the next release, not the typing; shortening the queues is what a pipeline and small releases are for.
//
// The hours of the two roads and the average waits come from exercises/00_value_stream.py (loop.json); the times are the author's example numbers, not a measurement of a real team.

type Cad = 'every day' | 'every week' | 'every 2 weeks' | 'every 4 weeks';
const HOURS = 24 * 28;
const FINISHED = Array.from({ length: 20 }, (_, i) => (i * HOURS) / 20 + 3);
const EVERY: Record<Cad, number> = { 'every day': 24, 'every week': 168, 'every 2 weeks': 336, 'every 4 weeks': 672 };

const TEXT: Record<Lang, { title: string; caption: string; work: string; wait: string; way1: string; way2: string; hours: string; eff: string; cad: string; cads: Record<Cad, string>; days: string; avg: string; rel: string; fin: string; releaseOf: (n: number) => string; banner: string }> = {
  th: {
    title: 'ดูก่อนว่าเวลาของหนึ่ง Change หมดไปกับอะไร แล้วเลือกว่าจะ Release ทุกกี่วัน เพื่อดูว่า Change ที่เสร็จแล้วต้องรอนานแค่ไหน',
    caption: 'ชั่วโมงของสองแบบและค่าเฉลี่ยของเวลารอมาจากแบบฝึก 00 (loop.json) ตัวเลขเวลาเป็นตัวอย่างที่ผู้เขียนตั้งขึ้นเอง ไม่ได้วัดจากทีมจริง ส่วนจุดทั้งยี่สิบจุดบนแกนวันคือ Change ที่เสร็จห่างกันเท่า ๆ กันตลอดสี่สัปดาห์',
    work: 'มีคนกำลังทำ', wait: 'รอคิว', way1: 'ส่งงานต่อกันเป็นขั้น (ขอ Ops ทีละเรื่อง)', way2: 'ผ่าน Pipeline อัตโนมัติ', hours: 'ชั่วโมง', eff: 'มีคนทำงานอยู่', cad: 'Release', cads: { 'every day': 'ทุกวัน', 'every week': 'ทุกสัปดาห์', 'every 2 weeks': 'ทุก 2 สัปดาห์', 'every 4 weeks': 'ทุก 4 สัปดาห์' },
    days: 'วันที่', avg: 'รอเฉลี่ย', rel: 'รอบ Release', fin: 'Change ที่เสร็จแล้ว', releaseOf: (n) => `${n} Change ต่อรอบ`, banner: 'ยิ่ง Release ห่าง Change ที่เสร็จแล้วยิ่งนอนรอ',
  },
  en: {
    title: 'First see where the time of one change goes, then choose how often a release leaves, and see how long a finished change waits',
    caption: 'The hours of the two roads and the average waits come from exercise 00 (loop.json). The times are example numbers set by the author, not measured on a real team. The twenty dots on the day axis are changes that finish evenly over four weeks.',
    work: 'someone is working', wait: 'waiting in a queue', way1: 'passed along step by step (ask Ops each time)', way2: 'through an automated pipeline', hours: 'hours', eff: 'worked on', cad: 'Release', cads: { 'every day': 'every day', 'every week': 'every week', 'every 2 weeks': 'every 2 weeks', 'every 4 weeks': 'every 4 weeks' },
    days: 'day', avg: 'average wait', rel: 'release', fin: 'finished change', releaseOf: (n) => `${n} changes per release`, banner: 'The rarer the release, the longer finished changes sit and wait',
  },
};

export default function WaitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [cad, setCad] = useState<Cad>('every week');
  const bars = [
    { name: T.way1, steps: data.handoff, lead: data.leadHandoff, eff: data.efficiencyHandoff },
    { name: T.way2, steps: data.pipeline, lead: data.leadPipeline, eff: data.efficiencyPipeline },
  ];
  const scale = 780 / data.leadHandoff;
  const every = EVERY[cad];
  const releases: number[] = [];
  for (let r = every; r <= HOURS + every; r += every) releases.push(r);
  const dx = (h: number) => 50 + (h / (HOURS + 24)) * 800;
  const info = (data.cadence as Record<string, { average_wait_h: number; changes_per_release: number }>)[cad];

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-legend" aria-label="legend">
        <span><i className="use" style={{ background: 'var(--accent)' }} />{T.work}</span>
        <span><i className="skip" />{T.wait}</span>
        <span><i style={{ background: 'var(--ib-bad)', borderColor: 'var(--ib-bad)' }} />{T.rel}</span>
      </div>
      <Seg label={T.cad} options={(Object.keys(EVERY) as Cad[]).map((c) => ({ id: c, text: T.cads[c] }))} value={cad} onChange={setCad} />
      <div className="viz-box">
        <svg viewBox="0 0 880 566" role="img" aria-label={T.title}>
          {bars.map((b, bi) => {
            let x = 50;
            const y = 24 + bi * 78;
            return (
              <g key={bi}>
                <text x={50} y={y} className="ib-n">{b.name}</text>
                {b.steps.map((s, i) => {
                  const wk = s.work * scale, wt = s.wait * scale;
                  const g = (
                    <g key={i}>
                      {wt > 0 && <rect className="ib-skip" x={x} y={y + 10} width={wt} height={26} rx={0} />}
                      {wk > 0 && <rect x={x + wt} y={y + 10} width={Math.max(wk, 2)} height={26} style={{ fill: 'var(--accent)' }} />}
                    </g>
                  );
                  x += wt + wk;
                  return g;
                })}
                <text x={50} y={y + 58} className="ib-n">{Math.round(b.lead)} {T.hours} · {T.eff} {pctOf(b.eff)}</text>
              </g>
            );
          })}
          <line className="ib-line" x1={50} y1={206} x2={850} y2={206} />
          {[0, 7, 14, 21, 28].map((d) => (
            <g key={d}>
              <path className="ib-line" d={`M${dx(d * 24)},200 v12`} />
              <text x={dx(d * 24)} y={230} textAnchor="middle" className="ib-s">{T.days} {d}</text>
            </g>
          ))}
          {releases.filter((r) => r <= HOURS + 1).map((r, i) => (
            <path key={i} d={`M${dx(r)},244 V492`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 3 }} />
          ))}
          {FINISHED.map((f, i) => {
            const next = releases.find((r) => r >= f) ?? HOURS;
            const y = 262 + i * 11.5;
            return (
              <g key={i}>
                <path d={`M${dx(f)},${y} H${dx(Math.min(next, HOURS + 24))}`} style={{ stroke: 'var(--line-strong)', strokeWidth: 3, strokeDasharray: '5 4' }} />
                <circle cx={dx(f)} cy={y} r={5} style={{ fill: 'var(--accent)' }} />
              </g>
            );
          })}
          <text x={50} y={252} className="ib-s">{T.fin}</text>
          <Banner y={506} text={`${T.avg} ${info.average_wait_h.toFixed(0)} ${T.hours} · ${T.releaseOf(info.changes_per_release)}`} />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}

const pctOf = (x: number) => `${Math.round(x * 100)}%`;
