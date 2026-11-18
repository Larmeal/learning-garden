import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import data from './dosData.json';

// Shows:      the work a regular expression (a+)+$ does on a string of n letters a and a final b, against a pattern that walks the string once, on a log scale. Move the length n:
//             the exponential pattern doubles with every letter and leaves the chart, the linear one barely moves. A switch for a length limit shows the request being refused before the pattern runs.
// Because:    "exponential" is only a word until you slide one letter and see the number double, and see 2^30 pass a billion.
// Control:    the length n (1 to 40) and the length limit (off, 24). Both change the numbers, the marker on the chart and the verdict.
// Conclusion: a few dozen letters make one request cost minutes of one core, and a cap on the length of the input removes the problem before the pattern ever runs.
//
// Up to n = 20 the step counts are those of exercises/12_dos_rate_limit.py (dosData.json): a small backtracking matcher whose calls are counted, and the exercise also timed the real re
// module (4 more letters took 16 times as long). From 21 to 40 the lab only continues the doubling (2^n calls) and draws it dashed. The speed of 10 million steps a second is an
// example, not a measurement.

const NESTED = data.nested as Record<string, number>;
const STEPS_PER_SEC = 10_000_000;
const LIMIT = 24;

const TEXT: Record<Lang, {
  title: string; n: string; limit: string; off: string; on: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; nested: string; linear: string; steps: string; time: string; measured: string; extrap: string;
  refused: string; verdictBad: string; verdictOk: string; axis: string; caption: string;
}> = {
  th: {
    title: 'เลื่อนความยาวของข้อความที่ส่งเข้า Regex แล้วดูว่า Pattern ที่ซ้อนวงเล็บใช้งานเพิ่มเป็นสองเท่าทุกตัวอักษร ขณะที่ Pattern ธรรมดาแทบไม่ขยับ (แกนเป็น Log)',
    n: 'จำนวนตัวอักษร a', limit: 'จำกัดความยาวก่อนเข้า Regex', off: 'ไม่จำกัด', on: `จำกัด ${LIMIT} ตัว`, legend: [{ kind: 'new', text: '(a+)+$ ซ้อนวงเล็บ' }, { kind: 'use', text: 'a+$ เดินครั้งเดียว' }],
    nested: '(a+)+$', linear: 'a+$', steps: 'จำนวนครั้งที่ทำงาน', time: 'ถ้าทำได้ 10 ล้านครั้งต่อวินาที', measured: 'นับจริงในแบบฝึก', extrap: 'ต่อจากการเพิ่มเป็นสองเท่า ไม่ได้รัน',
    refused: 'ปฏิเสธก่อนเข้า Regex เพราะยาวเกินกำหนด งานที่ใช้คือศูนย์', verdictBad: 'คำขอเดียวกินเวลาของ CPU หนึ่ง Core นานมาก', verdictOk: 'ใช้เวลาน้อยจนไม่รู้สึก', axis: 'จำนวนครั้ง (Log)',
    caption: 'จำนวนครั้งที่ทำงานตั้งแต่ n = 1 ถึง 20 มาจากแบบฝึก 12 และแบบฝึกจับเวลาบน re จริงด้วย (เพิ่ม 4 ตัวอักษร ช้าลง 16 เท่า) ส่วน n ที่เกิน 20 ต่อเส้นจากการเพิ่มเท่าตัว (2 ยกกำลัง n) ความเร็วของ CPU เป็นตัวอย่าง',
  },
  en: {
    title: 'Slide the length of the text sent to a regex and see the nested pattern double its work with every letter, while a plain pattern hardly moves (log scale)',
    n: 'number of letters a', limit: 'length limit before the regex', off: 'no limit', on: `limit of ${LIMIT}`, legend: [{ kind: 'new', text: '(a+)+$ nested' }, { kind: 'use', text: 'a+$ walks once' }],
    nested: '(a+)+$', linear: 'a+$', steps: 'steps of work', time: 'at 10 million steps a second', measured: 'counted in the exercise', extrap: 'continued from the doubling, not run',
    refused: 'Refused before the regex, because the input is too long. The work done is zero', verdictBad: 'One request costs one CPU core a very long time', verdictOk: 'Takes so little time that nobody notices', axis: 'steps (log)',
    caption: 'The step counts from n = 1 to 20 come from exercise 12, which also timed the real re module (4 more letters took 16 times as long). Beyond 20 the line continues the doubling (2 to the power n). The CPU speed is an example.',
  },
};

