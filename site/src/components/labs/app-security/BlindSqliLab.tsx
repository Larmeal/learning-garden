import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './injection.json';

// Shows:      a secret read one character at a time through a page that only says "found" or "not found". Each question is "is the character at place N greater
//             than M?". Every answer cuts the range of possible characters (32 to 126) in half, until one is left and the letter appears.
// Because:    the page never prints the secret, which is why people think a yes/no is harmless. 85 requests for 11 characters is what it takes, and the
//             halving is what makes it so few.
// Control:    the clock (play, scrub and jump to the first letter or the last). The questions are the real ones, in order.
// Conclusion: a one bit answer is enough to leak anything, if the attacker can ask as many questions as he likes. 95 possible values need 6 or 7 questions, so
//             11 characters need 85, not 1,000.
//
// The 85 questions and answers are the trace printed by exercises/08_injection.py --write (injection.json). The secret is a fake admin password in a fake table.

type Ev = { pos: number; mid: number; yes: boolean };
const TRACE = data.trace as Ev[];
const SECRET = data.secret as string;
const STEP = 0.2;
const START = 0.6;

// replay the binary search and keep, for each event, the range after it and the letters found so far
function replay() {
  const out: { lo: number; hi: number; found: string; check: boolean }[] = [];
  let lo = 32, hi = 126, found = '';
  TRACE.forEach((e) => {
    if (e.mid === 0) { lo = 32; hi = 126; out.push({ lo, hi, found, check: true }); return; }
    if (e.yes) lo = e.mid + 1; else hi = e.mid;
    if (lo >= hi) { found += String.fromCharCode(lo); out.push({ lo, hi, found, check: false }); lo = 32; hi = 126; return; }
    out.push({ lo, hi, found, check: false });
  });
  return out;
}
const STATES = replay();

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; ask: (p: number, m: number) => string; exists: (p: number) => string; yes: string; no: string; req: string; range: string; secret: string; caption: string; marks: Mark[] }> = {
  th: {
    title: 'หน้าเว็บตอบแค่ "เจอ" หรือ "ไม่เจอ" แต่ผู้โจมตีถามไปเรื่อย ๆ ได้รหัสผ่านทีละตัวอักษร กดเล่นดูว่าช่วงที่เป็นไปได้หดลงครึ่งหนึ่งทุกคำถาม',
    legend: [{ kind: 'new', text: 'ช่วงที่ยังเป็นไปได้' }, { kind: 'use', text: 'ตัวอักษรที่ได้แล้ว' }],
    ask: (p, m) => `ตัวอักษรที่ ${p} มีรหัส ASCII มากกว่า ${m} ไหม`, exists: (p) => `ตัวอักษรที่ ${p} มีอยู่ไหม`, yes: 'เจอ', no: 'ไม่เจอ', req: 'จำนวนคำขอ', range: 'ช่วงที่เป็นไปได้ (รหัส 32 ถึง 126)', secret: 'รหัสผ่านที่ถอดได้',
    caption: 'คำถามและคำตอบทั้ง 85 ข้อมาจากแบบฝึก 08 (injection.json) ที่ถามกับ SQLite จริงผ่านช่องที่ฉีด SQL ได้ รหัสผ่านเป็นข้อมูลปลอม',
    marks: [
      { at: 0, name: 'เริ่ม', title: 'ถามทีละข้อ ตอบได้แค่ เจอ หรือ ไม่เจอ', text: 'หน้าเว็บไม่เคยพิมพ์รหัสผ่านออกมา ผู้โจมตีใช้ช่องที่ฉีด SQL ได้ ถามว่าตัวอักษรที่ N มีรหัสมากกว่า M ไหม' },
      { at: 4, name: 'ตัวแรก', title: 'ครึ่งหนึ่งหายไปทุกครั้งที่ตอบ', text: 'ช่วง 32 ถึง 126 มี 95 ค่า ถามราว 7 ครั้งก็เหลือค่าเดียว' },
      { at: 15, name: 'ครึ่งทาง', title: 'ตัวอักษรเริ่มต่อกันเป็นรหัสผ่าน', text: 'แต่ละตัวอักษรใช้ 6 หรือ 7 คำถามบวกอีกหนึ่งข้อว่าตัวอักษรนั้นมีอยู่ไหม' },
      { at: 17.8, name: 'เสร็จ', title: 'ได้ครบ 11 ตัวอักษรหลัง 85 คำขอ', text: 'ถ้าไล่เดาทีละตัวจะต้องลองราว 95 ยกกำลัง 11 แบบ การตอบแค่ใช่หรือไม่ก็พอรั่ว' },
    ],
  },
  en: {
    title: 'The page answers only "found" or "not found", yet an attacker who keeps asking gets the password one character at a time. Press play and watch the range of possibilities halve with every question',
    legend: [{ kind: 'new', text: 'the range still possible' }, { kind: 'use', text: 'the characters found' }],
    ask: (p, m) => `Is the character at place ${p} greater than ${m}?`, exists: (p) => `Is there a character at place ${p}?`, yes: 'found', no: 'not found', req: 'requests', range: 'the range still possible (codes 32 to 126)', secret: 'the password so far',
    caption: 'All 85 questions and answers come from exercise 08 (injection.json), asked of a real SQLite through a place where SQL could be injected. The password is fake data.',
    marks: [
      { at: 0, name: 'start', title: 'One question at a time, answered only found or not found', text: 'The page never prints the password. The attacker uses the place where SQL can be injected to ask: is the character at place N greater than M?' },
      { at: 4, name: 'first letter', title: 'Half of the options disappear with every answer', text: 'The range 32 to 126 holds 95 values. About 7 questions leave one.' },
      { at: 15, name: 'halfway', title: 'The letters start to line up into the password', text: 'Each letter costs 6 or 7 questions, plus one asking whether a letter exists at that place.' },
      { at: 17.8, name: 'done', title: 'All 11 characters after 85 requests', text: 'Guessing the whole thing at once would take about 95 to the power 11 tries. A yes or no answer is enough to leak it.' },
    ],
  },
};

