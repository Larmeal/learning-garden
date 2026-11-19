import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import data from './dosData.json';

// Shows:      the text sent to a regular expression, as n tiles of the letter a and a last tile b, and below it every way the nested pattern (a+)+$ can cut those n letters into groups (each small
//             strip is one way to cut, and the groups are coloured alternately). The pattern fails on the final b, so the engine goes back and tries the next cut, and the next. Add one letter
//             and the number of strips doubles. Under the strips, the number of steps and the time at 10 million steps a second, next to a pattern that walks the text once.
// Because:    "exponential" is only a word until you slide one letter and watch the pile of strips double, and see that a few dozen letters make a wall that no computer can climb.
// Control:    the length n (1 to 40) and the length limit (off, 24). Both change the tiles, the strips, the numbers and the verdict.
// Conclusion: a few dozen letters make one request cost minutes of one core, and a cap on the length of the input removes the problem before the pattern ever runs.
//
// Up to n = 20 the step counts are those of exercises/12_dos_rate_limit.py (dosData.json): a small backtracking matcher whose calls are counted, and the exercise also timed the real re module
// (4 more letters took 16 times as long). From 21 to 40 the lab only continues the doubling (2^n calls). The strips are a drawing of the 2^(n-1) ways to cut n letters into groups, which is where
// the doubling comes from; only the first 64 are drawn, and only the first 8 letters of each. The speed of 10 million steps a second is an example, not a measurement.

const NESTED = data.nested as Record<string, number>;
const STEPS_PER_SEC = 10_000_000;
const LIMIT = 24;

