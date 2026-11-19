import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import data from './passwordData.json';

// Shows:      the whole space of passwords of one kind as a long bar (the left end is the first guess, the right end is the last), and for three ways of storing the password, how much of that bar
//             an attacker with some number of cores has walked after one hour, one day or one year. A mark in the middle is where the password is found on average.
// Because:    the gap between a fast hash and a slow one is six orders of magnitude, and "how much of the haystack is covered" is something you can see: with plain SHA-256 the bar is full within
//             a second, with a slow hash the same attacker has covered a sliver after a year.
// Control:    the kind of password (four, from 19.9 to 47.6 bits), how many cores the attacker has (1, 1,000, 1,000,000) and how long he works (an hour, a day, a year). All three change every bar.
// Conclusion: the storage method is worth more than the password. A slow hash multiplies the cost by about a million, and every extra bit of the password doubles it.
//
// Speeds are guesses per second on one core of the computer that ran exercises/04_passwords.py --write (passwordData.json). Another computer will give other speeds. The bits are log2 of the
// number of possible passwords. The number of cores (1, 1,000, 1,000,000) and the time the attacker works are examples, not measurements.

const SPEED = data.speeds as Record<string, number>;
const BITS = data.bits as Record<string, number>;
const METHODS = ['sha256', 'pbkdf2-600k', 'scrypt'] as const;
const PW = ['6 digits', '8 lower case letters', '8 mixed letters and digits', '4 random words (2048 word list)'] as const;
const CORES = [1, 1000, 1_000_000];
const TIMES = [3600, 86400, 3.156e7];

const fmt = (s: number, lang: Lang) => {
  const th = lang === 'th';
  if (s < 1) return th ? 'น้อยกว่า 1 วินาที' : 'under a second';
  const units: [number, string, string][] = [[3.156e9, 'ศตวรรษ', 'centuries'], [3.156e7, 'ปี', 'years'], [86400, 'วัน', 'days'], [3600, 'ชั่วโมง', 'hours'], [60, 'นาที', 'minutes'], [1, 'วินาที', 'seconds']];
  for (const [d, t, e] of units) if (s >= d) {
    const v = s / d;
    return `${v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)} ${th ? t : e}`;
  }
  return '';
};
const sci = (n: number) => {
  if (n < 1e6) return Math.round(n).toLocaleString('en-US');
  const e = Math.floor(Math.log10(n));
  return `${(n / 10 ** e).toFixed(1)} × 10^${e}`;
};
const pctText = (f: number) => {
  const p = f * 100;
  if (p >= 99.995) return '100%';
  if (p >= 1) return `${p.toFixed(1)}%`;
  if (p >= 0.0001) return `${Number(p.toPrecision(2))}%`;
  return '< 0.0001%';
};

const TEXT: Record<Lang, {
  title: string; pw: string; cores: string; time: string; times: string[]; names: Record<string, string>; pws: Record<string, string>; coresN: (n: number) => string; method: Record<string, string>;
  legend: { color: string; text: string; ring?: boolean }[]; speed: string; unit: string; space: string; first: string; last: string; half: string; tried: (n: string, p: string) => string; avg: string; caption: string;
  done: string; sliver: string;
}> = {
  th: {
    title: 'เลือกชนิดของ Password จำนวน Core ที่ผู้โจมตีมี และเวลาที่เขาทำงาน แล้วดูว่าเขาเดินผ่านพื้นที่ของ Password ที่เป็นไปได้ไปแล้วเท่าไร ในสามวิธีเก็บ',
    pw: 'Password', cores: 'จำนวน Core', time: 'ผู้โจมตีทำงานนาน', times: ['1 ชั่วโมง', '1 วัน', '1 ปี'], coresN: (n) => (n === 1 ? '1 Core' : n === 1000 ? '1,000 Core' : '1,000,000 Core'),
    names: { sha256: 'SHA-256 ธรรมดา', 'pbkdf2-600k': 'PBKDF2 600,000 รอบ', scrypt: 'scrypt (N=32768)' },
    method: { sha256: 'เร็วมาก', 'pbkdf2-600k': 'ช้าโดยตั้งใจ', scrypt: 'ช้าและกิน Memory' },
    pws: { '6 digits': 'เลข 6 หลัก', '8 lower case letters': 'ตัวพิมพ์เล็ก 8 ตัว', '8 mixed letters and digits': 'ตัวอักษรกับตัวเลข 8 ตัว', '4 random words (2048 word list)': 'คำสุ่ม 4 คำ' },
    legend: [{ color: 'var(--ib-bad)', text: 'ส่วนที่ผู้โจมตีลองไปแล้ว' }, { color: 'var(--accent-soft)', text: 'ส่วนที่ยังไม่ได้ลอง', ring: true }],
    speed: 'ลองได้', unit: 'ครั้งต่อวินาทีต่อ Core', space: 'Password ที่เป็นไปได้ทั้งหมด', first: 'เดาตัวแรก', last: 'เดาตัวสุดท้าย', half: 'เจอโดยเฉลี่ยตรงนี้',
    tried: (n, p) => `ลองไปแล้ว ${n} ครั้ง คิดเป็น ${p} ของทั้งหมด`, avg: 'เจอโดยเฉลี่ยใน', done: 'ลองครบทุกตัวแล้ว', sliver: 'แถบแดงบางเกินกว่าจะเห็น',
    caption: 'ความเร็วต่อ Core วัดในแบบฝึก 04 บนคอมพิวเตอร์ที่รัน (เครื่องอื่นจะได้ตัวเลขอื่น) จำนวนบิตของ Password คำนวณจากขนาดของตัวอักษรที่เลือกได้ ส่วนจำนวน Core และเวลาที่ผู้โจมตีทำงานเป็นตัวอย่างของผู้เขียน ไม่ได้วัด',
  },
  en: {
    title: 'Pick the kind of password, how many cores the attacker has and how long he works, and see how much of the space of possible passwords he has walked, for the three ways of storing it',
    pw: 'Password', cores: 'Cores', time: 'the attacker works for', times: ['1 hour', '1 day', '1 year'], coresN: (n) => (n === 1 ? '1 core' : n === 1000 ? '1,000 cores' : '1,000,000 cores'),
    names: { sha256: 'plain SHA-256', 'pbkdf2-600k': 'PBKDF2, 600,000 rounds', scrypt: 'scrypt (N=32768)' },
    method: { sha256: 'very fast', 'pbkdf2-600k': 'slow on purpose', scrypt: 'slow and memory hungry' },
    pws: { '6 digits': '6 digits', '8 lower case letters': '8 lower case letters', '8 mixed letters and digits': '8 letters and digits', '4 random words (2048 word list)': '4 random words' },
    legend: [{ color: 'var(--ib-bad)', text: 'the part the attacker has tried' }, { color: 'var(--accent-soft)', text: 'the part he has not tried', ring: true }],
    speed: 'tries', unit: 'guesses per second per core', space: 'every possible password', first: 'first guess', last: 'last guess', half: 'found here on average',
    tried: (n, p) => `${n} guesses so far, which is ${p} of everything`, avg: 'found on average in', done: 'every password has been tried', sliver: 'the red part is too thin to see',
    caption: "The speed per core was measured in exercise 04 on the computer that ran it (another computer gives other numbers). The bits of a password come from the size of the alphabet it was drawn from. The attacker's cores and working time are the author's examples, not measurements.",
  },
};