export default function BlindSqliLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const duration = START + TRACE.length * STEP + 1.5;
  const clock = useClock(duration);
  const { t } = clock;
  const k = Math.max(-1, Math.min(TRACE.length - 1, Math.floor((t - START) / STEP)));
  const ev = k >= 0 ? TRACE[k] : null;
  const st = k >= 0 ? STATES[k] : null;
  const found = st ? st.found : '';
  const lo = st ? st.lo : 32, hi = st ? st.hi : 126;
  const X = (v: number) => 40 + ((v - 32) / (126 - 32)) * 800;
  const pulse = ev ? 1 - ((t - START) / STEP - k) : 0;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          <text x={40} y={30} className="ib-s">{T.secret}</text>
          {SECRET.split('').map((ch, i) => {
            const shown = i < found.length;
            return (
              <g key={i}>
                <rect className={shown ? 'ib-use' : 'ib-node'} x={40 + i * 66} y={42} width={58} height={64} rx={9} style={ev && ev.pos === i + 1 && !shown ? { stroke: 'var(--accent)', strokeWidth: 3.5 } : undefined} />
                <text x={69 + i * 66} y={86} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 30, opacity: shown ? 1 : 0.2 }}>{shown ? found[i] : '?'}</text>
              </g>
            );
          })}
          <text x={40} y={146} className="ib-s">{T.range}</text>
          <line x1={X(32)} y1={186} x2={X(126)} y2={186} className="ib-line" style={{ strokeWidth: 3 }} />
          <rect className="ib-new" x={X(lo)} y={166} width={Math.max(8, X(hi) - X(lo))} height={40} rx={8} style={{ transition: 'x .15s, width .15s' }} />
          <text x={X(32)} y={230} className="ib-m" style={{ fontSize: 14 }}>32</text>
          <text x={X(126)} y={230} textAnchor="end" className="ib-m" style={{ fontSize: 14 }}>126</text>
          <text x={440} y={230} textAnchor="middle" className="ib-n">{`${lo} … ${hi}  (${hi - lo + 1})`}</text>
          {ev && (
            <g>
              <rect className={ev.yes ? 'ib-new' : 'ib-node'} x={40} y={254} width={800} height={56} rx={10} style={ev.yes ? undefined : { stroke: 'var(--ib-bad)', strokeWidth: 2.5 }} />
              <text x={56} y={288} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{ev.mid === 0 ? T.exists(ev.pos) : T.ask(ev.pos, ev.mid)}</text>
              <text x={824} y={288} textAnchor="end" className={ev.yes ? 'ib-ok ib-n' : 'ib-bad ib-n'} style={{ fontWeight: 700, fontSize: 20, opacity: 0.4 + 0.6 * (1 - pulse) }}>{ev.yes ? `✓ ${T.yes}` : `✗ ${T.no}`}</text>
            </g>
          )}
          <text x={40} y={350} className="ib-s">{T.req}</text>
          <text x={150} y={352} className="ib-n" style={{ fontWeight: 700, fontSize: 26 }}>{k + 1}</text>
          <text x={220} y={350} className="ib-s">{`/ ${TRACE.length}`}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
