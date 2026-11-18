import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Lang, type Mark } from '../spark/timeline';
import { Legend, Lines } from '../iceberg/ib';

// Shows:      one request travelling from the browser to the database through five stops and two trust boundaries, and where each of six attacks
//             lands on that path. Pick an attack: the attacker appears at its stop, the box turns red, a badge says which of C, I, A is lost,
//             and the shield at the end names the defence.
// Because:    the whole subject is "which stop breaks which promise". A table can list it, but only a picture shows that the stops are in a row
//             and that three of them sit in places we do not control.
// Control:    the attack buttons (each one moves the attacker to another stop and changes the badge and the defence); the clock plays the trip.
// Conclusion: every stop on the path can be attacked, each attack breaks confidentiality, integrity or availability, and each has its own defence.

type Attack = { id: string; stop: number; prop: 'C' | 'I' | 'A' };
const ATTACKS: Attack[] = [
  { id: 'sniff', stop: 1, prop: 'C' },
  { id: 'xss', stop: 0, prop: 'C' },
  { id: 'csrf', stop: 0, prop: 'I' },
  { id: 'sqli', stop: 3, prop: 'C' },
  { id: 'idor', stop: 3, prop: 'C' },
  { id: 'dos', stop: 2, prop: 'A' },
];

const TEXT: Record<Lang, {
  title: string; pick: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  stops: [string, string][]; zones: string[]; props: Record<'C' | 'I' | 'A', string>;
  attacks: Record<string, { name: string; does: string; fix: string }>; caption: string; shield: string; marks: (a: string) => Mark[];
}> = {
  th: {
    title: 'เลือกการโจมตีหนึ่งแบบ แล้วกดเล่นดูว่า Request วิ่งผ่านจุดไหน การโจมตีเกิดที่จุดไหน และอะไรที่เสียไป',
    pick: 'การโจมตี',
    legend: [{ kind: 'new', text: 'จุดที่โดนโจมตี' }, { kind: 'use', text: 'Request ผ่านไปแล้ว' }, { kind: 'node', text: 'ยังไม่ถึง' }],
    stops: [['Browser', 'อุปกรณ์ผู้ใช้'], ['เครือข่าย', 'Wi-Fi, ISP'], ['Web Server', 'รับ Request'], ['โค้ดของแอป', 'ตรรกะ ธุรกิจ'], ['Database', 'ข้อมูลจริง']],
    zones: ['อุปกรณ์ผู้ใช้', 'ไม่มีใครคุมได้', 'ระบบของเรา'],
    props: { C: 'ความลับรั่ว (Confidentiality)', I: 'ข้อมูลถูกแก้ (Integrity)', A: 'ใช้งานไม่ได้ (Availability)' },
    attacks: {
      sniff: { name: 'ดักอ่านกลางทาง', does: 'ใครสักคนใน Wi-Fi เดียวกันอ่านข้อความที่วิ่งผ่าน เช่น Password', fix: 'TLS เข้ารหัสทั้งทาง' },
      xss: { name: 'XSS', does: 'ความเห็นของคนอื่นมี Script ปนมา และ Browser ของเรารันมัน ทำให้ขโมย Cookie ได้', fix: 'Encode ตอนแสดงผล และ CSP' },
      csrf: { name: 'CSRF', does: 'เว็บอื่นสั่งให้ Browser ของเราส่ง Request ไปที่ธนาคารพร้อม Cookie ที่ล็อกอินค้างไว้', fix: 'SameSite และ CSRF Token' },
      sqli: { name: 'SQL Injection', does: 'ข้อความในช่องค้นหากลายเป็นส่วนหนึ่งของคำสั่ง SQL และดึงตารางอื่นออกมา', fix: 'Parameterized Query' },
      idor: { name: 'IDOR', does: 'เปลี่ยนเลข Order ใน URL แล้วอ่าน Order ของคนอื่นได้ เพราะโค้ดไม่ถามว่าเป็นของใคร', fix: 'เช็กเจ้าของใน Endpoint' },
      dos: { name: 'DoS', does: 'ส่ง Request เป็นพันต่อวินาทีจนคนอื่นเข้าไม่ได้', fix: 'Rate Limit' },
    },
    shield: 'ป้องกัน',
    caption: 'ห้าจุดและสองเส้นแบ่งความน่าเชื่อถือ (Trust Boundary) มาจาก exercises/01_mindset.py ส่วนการจับคู่การโจมตีกับจุดและกับ C, I, A เป็นการจัดของผู้เขียน แต่ละการโจมตีมีบทของตัวเองในเส้นทางนี้',
    marks: (a) => [
      { at: 0, name: 'เริ่ม', title: 'Request ออกจาก Browser', text: 'ผู้ใช้กดปุ่ม Request จะต้องผ่านห้าจุดกว่าจะถึง Database เส้นประคือขอบเขตที่ข้อมูลข้ามจากที่ที่เราคุมไม่ได้เข้ามาในระบบของเรา' },
      { at: 2.6, name: 'ถึงจุดโจมตี', title: `Request ผ่านจุดที่โดน ${a}`, text: 'ผู้โจมตีไม่ต้องทำลายทุกอย่าง แค่หาจุดเดียวที่โค้ดหรือระบบเชื่อใจสิ่งที่ส่งมามากเกินไป' },
      { at: 4.6, name: 'ผลที่เสีย', title: 'สิ่งที่เสียไปคือหนึ่งในสามอย่างนี้', text: 'ความลับรั่ว ข้อมูลถูกแก้ หรือใช้งานไม่ได้ การจำแนกแบบนี้ช่วยให้เราถามได้ว่าการโจมตีนี้ทำลายอะไร' },
      { at: 6.6, name: 'ป้องกัน', title: 'ทุกการโจมตีมีด่านป้องกันของมันเอง', text: 'ไม่มีด่านเดียวที่กันได้หมด เราจึงซ้อนหลายชั้นไว้ และแต่ละบทต่อจากนี้จะเจาะลงไปทีละด่าน' },
    ],
  },
  en: {
    title: 'Pick one attack and press play: see which stop the request passes, where the attack lands, and what is lost',
    pick: 'Attack',
    legend: [{ kind: 'new', text: 'the stop that is attacked' }, { kind: 'use', text: 'the request has passed' }, { kind: 'node', text: 'not reached yet' }],
    stops: [['Browser', 'the user device'], ['Network', 'Wi-Fi, ISP'], ['Web server', 'takes requests'], ['App code', 'business logic'], ['Database', 'the real data']],
    zones: ['User device', 'Nobody controls it', 'Our system'],
    props: { C: 'Secret leaks (Confidentiality)', I: 'Data is changed (Integrity)', A: 'Cannot be used (Availability)' },
    attacks: {
      sniff: { name: 'Sniffing', does: 'Someone on the same Wi-Fi reads what passes, for example a password', fix: 'TLS encrypts the whole way' },
      xss: { name: 'XSS', does: "Another user's comment carries a script and our browser runs it, which can steal a cookie", fix: 'Encode on output, and CSP' },
      csrf: { name: 'CSRF', does: 'Another site makes our browser send a request to the bank with the cookie that is still logged in', fix: 'SameSite and a CSRF token' },
      sqli: { name: 'SQL injection', does: 'The text in a search box becomes part of the SQL and pulls out another table', fix: 'Parameterised query' },
      idor: { name: 'IDOR', does: "Changing the order number in the URL shows someone else's order, because the code never asks whose it is", fix: 'Check the owner in the endpoint' },
      dos: { name: 'DoS', does: 'A thousand requests a second until nobody else can get in', fix: 'Rate limit' },
    },
    shield: 'Defence',
    caption: 'The five stops and two trust boundaries come from exercises/01_mindset.py. Matching each attack to a stop and to C, I or A is the author\'s own grouping. Each attack has its own lesson on this path.',
    marks: (a) => [
      { at: 0, name: 'start', title: 'The request leaves the browser', text: 'The user presses a button. The request passes five stops before it reaches the database. The dashed lines are the boundaries where data crosses from a place we do not control into our system.' },
      { at: 2.6, name: 'attack', title: `The request passes the stop that is hit by ${a}`, text: 'An attacker does not have to break everything, only find one place where the code or the system trusts what was sent a little too much.' },
      { at: 4.6, name: 'loss', title: 'What is lost is one of three things', text: 'A secret leaks, data is changed, or the service cannot be used. Sorting attacks this way lets us ask what this one destroys.' },
      { at: 6.6, name: 'defence', title: 'Every attack has its own defence', text: 'No single wall stops everything, so we stack several, and each lesson after this one goes into one of them.' },
    ],
  },
};

