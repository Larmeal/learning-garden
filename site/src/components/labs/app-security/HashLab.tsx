import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { bitDiff, hex, sha256, utf8 } from './sha256';

// Shows:      the real SHA-256 of two texts as 16 by 16 grids of 256 bits, and a third grid that lights the bits that differ.
// Because:    "one changed letter changes about half the bits" is a number until you see the second grid look like a different picture.
// Control:    the two text boxes (the digest is computed in the browser as you type), "change one letter" and "make B equal A".
// Conclusion: the same input always gives the same 256 bits, and the smallest change gives a digest that looks unrelated (about half the bits differ).
//
// The digests of the default texts, and the 133 differing bits, are the numbers of exercises/02_crypto_basics.py. The hash is
// written in sha256.ts and checked against it and against Node by subjects/app-security/code/verify_labs.mts.

const TEXT: Record<Lang, { title: string; a: string; b: string; one: string; same: string; reset: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; diffTitle: string; readout: (n: number) => string; same2: string; caption: string; len: string }> = {
  th: {
    title: 'พิมพ์ข้อความสองชุดแล้วดู SHA-256 ของแต่ละชุดเป็นตาราง 256 บิต ลองเปลี่ยนตัวอักษรตัวเดียวแล้วดูว่าตารางที่สามสว่างตรงไหน',
    a: 'ข้อความ A', b: 'ข้อความ B', one: 'เปลี่ยนตัวอักษรท้ายของ B หนึ่งตัว', same: 'ให้ B เท่ากับ A', reset: 'ตัวอย่างเริ่มต้น',
    legend: [{ kind: 'use', text: 'บิตเป็น 1' }, { kind: 'node', text: 'บิตเป็น 0' }, { kind: 'new', text: 'บิตที่ต่างกัน' }],
    diffTitle: 'บิตที่ต่างกัน', readout: (n) => `ต่างกัน ${n} จาก 256 บิต (${Math.round((n / 256) * 100)}%)`, same2: 'ข้อความเท่ากัน ได้ค่าเดิมเป๊ะ ไม่มีบิตไหนต่าง',
    caption: 'ค่าเริ่มต้น "pay bob 100" กับ "pay bob 900" ต่างกัน 133 บิตตามที่แบบฝึก 02 พิมพ์ SHA-256 ในแล็บนี้เขียนเองด้วย TypeScript และตรวจกับ Node ใน verify_labs.mts',
    len: 'ความยาวข้อความ',
  },
  en: {
    title: 'Type two texts and see the SHA-256 of each as a 256 bit grid. Change one letter and see where the third grid lights up',
    a: 'Text A', b: 'Text B', one: 'Change the last letter of B', same: 'Make B equal to A', reset: 'Start again',
    legend: [{ kind: 'use', text: 'bit is 1' }, { kind: 'node', text: 'bit is 0' }, { kind: 'new', text: 'bit that differs' }],
    diffTitle: 'bits that differ', readout: (n) => `${n} of 256 bits differ (${Math.round((n / 256) * 100)}%)`, same2: 'the texts are equal, so the digests are identical and no bit differs',
    caption: 'The default texts "pay bob 100" and "pay bob 900" differ in 133 bits, the number exercise 02 prints. The SHA-256 here is written in TypeScript and checked against Node in verify_labs.mts.',
    len: 'text length',
  },
};

const CELL = 17;
const GX = [16, 304, 592];

function bits(d: Uint8Array): number[] {
  const out: number[] = [];
  d.forEach((x) => { for (let i = 7; i >= 0; i--) out.push((x >> i) & 1); });
  return out;
}

export default function HashLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [a, setA] = useState('pay bob 100');
  const [b, setB] = useState('pay bob 900');
  const da = sha256(utf8(a));
  const db = sha256(utf8(b));
  const ba = bits(da), bb = bits(db);
  const n = bitDiff(da, db);
  const ha = hex(da), hb = hex(db);
  const grid = (x0: number, vals: number[], diff?: number[]) => (
    <g>
      {vals.map((v, i) => {
        const cx = x0 + (i % 16) * CELL, cy = 78 + Math.floor(i / 16) * CELL;
        const isDiff = diff ? diff[i] === 1 : false;
        const cls = diff ? (isDiff ? 'ib-new' : 'ib-node') : v ? 'ib-use' : 'ib-node';
        return <rect key={i} className={cls} x={cx} y={cy} width={CELL - 2} height={CELL - 2} rx={3} style={isDiff ? { fill: 'var(--ib-bad)', stroke: 'var(--ib-bad)' } : v && !diff ? { fill: 'var(--accent)', stroke: 'var(--accent)' } : undefined} />;
      })}
    </g>
  );
  const diffBits = ba.map((v, i) => (v !== bb[i] ? 1 : 0));
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <label className="ib-lbl">{T.a}{' '}
          <input type="text" value={a} maxLength={40} onChange={(e) => setA(e.target.value)} style={{ font: 'inherit', padding: '4px 8px', width: '14em' }} />
        </label>
        <label className="ib-lbl">{T.b}{' '}
          <input type="text" value={b} maxLength={40} onChange={(e) => setB(e.target.value)} style={{ font: 'inherit', padding: '4px 8px', width: '14em' }} />
        </label>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={() => setB(a.length ? a.slice(0, -1) + String.fromCharCode(a.charCodeAt(a.length - 1) ^ 1) : 'x')}>{T.one}</button>
        <button type="button" className="btn sm" onClick={() => setB(a)}>{T.same}</button>
        <button type="button" className="btn sm" onClick={() => { setA('pay bob 100'); setB('pay bob 900'); }}>{T.reset}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          {[0, 1, 2].map((k) => (
            <text key={k} x={GX[k]} y={40} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{k === 0 ? T.a : k === 1 ? T.b : T.diffTitle}</text>
          ))}
          <text x={GX[0]} y={62} className="ib-s">{`${T.len}: ${utf8(a).length}`}</text>
          <text x={GX[1]} y={62} className="ib-s">{`${T.len}: ${utf8(b).length}`}</text>
          {grid(GX[0], ba)}
          {grid(GX[1], bb)}
          {grid(GX[2], diffBits, diffBits)}
          {[ha, hb].map((h, k) => (
            <g key={k}>
              <text x={GX[k]} y={382} className="ib-m" style={{ fontSize: 14 }}>{h.slice(0, 32)}</text>
              <text x={GX[k]} y={402} className="ib-m" style={{ fontSize: 14 }}>{h.slice(32)}</text>
            </g>
          ))}
          <text x={GX[2]} y={382} className="ib-n" style={{ fontWeight: 700, fontSize: 24 }}>{n}</text>
          <text x={GX[2]} y={406} className="ib-s">{n === 0 ? T.same2 : T.readout(n)}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
