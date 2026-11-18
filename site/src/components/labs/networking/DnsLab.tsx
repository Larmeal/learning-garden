import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Lifelines, Msg, Note, Legend, ease } from './nw';
import data from './udpDns.json';

// Shows:      one lookup of www.example.test going through a caching resolver: the client asks once, the resolver asks the root, then the TLD, then the authoritative server, each
//             answering with a referral (a pointer to the next server, with its address) until the last one gives the address. Then the same question asked a second time.
// Because:    DNS resolution is a walk down a tree of servers with the time adding up at each step, and a cache that cuts the walk to nothing. A list of record types cannot show where
//             the time goes.
// Control:    play, the scrub bar and the jump buttons (the clock). The second lookup is the last mark.
// Conclusion: a name is resolved by following referrals from the root down, every answer is cached for its TTL, and that is why the second lookup is almost free.
//
// The walk, the flags, the answers, the TTLs and the times are the real ones of exercises/06_udp_dns.py (udpDns.json). The servers are small Python programs of the exercise on a made-up
// top-level domain, not the real internet.

const D = 30;
const XS = [70, 250, 430, 610, 790];       // client, resolver, root, TLD, authoritative
const NAMES = ['client', 'resolver', 'root', 'TLD', 'authoritative'];
const walk = data.dns.walk as { t: number; from: string; to: string; q: boolean; what: string; aa: number; ttl: number | null }[];
// each packet of the walk gets 1.4 s; the packets are numbered 1..8 in the capture
const STEP = 2.2, T0 = 1;
const Y = (i: number) => 90 + i * 36;

type T = { title: string; caption: string; names: string[]; q: string; second: string; ms: string; cache: string; cached: string; marks: Mark[]; legendQ: string; legendA: string; ref: (w: string) => string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Resolver เดินหา www.example.test จาก Root ลงมาตามคำชี้ทางของแต่ละ Server แล้วดูครั้งที่สองที่ไม่ต้องเดินเลย',
    caption: 'ลำดับข้อความ Flag ค่า TTL และเวลา (123 และ 0 มิลลิวินาที) มาจากการจับ Packet จริงในแบบฝึก 06 Server ทุกตัวเป็นโปรแกรม Python เล็ก ๆ บนโดเมนสมมติ .test ที่ทุกคำตอบถูกหน่วง 20 มิลลิวินาที ไม่ใช่อินเทอร์เน็ตจริง',
    names: ['Client', 'Resolver', 'Root', 'TLD', 'Authoritative'], q: 'www.example.test A?', second: 'ถามซ้ำ', ms: 'มิลลิวินาที', cache: 'Cache ของ Resolver', cached: 'จำคำตอบไว้ (TTL 300 วินาที)',
    legendQ: 'คำถาม', legendA: 'คำตอบหรือคำชี้ทาง',
    ref: (w) => w.replace('referral ', 'ชี้ไปที่ '),
    marks: [
      { at: T0, name: 'Client ถาม', title: 'Client ถาม Resolver หนึ่งครั้ง', text: 'Client ส่งคำถาม www.example.test พร้อมธง RD (Recursion Desired) แปลว่า "ช่วยหาคำตอบสุดท้ายมาให้ที" Client ไม่ต้องรู้ว่า Server ไหนถือคำตอบ' },
      { at: T0 + STEP, name: 'ถาม Root', title: 'Resolver เริ่มจาก Root', text: 'Resolver ไม่รู้คำตอบและไม่มีใน Cache จึงเริ่มจาก Root ซึ่งทุก Resolver รู้ที่อยู่ล่วงหน้า (ถามโดยปิด RD เพราะ Resolver เดินเอง) Root ไม่ตอบ แต่ชี้ไปที่ Server ของโดเมน test. พร้อมที่อยู่ (Glue)' },
      { at: T0 + 3 * STEP, name: 'ถาม TLD', title: 'TLD ชี้ไปที่ example.test', text: 'Server ของ test. ก็ไม่รู้ที่อยู่ของ www แต่รู้ว่า example.test อยู่ที่ Server ตัวไหน จึงชี้ต่อพร้อมที่อยู่ (10.0.1.6)' },
      { at: T0 + 5 * STEP, name: 'ถาม Authoritative', title: 'Authoritative ตอบจริง', text: 'Server ของ example.test เป็นเจ้าของข้อมูล จึงตอบเองได้ (ธง AA) ว่า www.example.test คือ 10.0.2.50 และมี TTL 300 วินาที' },
      { at: T0 + 7 * STEP, name: 'ส่งคำตอบ', title: 'Resolver ตอบ Client และจำไว้', text: 'Resolver ส่งคำตอบให้ Client (ธง RA แปลว่ารับทำ Recursion) และเก็บคำตอบไว้ใน Cache ตามเวลา TTL ทั้งหมดใช้เวลา 123 มิลลิวินาที (ส่วนใหญ่คือรอ Server ละ 20 มิลลิวินาทีที่เราหน่วงไว้ กับ ARP ครั้งแรก)' },
      { at: T0 + 9 * STEP, name: 'ถามซ้ำ', title: 'ถามครั้งที่สอง: ตอบจาก Cache', text: 'Resolver เจอคำตอบใน Cache จึงตอบเอง ไม่ถามใครเลย ใช้ 0 มิลลิวินาที และ TTL ในคำตอบลดเหลือ 298 เพราะเวลาผ่านไปแล้วสองวินาที' },
    ],
  },
  en: {
    title: 'Press play and watch a resolver walk from the root down to find www.example.test by following the pointers of each server, then see a second lookup that needs no walk',
    caption: 'The order of the messages, the flags, the TTL values and the times (123 and 0 milliseconds) come from the real capture of exercise 06. Every server is a small Python program on a made-up domain .test, with every answer delayed by 20 milliseconds, not the real internet.',
    names: ['Client', 'Resolver', 'Root', 'TLD', 'Authoritative'], q: 'www.example.test A?', second: 'again', ms: 'ms', cache: 'Cache of the resolver', cached: 'remembers the answer (TTL 300 seconds)',
    legendQ: 'a question', legendA: 'an answer or a pointer',
    ref: (w) => w.replace('referral ', 'refers to '),
    marks: [
      { at: T0, name: 'Client asks', title: 'The client asks the resolver once', text: 'The client sends the question www.example.test with the RD flag (recursion desired), which means "please bring me the final answer". The client does not need to know which server holds it.' },
      { at: T0 + STEP, name: 'Ask the root', title: 'The resolver starts at the root', text: 'The resolver does not know the answer and has nothing cached, so it starts at the root, whose address every resolver knows in advance (the question has RD off, because the resolver does the walking itself). The root does not answer. It points at the server of the test. domain, with its address (glue).' },
      { at: T0 + 3 * STEP, name: 'Ask the TLD', title: 'The TLD points at example.test', text: 'The server of test. does not know the address of www either, but it knows which server holds example.test, so it points on, with the address (10.0.1.6).' },
      { at: T0 + 5 * STEP, name: 'Ask authoritative', title: 'The authoritative server answers for real', text: 'The server of example.test owns the data, so it can answer itself (the AA flag) that www.example.test is 10.0.2.50 with a TTL of 300 seconds.' },
      { at: T0 + 7 * STEP, name: 'Send the answer', title: 'The resolver answers the client and remembers', text: 'The resolver sends the answer to the client (the RA flag says it does recursion) and keeps it in its cache for the TTL. The whole thing took 123 milliseconds (mostly waiting 20 milliseconds for each server that we delayed, plus the first ARP).' },
      { at: T0 + 9 * STEP, name: 'Ask again', title: 'The second question: answered from the cache', text: 'The resolver finds the answer in its cache, so it answers itself and asks nobody. It takes 0 milliseconds, and the TTL in the answer has dropped to 298 because two seconds have passed.' },
    ],
  },
};

