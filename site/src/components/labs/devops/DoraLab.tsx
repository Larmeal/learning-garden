import { useState } from 'react';
import { Lines } from '../iceberg/ib';
import { Seg, Tile, type Lang } from './dv';
import data from './dora.json';

// Shows:      two teams over eight weeks as two strips of deploys (one mark each, orange with a cross when the deploy failed), and under each strip the four DORA numbers read from the Git tags of that team.
//             The metric you choose is lit on both teams, with a short line on how it is computed.
// Because:    the four numbers are four different questions about the same strip of marks: how many marks (frequency), how long a commit waited for the next mark (lead time), how many marks are orange (failure rate),
//             how long an orange mark stayed orange (restore). The picture shows that all four are read from one record, and that they move together here.
// Control:    which metric to look at.
// Conclusion: the DORA metrics are counted from the history you already have (commits and deploy tags). The calculation can be checked by a script; whether small batches REALLY give fewer failures is not proved by invented data.
//
// The marks and the numbers come from exercises/12_dora_metrics.py (dora.json), which builds two real Git repositories with fixed dates. Which releases fail (every 3rd of Batch, every 10th of Flow) and how long a restore takes
// are choices of the exercise, so the data show that the calculation works, not that Flow is better.

type Metric = 'freq' | 'lead' | 'fail' | 'restore';
type TeamKey = 'batch' | 'flow';
const T0 = Date.parse('2026-01-05T00:00:00Z');
const SPAN = data.weeks * 7 * 86400000;
const X0 = 40, W = 800;
const teams = data.teams as unknown as Record<TeamKey, { deploys: number; per_week: number; lead_median_h: number; change_fail_rate: number; restore_mean_min: number; failures: number; commits: number; timeline: { at: string; commits: number; failed: boolean }[] }>;

const TEXT: Record<Lang, { title: string; caption: string; metric: string; metrics: Record<Metric, string>; team: Record<TeamKey, string>; how: Record<Metric, string>; val: Record<Metric, (t: TeamKey) => string>; sub: Record<Metric, string>; week: string; note: string }> = {
  th: {
    title: 'เลือกตัวชี้วัดของ DORA แล้วดูว่ามันอ่านมาจากแถบการ Deploy ของสองทีมในแปดสัปดาห์อย่างไร',
    caption: 'แถบและตัวเลขทั้งหมดอ่านจาก Git จริงสองที่เก็บในแบบฝึก 12 (dora.json) ทีม Batch Release ทุกสองสัปดาห์ ทีม Flow Release วันละสองครั้ง ข้อมูลเป็นของที่แต่งขึ้น: Release ที่ล้ม (ทุกครั้งที่สามของ Batch ทุกครั้งที่สิบของ Flow) กับเวลากู้คืนเป็นตัวเลือกของแบบฝึก จึงตรวจได้แค่ว่าการคำนวณถูก ไม่ได้พิสูจน์ว่า Batch เล็กล้มน้อยกว่า',
    metric: 'ตัวชี้วัด', metrics: { freq: 'ความถี่ในการ Deploy', lead: 'Lead Time', fail: 'อัตรา Deploy ที่ล้ม', restore: 'เวลากู้คืน' }, team: { batch: 'ทีม Batch', flow: 'ทีม Flow' },
    how: { freq: 'นับจำนวน Tag deploy-N แล้วหารด้วยจำนวนสัปดาห์', lead: 'เวลาจากแต่ละ Commit ถึง Tag deploy ที่เอามันออก (ค่ากลางของทุก Commit)', fail: 'จำนวน Deploy ที่ข้อความของ Tag บอกว่าล้ม หารด้วยจำนวน Deploy ทั้งหมด', restore: 'ค่าเฉลี่ยของเวลาจาก Deploy ที่ล้ม ถึงเวลากู้คืนที่จดไว้ในข้อความของ Tag' },
    val: {
      freq: (k) => `${teams[k].deploys} ครั้ง (${teams[k].per_week.toFixed(1)} ต่อสัปดาห์)`,
      lead: (k) => `${teams[k].lead_median_h >= 48 ? (teams[k].lead_median_h / 24).toFixed(1) + ' วัน' : teams[k].lead_median_h.toFixed(0) + ' ชั่วโมง'}`,
      fail: (k) => `${Math.round(teams[k].change_fail_rate * 100)}% (${teams[k].failures} จาก ${teams[k].deploys})`,
      restore: (k) => `${Math.round(teams[k].restore_mean_min)} นาที`,
    },
    sub: { freq: 'Deploy ต่อสัปดาห์', lead: 'ค่ากลาง', fail: 'ล้มกี่ครั้ง', restore: 'ค่าเฉลี่ย' }, week: 'สัปดาห์', note: 'เครื่องหมายส้มคือ Deploy ที่ล้ม',
  },
  en: {
    title: 'Choose a DORA metric and see how it is read from the strip of deploys of two teams over eight weeks',
    caption: 'The strips and all numbers are read from two real Git repositories of exercise 12 (dora.json). Team Batch releases every two weeks, team Flow twice a day. The data are made up: which releases fail (every 3rd of Batch, every 10th of Flow) and how long a restore takes are choices of the exercise, so it checks only that the calculation is right and does not prove that small batches fail less.',
    metric: 'metric', metrics: { freq: 'deployment frequency', lead: 'lead time', fail: 'change failure rate', restore: 'time to restore' }, team: { batch: 'team Batch', flow: 'team Flow' },
    how: { freq: 'count the deploy-N tags and divide by the number of weeks', lead: 'the time from each commit to the deploy tag that carried it out (the median over all commits)', fail: 'the deploys whose tag message says failed, divided by all deploys', restore: 'the mean of the time from a failed deploy to the restore time noted in the message of its tag' },
    val: {
      freq: (k) => `${teams[k].deploys} deploys (${teams[k].per_week.toFixed(1)} a week)`,
      lead: (k) => `${teams[k].lead_median_h >= 48 ? (teams[k].lead_median_h / 24).toFixed(1) + ' days' : teams[k].lead_median_h.toFixed(0) + ' hours'}`,
      fail: (k) => `${Math.round(teams[k].change_fail_rate * 100)}% (${teams[k].failures} of ${teams[k].deploys})`,
      restore: (k) => `${Math.round(teams[k].restore_mean_min)} minutes`,
    },
    sub: { freq: 'deploys a week', lead: 'median', fail: 'how many failed', restore: 'mean' }, week: 'week', note: 'an orange mark is a deploy that failed',
  },
};

