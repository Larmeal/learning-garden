import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, ease } from './nw';
import data from './http.json';

// Shows:      the same six requests (the server needs 100 ms for each, the round trip is 20 ms) drawn as bars on a time axis for four ways of fetching them: HTTP/1.1 with a new connection for every request,
//             HTTP/1.1 on one kept-alive connection, HTTP/1.1 on six connections at once, and HTTP/2 with six streams on one connection. Each bar is split into the time on the wire (the handshake and the round
//             trip) and the time the server works. A vertical cursor sweeps over the axis.
// Because:    "HTTP/2 does at once on one connection what HTTP/1.1 needs six connections for" is a statement about overlap in time. Bars side by side on one axis show that the work of the server overlaps
//             in the last two rows and does not in the first two, and what a connection costs.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: an HTTP/1.1 connection answers one request at a time, so concurrency needs more connections (each with a handshake); HTTP/2 puts the six requests in flight on one connection together.
//
// The finishing times of every request in the four runs (and so the total of about 857, 752, 149 and 135 ms) are real: exercises/12_http.py (http.json). The split of a bar into parts is computed from the known
// 100 ms of work and the 20 ms round trip.

const D = 18;
const MS_MAX = 900;
const X0 = 70, X1 = 840;
const px = (ms: number) => X0 + (ms / MS_MAX) * (X1 - X0);
const SPEED = MS_MAX / 14;

const H = data.h1 as Record<string, number[]>;
const N1 = Math.max(...H.new), N2 = Math.max(...H.reuse), N3 = Math.max(...H.parallel), N4 = data.h2Total;
type Mode = 'new' | 'reuse' | 'parallel' | 'h2';
const rows: { key: Mode; lanes: number }[] = [{ key: 'new', lanes: 1 }, { key: 'reuse', lanes: 1 }, { key: 'parallel', lanes: 6 }, { key: 'h2', lanes: 6 }];

type T = { title: string; caption: string; label: Record<Mode, string>; wire: string; work: string; ms: string; marks: Mark[] };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูหกคำขอเดียวกัน ถูกดึงสี่แบบ แบบไหนทับซ้อนกันได้ แบบไหนต้องเรียงต่อกัน',
    caption: `เวลาที่แต่ละคำขอเสร็จ (รวม ${N1}, ${N2}, ${N3} และ ${N4} มิลลิวินาที) เป็นผลจริงของแบบฝึก 12 ส่วนการแบ่งแท่งเป็นเวลาบนสายกับเวลาที่ Server ทำงาน คำนวณจากที่รู้ว่า Server ใช้ 100 มิลลิวินาทีต่อคำขอและ RTT 20 มิลลิวินาที`,
    label: { new: 'HTTP/1.1: Connection ใหม่ทุกคำขอ', reuse: 'HTTP/1.1: Connection เดียว ทีละคำขอ', parallel: 'HTTP/1.1: หก Connection พร้อมกัน', h2: 'HTTP/2: Connection เดียว หก Stream พร้อมกัน' },
    wire: 'เวลาบนสาย (Handshake และไปกลับ)', work: 'Server ทำงาน (100 มิลลิวินาที)', ms: 'มิลลิวินาที',
    marks: [
      { at: 0, name: 'เริ่ม', title: 'หกคำขอ Server ใช้ 100 มิลลิวินาทีต่อคำขอ', text: 'ทั้งสี่แบบขอข้อมูลชุดเดียวกัน ต่างกันที่วิธีใช้ Connection' },
      { at: 3.2, name: 'Connection ใหม่', title: 'Connection ใหม่ทุกคำขอ: แต่ละอันเสียเวลา Handshake ซ้ำ', text: `คำขอหนึ่งเสียราว 140 มิลลิวินาที คือ Handshake 20, ไปกลับ 20 และ Server ทำงาน 100 หกคำขอเรียงกันจึงรวม ${N1}` },
      { at: 6.5, name: 'ใช้ซ้ำ', title: 'Connection เดียว ทีละคำขอ: ประหยัด Handshake แต่ยังต้องรอ', text: `ใช้ Connection เดิมต่อ (Keep-alive) จึงเหลือคำขอละ 120 มิลลิวินาที แต่ HTTP/1.1 ตอบได้ทีละคำขอ คำขอถัดไปต้องรอตัวก่อนหน้า รวม ${N2}` },
      { at: 9, name: 'หก Connection', title: 'หก Connection พร้อมกัน: เร็วขึ้น แต่ต้องเปิดหกอัน', text: `เบราว์เซอร์แก้ปัญหาด้วยการเปิดหลาย Connection ได้ผลรวม ${N3} แต่ทุกอันต้อง Handshake เอง และ Server ต้องเก็บหก Connection (RFC 9113 หัวข้อ 1)` },
      { at: 12, name: 'HTTP/2', title: 'HTTP/2: Connection เดียว ส่งหกคำขอไปพร้อมกัน', text: `หกคำขอวิ่งเป็น Stream 1, 3, 5, 7, 9 และ 11 บน Connection เดียว Server ตอบกลับพร้อมกัน ได้ผลรวม ${N4} มิลลิวินาทีนับจากเปิดคำขอ (บวกเวลา Handshake ของ TCP ครั้งเดียว) ใกล้เคียงกับหก Connection แต่ใช้แค่หนึ่ง` },
    ],
  },
  en: {
    title: 'Press play and watch the same six requests fetched four ways, and see which can overlap and which have to go one after another',
    caption: `The finishing time of each request (totals of ${N1}, ${N2}, ${N3} and ${N4} milliseconds) is the real result of exercise 12. The split of each bar into time on the wire and time the server works is computed from the known 100 milliseconds of work per request and the 20 millisecond round trip.`,
    label: { new: 'HTTP/1.1: a new connection for each request', reuse: 'HTTP/1.1: one connection, one at a time', parallel: 'HTTP/1.1: six connections at once', h2: 'HTTP/2: one connection, six streams at once' },
    wire: 'time on the wire (handshake and round trip)', work: 'the server works (100 ms)', ms: 'ms',
    marks: [
      { at: 0, name: 'Start', title: 'Six requests, and the server needs 100 milliseconds for each', text: 'All four ways ask for the same data. They differ in how they use connections.' },
      { at: 3.2, name: 'New connection', title: 'A new connection for each request: every one pays the handshake again', text: `One request costs about 140 milliseconds: 20 for the handshake, 20 for the round trip and 100 of work by the server. Six in a row make ${N1}.` },
      { at: 6.5, name: 'Reuse', title: 'One connection, one at a time: the handshake is saved but we still wait', text: `Keeping the connection (keep-alive) leaves 120 milliseconds per request, but HTTP/1.1 answers one request at a time, so each waits for the one before. In all ${N2}.` },
      { at: 9, name: 'Six connections', title: 'Six connections at once: faster, but six have to be opened', text: `Browsers solve this by opening several connections. The total is ${N3}, but each does its own handshake and the server has to hold six connections (RFC 9113 section 1).` },
      { at: 12, name: 'HTTP/2', title: 'HTTP/2: one connection carries six requests at once', text: `The six requests run as streams 1, 3, 5, 7, 9 and 11 on one connection, and the server answers them together, for a total of ${N4} milliseconds from the moment the requests are made (plus one TCP handshake). That is close to six connections, but with only one.` },
    ],
  },
};

