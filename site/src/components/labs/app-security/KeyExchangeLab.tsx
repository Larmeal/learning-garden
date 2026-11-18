import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';

// Shows:      a Diffie-Hellman key exchange with numbers small enough to follow: p = 23, g = 5. Each side picks a secret with a slider, sends one number
//             (g to the power of its secret, mod p), and both end with the same shared number. An eavesdropper who sees only the two public numbers is
//             shown trying every secret in turn until one fits.
// Because:    "two sides get the same secret without sending it" is the one claim of TLS that nobody believes until they compute it once.
// Control:    two sliders (Alice's and Bob's secret). Every number in the picture is recomputed from them, and so is the eavesdropper's search.
// Conclusion: the shared number is never on the wire. The eavesdropper can only search, and the search is short only because p is tiny.
//
// p=23, g=5, secrets 6 and 15 give 8, 19 and the shared number 2 in exercises/03_tls.py (section 5). With real sizes (X25519, about 2^255 values)
// the search is not possible.

const P = 23, G = 5;
const pw = (b: number, e: number) => { let r = 1; for (let i = 0; i < e; i++) r = (r * b) % P; return r; };

const TEXT: Record<Lang, {
  title: string; alice: string; bob: string; secret: string; pub: string; shared: string; wire: string; eve: string; tries: (n: number) => string; found: (k: number) => string;
  legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; same: string; formula: (a: string, x: number, y: number) => string; caption: string; real: string;
}> = {
  th: {
    title: 'เลื่อนความลับของ Alice และของ Bob แล้วดูว่าทั้งสองฝั่งได้เลขร่วมตัวเดียวกัน โดยที่เลขนั้นไม่เคยผ่านสาย และดูว่าคนดักฟังต้องลองกี่ครั้ง',
    alice: 'Alice', bob: 'Bob', secret: 'ความลับของตัวเอง', pub: 'เลขที่ส่งออกไป', shared: 'เลขร่วม', wire: 'บนสายเห็นแค่ p=23, g=5 และสองเลขนี้',
    eve: 'คนดักฟัง', tries: (n) => `ลองความลับ 1, 2, 3 ... จนถึง ${n}`, found: (k) => `เจอที่ ${k} (เพราะ p เล็กมาก)`,
    legend: [{ kind: 'new', text: 'เลขที่ส่งผ่านสาย' }, { kind: 'use', text: 'เลขที่อยู่ในเครื่องตัวเอง' }],
    same: 'ตรงกัน', formula: (a, x, y) => `${a}^${x} mod 23 = ${y}`,
    caption: 'p=23, g=5, ความลับ 6 กับ 15 ได้เลขที่ส่ง 8 กับ 19 และเลขร่วม 2 ตามแบบฝึก 03 ส่วนที่ขยับด้วยแถบเลื่อนคำนวณสดในหน้านี้ TLS จริงใช้ X25519 ที่มีความลับราว 2^255 แบบ คนดักฟังลองทีละตัวไม่ไหว',
    real: 'ถ้า p ใหญ่ราว 2^255 การไล่ลองแบบนี้ทำไม่ได้ในทางปฏิบัติ',
  },
  en: {
    title: "Slide Alice's and Bob's secrets and see both sides end up with the same shared number, which never crossed the wire, and how many tries an eavesdropper needs",
    alice: 'Alice', bob: 'Bob', secret: 'own secret', pub: 'number sent out', shared: 'shared number', wire: 'The wire shows only p=23, g=5 and these two numbers',
    eve: 'Eavesdropper', tries: (n) => `tries secrets 1, 2, 3 ... up to ${n}`, found: (k) => `found at ${k} (only because p is tiny)`,
    legend: [{ kind: 'new', text: 'a number sent over the wire' }, { kind: 'use', text: 'a number kept on its own side' }],
    same: 'equal', formula: (a, x, y) => `${a}^${x} mod 23 = ${y}`,
    caption: 'p=23, g=5, secrets 6 and 15 give the sent numbers 8 and 19 and the shared number 2, as in exercise 03. What moves with the sliders is computed live on this page. Real TLS uses X25519, with about 2^255 possible secrets, so trying them one by one is impossible.',
    real: 'With p around 2^255, this kind of search is not possible in practice',
  },
};

