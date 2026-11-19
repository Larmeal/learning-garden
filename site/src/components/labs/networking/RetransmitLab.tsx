import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Card, Lifelines, Msg, Legend, ease } from './nw';
import data from './tcpRel.json';

// Shows:      the same loss told two ways. (1) Only one segment is sent and it is dropped: the sender can only wait for its timer, sends it again, and the timer doubles each time.
//             (2) One segment is lost in the middle of a stream: the receiver keeps repeating "I still need number 3" and says in SACK blocks what it has beyond the hole, and after the third
//             repeat the sender sends the missing segment at once, one round trip after the loss, without waiting for any timer.
// Because:    "how long does TCP wait?" depends on whether anything else is still arriving. That is a story about the order of arrows and the gaps between them. The numbers
//             (about 250 ms against 20 ms) only make sense next to each other.
// Control:    a switch of two scenarios, plus play, the scrub bar and the jump buttons (the clock).
// Conclusion: TCP waits for a timer only when it has no other signal; with a stream flowing, duplicate ACKs and SACK let it repair a loss within one round trip.
//
// The segments, the gaps (246, 248 and 508 ms), the 20 ms between the first send and the repair, the SACK blocks and the number of segments are real: exercises/08_tcp_reliability.py (tcpRel.json).
// In the picture segments are numbered 1 to 6; the exercise sent 30, and the third was dropped.

type Scen = 'timer' | 'fast';
const G = data.rto.gaps;
const S = data.rto.sent;
const FIX = Math.round(data.fast.retx - data.fast.first);
const XS = { c: 170, s: 710 };
const D = 17;

type Row = { from: 'c' | 's'; label: string; kind: 'data' | 'ack' | 'ctl' | 'retx'; lost?: boolean; at: number; note?: string };

const timerRows = (T: { s1: string; again: string; ack: string }): Row[] => {
  const s = data.rto.sent;
  const t = (ms: number) => 1 + ms / 100;
  return [
    { from: 'c', label: `${T.s1}  (${s[0]} ms)`, kind: 'data', lost: true, at: t(s[0]) },
    { from: 'c', label: `${T.again}  (${s[1]} ms)`, kind: 'retx', lost: true, at: t(s[1]) },
    { from: 'c', label: `${T.again}  (${s[2]} ms)`, kind: 'retx', lost: true, at: t(s[2]) },
    { from: 'c', label: `${T.again}  (${s[3]} ms)`, kind: 'retx', at: t(s[3]) },
    { from: 's', label: `${T.ack}  ack=101`, kind: 'ack', at: t(s[3]) + 1.3 },
  ];
};


// The first scenario drawn as a time line: every attempt is a card at its real time, and the wait between two attempts is a bar that grows while the sender waits.
const TX = (ms: number) => 70 + (ms / 1100) * 740;
const TV: Record<Lang, { send: (n: number) => string; ack: string; wait: string; total: string }> = {
  th: { send: (n) => `ส่งครั้งที่ ${n}`, ack: 'ถึงแล้ว ได้ ACK', wait: 'รอ', total: 'กว่าข้อมูล 100 ไบต์จะถึงใช้เวลา' },
  en: { send: (n) => `Try ${n}`, ack: 'Arrived, got an ACK', wait: 'wait', total: 'Time before 100 bytes got through' },
};

