import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, type Lang, type Mark } from '../spark/timeline';
import { Key } from '../data-security/ds';
import data from './dosData.json';

// Shows:      requests arriving over time as dots on a timeline, and which a limiter lets through. A token bucket drawn as a bucket of five coins (a burst of 8 empties it, 3 seconds later 3 coins
//             are back) and two window counters drawn as frames on the same edge case (10 requests at second 55 and 10 at second 61): the fixed window is two boxes that each fill to 10 of 10, so all
//             20 pass, and the sliding window is one frame that looks back 60 seconds from the latest request and refuses the second ten.
// Because:    "limit of 10 a minute" means different things to a fixed window and a sliding window, and only the picture of the two at the edge of the window shows how.
// Control:    the limiter (bucket, fixed window, sliding window); the clock replays the requests as dots that turn into a pass or a refusal.
// Conclusion: a bucket lets a burst through and refills at a steady rate, a fixed window can allow twice the limit around its edge, a sliding window cannot.
//
// The events and the decisions are those printed by exercises/12_dos_rate_limit.py (dosData.json). The token level under the bucket is computed in the lab with the same rule as the
// exercise (capacity 5, one token a second).

type Alg = 'bucket' | 'fixed' | 'sliding';
const BUCKET = data.bucket as { events: number[]; allowed: boolean[] };
const EDGE = data.edge as { events: number[]; fixed: boolean[]; sliding: boolean[] };

const TEXT: Record<Lang, {
  title: string; pick: string; algs: Record<Alg, string>; legend: { color: string; text: string; ring?: boolean }[]; allowed: string; refused: string; level: string; window: string; edge: string; caption: string; marks: (a: Alg) => Mark[];
  readout: (ok: number, total: number) => string; sec: string;
}> = {
  th: {
    title: 'เลือกวิธีจำกัดอัตรา แล้วกดเล่นดูคำขอที่ทยอยเข้ามา ว่าคำขอไหนผ่านและคำขอไหนถูกปฏิเสธ',
    pick: 'ตัวจำกัด', algs: { bucket: 'Token Bucket', fixed: 'Fixed Window', sliding: 'Sliding Window' },
    legend: [{ color: 'var(--accent)', text: 'ผ่าน' }, { color: 'var(--ib-bad)', text: 'ถูกปฏิเสธ' }], allowed: 'ผ่าน', refused: 'ปฏิเสธ', level: 'Token ที่เหลือ', window: 'ขอบของ Window (วินาทีที่ 60)', edge: 'ช่วงเวลา 60 วินาทีที่เลื่อนไปตามคำขอ', sec: 'วินาที',
    readout: (ok, total) => `ผ่าน ${ok} จาก ${total} คำขอ`,
    caption: 'เวลาของคำขอและผลของแต่ละวิธีมาจากแบบฝึก 12 (Bucket: ความจุ 5 เติมวินาทีละหนึ่ง, Window: จำกัด 10 ต่อ 60 วินาที) ระดับ Token ที่เห็นใต้กราฟคำนวณในหน้านี้ด้วยกฎเดียวกัน',
    marks: (a) => a === 'bucket'
      ? [{ at: 0, name: 'ระเบิด', title: 'คำขอ 8 ครั้งพร้อมกัน', text: 'Bucket เต็ม 5 Token จึงผ่านห้าครั้งแรกและปฏิเสธสามครั้งหลัง' }, { at: 3.2, name: 'เติมแล้ว', title: 'สามวินาทีต่อมา Token กลับมา 3 ตัว', text: 'คำขอสี่ครั้งใหม่ ผ่านสามครั้ง และปฏิเสธหนึ่งครั้ง' }]
      : [{ at: 0, name: 'นาทีแรก', title: '10 คำขอที่วินาที 55', text: 'ยังไม่เกินขีดจำกัด 10 ต่อนาที จึงผ่านทั้งหมด' }, { at: 3.2, name: 'ข้ามขอบ', title: '10 คำขอที่วินาที 61', text: a === 'fixed' ? 'Window ใหม่เริ่มนับจากศูนย์ ผ่านทั้ง 10 รวมเป็น 20 ใน 6 วินาที' : 'Window ที่เลื่อนไปยังนับ 10 ครั้งก่อนหน้า จึงปฏิเสธทั้งหมด เหลือผ่านแค่ 10' }]
  },
  en: {
    title: 'Pick a rate limiter and press play to watch the requests come in, which pass and which are refused',
    pick: 'Limiter', algs: { bucket: 'Token bucket', fixed: 'Fixed window', sliding: 'Sliding window' },
    legend: [{ color: 'var(--accent)', text: 'allowed' }, { color: 'var(--ib-bad)', text: 'refused' }], allowed: 'allowed', refused: 'refused', level: 'tokens left', window: 'the edge of the window (second 60)', edge: 'the 60 second window that moves with the requests', sec: 's',
    readout: (ok, total) => `${ok} of ${total} requests allowed`,
    caption: 'The times of the requests and the result of each method come from exercise 12 (bucket: capacity 5, one token refilled per second; windows: 10 per 60 seconds). The token level shown under the chart is computed on this page with the same rule.',
    marks: (a) => a === 'bucket'
      ? [{ at: 0, name: 'burst', title: '8 requests at once', text: 'The bucket holds 5 tokens, so the first five pass and the last three are refused' }, { at: 3.2, name: 'refilled', title: 'Three seconds later 3 tokens are back', text: 'Four new requests: three pass and one is refused' }]
      : [{ at: 0, name: 'first minute', title: '10 requests at second 55', text: 'Still within the limit of 10 a minute, so all pass' }, { at: 3.2, name: 'the edge', title: '10 requests at second 61', text: a === 'fixed' ? 'A new window starts counting from zero, so all 10 pass, 20 within 6 seconds' : 'The moving window still counts the earlier 10, so all of these are refused and only 10 pass' }],
  },
};

