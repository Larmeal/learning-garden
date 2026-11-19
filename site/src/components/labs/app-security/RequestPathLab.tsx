import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Lang, type Mark } from '../spark/timeline';
import { Key } from '../data-security/ds';
import { Envelope, Figure, Paper, Shield } from './bits';

// Shows:      a request as an envelope that rides a road through five buildings (browser, network, web server, app code, database). Pick an attack: the attacker steps out at
//             the building where that attack lands, and three cards show what an honest request says, what the attacker sends instead, and what he gets (with the letter C, I or A
//             for the promise that is lost). At the end a shield appears at that building and the third card is struck out.
// Because:    "which stop breaks which promise" is a claim about a place and a thing. A table lists it, but only the envelope on the road shows that the stops are in a row and that
//             three of them are not ours, and only the three cards show the same request turned into something else.
// Control:    the six attack buttons (each moves the attacker to another building and changes all three cards and the shield); the clock plays the trip and the scrub bar jumps to a step.
// Conclusion: every stop can be attacked, each attack takes away confidentiality, integrity or availability, and each has one defence that sits at that stop.
//
// The five stops and the two boundaries come from exercises/01_mindset.py. The payloads are the ones the later lessons run (exercises 08, 09, 10, 05, 12). Which stop and which of C, I, A
// belongs to which attack is the author's grouping. The ciphertext bytes under TLS are an illustration.

type Attack = { id: string; stop: number; prop: 'C' | 'I' | 'A' };
const ATTACKS: Attack[] = [
  { id: 'sniff', stop: 1, prop: 'C' },
  { id: 'xss', stop: 0, prop: 'C' },
  { id: 'csrf', stop: 0, prop: 'I' },
  { id: 'sqli', stop: 3, prop: 'C' },
  { id: 'idor', stop: 3, prop: 'C' },
  { id: 'dos', stop: 2, prop: 'A' },
];

type Info = { name: string; normal: string; payload: string; got: string; does: string; fix: string; fixed: string };