const LX = 40, LW = 800;

export default function PasswordCrackLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [pw, setPw] = useState<(typeof PW)[number]>('8 mixed letters and digits');
  const [cores, setCores] = useState(1);
  const [ti, setTi] = useState(1);
  const bits = BITS[pw];
  const space = 2 ** bits;
  const bad = 'var(--ib-bad)';
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.pw}</span>
        <span className="seg" role="group" aria-label={T.pw} style={{ flexWrap: 'wrap' }}>
          {PW.map((p) => <button key={p} type="button" aria-pressed={pw === p} onClick={() => setPw(p)}>{T.pws[p]}</button>)}
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.cores}</span>
        <span className="seg" role="group" aria-label={T.cores}>
          {CORES.map((c) => <button key={c} type="button" aria-pressed={cores === c} onClick={() => setCores(c)}>{T.coresN(c)}</button>)}
        </span>
        <span className="ib-lbl">{T.time}</span>
        <span className="seg" role="group" aria-label={T.time}>
          {TIMES.map((_, i) => <button key={i} type="button" aria-pressed={ti === i} onClick={() => setTi(i)}>{T.times[i]}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={LX} y={28} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{`${T.pws[pw]}: 2^${bits} = ${sci(space)}`}</text>
          <text x={LX} y={50} className="ib-s" style={{ fontSize: 14 }}>{`${T.space}  ·  ${T.coresN(cores)}  ·  ${T.times[ti]}`}</text>
          {METHODS.map((m, i) => {
            const speed = SPEED[m];
            const guesses = speed * cores * TIMES[ti];
            const f = Math.min(1, guesses / space);
            const secs = space / 2 / (speed * cores);
            const y = 82 + i * 126;
            const w = f > 0 ? Math.max(5, f * LW) : 0;
            const thin = f > 0 && f * LW < 5;
            return (
              <g key={m}>
                <text x={LX} y={y} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{`${T.names[m]}  ·  ${T.method[m]}`}</text>
                <text x={LX + LW} y={y} textAnchor="end" className="ib-s" style={{ fontSize: 13.5 }}>{`${T.speed} ${SPEED[m].toLocaleString('en-US', { maximumFractionDigits: 1 })} ${T.unit}`}</text>
                <rect x={LX} y={y + 12} width={LW} height={36} rx={8} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={2} />
                {w > 0 ? <rect x={LX} y={y + 12} width={w} height={36} rx={f >= 1 ? 8 : 5} fill={bad} /> : null}
                <line x1={LX + LW / 2} y1={y + 6} x2={LX + LW / 2} y2={y + 54} stroke="var(--fg)" strokeWidth={2.5} strokeDasharray="4 4" />
                <text x={LX + LW / 2} y={y + 70} textAnchor="middle" className="ib-s" style={{ fontSize: 13 }}>{`▲ ${T.half}`}</text>
                <text x={LX} y={y + 70} className="ib-s" style={{ fontSize: 13 }}>{T.first}</text>
                <text x={LX + LW} y={y + 70} textAnchor="end" className="ib-s" style={{ fontSize: 13 }}>{T.last}</text>
                <text x={LX} y={y + 94} className="ib-n" style={{ fontSize: 15, fontWeight: 700, fill: f >= 0.5 ? bad : 'var(--fg)' }}>{f >= 1 ? `${T.tried(sci(space), '100%')}  ·  ${T.done}` : T.tried(sci(guesses), pctText(f))}{thin ? `  (${T.sliver})` : ''}</text>
                <text x={LX + LW} y={y + 94} textAnchor="end" className="ib-n" style={{ fontSize: 15 }}>{`${T.avg} ${fmt(secs, lang)}`}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
