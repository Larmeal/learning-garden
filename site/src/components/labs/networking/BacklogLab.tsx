import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, Lifelines, Msg, ease } from './nw';
import data from './sockets.json';

// Shows:      a server that called listen(2) and never calls accept(). Six clients try to connect one after another. The first three finish the handshake and sit in the accept queue (three slots:
//             backlog + 1 on Linux). The fourth finds the queue full: its SYN gets no answer, it is sent again after 1, 2, 3 and 4 seconds, and the client's program times out after 1.5 seconds.
// Because:    a full queue produces SILENCE, not an error. The reader has to see a connection attempt that produces no packet back at all, and the same SYN repeated, to understand why a connect() "hangs".
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: listen(n) is the size of a queue of finished handshakes that accept() has not taken yet. When it is full, new SYNs are ignored and clients wait; it is the server program's slowness that shows up as a connect timeout.
//
// The results of the six connections, the 1-second repeats of the fourth SYN and the counter of ten ignored SYNs are real: exercises/10_sockets.py (sockets.json).

const D = 20;
const XS = { c: 130, s: 760 };
const res = data.backlog.results as { n: number; result: string; seconds: number }[];
const again = data.backlog.synAgain as number[];

type T = { title: string; caption: string; client: string; server: string; queue: string; slot: string; waiting: string; timeout: string; marks: Mark[]; slots: string; ignored: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดู Server ที่เรียก listen(2) แต่ไม่เรียก accept เลย Client หกตัวเข้ามา สามตัวแรกเข้าคิว ตัวที่สี่เป็นต้นไปเงียบหายและต้องส่ง SYN ซ้ำ',
    caption: 'ผลของ Connection ทั้งหก (เชื่อมต่อใน 0.02 วินาทีสามตัวแรก แล้ว Timeout 1.5 วินาทีอีกสามตัว) SYN ที่ถูกส่งซ้ำห่างกันประมาณ 1 วินาที และตัวนับ ListenOverflows เท่ากับ 10 เป็นผลจริงของแบบฝึก 10',
    client: 'Client', server: 'Server (listen 2, ไม่เรียก accept)', queue: 'คิวของ Connection ที่จับมือเสร็จแล้ว รอ accept()', slot: 'ช่อง', waiting: 'รออยู่', timeout: 'Timeout 1.5 วินาที', slots: 'ช่องว่าง', ignored: 'SYN ที่ถูกเมิน',
    marks: [
      { at: 1, name: 'ตัวที่ 1 ถึง 3', title: 'สามตัวแรกจับมือสำเร็จ เข้าคิวรอ accept', text: 'Kernel ตอบ SYN,ACK และรับ ACK เสร็จเอง โดยไม่ต้องให้โปรแกรมของ Server ทำอะไร Connection ที่เสร็จแล้วเข้าไปรอในคิว ซึ่ง listen(2) ขอไว้สองช่อง แต่ Linux ให้อยู่ได้สามตัว (ตามที่วัดได้) ตอนนี้ ss บอก Recv-Q เป็น 3 จาก Send-Q ที่เป็น 2' },
      { at: 8, name: 'ตัวที่ 4', title: 'ตัวที่ 4 ส่ง SYN แต่คิวเต็ม จึงไม่มีใครตอบ', text: 'Kernel เมิน SYN เฉย ๆ ไม่ส่ง RST และไม่ส่ง SYN,ACK Client ไม่รู้ว่าเกิดอะไรขึ้น จึงทำตามกฎของ TCP คือส่ง SYN เดิมซ้ำเมื่อ Timer หมด (ห่างกันประมาณ 1 วินาที)' },
      { at: 13, name: 'รอจนหมดเวลา', title: 'โปรแกรมของ Client ยอมแพ้เองหลัง 1.5 วินาที', text: 'เพราะไม่มีข้อความตอบกลับมาเลย connect() ค้างจนหมด Timeout ของโปรแกรม ในแบบฝึกทั้งตัวที่ 4, 5 และ 6 จบแบบเดียวกัน Kernel นับ SYN ที่เมินไปทั้งหมด 10 ครั้ง (ListenOverflows) นี่คืออาการ "ต่อ Server ไม่ติดเป็นพัก ๆ" ทั้งที่ Server เปิดอยู่' },
    ],
  },
  en: {
    title: 'Press play and watch a server that called listen(2) but never calls accept. Six clients arrive, the first three join the queue, and the fourth onwards vanish into silence and have to send their SYN again',
    caption: 'The results of the six connections (three connected in 0.02 seconds, then three timeouts of 1.5 seconds), the SYN repeated about a second apart and the counter ListenOverflows equal to 10 are the real results of exercise 10.',
    client: 'Client', server: 'Server (listen 2, never accept)', queue: 'queue of finished handshakes waiting for accept()', slot: 'slot', waiting: 'waiting', timeout: 'timeout 1.5 seconds', slots: 'free slots', ignored: 'SYNs ignored',
    marks: [
      { at: 1, name: 'Number 1 to 3', title: 'The first three complete the handshake and join the queue to wait for accept', text: 'The kernel answers with SYN,ACK and takes the ACK by itself, without the server program doing anything. A finished connection waits in the queue, for which listen(2) asked two slots, but Linux lets three stay (as measured). Now ss shows Recv-Q 3 against a Send-Q of 2.' },
      { at: 8, name: 'Number 4', title: 'Number 4 sends a SYN but the queue is full, so nobody answers', text: 'The kernel simply ignores the SYN. It sends no RST and no SYN,ACK. The client does not know what happened, so it follows the rule of TCP and sends the same SYN again when its timer runs out (about 1 second apart).' },
      { at: 13, name: 'Waiting it out', title: 'The client\'s program gives up on its own after 1.5 seconds', text: 'Because no message ever comes back, connect() hangs until the program\'s own timeout. In the exercise numbers 4, 5 and 6 all ended the same way. The kernel counted 10 ignored SYNs in all (ListenOverflows). This is the symptom "sometimes cannot connect to the server" while the server is up.' },
    ],
  },
};