export default function DoraLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [m, setM] = useState<Metric>('freq');
  const x = (iso: string) => X0 + ((Date.parse(iso) - T0) / SPAN) * W;
  const rows: { k: TeamKey; y: number }[] = [{ k: 'batch', y: 70 }, { k: 'flow', y: 250 }];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.metric} options={(Object.keys(T.metrics) as Metric[]).map((k) => ({ id: k, text: T.metrics[k] }))} value={m} onChange={setM} />
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          {rows.map(({ k, y }) => (
            <g key={k}>
              <text x={X0} y={y - 28} className="ib-t">{T.team[k]}</text>
              <rect x={X0} y={y - 14} width={W} height={34} rx={6} className="ib-node" />
              {[1, 2, 3, 4, 5, 6, 7].map((w) => (<path key={w} className="ib-line" d={`M${X0 + (w / data.weeks) * W},${y - 14} v34`} />))}
              {teams[k].timeline.map((d, i) => {
                const cx = x(d.at);
                return (
                  <g key={i}>
                    <circle cx={cx} cy={y + 3} r={k === 'batch' ? 11 : 6} style={{ fill: d.failed ? 'var(--ib-bad)' : m === 'freq' ? 'var(--accent)' : 'var(--k2)' }} />
                    {d.failed && <path d={`M${cx - 3},${y} l6,6 M${cx + 3},${y} l-6,6`} style={{ stroke: '#fff', strokeWidth: 1.8 }} />}
                  </g>
                );
              })}
              <Tile x={X0} y={y + 34} w={800} h={64} title={`${T.metrics[m]}: ${T.val[m](k)}`} sub={T.sub[m]} state="on" big />
            </g>
          ))}
          {[0, 2, 4, 6, 8].map((w) => (
            <text key={w} x={X0 + (w / data.weeks) * W} y={186} textAnchor="middle" className="ib-s">{T.week} {w}</text>
          ))}
          <text x={X0} y={206} className="ib-s">{T.note}</text>
          <rect className="ib-banner" x={12} y={376} width={856} height={56} rx={10} />
          <Lines x={26} y={402} text={T.how[m]} max={92} lh={22} className="ib-n" />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