export default function RequestsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const ms = Math.min(MS_MAX, t * SPEED);
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const h1 = data.h1 as Record<string, number[]>;
  const done: Record<Mode, number[]> = { new: h1.new, reuse: h1.reuse, parallel: h1.parallel, h2: (data.h2 as number[]).map((x) => x + (data.h2Total - Math.max(...(data.h2 as number[])))) };
  const panelH = [68, 68, 150, 150];
  const ys: number[] = [];
  panelH.reduce((a, h, i) => { ys[i] = a; return a + h + 38; }, 100);
  const total = ys[3] + panelH[3] + 50;
  const bar = (start: number, end: number, key: string, y: number, h: number, hasConnect: boolean) => {
    const work = Math.min(100, end - start);
    const wireEnd = end - work;
    return (
      <g key={key}>
        <rect className="nw-l4" x={px(start)} y={y} width={Math.max(0, px(Math.min(ms, wireEnd)) - px(start))} height={h} rx={4} />
        <rect className="nw-app" x={px(wireEnd)} y={y} width={Math.max(0, px(Math.min(ms, end)) - px(wireEnd))} height={h} rx={4} style={{ display: ms > wireEnd ? undefined : 'none' }} />
        {hasConnect && null}
      </g>
    );
  };

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'l4', text: T.wire }, { cls: 'app', text: T.work }]} />
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${total + 60}`} role="img" aria-label={T.title}>
          {[0, 200, 400, 600, 800].map((v) => (<g key={v}><path className="ib-line" d={`M${px(v)},${58} L${px(v)},${total - 18}`} style={{ opacity: 0.35 }} /><text x={px(v)} y={44} textAnchor="middle" className="ib-s">{v}{v === 800 ? ` ${T.ms}` : ''}</text></g>))}
          {rows.map((r, i) => {
            const y = ys[i];
            const d = done[r.key];
            const h = r.lanes === 1 ? 30 : 18;
            return (
              <g key={r.key}>
                <text x={X0} y={y - 8} className="ib-n" style={{ fontSize: 18 }}>{T.label[r.key]}</text>
                {ms >= Math.max(...d) && <text x={840} y={y - 8} textAnchor="end" className="ib-n" style={{ fontSize: 22, fill: r.key === 'h2' ? 'var(--k2)' : 'var(--fg)' }}>{Math.max(...d)} {T.ms}</text>}
                {r.lanes !== 1 && d.map((_, k) => <text key={'l' + k} x={px(0) - 8} y={y + 4 + k * 22 + 14} textAnchor="end" className="ib-s">#{k + 1}</text>)}
                {d.map((end, k) => {
                  if (r.key === 'new' || r.key === 'reuse') {
                    const per = r.key === 'new' ? 140 : 120;
                    const start = end - per;
                    return bar(Math.max(0, start), end, `${r.key}${k}`, y + 4, h, false);
                  }
                  return bar(0, end, `${r.key}${k}`, y + 4 + k * 22, h, true);
                })}
              </g>
            );
          })}
          <path className="ib-arrow" d={`M${px(ms)},${58} L${px(ms)},${total - 18}`} style={{ strokeDasharray: '6 5', strokeWidth: 2.5, opacity: 0.7 }} />
          <Banner y={total - 8} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
