import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import { Envelope, Figure } from './bits';

// Shows:      a Diffie-Hellman key exchange with numbers small enough to follow (p = 23, g = 5). Alice and Bob each keep a secret number inside their own box, send one number across a
//             wire that anyone can read, and each mixes the number they received with their own secret. Both end with the same colour. Below, an eavesdropper who has seen only the two
//             numbers on the wire walks a row of 22 tiles (every possible secret) until one tile gives Alice's number.
// Because:    "two sides get the same secret without ever sending it" is the claim of TLS that nobody believes until they compute it once. The box that never opens and the matching colours
//             make it visible, and the row of tiles shows what an eavesdropper has to do, and why that row is short only because p is tiny.
// Control:    two sliders (Alice's and Bob's secret). Every number, every colour and the length of the eavesdropper's walk are recomputed from them.
// Conclusion: the shared number is never on the wire. The eavesdropper can only search, and the search is short only because p is tiny.
//
// p=23, g=5, secrets 6 and 15 give 8, 19 and the shared number 2 in exercises/03_tls.py (section 5). With real sizes (X25519, about 2^255 values) the row could not be walked.
// The colour of a number is only a drawing aid: the same number always has the same colour.

const P = 23, G = 5;
const pw = (b: number, e: number) => { let r = 1; for (let i = 0; i < e; i++) r = (r * b) % P; return r; };
const hue = (n: number) => `hsl(${Math.round((n / P) * 360)} 62% 55%)`;

const TEXT: Record<Lang, {
  title: string; alice: string; bob: string; secret: string; pub: string; shared: string; stays: string; wire: string; eve: string; walk: string; tries: (k: number) => string; found: string;
  legend: { color: string; text: string; ring?: boolean }[]; same: string; caption: string; real: string; mixes: string; sentOut: string; formula: (a: string, x: number, y: number) => string; row: string;
}> = {
  th: {
    title: 'เลื่อนความลับของ Alice และของ Bob แล้วดูว่าทั้งสองคนได้เลขร่วมตัวเดียวกัน โดยที่เลขนั้นไม่เคยผ่านสาย และดูว่าคนดักฟังต้องเดินผ่านกี่ช่องกว่าจะเจอ',
    alice: 'Alice', bob: 'Bob', secret: 'ความลับของตัวเอง', pub: 'เลขที่ส่งออกไป', shared: 'เลขร่วม', stays: 'อยู่ในเครื่องนี้เท่านั้น',
    wire: 'สายที่ใครก็อ่านได้', eve: 'คนดักฟัง', walk: 'เห็นแค่เลขสองตัวบนสาย จึงต้องลองความลับทีละช่อง', tries: (k) => `ลองไป ${k} ช่องจาก 22`, found: 'ช่องที่ได้เลขเท่ากับของ Alice',
    legend: [{ color: 'var(--accent)', text: 'ผ่านสายให้ใครก็เห็น' }, { color: 'var(--muted)', text: 'ไม่ออกจากเครื่อง', ring: true }],
    same: 'สีเดียวกัน คือเลขร่วมตัวเดียวกัน', mixes: 'เอาเลขที่ได้รับมาผสมกับความลับตัวเอง', sentOut: 'ผสมความลับกับ g แล้วส่ง', formula: (a, x, y) => `${a}^${x} mod 23 = ${y}`, row: 'ความลับที่เป็นไปได้ 1 ถึง 22',
    real: 'ถ้า p ใหญ่ราว 2^255 แถวนี้จะยาวเกินกว่าจะเดินผ่านหมดได้',
    caption: 'p=23, g=5, ความลับ 6 กับ 15 ได้เลขที่ส่ง 8 กับ 19 และเลขร่วม 2 ตามแบบฝึก 03 ส่วนที่ขยับด้วยแถบเลื่อนคำนวณสดในหน้านี้ สีของแต่ละเลขเป็นแค่ตัวช่วยดู เลขเดียวกันได้สีเดียวกัน TLS จริงใช้ X25519 ที่มีความลับราว 2^255 แบบ คนดักฟังลองทีละตัวไม่ไหว',
  },
  en: {
    title: "Slide Alice's and Bob's secrets and see both end up with the same shared number, which never crossed the wire, and how many tiles an eavesdropper has to walk before he finds one",
    alice: 'Alice', bob: 'Bob', secret: 'own secret', pub: 'number sent out', shared: 'shared number', stays: 'stays in this box',
    wire: 'a wire that anyone can read', eve: 'Eavesdropper', walk: 'He sees only the two numbers on the wire, so he tries the secrets one tile at a time', tries: (k) => `${k} tiles tried of 22`, found: "the tile that gives Alice's number",
    legend: [{ color: 'var(--accent)', text: 'crosses the wire, anyone sees it' }, { color: 'var(--muted)', text: 'never leaves the box', ring: true }],
    same: 'the same colour: the same shared number', mixes: 'mixes the number received with its own secret', sentOut: 'mixes the secret with g and sends it', formula: (a, x, y) => `${a}^${x} mod 23 = ${y}`, row: 'the possible secrets, 1 to 22',
    real: 'With p around 2^255 this row is far too long to walk',
    caption: 'p=23, g=5, secrets 6 and 15 give the sent numbers 8 and 19 and the shared number 2, as in exercise 03. What moves with the sliders is computed live on this page. The colour of a number is only a drawing aid: the same number always has the same colour. Real TLS uses X25519, with about 2^255 possible secrets, so trying them one by one is impossible.',
  },
};