const NEWT: Record<Lang, { bucket: string; coins: string; inFrame: (n: number) => string; frame1: string; frame2: string; slide: string; passed: string; refusedN: string; full: string; limitOf: string }> = {
  th: { bucket: 'ถัง Token', coins: 'เหรียญ 1 เหรียญต่อ 1 คำขอ เติมเหรียญวินาทีละหนึ่ง', inFrame: (n) => `${n} จาก 10 คำขอที่ผ่านแล้วอยู่ในกรอบนี้`, frame1: 'Window ที่ 1 (วินาที 0 ถึง 59)', frame2: 'Window ที่ 2 (วินาที 60 ถึง 119)', slide: 'กรอบ 60 วินาทีที่ถอยหลังจากคำขอล่าสุด', passed: 'ผ่าน', refusedN: 'ปฏิเสธ', full: 'เต็มแล้ว คำขอต่อไปถูกปฏิเสธ', limitOf: 'ขีดจำกัด 10 ต่อ 60 วินาที' },
  en: { bucket: 'the token bucket', coins: 'one coin per request, one coin refilled every second', inFrame: (n) => `${n} of 10 allowed requests are inside this frame`, frame1: 'window 1 (seconds 0 to 59)', frame2: 'window 2 (seconds 60 to 119)', slide: 'a 60 second frame that looks back from the latest request', passed: 'allowed', refusedN: 'refused', full: 'full, so the next requests are refused', limitOf: 'limit of 10 per 60 seconds' },
};

const DUR = 6.5;

