import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './dosData.json';

// Shows:      requests arriving over time, and which a limiter lets through. A token bucket (a burst of 8, then 4 more after 3 seconds) and two window counters on the same
//             edge case (10 requests at second 55 and 10 at second 61): the fixed window lets all 20 through, the sliding window lets only 10.
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
  title: string; pick: string; algs: Record<Alg, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; allowed: string; refused: string; level: string; window: string; edge: string; caption: string; marks: (a: Alg) => Mark[];
  readout: (ok: number, total: number) => string; sec: string;
}> = {
  th: {
    title: 'เลือกวิธีจำกัดอัตรา แล้วกดเล่นดูคำขอที่ทยอยเข้ามา ว่าคำขอไหนผ่านและคำขอไหนถูกปฏิเสธ',
    pick: 'ตัวจำกัด', algs: { bucket: 'Token Bucket', fixed: 'Fixed Window', sliding: 'Sliding Window' },
    legend: [{ kind: 'new', text: 'ผ่าน' }, { kind: 'use', text: 'ถูกปฏิเสธ' }], allowed: 'ผ่าน', refused: 'ปฏิเสธ', level: 'Token ที่เหลือ', window: 'ขอบของ Window (วินาทีที่ 60)', edge: 'ช่วงเวลา 60 วินาทีที่เลื่อนไปตามคำขอ', sec: 'วินาที',
    readout: (ok, total) => `ผ่าน ${ok} จาก ${total} คำขอ`,
    caption: 'เวลาของคำขอและผลของแต่ละวิธีมาจากแบบฝึก 12 (Bucket: ความจุ 5 เติมวินาทีละหนึ่ง, Window: จำกัด 10 ต่อ 60 วินาที) ระดับ Token ที่เห็นใต้กราฟคำนวณในหน้านี้ด้วยกฎเดียวกัน',
    marks: (a) => a === 'bucket'
      ? [{ at: 0, name: 'ระเบิด', title: 'คำขอ 8 ครั้งพร้อมกัน', text: 'Bucket เต็ม 5 Token จึงผ่านห้าครั้งแรกและปฏิเสธสามครั้งหลัง' }, { at: 3.2, name: 'เติมแล้ว', title: 'สามวินาทีต่อมา Token กลับมา 3 ตัว', text: 'คำขอสี่ครั้งใหม่ ผ่านสามครั้ง และปฏิเสธหนึ่งครั้ง' }]
      : [{ at: 0, name: 'นาทีแรก', title: '10 คำขอที่วินาที 55', text: 'ยังไม่เกินขีดจำกัด 10 ต่อนาที จึงผ่านทั้งหมด' }, { at: 3.2, name: 'ข้ามขอบ', title: '10 คำขอที่วินาที 61', text: a === 'fixed' ? 'Window ใหม่เริ่มนับจากศูนย์ ผ่านทั้ง 10 รวมเป็น 20 ใน 6 วินาที' : 'Window ที่เลื่อนไปยังนับ 10 ครั้งก่อนหน้า จึงปฏิเสธทั้งหมด เหลือผ่านแค่ 10' }]
  },
  en: {
    title: 'Pick a rate limiter and press play to watch the requests come in, which pass and which are refused',
    pick: 'Limiter', algs: { bucket: 'Token bucket', fixed: 'Fixed window', sliding: 'Sliding window' },
    legend: [{ kind: 'new', text: 'allowed' }, { kind: 'use', text: 'refused' }], allowed: 'allowed', refused: 'refused', level: 'tokens left', window: 'the edge of the window (second 60)', edge: 'the 60 second window that moves with the requests', sec: 's',
    readout: (ok, total) => `${ok} of ${total} requests allowed`,
    caption: 'The times of the requests and the result of each method come from exercise 12 (bucket: capacity 5, one token refilled per second; windows: 10 per 60 seconds). The token level shown under the chart is computed on this page with the same rule.',
    marks: (a) => a === 'bucket'
      ? [{ at: 0, name: 'burst', title: '8 requests at once', text: 'The bucket holds 5 tokens, so the first five pass and the last three are refused' }, { at: 3.2, name: 'refilled', title: 'Three seconds later 3 tokens are back', text: 'Four new requests: three pass and one is refused' }]
      : [{ at: 0, name: 'first minute', title: '10 requests at second 55', text: 'Still within the limit of 10 a minute, so all pass' }, { at: 3.2, name: 'the edge', title: '10 requests at second 61', text: a === 'fixed' ? 'A new window starts counting from zero, so all 10 pass, 20 within 6 seconds' : 'The moving window still counts the earlier 10, so all of these are refused and only 10 pass' }],
  },
};

const DUR = 6.5;