const TEXT: Record<Lang, {
  title: string; n: string; limit: string; off: string; on: string; legend: { color: string; text: string; ring?: boolean }[]; nested: string; linear: string; steps: string; time: string; measured: string; extrap: string;
  refused: string; verdictBad: string; verdictOk: string; caption: string; text: string; ways: (w: string, shown: number) => string; once: string; gate: string; moreLetters: string;
}> = {
  th: {
    title: 'เลื่อนความยาวของข้อความที่ส่งเข้า Regex แล้วดูว่า Pattern ที่ซ้อนวงเล็บต้องลองแบ่งตัวอักษรเป็นกลุ่มกี่วิธี ทุกตัวอักษรที่เพิ่มทำให้จำนวนวิธีเป็นสองเท่า ขณะที่ Pattern ธรรมดาเดินครั้งเดียว',
    n: 'จำนวนตัวอักษร a', limit: 'จำกัดความยาวก่อนเข้า Regex', off: 'ไม่จำกัด', on: `จำกัด ${LIMIT} ตัว`, legend: [{ color: 'var(--accent)', text: 'กลุ่มที่ (a+) แบ่งออกมา' }, { color: 'var(--ib-bad)', text: 'ตัว b ที่ทำให้ทุกวิธีล้มเหลว' }],
    nested: '(a+)+$', linear: 'a+$', steps: 'ขั้น', time: 'ถ้าทำได้ 10 ล้านขั้นต่อวินาที', measured: 'นับจริงในแบบฝึก', extrap: 'ต่อจากการเพิ่มเป็นสองเท่า ไม่ได้รัน',
    refused: 'ปฏิเสธก่อนเข้า Regex เพราะยาวเกินกำหนด งานที่ใช้คือศูนย์', verdictBad: 'คำขอเดียวกินเวลาของ CPU หนึ่ง Core นานมาก', verdictOk: 'ใช้เวลาน้อยจนไม่รู้สึก',
    text: 'ข้อความที่ส่งเข้ามา', ways: (w, shown) => `วิธีที่ (a+)+$ ลองแบ่ง ${w} วิธี (ในภาพวาด ${shown} วิธีแรก) และทุกวิธีล้มที่ตัว b`, once: 'a+$ เดินตามข้อความครั้งเดียว', gate: 'ด่านจำกัดความยาว', moreLetters: 'ตัวแรกถึงตัวที่ 8 ของแต่ละวิธี',
    caption: 'จำนวนครั้งที่ทำงานตั้งแต่ n = 1 ถึง 20 มาจากแบบฝึก 12 และแบบฝึกจับเวลาบน re จริงด้วย (เพิ่ม 4 ตัวอักษร ช้าลง 16 เท่า) ส่วน n ที่เกิน 20 ต่อจากการเพิ่มเท่าตัว (2 ยกกำลัง n) แถบเล็ก ๆ คือภาพวาดของวิธีแบ่ง 2 ยกกำลัง (n − 1) วิธี ซึ่งเป็นที่มาของการเพิ่มเท่าตัว ความเร็วของ CPU เป็นตัวอย่าง',
  },
  en: {
    title: 'Slide the length of the text sent to a regex and see how many ways the nested pattern tries to cut the letters into groups. Every added letter doubles the number of ways, while a plain pattern walks the text once',
    n: 'number of letters a', limit: 'length limit before the regex', off: 'no limit', on: `limit of ${LIMIT}`, legend: [{ color: 'var(--accent)', text: 'a group that (a+) cuts out' }, { color: 'var(--ib-bad)', text: 'the b that makes every way fail' }],
    nested: '(a+)+$', linear: 'a+$', steps: 'steps', time: 'at 10 million steps a second', measured: 'counted in the exercise', extrap: 'continued from the doubling, not run',
    refused: 'Refused before the regex, because the input is too long. The work done is zero', verdictBad: 'One request costs one CPU core a very long time', verdictOk: 'Takes so little time that nobody notices',
    text: 'the text that arrives', ways: (w, shown) => `(a+)+$ tries ${w} ways to cut (the picture draws the first ${shown}), and every one fails at the b`, once: 'a+$ walks along the text once', gate: 'the length gate', moreLetters: 'the first 8 letters of each way',
    caption: 'The step counts from n = 1 to 20 come from exercise 12, which also timed the real re module (4 more letters took 16 times as long). Beyond 20 the number continues the doubling (2 to the power n). The small strips are a drawing of the 2 to the power (n − 1) ways to cut the letters, which is where the doubling comes from. The CPU speed is an example.',
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
  const secs = nested / STEPS_PER_SEC;
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';
  const waysTotal = 2 ** (n - 1);
  const shown = refused ? 0 : Math.min(64, waysTotal);
  const tw = Math.min(24, Math.floor(800 / (n + 1)));
  const m = Math.min(n, 8);
  const strip = (w: number) => {
    // group index of each letter: a new group starts after every gap whose bit is set
    const out: number[] = [];
    let g = 0;
    for (let j = 0; j < m; j++) { out.push(g); if (j < m - 1 && (w >> j) & 1) g++; }
    return out;
  };
  const fmtBig = (x: number) => (x < 1e6 ? x.toLocaleString('en-US') : `${(x / 10 ** Math.floor(Math.log10(x))).toFixed(1)} × 10^${Math.floor(Math.log10(x))}`);
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
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
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={40} y={24} className="ib-s" style={{ fontSize: 14 }}>{T.text}</text>
          {Array.from({ length: n }, (_, k) => (
            <g key={k}>
              <rect x={40 + k * (tw + 2)} y={34} width={tw} height={30} rx={4} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.2} />
              {tw >= 14 ? <text x={40 + k * (tw + 2) + tw / 2} y={55} textAnchor="middle" className="ib-m" style={{ fontSize: 15 }}>a</text> : null}
            </g>
          ))}
          <rect x={40 + n * (tw + 2)} y={34} width={tw} height={30} rx={4} fill={bad} />
          <text x={40 + n * (tw + 2) + tw / 2} y={55} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: '#fff' }}>b</text>
          {refused ? (
            <g>
              <rect x={40} y={86} width={800} height={246} rx={12} fill="color-mix(in srgb, var(--ib-bad) 8%, var(--surface))" stroke={bad} strokeWidth={3} strokeDasharray="9 6" />
              <text x={440} y={196} textAnchor="middle" style={{ fontSize: 44 }}>🚫</text>
              <text x={440} y={240} textAnchor="middle" className="ib-n" style={{ fontSize: 17, fontWeight: 700, fill: bad }}>{T.gate}</text>
            </g>
          ) : (
            <g>
              <text x={40} y={92} className="ib-n" style={{ fontSize: 14.5, fontWeight: 700 }}>{T.ways(fmtBig(waysTotal), shown)}</text>
              <text x={40} y={112} className="ib-s" style={{ fontSize: 13 }}>{n > 8 ? T.moreLetters : ''}</text>
              {Array.from({ length: shown }, (_, w) => {
                const col = w % 8, row = Math.floor(w / 8);
                const x0 = 40 + col * 102, y0 = 122 + row * 26;
                const grp = strip(w);
                const cw = 88 / m;
                return (
                  <g key={w}>
                    {grp.map((g, j) => (
                      <rect key={j} x={x0 + j * cw} y={y0} width={cw - (grp[j + 1] === g ? 0 : 1.5)} height={16} fill={g % 2 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 38%, var(--surface))'} />
                    ))}
                    <rect x={x0 + 90} y={y0} width={8} height={16} rx={2} fill={bad} />
                  </g>
                );
              })}
            </g>
          )}
          {/* the numbers */}
          <rect x={14} y={346} width={852} height={110} rx={12} fill="var(--surface)" stroke={refused ? bad : secs > 1 ? bad : 'var(--line-strong)'} strokeWidth={3} />
          {refused ? (
            <text x={30} y={408} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.refused}</text>
          ) : (
            <g>
              <text x={30} y={376} className="ib-n" style={{ fontSize: 16 }}><tspan style={{ fontWeight: 700 }}>{T.nested}</tspan>{`   ${nested.toLocaleString('en-US')} ${T.steps}  (${n <= 20 ? T.measured : T.extrap})`}</text>
              <text x={30} y={402} className="ib-n" style={{ fontSize: 16 }}><tspan style={{ fontWeight: 700 }}>{T.linear}</tspan>{`   ${linear.toLocaleString('en-US')} ${T.steps}  ·  ${T.once}`}</text>
              <text x={30} y={436} className="ib-n" style={{ fontWeight: 700, fontSize: 17, fill: secs > 1 ? bad : acc }}>{`${T.time}: ${fmtTime(secs, lang)}  ·  ${secs > 1 ? T.verdictBad : T.verdictOk}`}</text>
            </g>
          )}
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