const TEXT: Record<Lang, {
  title: string; pick: string; stops: [string, string][]; zones: string[]; props: Record<'C' | 'I' | 'A', string>; attacker: string; request: string;
  cardA: string; cardB: string; defence: string; attacks: Record<string, Info>; caption: string; legend: { color: string; text: string; ring?: boolean }[]; marks: (a: string) => Mark[];
}> = {
  th: {
    title: 'เลือกการโจมตีหนึ่งแบบ แล้วกดเล่นดู Request ที่เป็นซองจดหมายวิ่งผ่านอาคารทั้งห้า ผู้โจมตีออกมาที่จุดไหน ส่งอะไรเข้าไป ได้อะไรกลับไป และอะไรที่กันไว้ได้',
    pick: 'การโจมตี',
    stops: [['Browser', 'ของผู้ใช้'], ['เครือข่าย', 'Wi-Fi และ ISP'], ['Web Server', 'รับ Request'], ['โค้ดของแอป', 'ตรรกะของร้าน'], ['Database', 'ข้อมูลจริง']],
    zones: ['อุปกรณ์ของผู้ใช้', 'ไม่มีใครคุมได้', 'ระบบของเรา'],
    props: { C: 'C ความลับรั่ว (Confidentiality)', I: 'I ข้อมูลถูกแก้ (Integrity)', A: 'A ใช้งานไม่ได้ (Availability)' },
    attacker: 'ผู้โจมตี', request: 'Request',
    cardA: 'Request ปกติ', cardB: 'สิ่งที่ผู้โจมตีส่งแทน', defence: 'ด่านป้องกัน',
    attacks: {
      sniff: { name: 'ดักอ่านกลางทาง', normal: 'POST /login user=ann password=hunter2', payload: 'ไม่ต้องแก้อะไร แค่แอบดูสำเนาของ Request ที่ผ่านสาย', got: 'เห็น password=hunter2 ทุกตัวอักษร', does: 'คนที่อยู่ใน Wi-Fi เดียวกันอ่านข้อความที่วิ่งผ่านไปได้ ถ้ามันไม่ได้ถูกเข้ารหัส', fix: 'TLS', fixed: 'เห็นแค่ 9f3a 07c1 b2e4 (อ่านไม่ออก)' },
      xss: { name: 'XSS', normal: 'รีวิว: ร้านดีมาก ส่งไวด้วย', payload: '<script>send(document.cookie)</script>', got: 'Browser ของคนที่เปิดอ่านรัน Script แล้วส่ง Cookie ไปที่ evil.test', does: 'ความเห็นของคนอื่นมี Script ปนมา และ Browser ของเราเชื่อว่าเป็นโค้ดของเว็บ จึงรันมัน', fix: 'Encode ตอนแสดงผล + CSP', fixed: 'Browser แสดงมันเป็นตัวหนังสือธรรมดา ไม่มีอะไรรัน' },
      csrf: { name: 'CSRF', normal: 'ผู้ใช้กดปุ่ม โอนเงิน บนเว็บของธนาคารเอง', payload: 'evil.test ซ่อนฟอร์ม POST bank.test/transfer to=mallory', got: 'ธนาคารเห็น Cookie ของผู้ใช้ จึงโอนเงินให้', does: 'เว็บอื่นสั่งให้ Browser ของเราส่ง Request ไปที่ธนาคาร โดย Browser แนบ Cookie ที่ล็อกอินค้างไว้ไปให้เอง', fix: 'SameSite + CSRF Token', fixed: 'ไม่มี Token ที่ถูกต้อง ธนาคารปฏิเสธ' },
      sqli: { name: 'SQL Injection', normal: 'ค้นหา: pen', payload: "x' UNION SELECT name, password FROM users --", got: 'ตาราง users ทั้งตารางกลับมาในหน้าค้นหา', does: 'ข้อความในช่องค้นหากลายเป็นส่วนหนึ่งของคำสั่ง SQL แล้วดึงตารางอื่นออกมา', fix: 'Parameterized Query', fixed: 'ข้อความทั้งก้อนถูกค้นหาเป็นชื่อสินค้า ไม่เจออะไร' },
      idor: { name: 'IDOR', normal: 'GET /orders/101 (ของ Ann เอง)', payload: 'GET /orders/102', got: 'ได้ Order ของ Bob ยอด 900', does: 'Ann เปลี่ยนเลขใน URL แล้วอ่าน Order ของคนอื่นได้ เพราะโค้ดไม่ถามว่า Order นี้เป็นของใคร', fix: 'เช็กเจ้าของใน Endpoint', fixed: '403 ไม่ใช่ของคุณ' },
      dos: { name: 'DoS', normal: 'ลูกค้าส่ง 3 Request ต่อวินาที', payload: 'GET /search ซ้ำ 1,000 ครั้งต่อวินาที', got: 'คิวเต็ม คนอื่นเข้าเว็บไม่ได้', does: 'ส่ง Request เป็นพันต่อวินาทีจน Server ไม่มีแรงตอบคนอื่น', fix: 'Rate Limit', fixed: 'เกินโควตาจึงได้ 429 และถูกทิ้งก่อนถึงโค้ด' },
    },
    legend: [{ color: 'var(--accent)', text: 'Request ที่เดินทาง' }, { color: 'var(--ib-bad)', text: 'ผู้โจมตีและสิ่งที่เสียไป' }],
    caption: 'ห้าจุดกับเส้นแบ่งความน่าเชื่อถือสองเส้นมาจาก exercises/01_mindset.py ส่วนการจับคู่แต่ละการโจมตีกับจุดและกับ C, I, A เป็นการจัดของผู้เขียน ข้อความที่ผู้โจมตีส่งคือแบบเดียวกับที่บทหลัง ๆ รันจริง ส่วนไบต์หลัง TLS เป็นตัวอย่าง',
    marks: (a) => [
      { at: 0, name: 'เริ่ม', title: 'Request ออกจาก Browser', text: 'ซองจดหมายคือ Request ของผู้ใช้ ซึ่งต้องผ่านห้าอาคารกว่าจะถึง Database เส้นประคือขอบเขตที่ข้อมูลข้ามจากที่ที่เราคุมไม่ได้เข้ามาในระบบของเรา' },
      { at: 2.6, name: 'ผู้โจมตีออกมา', title: `ผู้โจมตีออกมาที่จุดของ ${a}`, text: 'ผู้โจมตีไม่ต้องทำลายทุกอย่าง แค่หาจุดเดียวที่ระบบเชื่อสิ่งที่ส่งมามากเกินไป การ์ดตรงกลางคือสิ่งที่เขาส่งเข้าไปแทน Request ปกติ' },
      { at: 4.6, name: 'ผลที่เสีย', title: 'สิ่งที่เสียไปคือหนึ่งในสามอย่างนี้', text: 'ความลับรั่ว ข้อมูลถูกแก้ หรือใช้งานไม่ได้ การจำแนกแบบนี้ช่วยให้เราถามได้ว่าการโจมตีนี้ทำลายอะไร' },
      { at: 6.6, name: 'ป้องกัน', title: 'ทุกการโจมตีมีด่านป้องกันของมันเอง', text: 'ไม่มีด่านเดียวที่กันได้หมด เราจึงซ้อนหลายชั้นไว้ และแต่ละบทต่อจากนี้จะเจาะลงไปทีละด่าน' },
    ],
  },
  en: {
    title: 'Pick one attack and press play: a request (an envelope) rides through the five buildings, the attacker steps out at one of them, sends something, takes something, and a defence stops it',
    pick: 'Attack',
    stops: [['Browser', 'the user device'], ['Network', 'Wi-Fi and ISP'], ['Web server', 'takes requests'], ['App code', "the shop's logic"], ['Database', 'the real data']],
    zones: ['User device', 'Nobody controls it', 'Our system'],
    props: { C: 'C secret leaks (Confidentiality)', I: 'I data is changed (Integrity)', A: 'A cannot be used (Availability)' },
    attacker: 'Attacker', request: 'Request',
    cardA: 'The honest request', cardB: 'What the attacker sends instead', defence: 'The defence',
    attacks: {
      sniff: { name: 'Sniffing', normal: 'POST /login user=ann password=hunter2', payload: 'Nothing is changed. He only watches a copy of the request as it passes', got: 'Sees password=hunter2, every character', does: 'Someone on the same Wi-Fi reads what passes, as long as it is not encrypted', fix: 'TLS', fixed: 'Sees only 9f3a 07c1 b2e4 (unreadable)' },
      xss: { name: 'XSS', normal: 'Review: great shop, fast delivery', payload: '<script>send(document.cookie)</script>', got: "The reader's browser runs the script and sends the cookie to evil.test", does: "Another user's comment carries a script, and our browser believes it is the site's own code, so it runs it", fix: 'Encode on output + CSP', fixed: 'The browser shows it as plain text and nothing runs' },
      csrf: { name: 'CSRF', normal: 'The user presses Transfer on the bank\'s own page', payload: 'evil.test hides a form: POST bank.test/transfer to=mallory', got: "The bank sees the user's cookie and moves the money", does: 'Another site makes our browser send a request to the bank, and the browser attaches the cookie that is still logged in', fix: 'SameSite + CSRF token', fixed: 'No valid token, so the bank refuses' },
      sqli: { name: 'SQL injection', normal: 'Search: pen', payload: "x' UNION SELECT name, password FROM users --", got: 'The whole users table comes back in the search page', does: 'The text in the search box becomes part of the SQL and pulls out another table', fix: 'Parameterised query', fixed: 'The whole text is searched as a product name and nothing is found' },
      idor: { name: 'IDOR', normal: "GET /orders/101 (Ann's own)", payload: 'GET /orders/102', got: "Gets Bob's order, total 900", does: "Ann changes the number in the URL and reads someone else's order, because the code never asks whose it is", fix: 'Check the owner in the endpoint', fixed: '403 not yours' },
      dos: { name: 'DoS', normal: 'A customer sends 3 requests a second', payload: 'GET /search repeated 1,000 times a second', got: 'The queue is full and nobody else can get in', does: 'A thousand requests a second until the server has no strength left to answer anyone else', fix: 'Rate limit', fixed: 'Over the quota, so it gets 429 and is dropped before the code' },
    },
    legend: [{ color: 'var(--accent)', text: 'the request on its way' }, { color: 'var(--ib-bad)', text: 'the attacker and what is lost' }],
    caption: "The five stops and two trust boundaries come from exercises/01_mindset.py. Matching each attack to a stop and to C, I or A is the author's own grouping. The payloads are the ones the later lessons really run. The bytes under TLS are an illustration.",
    marks: (a) => [
      { at: 0, name: 'start', title: 'The request leaves the browser', text: 'The envelope is the user\'s request. It passes five buildings before it reaches the database. The dashed lines are the boundaries where data crosses from a place we do not control into our system.' },
      { at: 2.6, name: 'attacker', title: `The attacker steps out where ${a} lands`, text: 'An attacker does not have to break everything, only find one place where the system trusts what was sent a little too much. The middle card is what he sends instead of the honest request.' },
      { at: 4.6, name: 'loss', title: 'What is lost is one of three things', text: 'A secret leaks, data is changed, or the service cannot be used. Sorting attacks this way lets us ask what this one destroys.' },
      { at: 6.6, name: 'defence', title: 'Every attack has its own defence', text: 'No single wall stops everything, so we stack several, and each lesson after this one goes into one of them.' },
    ],
  },
};