const fmtTime = (s: number, lang: Lang) => {
  const th = lang === 'th';
  if (s < 0.001) return th ? 'น้อยกว่า 1 มิลลิวินาที' : 'under a millisecond';
  if (s < 1) return `${(s * 1000).toFixed(0)} ${th ? 'มิลลิวินาที' : 'ms'}`;
  const u: [number, string, string][] = [[31557600, 'ปี', 'years'], [86400, 'วัน', 'days'], [3600, 'ชั่วโมง', 'hours'], [60, 'นาที', 'minutes'], [1, 'วินาที', 'seconds']];
  for (const [d, a, b] of u) if (s >= d) return `${(s / d).toFixed(s / d >= 100 ? 0 : 1)} ${th ? a : b}`;
  return '';
};

export default function ReDosLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [n, setN] = useState(28);
  const [limited, setLimited] = useState(false);
  const refused = limited && n > LIMIT;
  const calls = (k: number) => (k <= 20 ? NESTED[String(k)] : 2 ** k);
  const nested = refused ? 0 : calls(n);
  const linear = refused ? 0 : n + 1;
  const X = (k: number) => 50 + ((k - 1) / 39) * 780;
  const Y = (v: number) => 250 - (Math.log10(Math.max(v, 1)) / 13) * 220;
  const path = (f: (k: number) => number, a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i).map((k, i) => `${i ? 'L' : 'M'}${X(k)},${Y(f(k))}`).join(' ');
  const secs = nested / STEPS_PER_SEC;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <label className="ib-lbl">{`${T.n} = ${n}`}{' '}
          <input type="range" min={1} max={40} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label={T.n} style={{ width: 260 }} />
        </label>
        <span className="ib-lbl">{T.limit}</span>
        <span className="seg" role="group" aria-label={T.limit}>
          <button type="button" aria-pressed={!limited} onClick={() => setLimited(false)}>{T.off}</button>
          <button type="button" aria-pressed={limited} onClick={() => setLimited(true)}>{T.on}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          {[0, 3, 6, 9, 12].map((e) => (
            <g key={e}>
              <line x1={50} y1={Y(10 ** e)} x2={830} y2={Y(10 ** e)} className="ib-line" style={{ strokeWidth: 1, opacity: 0.45 }} />
              <text x={44} y={Y(10 ** e) + 5} textAnchor="end" className="ib-s">{e === 0 ? '1' : `10^${e}`}</text>
            </g>
          ))}
          <text x={50} y={20} className="ib-s">{T.axis}</text>
          <path d={path(calls, 1, 20)} fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 4 }} />
          <path d={path(calls, 20, 40)} fill="none" style={{ stroke: 'var(--accent)', strokeWidth: 4, strokeDasharray: '7 6' }} />
          <path d={path((k) => k + 1, 1, 40)} fill="none" style={{ stroke: 'var(--fg)', strokeWidth: 3 }} />
          <line x1={X(n)} y1={30} x2={X(n)} y2={250} style={{ stroke: refused ? 'var(--ib-bad)' : 'var(--fg)', strokeWidth: 2, strokeDasharray: '4 4' }} />
          <text x={X(1)} y={274} className="ib-s">1</text>
          <text x={X(20)} y={274} textAnchor="middle" className="ib-s">20</text>
          <text x={X(40)} y={274} textAnchor="end" className="ib-s">40</text>
          <rect className={refused ? 'ib-use' : 'ib-new'} x={14} y={290} width={852} height={100} rx={12} style={refused ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
          {refused ? (
            <text x={30} y={344} className="ib-n" style={{ fontWeight: 700 }}>{T.refused}</text>
          ) : (
            <g>
              <text x={30} y={318} className="ib-n"><tspan style={{ fontWeight: 700 }}>{T.nested}</tspan>{`  ${nested.toLocaleString('en-US')} ${T.steps}  (${n <= 20 ? T.measured : T.extrap})`}</text>
              <text x={30} y={344} className="ib-n"><tspan style={{ fontWeight: 700 }}>{T.linear}</tspan>{`  ${linear.toLocaleString('en-US')} ${T.steps}`}</text>
              <text x={30} y={374} className={secs > 1 ? 'ib-bad ib-n' : 'ib-ok ib-n'} style={{ fontWeight: 700 }}>{`${T.time}: ${fmtTime(secs, lang)}  ·  ${secs > 1 ? T.verdictBad : T.verdictOk}`}</text>
            </g>
          )}
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