export default function BacklogLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const inQueue = [0, 1, 2].filter((i) => t >= 1 + i * 1.2 + 1.3).length;
  const startOf = (i: number) => (i < 3 ? 1 + i * 1.2 : 8 + (i - 3) * 1.6);
  const synN = res.slice(3).filter((_, k) => t >= 8 + k * 1.6 + 0.4).length + (t >= 9.8 ? Math.min(3, again.length - 1) : 0);

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'same', text: 'SYN,ACK' }, { cls: 'bad', text: 'SYN (ignored)' }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 540" role="img" aria-label={T.title}>
          <Lifelines xs={[XS.c, XS.s]} y1={64} y2={344} names={[T.client, T.server]} />
          {res.map((r, i) => {
            const ok = r.result === 'connected';
            const y = 92 + i * 40;
            const p = ease(t, startOf(i), startOf(i) + 1.0);
            return (
              <g key={i}>
                <Msg x1={XS.c} y1={y} x2={XS.s} y2={y + 14} p={p} kind={ok ? 'ctl' : 'retx'} n={r.n} label={ok ? 'SYN → SYN,ACK → ACK' : 'SYN'} lost={!ok} labelDy={-6} />
                {!ok && p > 0.99 && t < startOf(i) + 1.6 && <text x={XS.c + 40} y={y + 6} className="ib-s" style={{ fill: 'var(--ib-bad)', fontWeight: 700 }}>…</text>}
                {ok && t >= startOf(i) + 1.0 && <text x={XS.c + 24} y={y - 6} className="ib-s" style={{ fill: 'var(--k2)', fontWeight: 700 }}>✓ {r.seconds} s</text>}
                {!ok && t >= startOf(i) + 1.5 && <text x={XS.c + 24} y={y - 6} className="ib-s" style={{ fill: 'var(--ib-bad)', fontWeight: 700 }}>✗ {T.timeout}</text>}
              </g>
            );
          })}
          <text x={20} y={376} className="ib-layer">{T.queue}</text>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect className={i < inQueue ? 'nw-cell ok' : 'nw-cell'} x={20 + i * 150} y={386} width={140} height={44} rx={8} />
              <text x={20 + i * 150 + 70} y={414} textAnchor="middle" className="ib-n" style={{ fontSize: 15 }}>{i < inQueue ? `#${i + 1} ${T.waiting}` : `${T.slot} ${i + 1}`}</text>
            </g>
          ))}
          <g>
            <rect className="nw-cell" x={490} y={386} width={170} height={44} rx={8} />
            <text x={502} y={406} className="ib-s">ss: Recv-Q / Send-Q</text>
            <text x={502} y={424} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{inQueue} / 2</text>
            <rect className={synN > 0 ? 'nw-cell bad' : 'nw-cell'} x={676} y={386} width={184} height={44} rx={8} />
            <text x={688} y={406} className="ib-s">{T.ignored}</text>
            <text x={688} y={424} className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{synN} {t >= 13 ? `(→ ${data.backlog.overflows})` : ''}</text>
          </g>
          <Banner y={460} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