const BX = (i: number) => 24 + i * 172;
const BW = 140;
const DURATION = 9;

export default function RequestPathLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [pick, setPick] = useState('sqli');
  const a = ATTACKS.find((x) => x.id === pick)!;
  const info = T.attacks[pick];
  const clock = useClock(DURATION);
  const { t } = clock;

  const travel = smooth(prog(t, 0.8, 2.6)); // 0 at browser, 1 at the attack stop
  const dotX = mix(BX(0) + BW / 2, BX(a.stop) + BW / 2, travel);
  const hit = smooth(prog(t, 2.6, 3.4));
  const loss = smooth(prog(t, 4.6, 5.4));
  const fix = smooth(prog(t, 6.6, 7.4));
  const reached = (i: number) => (i <= a.stop && travel > i / Math.max(a.stop, 1) - 0.001 && t > 0.8) || (i === 0);
  const Y = 128;
  const H = 92;

  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {ATTACKS.map((x) => (
            <button key={x.id} type="button" aria-pressed={pick === x.id} onClick={() => { setPick(x.id); clock.restart(); }}>{T.attacks[x.id].name}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          {/* three zones */}
          <rect className="ib-zone" x={10} y={44} width={BW + 28} height={190} rx={12} />
          <rect className="ib-zone" x={BX(1) - 14} y={44} width={BW + 28} height={190} rx={12} style={{ strokeDasharray: '6 5' }} />
          <rect className="ib-zone" x={BX(2) - 14} y={44} width={3 * 172 - 4} height={190} rx={12} />
          {[0, 1, 2].map((z) => (
            <text key={z} x={[BX(0) + BW / 2, BX(1) + BW / 2, BX(3) + BW / 2][z]} y={66} textAnchor="middle" className="ib-s">{T.zones[z]}</text>
          ))}
          {/* the five stops */}
          {T.stops.map(([name, sub], i) => {
            const isHit = i === a.stop && hit > 0.3;
            const passed = reached(i);
            return (
              <g key={name}>
                <rect className={isHit ? 'ib-new' : passed ? 'ib-use' : 'ib-node'} x={BX(i)} y={Y} width={BW} height={H} rx={10} style={isHit ? { stroke: 'var(--ib-bad)', strokeWidth: 3.5 } : undefined} />
                <text x={BX(i) + BW / 2} y={Y + 38} textAnchor="middle" className="ib-n" style={{ fontWeight: 700 }}>{name}</text>
                <text x={BX(i) + BW / 2} y={Y + 64} textAnchor="middle" className="ib-s">{sub}</text>
                {i < 4 && <line x1={BX(i) + BW} y1={Y + H / 2} x2={BX(i + 1)} y2={Y + H / 2} className="ib-line" style={{ strokeWidth: 3 }} />}
              </g>
            );
          })}
          {/* the request dot */}
          <circle cx={dotX} cy={Y + H / 2} r={11} className="ib-new" style={{ opacity: t > 0.7 ? 1 : 0.0 }} />
          <text x={BX(0) + BW / 2} y={Y - 14} textAnchor="middle" className="ib-s" style={{ opacity: t < 1 ? 1 : 0 }}>Request</text>
          {/* the attacker */}
          <g style={{ opacity: hit }}>
            <rect x={BX(a.stop) + BW / 2 - 52} y={Y - 56} width={104} height={32} rx={9} style={{ fill: 'var(--ib-bad)' }} />
            <text x={BX(a.stop) + BW / 2} y={Y - 34} textAnchor="middle" className="ib-white" style={{ fontSize: 16 }}>{lang === 'th' ? 'ผู้โจมตี' : 'Attacker'}</text>
            <path d={`M${BX(a.stop) + BW / 2},${Y - 24} L${BX(a.stop) + BW / 2},${Y - 2}`} stroke="var(--ib-bad)" strokeWidth={3.5} fill="none" />
          </g>
          {/* what is lost */}
          <g style={{ opacity: loss }}>
            <rect x={14} y={252} width={852} height={44} rx={10} style={{ fill: 'var(--surface)', stroke: 'var(--ib-bad)', strokeWidth: 2 }} />
            <text x={30} y={280} className="ib-n" style={{ fontWeight: 700 }}>{`${info.name}: ${T.props[a.prop]}`}</text>
          </g>
          <g style={{ opacity: loss }}>
            <Lines x={20} y={326} text={info.does} max={lang === 'th' ? 78 : 92} className="ib-n" />
          </g>
          {/* the defence */}
          <g style={{ opacity: fix }}>
            <rect className="ib-new" x={14} y={352} width={852} height={40} rx={10} />
            <text x={30} y={378} className="ib-n" style={{ fontWeight: 700 }}>{`✓ ${T.shield}: ${info.fix}`}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(info.name)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