function TimerView({ t, lang, ms }: { t: number; lang: Lang; ms: string }) {
  const V = TV[lang];
  const sent = data.rto.sent, gaps = data.rto.gaps;
  const now = (t - 1) * 100;
  return (
    <g transform="translate(0,-60)">
      <path d={`M${TX(0)},262 L${TX(1100)},262`} className="nw-wire" />
      {[0, 250, 500, 750, 1000].map((m) => (<g key={m}><path d={`M${TX(m)},256 v12`} className="nw-wire" /><text x={TX(m)} y={290} textAnchor="middle" className="ib-s">{m} {ms}</text></g>))}
      {sent.map((m, i) => {
        const shown = now >= m;
        const last = i === sent.length - 1;
        const nextX = i < sent.length - 1 ? TX(sent[i + 1]) : TX(m);
        const grow = i < sent.length - 1 ? Math.max(0, Math.min(1, (now - m) / (sent[i + 1] - m))) : 0;
        return (
          <g key={i}>
            {shown && <Card x={Math.max(TX(m), 120 + i * 0)} y={190} w={136} title={V.send(i + 1)} sub={`${m} ${ms}`} kind={last ? 'a' : i === 0 ? 'q' : 'bad'} />}
            {shown && !last && now >= sent[i + 1] - 150 && <path d={`M${TX(m) + 50},158 l22,22 M${TX(m) + 72},158 l-22,22`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 5, fill: 'none', strokeLinecap: 'round' }} />}
            {shown && <path d={`M${TX(m)},222 V256`} className="nw-wire" style={{ stroke: 'var(--accent)' }} />}
            {i < sent.length - 1 && grow > 0 && (
              <g>
                <rect x={TX(m)} y={300} width={(nextX - TX(m)) * grow} height={22} rx={6} className="nw-cell bad" />
                {grow > 0.98 && <text x={(TX(m) + nextX) / 2} y={344} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{V.wait} {gaps[i]} {ms}</text>}
              </g>
            )}
          </g>
        );
      })}
      {now >= sent[3] + 120 && (
        <g>
          <Card x={TX(sent[3]) - 40} y={420} w={230} title={V.ack} sub="ACK ack=101" kind="a" />
          <text x={70} y={432} className="ib-t" style={{ fontSize: 20 }}>{V.total} {sent[3] + data.rto.rtt} {ms}</text>
        </g>
      )}
    </g>
  );
}

const sackLabel = (a: number, b: number) => `SACK ${a}${a === b ? '' : `–${b}`}`;

const fastRows = (T: { seg: string; ack: string; dup: string; retx: string; next: string }): Row[] => [
  { from: 'c', label: `${T.seg} 1`, kind: 'data', at: 1 },
  { from: 'c', label: `${T.seg} 2`, kind: 'data', at: 1.5 },
  { from: 'c', label: `${T.seg} 3`, kind: 'data', lost: true, at: 2 },
  { from: 'c', label: `${T.seg} 4`, kind: 'data', at: 2.5 },
  { from: 'c', label: `${T.seg} 5`, kind: 'data', at: 3 },
  { from: 'c', label: `${T.seg} 6`, kind: 'data', at: 3.5 },
  { from: 's', label: `${T.ack} ${T.next}=2`, kind: 'ack', at: 5 },
  { from: 's', label: `${T.ack} ${T.next}=3`, kind: 'ack', at: 5.5 },
  { from: 's', label: `${T.dup} 1: ${T.next}=3  ${sackLabel(4, 4)}`, kind: 'ack', at: 6.2 },
  { from: 's', label: `${T.dup} 2: ${T.next}=3  ${sackLabel(4, 5)}`, kind: 'ack', at: 6.7 },
  { from: 's', label: `${T.dup} 3: ${T.next}=3  ${sackLabel(4, 6)}`, kind: 'ack', at: 7.2 },
  { from: 'c', label: `${T.retx} ${T.seg} 3`, kind: 'retx', at: 9.2 },
  { from: 's', label: `${T.ack} ${T.next}=7`, kind: 'ack', at: 11.2 },
];

