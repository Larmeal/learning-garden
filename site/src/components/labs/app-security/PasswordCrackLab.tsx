import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import data from './passwordData.json';

// Shows:      how long it takes to try, on average, half of every password the attacker could have to try, for three ways of storing it, side by side.
//             The bars are on a log scale (each tick is a factor of ten), with marks at one hour, one year and one thousand years.
// Because:    the gap between a fast hash and a slow one is six orders of magnitude, which only a log scale and a time next to each bar make visible.
// Control:    the kind of password (four, from 19.9 to 47.6 bits) and how many cores the attacker has (1, 1,000, 1,000,000). Both change every bar.
// Conclusion: the storage method is worth more than the password. A slow hash multiplies the cost by about a million, and every extra bit doubles it.
//
// Speeds are guesses per second on one core of the computer that ran exercises/04_passwords.py --write (passwordData.json). Another computer will give
// other speeds. The bits are log2 of the number of possible passwords. The cores factor (1, 1,000, 1,000,000) is an example, not a measurement.

const SPEED = data.speeds as Record<string, number>;
const BITS = data.bits as Record<string, number>;
const METHODS = ['sha256', 'pbkdf2-600k', 'scrypt'] as const;
const PW = ['6 digits', '8 lower case letters', '8 mixed letters and digits', '4 random words (2048 word list)'] as const;
const CORES = [1, 1000, 1_000_000];
const MARKS = [3600, 3.156e7, 3.156e10]; // 1 hour, 1 year, 1,000 years

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

const TEXT: Record<Lang, {
  title: string; pw: string; cores: string; names: Record<string, string>; pws: Record<string, string>; coresN: (n: number) => string; marks: string[]; method: Record<string, string>;
  legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; avg: string; speed: string; caption: string; unit: string;
}> = {
  th: {
    title: 'เลือกชนิดของ Password และจำนวน Core ที่ผู้โจมตีมี แล้วเทียบว่าสามวิธีเก็บใช้เวลาถอดต่างกันเท่าไร (แกนเป็น Log)',
    pw: 'Password', cores: 'จำนวน Core', coresN: (n) => (n === 1 ? '1 Core' : n === 1000 ? '1,000 Core' : '1,000,000 Core'),
    names: { sha256: 'SHA-256 ธรรมดา', 'pbkdf2-600k': 'PBKDF2 600,000 รอบ', scrypt: 'scrypt (N=32768)' },
    method: { sha256: 'เร็วมาก', 'pbkdf2-600k': 'ช้าโดยตั้งใจ', scrypt: 'ช้าและกิน Memory' },
    pws: { '6 digits': 'เลข 6 หลัก', '8 lower case letters': 'ตัวพิมพ์เล็ก 8 ตัว', '8 mixed letters and digits': 'ตัวอักษรกับตัวเลข 8 ตัว', '4 random words (2048 word list)': 'คำสุ่ม 4 คำ' },
    marks: ['1 ชั่วโมง', '1 ปี', '1,000 ปี'], legend: [{ kind: 'new', text: 'เวลาเฉลี่ยในการเดา' }, { kind: 'use', text: 'เส้นอ้างอิง' }],
    avg: 'เวลาเฉลี่ย (ลองครึ่งหนึ่งของทั้งหมด)', speed: 'ความเร็วที่วัดได้ต่อ Core', unit: 'ครั้งต่อวินาที',
    caption: 'ความเร็วต่อ Core วัดในแบบฝึก 04 บนคอมพิวเตอร์ที่รัน (เครื่องอื่นจะได้ตัวเลขอื่น) จำนวนบิตของ Password คำนวณจากขนาดของตัวอักษรที่เลือกได้ ส่วนจำนวน Core ของผู้โจมตีเป็นตัวอย่างของผู้เขียน ไม่ได้วัด',
  },
  en: {
    title: 'Pick the kind of password and how many cores the attacker has, and compare how long the three ways of storing it take to crack (log scale)',
    pw: 'Password', cores: 'Cores', coresN: (n) => (n === 1 ? '1 core' : n === 1000 ? '1,000 cores' : '1,000,000 cores'),
    names: { sha256: 'plain SHA-256', 'pbkdf2-600k': 'PBKDF2, 600,000 rounds', scrypt: 'scrypt (N=32768)' },
    method: { sha256: 'very fast', 'pbkdf2-600k': 'slow on purpose', scrypt: 'slow and memory hungry' },
    pws: { '6 digits': '6 digits', '8 lower case letters': '8 lower case letters', '8 mixed letters and digits': '8 letters and digits', '4 random words (2048 word list)': '4 random words' },
    marks: ['1 hour', '1 year', '1,000 years'], legend: [{ kind: 'new', text: 'average time to guess' }, { kind: 'use', text: 'reference line' }],
    avg: 'average time (try half of all possibilities)', speed: 'measured speed per core', unit: 'guesses per second',
    caption: 'The speed per core was measured in exercise 04 on the computer that ran it (another computer gives other numbers). The bits of a password come from the size of the alphabet it was drawn from. The attacker\'s number of cores is the author\'s example, not a measurement.',
  },
};

const LX = 40, LW = 800;
const LMIN = -1, LMAX = 14; // log10 seconds from 0.1 s to 1e14 s
const X = (s: number) => LX + ((Math.log10(Math.max(s, 0.1)) - LMIN) / (LMAX - LMIN)) * LW;

export default function PasswordCrackLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [pw, setPw] = useState<(typeof PW)[number]>('8 mixed letters and digits');
  const [cores, setCores] = useState(1);
  const bits = BITS[pw];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.pw}</span>
        <span className="seg" role="group" aria-label={T.pw} style={{ flexWrap: 'wrap' }}>
          {PW.map((p) => <button key={p} type="button" aria-pressed={pw === p} onClick={() => setPw(p)}>{T.pws[p]}</button>)}
        </span>
        <span className="ib-lbl">{T.cores}</span>
        <span className="seg" role="group" aria-label={T.cores}>
          {CORES.map((c) => <button key={c} type="button" aria-pressed={cores === c} onClick={() => setCores(c)}>{T.coresN(c)}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <text x={40} y={28} className="ib-n" style={{ fontWeight: 700 }}>{`${T.pws[pw]}: ${bits} bits, ${T.coresN(cores)}`}</text>
          {MARKS.map((m, i) => (
            <g key={m}>
              <line x1={X(m)} y1={44} x2={X(m)} y2={332} className="ib-line" style={{ strokeDasharray: '5 5', strokeWidth: 2 }} />
              <text x={X(m)} y={352} textAnchor="middle" className="ib-s">{T.marks[i]}</text>
            </g>
          ))}
          {METHODS.map((m, i) => {
            const secs = (2 ** (bits - 1)) / (SPEED[m] * cores);
            const y = 60 + i * 92;
            const w = Math.max(6, X(secs) - LX);
            return (
              <g key={m}>
                <text x={LX} y={y} className="ib-n" style={{ fontWeight: 700 }}>{`${T.names[m]}  ·  ${T.method[m]}`}</text>
                <rect className="ib-new" x={LX} y={y + 10} width={w} height={34} rx={7} />
                <text x={w > 520 ? LX + 12 : LX + w + 10} y={y + 34} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }} textAnchor="start">{fmt(secs, lang)}</text>
                <text x={LX} y={y + 62} className="ib-s">{`${T.speed}: ${SPEED[m].toLocaleString('en-US', { maximumFractionDigits: 1 })} ${T.unit}`}</text>
              </g>
            );
          })}
          <text x={LX} y={382} className="ib-s">{T.avg}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