export default function RateLimitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const N = NEWT[lang];
  const [alg, setAlg] = useState<Alg>('bucket');
  const clock = useClock(DUR);
  const { t } = clock;
  const ev = alg === 'bucket' ? BUCKET.events : EDGE.events;
  const ok = alg === 'bucket' ? BUCKET.allowed : alg === 'fixed' ? EDGE.fixed : EDGE.sliding;
  const t0 = Math.min(...ev), t1 = Math.max(...ev);
  const clockOf = (e: number) => 0.6 + ((e - t0) / (t1 - t0)) * 3.2;
  const secOf = (tt: number) => t0 + ((Math.min(Math.max(tt, 0.6), 3.8) - 0.6) / 3.2) * (t1 - t0);
  const lo = alg === 'bucket' ? -0.5 : 53, span = alg === 'bucket' ? 4.5 : 10;
  const X = (e: number) => 60 + ((e - lo) / span) * 760;
  const seen: Record<string, number> = {};
  const dots = ev.map((e, i) => { const k = String(e); const row = seen[k] ?? 0; seen[k] = row + 1; return { e, i, row }; });
  const shown = dots.filter((d) => t >= clockOf(d.e));
  const passed = shown.filter((d) => ok[d.i]).length;
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';
  // tokens in the bucket now: same rule as the exercise (capacity 5, one token a second), with the refill running between the requests
  let tokens = 5, last = 0;
  shown.forEach((d) => { tokens = Math.min(5, tokens + (d.e - last)); last = d.e; if (ok[d.i]) tokens -= 1; });
  const nowSec = alg === 'bucket' ? Math.max(last, secOf(t)) : 0;
  const coins = alg === 'bucket' ? Math.min(5, tokens + (nowSec - last)) : 0;
  // window counters
  const allowedBefore = (from: number, to: number) => shown.filter((d) => ok[d.i] && d.e >= from && d.e <= to).length;
  const latest = shown.length ? shown[shown.length - 1].e : 0;
  const DY = 296;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={[{ color: acc, text: T.legend[0].text }, { color: bad, text: T.legend[1].text }]} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {(['bucket', 'fixed', 'sliding'] as Alg[]).map((a) => <button key={a} type="button" aria-pressed={alg === a} onClick={() => { setAlg(a); clock.restart(); }}>{T.algs[a]}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 456" role="img" aria-label={T.title}>
          {alg === 'bucket' ? (
            <g>
              <path d="M60,26 L300,26 L280,124 L80,124 Z" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={3} />
              <text x={70} y={20} className="ib-n" style={{ fontWeight: 700, fontSize: 15 }}>{`🪣 ${N.bucket}`}</text>
              {Array.from({ length: 5 }, (_, k) => {
                const f = Math.max(0, Math.min(1, coins - k));
                return (
                  <g key={k}>
                    <circle cx={110 + k * 42} cy={80} r={17} fill="none" stroke="var(--line)" strokeWidth={2} strokeDasharray="4 4" />
                    {f > 0 ? <circle cx={110 + k * 42} cy={80} r={17 * (0.4 + 0.6 * f)} fill="#e2b93b" stroke="var(--line-strong)" strokeWidth={2} opacity={0.5 + 0.5 * f} /> : null}
                  </g>
                );
              })}
              <text x={330} y={64} className="ib-n" style={{ fontSize: 15 }}>{N.coins}</text>
              <text x={330} y={92} className="ib-n" style={{ fontSize: 22, fontWeight: 700 }}>{`${Math.floor(coins + 0.001)} / 5`}</text>
            </g>
          ) : (
            <g>
              {alg === 'fixed' ? (
                <g>
                  {[0, 1].map((k) => {
                    const a0 = k === 0 ? 53 : 60, a1 = k === 0 ? 60 : 63;
                    const cnt = allowedBefore(a0, a1 - 0.0001);
                    return (
                      <g key={k}>
                        <rect x={X(a0)} y={24} width={X(a1) - X(a0)} height={104} rx={12} fill={cnt >= 10 ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface)'} stroke={cnt >= 10 ? acc : 'var(--line-strong)'} strokeWidth={3} strokeDasharray={k === 1 ? '9 6' : undefined} />
                        <text x={X(a0) + 12} y={50} className="ib-s" style={{ fontSize: 13.5 }}>{k === 0 ? N.frame1 : N.frame2}</text>
                        <text x={X(a0) + 12} y={92} className="ib-n" style={{ fontSize: 26, fontWeight: 700 }}>{`${cnt} / 10`}</text>
                        {cnt >= 10 ? <text x={X(a1) - 12} y={92} textAnchor="end" className="ib-s" style={{ fontSize: 13, fill: acc }}>{N.full.split(' ')[0]}</text> : null}
                      </g>
                    );
                  })}
                  <line x1={X(60)} y1={24} x2={X(60)} y2={DY + 30} stroke={acc} strokeWidth={2.5} strokeDasharray="6 5" />
                </g>
              ) : (
                <g>
                  {(() => {
                    const from = Math.max(lo, latest - 60), to = Math.max(latest, lo + 0.4);
                    const cnt = allowedBefore(latest - 60, latest);
                    return (
                      <g opacity={shown.length ? 1 : 0.3}>
                        <text x={60} y={42} className="ib-s" style={{ fontSize: 14 }}>{N.slide}</text>
                        <rect x={X(from)} y={56} width={Math.max(8, X(to) - X(from))} height={72} rx={12} fill={cnt >= 10 ? 'color-mix(in srgb, var(--ib-bad) 8%, var(--surface))' : 'var(--surface)'} stroke={cnt >= 10 ? bad : acc} strokeWidth={3} />
                        <text x={X(from) + 12} y={104} className="ib-n" style={{ fontSize: 26, fontWeight: 700, fill: cnt >= 10 ? bad : 'var(--fg)' }}>{`${cnt} / 10`}</text>
                        {latest - 60 < lo ? <text x={X(from) + 6} y={124} className="ib-s" style={{ fontSize: 13 }}>{'←  60 s'}</text> : null}
                      </g>
                    );
                  })()}
                </g>
              )}
            </g>
          )}
          {/* the timeline with the requests as dots */}
          <line x1={50} y1={DY + 28} x2={840} y2={DY + 28} stroke="var(--line-strong)" strokeWidth={4} />
          {(alg === 'bucket' ? [0, 1, 2, 3, 4] : [55, 57, 59, 61, 63]).map((e) => (
            <g key={e}><line x1={X(e)} y1={DY + 24} x2={X(e)} y2={DY + 36} stroke="var(--line-strong)" strokeWidth={2} /><text x={X(e)} y={DY + 58} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{`${e} ${T.sec}`}</text></g>
          ))}
          {dots.map((d) => {
            const vis = smooth(prog(t, clockOf(d.e), clockOf(d.e) + 0.4));
            if (vis < 0.02) return null;
            const good = ok[d.i];
            return (
              <g key={d.i} style={{ opacity: vis }}>
                <circle cx={X(d.e)} cy={DY - d.row * 17 - (1 - vis) * 30} r={8} fill={good ? acc : 'var(--surface)'} stroke={good ? acc : bad} strokeWidth={2.5} />
                <text x={X(d.e)} y={DY - d.row * 17 + 4 - (1 - vis) * 30} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: good ? '#fff' : bad }}>{good ? '✓' : '✗'}</text>
              </g>
            );
          })}
          <text x={50} y={DY + 94} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{`${T.readout(passed, shown.length)}`}</text>
          <text x={50} y={DY + 122} className="ib-s" style={{ fontSize: 14 }}>{alg === 'bucket' ? '' : N.limitOf}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(alg)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