export default function KeyExchangeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [a, setA] = useState(6);
  const [b, setB] = useState(15);
  const A = pw(G, a), B = pw(G, b);
  const sa = pw(B, a), sb = pw(A, b);
  let k = 1;
  while (pw(G, k) !== A && k < P) k++;
  const acc = 'var(--accent)', bad = 'var(--ib-bad)';
  const swatch = (x: number, y: number, n: number, r = 22) => (
    <g>
      <circle cx={x} cy={y} r={r} fill={hue(n)} stroke="var(--line-strong)" strokeWidth={2} />
      <text x={x} y={y + 7} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: '#fff', paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 3 }}>{n}</text>
    </g>
  );
  // one side: the private box with the secret, the number sent, and the shared number
  const side = (x: number, who: string, secret: number, out: number, got: number, shared: number, left: boolean) => (
    <g>
      <rect x={x} y={14} width={270} height={316} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2.5} />
      <Figure cx={x + 26} cy={40} r={11} />
      <text x={x + 48} y={48} className="ib-n" style={{ fontWeight: 700, fontSize: 19 }}>{who}</text>
      <rect x={x + 12} y={66} width={246} height={64} rx={10} fill="none" stroke="var(--muted)" strokeWidth={2.5} strokeDasharray="7 5" />
      <text x={x + 24} y={88} className="ib-s" style={{ fontSize: 13.5 }}>{`🔒 ${T.secret}`}</text>
      <text x={x + 24} y={116} className="ib-m" style={{ fontSize: 14 }}>{T.stays}</text>
      <text x={x + 232} y={116} textAnchor="end" className="ib-n" style={{ fontWeight: 700, fontSize: 30 }}>{secret}</text>
      <text x={x + 24} y={160} className="ib-s" style={{ fontSize: 13.5 }}>{T.sentOut}</text>
      {swatch(x + (left ? 224 : 46), 196, out)}
      <text x={x + (left ? 24 : 82)} y={200} className="ib-m" style={{ fontSize: 14 }}>{T.formula('5', secret, out)}</text>
      <line x1={x + 12} y1={236} x2={x + 258} y2={236} stroke="var(--line)" strokeWidth={1.5} />
      <text x={x + 24} y={258} className="ib-s" style={{ fontSize: 13.5 }}>{T.mixes}</text>
      {swatch(x + (left ? 224 : 46), 292, shared)}
      <rect x={left ? x + 196 : x + 18} y={266} width={56} height={52} rx={26} fill="none" stroke="var(--muted)" strokeWidth={2.5} strokeDasharray="5 4" />
      <text x={x + (left ? 24 : 82)} y={296} className="ib-m" style={{ fontSize: 14 }}>{T.formula(String(got), secret, shared)}</text>
    </g>
  );
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <label className="ib-lbl">{`${T.alice}: ${T.secret} = ${a}`}{' '}
          <input type="range" min={1} max={22} value={a} onChange={(e) => setA(Number(e.target.value))} aria-label={`${T.alice} ${T.secret}`} />
        </label>
        <label className="ib-lbl">{`${T.bob}: ${T.secret} = ${b}`}{' '}
          <input type="range" min={1} max={22} value={b} onChange={(e) => setB(Number(e.target.value))} aria-label={`${T.bob} ${T.secret}`} />
        </label>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 640" role="img" aria-label={T.title}>
          {side(14, T.alice, a, A, B, sa, true)}
          {side(596, T.bob, b, B, A, sb, false)}
          {/* the wire between them: only the two sent numbers cross */}
          <rect x={296} y={14} width={288} height={316} rx={14} fill="color-mix(in srgb, var(--accent) 7%, var(--surface))" stroke={acc} strokeWidth={2} strokeDasharray="8 6" />
          <text x={440} y={40} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.wire}</text>
          <text x={440} y={64} textAnchor="middle" className="ib-m" style={{ fontSize: 14 }}>p = 23, g = 5</text>
          <line x1={304} y1={146} x2={576} y2={146} stroke={acc} strokeWidth={3} />
          <path d="M576,146 l-12,-7 l0,14 z" fill={acc} />
          <Envelope cx={372} cy={146} w={46} color={acc} />
          {swatch(480, 146, A, 18)}
          <text x={440} y={108} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{`${T.alice} → ${T.bob}`}</text>
          <line x1={304} y1={236} x2={576} y2={236} stroke={acc} strokeWidth={3} />
          <path d="M304,236 l12,-7 l0,14 z" fill={acc} />
          <Envelope cx={508} cy={236} w={46} color={acc} />
          {swatch(400, 236, B, 18)}
          <text x={440} y={198} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{`${T.bob} → ${T.alice}`}</text>
          <line x1={252} y1={292} x2={628} y2={292} stroke={sa === sb ? acc : bad} strokeWidth={3} strokeDasharray="4 6" />
          <text x={440} y={284} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 15, fill: sa === sb ? acc : bad }}>{sa === sb ? `${sa} = ${sb}` : `${sa} ≠ ${sb}`}</text>
          <text x={440} y={316} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{sa === sb ? T.same : ''}</text>
          {/* the eavesdropper walks the row of every possible secret */}
          <rect x={14} y={350} width={852} height={278} rx={14} fill="var(--surface)" stroke={bad} strokeWidth={2.5} />
          <Figure cx={40} cy={378} r={11} fill={bad} />
          <text x={62} y={386} className="ib-n" style={{ fontWeight: 700, fontSize: 18, fill: bad }}>{T.eve}</text>
          <text x={150} y={386} className="ib-s" style={{ fontSize: 14 }}>{T.walk}</text>
          <text x={28} y={426} className="ib-s" style={{ fontSize: 13.5 }}>{T.row}</text>
          {Array.from({ length: 22 }, (_, i) => {
            const kk = i + 1;
            const v = pw(G, kk);
            const done = kk <= k;
            const hit = kk === k;
            const x = 26 + i * 38;
            return (
              <g key={kk} opacity={done ? 1 : 0.35}>
                <rect x={x} y={440} width={34} height={86} rx={7} fill="var(--surface)" stroke={hit ? acc : 'var(--line-strong)'} strokeWidth={hit ? 4 : 1.5} />
                <text x={x + 17} y={461} textAnchor="middle" className="ib-n" style={{ fontSize: 14, fontWeight: 700 }}>{kk}</text>
                <circle cx={x + 17} cy={494} r={13} fill={hue(v)} stroke="var(--line-strong)" strokeWidth={1.2} />
                <text x={x + 17} y={499} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: '#fff', paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 2.5 }}>{v}</text>
                {done && !hit ? <path d={`M${x + 8},${512} L${x + 26},${520}`} stroke={bad} strokeWidth={2.5} /> : null}
                {hit ? <text x={x + 17} y={521} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: acc }}>✓</text> : null}
              </g>
            );
          })}
          <text x={28} y={556} className="ib-n" style={{ fontSize: 15, fontWeight: 700 }}>{`${T.tries(k)}  ·  ${T.found}: ${k} → ${A}`}</text>
          <text x={28} y={586} className="ib-s" style={{ fontSize: 14 }}>{`5^k mod 23, ${lang === 'th' ? 'ตัวเลขในวงกลมคือผลของแต่ละช่อง' : 'the number in each circle is the result of that tile'}`}</text>
          <text x={28} y={614} className="ib-n" style={{ fontSize: 15, fill: bad, fontWeight: 700 }}>{T.real}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