type T = { title: string; caption: string; client: string; server: string; scen: Record<Scen, string>; marks: Record<Scen, Mark[]>; lab: { s1: string; again: string; ack: string; seg: string; dup: string; retx: string; next: string }; ms: string; legendLost: string; wait: string; fastDone: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือกเหตุการณ์แล้วกดเล่น เทียบ Segment ที่หายตัวเดียว ซึ่งต้องรอ Timer กับ Segment ที่หายกลางสาย ซึ่งซ่อมได้ภายในหนึ่งรอบเวลา',
    caption: `เวลาส่งซ้ำ ${S[1]}, ${S[2]} และ ${S[3]} มิลลิวินาที (ห่างกัน ${G[0]}, ${G[1]} และ ${G[2]}) การซ่อมที่ใช้เวลา ${FIX} มิลลิวินาที SACK และจำนวน Segment มาจากแบบฝึก 08 ภาพวาดเรียง Segment แค่ 6 ตัวให้อ่านง่าย (ในแบบฝึกส่ง 30 ตัวและหายตัวที่สาม) เวลาของฉากแรกถูกย่อให้เป็นหนึ่งในสิบ`,
    client: 'Client (ผู้ส่ง)', server: 'Server (ผู้รับ)', scen: { timer: 'หายตัวเดียว ไม่มีอะไรตามมา', fast: 'หายกลางสาย' },
    lab: { s1: 'ส่ง 100 ไบต์', again: 'ส่งซ้ำ', ack: 'ACK', seg: 'Segment', dup: 'ACK ซ้ำครั้งที่', retx: 'ส่งซ้ำ', next: 'รอตัวที่' },
    ms: 'มิลลิวินาที', legendLost: 'Packet ที่ถูกทิ้งระหว่างทาง', wait: 'Timer นับถอยหลัง: รอ', fastDone: `ซ่อมเสร็จใน ${FIX} มิลลิวินาที`,
    marks: {
      timer: [
        { at: 1, name: 'ส่งแล้วหาย', title: 'ส่ง 100 ไบต์ แต่ Router ทิ้งไป', text: 'ผู้ส่งไม่รู้ว่าหาย มันไม่ได้ยินอะไรจากผู้รับเลย เพราะไม่มี Segment อื่นที่จะทำให้ผู้รับตอบ' },
        { at: 3.7, name: 'ส่งซ้ำครั้งแรก', title: 'Timer หมด ส่ง Segment เดิมซ้ำ', text: `หลังรอประมาณ ${G[0]} มิลลิวินาที (มากกว่าหนึ่งรอบเวลาของสาย 20 มิลลิวินาทีมาก) ผู้ส่งตัดสินว่าหายแล้วส่งซ้ำ แต่ก็ถูกทิ้งอีก` },
        { at: 6.2, name: 'ส่งซ้ำครั้งสอง', title: `Timer ถูกคูณสอง: รอ ${G[2]} มิลลิวินาทีรอบถัดไป`, text: `ทุกครั้งที่ส่งซ้ำแล้วไม่ได้คำตอบ Timer จะยาวขึ้นเป็นสองเท่า (Exponential Back-off) เพื่อไม่ให้ซ้ำเติมเครือข่ายที่อาจกำลังแย่อยู่ ในแบบฝึกช่วงห่างคือ ${G[0]}, ${G[1]} และ ${G[2]} มิลลิวินาที` },
        { at: 11.3, name: 'ถึงจนได้', title: 'ครั้งที่สี่ผ่านไปได้', text: 'ในแบบฝึกเราถอดกฎที่ทิ้ง Packet ออกก่อนถึงครั้งนี้ Segment เดิมจึงไปถึง และได้ ACK ใช้เวลารวมกว่า 1 วินาทีสำหรับข้อมูลเพียง 100 ไบต์' },
      ],
      fast: [
        { at: 1, name: 'ส่งหกตัว', title: 'ส่ง Segment ต่อเนื่อง ตัวที่ 3 หาย', text: 'ผู้ส่งส่งหลายตัวไปโดยไม่รอ ACK ทีละตัว ตัวที่ 3 ถูกทิ้งระหว่างทาง ตัวอื่นไปถึงปกติ' },
        { at: 5, name: 'ACK ปกติ', title: 'ผู้รับตอบ ACK สำหรับตัวที่ 1 และ 2', text: 'ACK บอกว่าตอนนี้ผู้รับต้องการตัวไหนต่อ พอได้ตัวที่ 1 ก็ขอตัวที่ 2 พอได้ตัวที่ 2 ก็ขอตัวที่ 3 (ในภาพนับเป็นตัวที่ แทนที่จะนับเป็นไบต์ เพื่อให้อ่านง่าย)' },
        { at: 6.2, name: 'ACK ซ้ำ', title: 'ตัวที่ 4, 5, 6 มาถึง แต่ผู้รับยังรอตัวที่ 3', text: 'ผู้รับตอบ ACK เดิมซ้ำทุกครั้งที่มีตัวที่ไม่ใช่ตัวที่ต้องการมาถึง (ack ค้างที่ 3) พร้อม SACK Block ที่บอกว่าได้ของไปถึงตัวไหนแล้ว ซึ่งทำให้ผู้ส่งรู้ว่าช่องที่หายมีแค่ตัวที่ 3 ตัวเดียว' },
        { at: 9.2, name: 'ซ่อมทันที', title: 'ครบ ACK ซ้ำสามครั้ง ผู้ส่งส่งตัวที่ 3 ซ้ำ', text: `เมื่อได้ ACK ซ้ำครบสามครั้ง ผู้ส่งไม่รอ Timer แต่ส่งตัวที่หายซ้ำเลย (Fast Retransmit) ในแบบฝึกเกิดห่างจากครั้งแรก ${FIX} มิลลิวินาที ซึ่งเท่ากับราวหนึ่งรอบเวลา (20 มิลลิวินาที)` },
        { at: 11.2, name: 'เสร็จ', title: 'ACK เดียวกระโดดข้ามไปที่ 7', text: 'ตัวที่ 3 มาถึง ผู้รับมีทุกตัวแล้ว จึงตอบ ACK ที่ข้ามไปถึงตัวที่ 7 ในครั้งเดียว ไม่มีใครต้องส่งตัว 4, 5, 6 ซ้ำ เพราะ SACK บอกไว้แล้วว่าไปถึงแล้ว' },
      ],
    },
  },
  en: {
    title: 'Pick a situation and press play, comparing a single lost segment, which has to wait for a timer, with a segment lost in a stream, which is repaired within one round trip',
    caption: `The resend times ${S[1]}, ${S[2]} and ${S[3]} milliseconds (gaps of ${G[0]}, ${G[1]} and ${G[2]}), the repair that took ${FIX} milliseconds, the SACK blocks and the number of segments come from exercise 08. The drawing lists only 6 segments to be readable (the exercise sent 30 and lost the third). The time of the first scene is shrunk to a tenth.`,
    client: 'Client (sender)', server: 'Server (receiver)', scen: { timer: 'one lost segment, nothing follows', fast: 'lost in a stream' },
    lab: { s1: 'send 100 bytes', again: 'again', ack: 'ACK', seg: 'segment', dup: 'duplicate ACK', retx: 'resend', next: 'next' },
    ms: 'ms', legendLost: 'a packet dropped on the way', wait: 'timer counting down: waits', fastDone: `repaired in ${FIX} ms`,
    marks: {
      timer: [
        { at: 1, name: 'Sent, lost', title: 'It sends 100 bytes and the router drops them', text: 'The sender does not know it was lost. It hears nothing from the receiver, because no other segment arrives that would make the receiver answer.' },
        { at: 3.7, name: 'First resend', title: 'The timer runs out and the same segment is sent again', text: `After waiting about ${G[0]} milliseconds (far more than the 20 millisecond round trip of the cable) the sender decides it is lost and sends it again. It is dropped again.` },
        { at: 6.2, name: 'Second resend', title: `The timer is doubled: the next wait is ${G[2]} milliseconds`, text: `Every time a resend gets no answer, the timer is doubled (exponential back-off) so as not to pile onto a network that may be in trouble. In the exercise the gaps were ${G[0]}, ${G[1]} and ${G[2]} milliseconds.` },
        { at: 11.3, name: 'It gets through', title: 'The fourth send gets through', text: 'We removed the dropping rule before this one, so the same segment arrives and is acknowledged. It took over a second to deliver just 100 bytes.' },
      ],
      fast: [
        { at: 1, name: 'Six sent', title: 'Segments are sent one after another, number 3 is lost', text: 'The sender sends several without waiting for each ACK. Number 3 is dropped on the way and the others arrive normally.' },
        { at: 5, name: 'Normal ACKs', title: 'The receiver acknowledges segments 1 and 2', text: 'An ACK says the number of the next byte wanted, which is now segment 3 (the picture counts in segments to be readable).' },
        { at: 6.2, name: 'Duplicate ACKs', title: 'Segments 4, 5 and 6 arrive but the receiver still wants 3', text: 'The receiver repeats the same ACK every time a segment arrives that is not the one it wants (ack stuck at 3), with a SACK block that says how far it has received. That tells the sender the hole is exactly one segment, number 3.' },
        { at: 9.2, name: 'Repair now', title: 'Three duplicate ACKs, so the sender resends segment 3', text: `After the third duplicate ACK the sender does not wait for any timer, it sends the missing segment again at once (fast retransmit). In the exercise this was ${FIX} milliseconds after the first time, about one round trip (20 milliseconds).` },
        { at: 11.2, name: 'Done', title: 'One ACK jumps to 7', text: 'Segment 3 arrives, the receiver has everything, and it acknowledges up to segment 7 in one go. Nobody has to resend 4, 5 and 6, because SACK already said they arrived.' },
      ],
    },
  },
};