export default function RateLimitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [alg, setAlg] = useState<Alg>('bucket');
  const clock = useClock(DUR);
  const { t } = clock;
  const ev = alg === 'bucket' ? BUCKET.events : EDGE.events;
  const ok = alg === 'bucket' ? BUCKET.allowed : alg === 'fixed' ? EDGE.fixed : EDGE.sliding;
  const t0 = Math.min(...ev), t1 = Math.max(...ev);
  const clockOf = (e: number) => 0.6 + ((e - t0) / (t1 - t0)) * 3.2;
  const X = (e: number) => 60 + ((e - (alg === 'bucket' ? -0.5 : 53)) / (alg === 'bucket' ? 4.5 : 10)) * 760;
  // stack the dots of the same time one above the other
  const seen: Record<string, number> = {};
  const dots = ev.map((e, i) => { const k = String(e); const row = seen[k] ?? 0; seen[k] = row + 1; return { e, i, row }; });
  // token level for the bucket (same rule as the exercise)
  const level: { at: number; v: number }[] = [];
  if (alg === 'bucket') {
    let tokens = 5, last = 0;
    ev.forEach((e, i) => { tokens = Math.min(5, tokens + (e - last) * 1); last = e; if (ok[i]) tokens -= 1; level.push({ at: e, v: tokens }); });
  }
  const shown = dots.filter((d) => t >= clockOf(d.e));
  const passed = shown.filter((d) => ok[d.i]).length;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {(['bucket', 'fixed', 'sliding'] as Alg[]).map((a) => <button key={a} type="button" aria-pressed={alg === a} onClick={() => { setAlg(a); clock.restart(); }}>{T.algs[a]}</button>)}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          <line x1={50} y1={300} x2={840} y2={300} className="ib-line" style={{ strokeWidth: 3 }} />
          {(alg === 'bucket' ? [0, 1, 2, 3, 4] : [55, 57, 59, 61, 63]).map((e) => (
            <g key={e}><line x1={X(e)} y1={296} x2={X(e)} y2={308} className="ib-line" /><text x={X(e)} y={330} textAnchor="middle" className="ib-s">{`${e} ${T.sec}`}</text></g>
          ))}
          {alg !== 'bucket' && (
            <g>
              <line x1={X(60)} y1={40} x2={X(60)} y2={300} style={{ stroke: 'var(--accent)', strokeWidth: 2.5, strokeDasharray: '6 5' }} />
              <text x={X(60)} y={32} textAnchor="middle" className="ib-n">{alg === 'fixed' ? T.window : T.edge}</text>
              {alg === 'sliding' && <rect x={X(55) - 8} y={44} width={X(61) - X(55) + 16} height={18} rx={8} className="ib-zone" />}
            </g>
          )}
          {dots.map((d) => {
            const vis = smooth(prog(t, clockOf(d.e), clockOf(d.e) + 0.4));
            if (vis < 0.02) return null;
            const good = ok[d.i];
            return (
              <g key={d.i} style={{ opacity: vis }}>
                <circle cx={X(d.e) + (d.row % 2) * 0} cy={280 - d.row * 22 - (1 - vis) * 30} r={9} className={good ? 'ib-new' : 'ib-node'} style={good ? undefined : { stroke: 'var(--ib-bad)', strokeWidth: 2.5 }} />
                <text x={X(d.e)} y={285 - d.row * 22 - (1 - vis) * 30} textAnchor="middle" className={good ? 'ib-white' : 'ib-bad'} style={{ fontSize: 13, fontWeight: 700 }}>{good ? '✓' : '✗'}</text>
              </g>
            );
          })}
          {alg === 'bucket' && (
            <g>
              <text x={50} y={362} className="ib-s">{T.level}</text>
              {level.map((l, k) => (shown.some((d) => d.i === k) ? <text key={k} x={X(l.at) + (k % 5 === 0 ? 0 : 0)} y={382 + (k % 2) * 0} textAnchor="middle" className="ib-m" style={{ fontSize: 14, opacity: 0.0 }}>{l.v}</text> : null))}
              {Array.from(new Set(ev)).map((e) => {
                const idxs = ev.map((x, i) => (x === e ? i : -1)).filter((i) => i >= 0);
                const last = idxs[idxs.length - 1];
                return shown.some((d) => d.i === last) ? <text key={e} x={X(e)} y={390} textAnchor="middle" className="ib-n" style={{ fontWeight: 700 }}>{level[last].v.toFixed(0)}</text> : null;
              })}
            </g>
          )}
          <text x={850} y={30} textAnchor="end" className="ib-n" style={{ fontWeight: 700 }}>{T.readout(passed, shown.length)}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(alg)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