const BX = (i: number) => 24 + i * 172;
const BW = 140;
const DURATION = 9;
const RY = 168;

export default function RequestPathLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [pick, setPick] = useState('sqli');
  const a = ATTACKS.find((x) => x.id === pick)!;
  const info = T.attacks[pick];
  const clock = useClock(DURATION);
  const { t } = clock;
  const travel = smooth(prog(t, 0.8, 2.6));
  const cx = (i: number) => BX(i) + BW / 2;
  const dotX = mix(cx(0), cx(a.stop), travel);
  const hit = smooth(prog(t, 2.6, 3.4));
  const loss = smooth(prog(t, 4.6, 5.4));
  const fix = smooth(prog(t, 6.6, 7.4));
  const bad = 'var(--ib-bad)';
  const mx = lang === 'th' ? 29 : 30;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {ATTACKS.map((x) => (
            <button key={x.id} type="button" aria-pressed={pick === x.id} onClick={() => { setPick(x.id); clock.restart(); }}>{T.attacks[x.id].name}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 612" role="img" aria-label={T.title}>
          {/* three zones and five buildings */}
          <rect className="ib-zone" x={10} y={8} width={BW + 28} height={150} rx={12} />
          <rect className="ib-zone" x={BX(1) - 14} y={8} width={BW + 28} height={150} rx={12} style={{ strokeDasharray: '6 5' }} />
          <rect className="ib-zone" x={BX(2) - 14} y={8} width={3 * 172 - 4} height={150} rx={12} />
          {[0, 1, 2].map((z) => (
            <text key={z} x={[cx(0), cx(1), cx(3)][z]} y={28} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.zones[z]}</text>
          ))}
          {T.stops.map(([name, sub], i) => {
            const isHit = i === a.stop && hit > 0.3;
            return (
              <g key={name}>
                <rect x={BX(i)} y={44} width={BW} height={92} rx={10} fill="var(--surface)" stroke={isHit ? bad : 'var(--line-strong)'} strokeWidth={isHit ? 4 : 2} />
                <text x={cx(i)} y={84} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{name}</text>
                <text x={cx(i)} y={110} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{sub}</text>
                <line x1={cx(i)} y1={136} x2={cx(i)} y2={RY} stroke="var(--line-strong)" strokeWidth={2} />
              </g>
            );
          })}
          {/* the road and the envelope */}
          <line x1={14} y1={RY} x2={866} y2={RY} stroke="var(--line-strong)" strokeWidth={5} strokeLinecap="round" />
          <Envelope cx={dotX} cy={RY} w={50} op={t > 0.5 ? 1 : 0} />
          {t < 1 ? <text x={cx(0)} y={RY + 42} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.request}</text> : null}
          {/* the attacker, below the building where the attack lands */}
          <g opacity={hit}>
            <line x1={cx(a.stop)} y1={RY + 8} x2={cx(a.stop)} y2={RY + 34} stroke={bad} strokeWidth={4} />
            <Figure cx={cx(a.stop)} cy={RY + 50} r={13} fill={bad} />
            <text x={cx(a.stop) + 34} y={RY + 56} className="ib-n" style={{ fontWeight: 700, fill: bad, fontSize: 15 }}>{T.attacker}</text>
          </g>
          {/* the three cards */}
          <Paper x={14} y={262} w={268} h={132} title={T.cardA} text={info.normal} max={mx} mono={pick === 'sniff' || pick === 'idor'} op={0.35 + 0.65 * smooth(prog(t, 0.2, 0.8))} />
          <path d="M288,328 l14,-9 l0,18 z" fill="var(--muted)" opacity={hit} />
          <Paper x={306} y={262} w={268} h={132} title={T.cardB} text={info.payload} max={pick === 'sniff' ? mx : 25} mono={pick !== 'sniff'} tone="bad" op={hit} />
          <path d="M580,328 l14,-9 l0,18 z" fill="var(--muted)" opacity={loss} />
          <Paper x={598} y={262} w={268} h={132} title={T.props[a.prop]} text={info.got} max={mx} tone="bad" op={loss} strike={fix > 0.6} />
          {/* what happened, in one sentence */}
          <g opacity={hit}>
            <rect className="ib-banner" x={14} y={412} width={852} height={62} rx={12} />
            <foreignObject x={26} y={416} width={828} height={56}><div style={{ fontSize: 15.5, lineHeight: 1.4, paddingTop: 6 }}>{info.does}</div></foreignObject>
          </g>
          {/* the defence */}
          <g opacity={fix}>
            <rect x={14} y={492} width={852} height={104} rx={12} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={3} />
            <Shield cx={60} cy={544} s={1.5} />
            <text x={110} y={522} className="ib-s" style={{ fontSize: 14 }}>{T.defence}</text>
            <text x={110} y={550} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{info.fix}</text>
            <text x={110} y={580} className="ib-n" style={{ fontSize: 15 }}>{`✓ ${info.fixed}`}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(info.name)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