export default function RetransmitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [scen, setScen] = useState<Scen>('fast');
  const clock = useClock(D);
  const { t } = clock;
  const marks = T.marks[scen];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const rows = scen === 'timer' ? timerRows(T.lab) : fastRows(T.lab);
  const pitch = scen === 'timer' ? 52 : 28;
  const y0 = scen === 'timer' ? 110 : 92;
  const lostLabelDone = scen === 'fast' && t >= 9.2 + 1.3;
  const pick = (s: Scen) => { setScen(s); clock.restart(); };
  const timerCount = scen === 'timer' ? data.rto.gaps : [];
  const H = scen === 'timer' ? 440 : 520;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="scenario">
          {(['timer', 'fast'] as Scen[]).map((s) => (
            <button key={s} type="button" aria-pressed={scen === s} onClick={() => pick(s)}>{T.scen[s]}</button>
          ))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'bad', text: T.legendLost }, { cls: 'same', text: 'ACK' }]} />
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${H + 40}`} role="img" aria-label={T.title}>
          {scen === 'timer' && <TimerView t={t} lang={lang} ms={T.ms} />}
          {scen === 'fast' && <Lifelines xs={[XS.c, XS.s]} y1={58} y2={H - 54} names={[T.client, T.server]} />}
          {scen === 'fast' && rows.map((r, i) => {
            const y = y0 + i * pitch;
            const toServer = r.from === 'c';
            const p = ease(t, r.at, r.at + 1.2);
            const x1 = toServer ? XS.c : XS.s, x2 = toServer ? XS.s : XS.c;
            const stop = r.lost ? 0.55 : 1;
            return (
              <g key={i}>
                <Msg x1={x1} y1={y} x2={x1 + (x2 - x1) * stop} y2={y + 12} p={p} kind={r.kind} lost={r.lost} label={r.label} labelDy={-6} />
                {scen === 'timer' && i > 0 && i < 4 && p > 0.1 && <text x={XS.c + 14} y={y - 20} className="ib-s" style={{ fontWeight: 700, fill: 'var(--ib-bad)' }}>{T.wait} {timerCount[i - 1]} {T.ms}</text>}
              </g>
            );
          })}
          {lostLabelDone && <text x={XS.c + 14} y={H - 66} className="ib-n" style={{ fill: 'var(--k2)' }}>✓ {T.fastDone}</text>}
          <Banner y={H - 40} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