export default function DnsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const secondStart = T0 + 9 * STEP;
  const col = (n: string) => NAMES.indexOf(n);

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.legendQ }, { cls: 'same', text: T.legendA }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 560" role="img" aria-label={T.title}>
          <Lifelines xs={XS} y1={62} y2={490} names={T.names} subs={['10.0.1.2', '10.0.1.3', '10.0.1.4', '10.0.1.5', '10.0.1.6']} />
          {walk.map((w, i) => {
            const s = T0 + i * STEP;
            const dur = 1.6;
            const x1 = XS[col(w.from)], x2 = XS[col(w.to)];
            const y = Y(i);
            const p = ease(t, s, s + dur);
            const label = w.q ? T.q : T.ref(w.what.replace('answer A ', 'A ').replace('A 10.0.2.50', 'A 10.0.2.50 (TTL 300)'));
            return <Msg key={i} x1={x1} y1={y} x2={x2} y2={y + 18} p={p} kind={w.q ? 'data' : 'ack'} n={i + 1} label={label} labelDy={-8} />;
          })}
          {/* the second lookup */}
          {(() => {
            const y = Y(8) + 8;
            const p1 = ease(t, secondStart, secondStart + 1.4);
            const p2 = ease(t, secondStart + 1.6, secondStart + 3);
            return (
              <g>
                <Msg x1={XS[0]} y1={y} x2={XS[1]} y2={y + 14} p={p1} kind="data" n={9} label={`${T.q} (${T.second})`} labelDy={-8} />
                <Msg x1={XS[1]} y1={y + 28} x2={XS[0]} y2={y + 42} p={p2} kind="ack" label={`A 10.0.2.50 (TTL ${data.dns.cacheTtl})`} labelDy={-6} />
              </g>
            );
          })()}
          <Note x={XS[1] - 150} y={436} w={300} text={t >= T0 + 7 * STEP + 1.6 ? T.cached : T.cache + ': ∅'} tone={t >= T0 + 7 * STEP + 1.6 ? 'ok' : undefined} op={t >= T0 + 7 * STEP + 1.6 ? 1 : 0.4} />
          <text x={XS[4]} y={436} textAnchor="middle" className="ib-n" style={{ opacity: t >= T0 + 7 * STEP + 1.6 ? 1 : 0 }}>123 {T.ms}</text>
          <text x={XS[1]} y={488} textAnchor="middle" className="ib-n" style={{ opacity: t >= secondStart + 3 ? 1 : 0 }}>0 {T.ms}</text>
          <Banner y={502} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
