import { useState } from 'react';
import { ClockControls, useClock, prog, type Mark } from '../spark/timeline';
import { Banner, Lines } from '../iceberg/ib';
import { Jar, Seg, type Lang } from './dv';
import data from './budget.json';

// Shows:      thirty days of a service with an SLO of 99.9 percent. A jar holds the error budget and drains as failed requests pile up; a line shows the share of the budget used, day by day.
//             One bad deploy on day 12 makes a step in the line. Bells show when each alert rule would have woken somebody.
// Because:    "an alert that pages 25 times for a month with one real incident" against "an alert that pages once, 4 minutes after the incident starts" is about WHEN and HOW OFTEN. A count says it,
//             but bells scattered over the nights of a month and a single bell on the step of the incident make the difference something you can see at once.
// Control:    which rule pages (a threshold on one minute, or a burn rate over two windows); play, scrub and jump.
// Conclusion: an SLO turns "reliable enough" into a budget you can spend; and an alert that follows how fast the budget burns pages for the incident and stays quiet for a lone failed request at night.
//
// The requests are made with a fixed seed (about 5.16 million in 30 days), every number and every bell comes from exercises/09_slo_error_budget.py (budget.json). The traffic is synthetic, not a real service.

type Rule = 'naive' | 'burn';
const DAYS = data.days;
const D = 12;
const X0 = 140, X1 = 850, Y0 = 70, Y1 = 270;
const bells = (rule: Rule): { min: number; night: boolean }[] =>
  (rule === 'naive' ? (data.naivePageMinutes as number[]) : [data.burnAlertMinute]).map((m) => {
    const h = Math.floor((m % 1440) / 60);
    return { min: m, night: !(h >= 8 && h < 22) };
  });
const xOfDay = (d: number) => X0 + (d / DAYS) * (X1 - X0);

const TEXT: Record<Lang, { title: string; caption: string; rule: string; rules: Record<Rule, string>; budget: string; left: string; used: string; pages: string; night: string; bad: string; incident: string; day: string; marks: Mark[]; ruleText: Record<Rule, string> }> = {
  th: {
    title: 'เลือกกฎการเตือน แล้วกดเล่นดูหนึ่งเดือนของบริการที่ตั้ง SLO ไว้ 99.9% ว่ากระดิ่งดังกี่ครั้ง ดังตอนไหน และงบ Error ที่เหลืออยู่ในโหลลดลงอย่างไร',
    caption: 'คำขอทั้งเดือนเป็นข้อมูลสังเคราะห์ที่สร้างด้วย Seed คงที่ (ประมาณ 5.16 ล้านคำขอ) และ Deploy ที่พังวันที่ 12 ทำให้ 20% ของคำขอล้มเหลว 40 นาที ตัวเลขและกระดิ่งทุกอัน มาจากแบบฝึก 09 (budget.json) ไม่ใช่บริการจริง',
    rule: 'กฎการเตือน', rules: { naive: 'Error เกิน 5% ในหนึ่งนาที', burn: 'Burn Rate เกิน 14.4 ทั้ง 1 ชั่วโมงและ 5 นาที' },
    budget: 'งบ Error', left: 'เหลือ', used: 'ใช้ไปแล้ว', pages: 'ครั้งที่เตือน', night: 'ปลุกตอนกลางคืน', bad: 'เหตุการณ์จริง', incident: 'Deploy ที่พัง', day: 'วันที่',
    ruleText: { naive: 'กฎนี้เตือนเมื่อคำขอในหนึ่งนาทีล้มเกิน 5% กลางคืนที่มีคำขอไม่กี่ตัว การล้มตัวเดียวก็เกินแล้ว', burn: 'กฎนี้เตือนเมื่องบกำลังไหม้เร็วเกิน 14.4 เท่าของอัตราปกติ ทั้งในหนึ่งชั่วโมงและห้านาทีล่าสุด' },
    marks: [
      { at: 0, name: 'ต้นเดือน', title: 'ต้นเดือน งบ Error เต็มโหล', text: 'SLO 99.9% แปลว่าจากคำขอทั้งเดือนยอมให้ล้มได้ 0.1% ซึ่งในข้อมูลนี้คือราว 5,161 คำขอ งบนี้คือสิ่งที่ทีมใช้ได้ ไม่ใช่ความผิดพลาดที่ห้ามเกิด' },
      { at: 4.6, name: 'วันที่ 12', title: 'Deploy ที่พังทำให้เส้นกระโดด', text: 'Deploy ตอนบ่ายสองของวันที่ 12 ทำให้ 20% ของคำขอล้ม 40 นาที เส้นการใช้งบกระโดดขึ้น และเหตุการณ์เดียวนี้กินราว 31% ของงบทั้งเดือน' },
      { at: 12, name: 'จบเดือน', title: 'จบเดือน ใช้งบไปราวครึ่งหนึ่ง', text: 'SLI ของเดือนอยู่ที่ 99.95% ยังสูงกว่า SLO และงบเหลือราวครึ่ง กฎที่เตือนถี่เกินไปทำให้คนเลิกเชื่อกระดิ่ง ส่วนกฎที่ดูอัตราการไหม้ของงบเตือนครั้งเดียวและเตือนเร็ว' },
    ],
  },
  en: {
    title: 'Choose an alert rule and press play to watch a month of a service with an SLO of 99.9%: how many times the bell rings, when, and how the error budget left in the jar drains',
    caption: 'The requests of the whole month are synthetic, made with a fixed seed (about 5.16 million requests), and the bad deploy of day 12 makes 20% of the requests fail for 40 minutes. Every number and every bell comes from exercise 09 (budget.json). This is not a real service.',
    rule: 'alert rule', rules: { naive: 'more than 5% errors in one minute', burn: 'burn rate above 14.4 over both 1 hour and 5 minutes' },
    budget: 'error budget', left: 'left', used: 'used', pages: 'pages', night: 'woke someone at night', bad: 'real incident', incident: 'the bad deploy', day: 'day',
    ruleText: { naive: 'This rule pages when more than 5% of the requests of one minute fail. At night, with a handful of requests, a single failure is already over the line.', burn: 'This rule pages when the budget is burning faster than 14.4 times the normal rate, over both the last hour and the last five minutes.' },
    marks: [
      { at: 0, name: 'Start', title: 'At the start of the month the jar holds the whole error budget', text: 'An SLO of 99.9% means 0.1% of the requests of the month may fail, in this data about 5,161 requests. That budget is something the team can spend, not a mistake that must never happen.' },
      { at: 4.6, name: 'Day 12', title: 'The bad deploy makes the line jump', text: 'A deploy at 14:00 on day 12 makes 20% of the requests fail for 40 minutes. The line of budget used jumps, and this one incident eats about 31% of the whole month\'s budget.' },
      { at: 12, name: 'End of month', title: 'End of the month: about half of the budget is used', text: 'The SLI of the month is 99.95%, still above the SLO, and about half of the budget is left. A rule that pages too often makes people stop trusting the bell, while the rule on how fast the budget burns pages once and early.' },
    ],
  },
};