export default function KeyExchangeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [a, setA] = useState(6);
  const [b, setB] = useState(15);
  const A = pw(G, a), B = pw(G, b);
  const sa = pw(B, a), sb = pw(A, b);
  // the eavesdropper tries k = 1, 2, 3 ... until g^k equals the number Alice sent
  let k = 1;
  while (pw(G, k) !== A && k < P) k++;
  const box = (x: number, y: number, w: number, h: number, cls: string, label: string, value: string | number, sub?: string) => (
    <g>
      <rect className={cls} x={x} y={y} width={w} height={h} rx={10} />
      <text x={x + 12} y={y + 24} className="ib-s">{label}</text>
      <text x={x + w - 12} y={y + h - 14} textAnchor="end" className="ib-n" style={{ fontWeight: 700, fontSize: 30 }}>{value}</text>
      {sub && <text x={x + 12} y={y + h - 14} className="ib-m" style={{ fontSize: 14 }}>{sub}</text>}
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <label className="ib-lbl">{`${T.alice}: ${T.secret} = ${a}`}{' '}
          <input type="range" min={1} max={22} value={a} onChange={(e) => setA(Number(e.target.value))} aria-label={`${T.alice} ${T.secret}`} />
        </label>
        <label className="ib-lbl">{`${T.bob}: ${T.secret} = ${b}`}{' '}
          <input type="range" min={1} max={22} value={b} onChange={(e) => setB(Number(e.target.value))} aria-label={`${T.bob} ${T.secret}`} />
        </label>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          <text x={20} y={34} className="ib-n" style={{ fontWeight: 700, fontSize: 20 }}>{T.alice}</text>
          <text x={860} y={34} textAnchor="end" className="ib-n" style={{ fontWeight: 700, fontSize: 20 }}>{T.bob}</text>
          {box(20, 50, 200, 80, 'ib-use', T.secret, a)}
          {box(660, 50, 200, 80, 'ib-use', T.secret, b)}
          {box(20, 150, 200, 80, 'ib-new', T.pub, A, T.formula('5', a, A))}
          {box(660, 150, 200, 80, 'ib-new', T.pub, B, T.formula('5', b, B))}
          {/* the wire */}
          <line x1={220} y1={190} x2={660} y2={190} className="ib-line" style={{ strokeWidth: 3, strokeDasharray: '7 6' }} />
          <text x={440} y={170} textAnchor="middle" className="ib-n">{`${A} →`}</text>
          <text x={440} y={218} textAnchor="middle" className="ib-n">{`← ${B}`}</text>
          <text x={440} y={252} textAnchor="middle" className="ib-s">{T.wire}</text>
          {box(20, 262, 200, 80, 'ib-use', T.shared, sa, T.formula(String(B), a, sa))}
          {box(660, 262, 200, 80, 'ib-use', T.shared, sb, T.formula(String(A), b, sb))}
          <text x={440} y={316} textAnchor="middle" className={sa === sb ? 'ib-ok ib-n' : 'ib-bad ib-n'} style={{ fontWeight: 700, fontSize: 20 }}>{`${sa} = ${sb} ✓ ${T.same}`}</text>
          {/* the eavesdropper */}
          <rect x={20} y={364} width={840} height={62} rx={10} style={{ fill: 'var(--surface)', stroke: 'var(--ib-bad)', strokeWidth: 2.5 }} />
          <text x={36} y={392} className="ib-n" style={{ fontWeight: 700 }}>{`${T.eve}: ${T.tries(k)}`}</text>
          <text x={36} y={416} className="ib-s">{`${T.found(k)}. ${T.real}`}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