export default function BudgetLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [rule, setRule] = useState<Rule>('naive');
  const clock = useClock(D);
  const day = prog(clock.t, 0, D) * DAYS;
  const di = Math.min(DAYS - 1, Math.floor(day));
  const cum = data.cumulativeBudgetUsed as number[];
  const usedNow = di === 0 ? cum[0] * (day - di) : cum[di - 1] + (cum[di] - cum[di - 1]) * (day - di);
  const bs = bells(rule).filter((b) => b.min / 1440 <= day);
  const nights = bs.filter((b) => b.night).length;
  const visible = Math.floor(day);
  const partial = cum.slice(0, visible).map((v, i) => `${i === 0 ? 'M' : 'L'}${xOfDay(i + 1)},${Y1 - v * (Y1 - Y0)}`).join(' ');
  let cur = 0;
  T.marks.forEach((m, i) => { if (clock.t >= m.at - 0.001) cur = i; });
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.rule} options={(['naive', 'burn'] as Rule[]).map((r) => ({ id: r, text: T.rules[r] }))} value={rule} onChange={(r) => { setRule(r); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 504" role="img" aria-label={T.title}>
          <text x={20} y={28} className="ib-t">{T.budget}</text>
          <Jar x={20} y={44} w={86} h={226} left={1 - usedNow} label={`${Math.round((1 - usedNow) * 100)}%`} bad={usedNow > 0.4} />
          <text x={63} y={292} textAnchor="middle" className="ib-s">{T.left}</text>
          {/* chart */}
          <path className="ib-line" d={`M${X0},${Y0} V${Y1} H${X1}`} />
          {[0, 10, 20, 30].map((d) => (
            <g key={d}>
              <path className="ib-line" d={`M${xOfDay(d)},${Y1} v6`} />
              <text x={xOfDay(d)} y={Y1 + 22} textAnchor="middle" className="ib-s">{T.day} {d}</text>
            </g>
          ))}
          <rect x={xOfDay(11) + 4} y={Y0} width={xOfDay(12) - xOfDay(11) + 6} height={Y1 - Y0} style={{ fill: 'color-mix(in srgb, var(--ib-bad) 14%, transparent)' }} />
          <text x={xOfDay(11.5)} y={Y0 - 8} textAnchor="middle" className="ib-s" style={{ fill: 'var(--ib-bad)' }}>{T.incident}</text>
          <path d={partial} style={{ stroke: 'var(--accent)', strokeWidth: 4, fill: 'none', strokeLinejoin: 'round' }} />
          <text x={X0 + 10} y={Y0 + 16} className="ib-s">{T.used} {Math.round(usedNow * 100)}%</text>
          {/* bells */}
          {bs.map((b, i) => {
            const x = xOfDay(b.min / 1440 + 0) + 0;
            const real = rule === 'burn';
            return (
              <g key={i}>
                <path d={`M${x},${Y1 + 54} v-18`} style={{ stroke: b.night ? 'var(--ib-bad)' : 'var(--accent)', strokeWidth: 3 }} />
                <circle cx={x} cy={Y1 + 56} r={real ? 8 : 5} style={{ fill: b.night ? 'var(--ib-bad)' : 'var(--accent)' }} />
              </g>
            );
          })}
          <text x={X0} y={Y1 + 90} className="ib-n">{T.pages}: {bs.length}{rule === 'naive' ? ` (${T.night} ${nights})` : ` (${T.bad})`}</text>
          <Banner y={384} text={T.marks[cur].title} />
          <Lines x={20} y={456} text={T.ruleText[rule]} max={110} lh={20} className="ib-s" />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
