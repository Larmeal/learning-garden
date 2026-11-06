import { useState } from 'react';
import { MAJOR_KEYS, MINOR_KEYS, SCALES, build, diatonicChord, chordName, nameOf, parseNote, roman, signatureOf } from '../../../lib/music';

// The circle of fifths. Moving clockwise goes up a fifth and adds a sharp (or drops a flat); counter-clockwise goes up a
// fourth and adds a flat. The outer ring is the major keys, the inner ring is their relative minors.

const R_OUT = 138;
const R_IN = 96;
const C = 170;

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string; aria: string; keyAria: (k: string) => string; none: string; clockwise: string;
  head: (k: string, minor: string) => string; noSig: string; sig: (n: number, list: string) => string;
  scale: string; near: (a: string, b: string, k: string) => string;
}> = {
  th: {
    title: 'วงกลมคู่ห้า: กดคีย์เพื่อดูเครื่องหมายและคอร์ด',
    aria: 'วงกลมคู่ห้า',
    keyAria: (k) => `คีย์ ${k} เมเจอร์`,
    none: 'ไม่มี # ♭',
    clockwise: 'ตามเข็ม = ขึ้นหนึ่งคู่ห้า',
    head: (k, minor) => `${k} เมเจอร์ · relative minor คือ ${minor}m`,
    noSig: 'ไม่มีเครื่องหมายแปลงเสียงเลย (โน้ตขาวทั้งหมด)',
    sig: (n, list) => `เครื่องหมายประจำคีย์ ${n} ตัว: ${list}`,
    scale: 'สเกล:',
    near: (a, b, k) => `คีย์ข้างเคียง ${a} และ ${b} ใช้โน้ตร่วมกับ ${k} ถึง 6 จาก 7 ตัว นั่นคือคอร์ด IV และ V (พื้นสี) ที่ใช้ในเพลงเกือบทุกเพลง`,
  },
  en: {
    title: 'Circle of fifths: click a key to see its signature and chords',
    aria: 'Circle of fifths',
    keyAria: (k) => `Key of ${k} major`,
    none: 'no # or ♭',
    clockwise: 'clockwise = up a fifth',
    head: (k, minor) => `${k} major · relative minor is ${minor}m`,
    noSig: 'No accidentals at all (all white keys)',
    sig: (n, list) => `Key signature (${n} ${n === 1 ? 'accidental' : 'accidentals'}): ${list}`,
    scale: 'Scale:',
    near: (a, b, k) => `The neighbor keys ${a} and ${b} share 6 of 7 notes with ${k}. Their roots are the IV and V chords of ${k} (shaded), used in almost every song.`,
  },
};

const pt = (i: number, r: number) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

export default function CircleOfFifths({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [i, setI] = useState(0);
  const key = MAJOR_KEYS[i];
  const sig = signatureOf(key);
  const scale = build(parseNote(key), SCALES.major.pattern);
  const triads = scale.map((_, d) => diatonicChord(scale, d, 3));
  const near = [(i + 11) % 12, (i + 1) % 12];

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="gx-split" style={{ alignItems: 'center' }}>
        <div className="gx-pane" style={{ flex: '0 1 340px' }}>
          <svg viewBox="0 0 340 340" role="img" aria-label={t.aria} style={{ width: '100%', maxWidth: 340, height: 'auto' }}>
            <circle cx={C} cy={C} r={R_OUT + 26} fill="var(--surface-2)" />
            <circle cx={C} cy={C} r={R_IN - 24} fill="var(--surface)" />
            {MAJOR_KEYS.map((k, n) => {
              const o = pt(n, R_OUT);
              const m = pt(n, R_IN);
              const on = n === i;
              const side = near.includes(n);
              return (
                <g key={k} onClick={() => setI(n)} style={{ cursor: 'pointer' }} tabIndex={0} role="button" aria-label={t.keyAria(k)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setI(n)}>
                  <circle cx={o.x} cy={o.y} r="21" fill={on ? 'var(--accent)' : side ? 'var(--accent-soft)' : 'var(--surface)'} stroke={on || side ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth="2" />
                  <text x={o.x} y={o.y + 5} textAnchor="middle" style={{ fill: on ? 'var(--on-accent)' : 'var(--fg)', fontSize: 15, fontWeight: 700 }}>{k}</text>
                  <text x={m.x} y={m.y + 4} textAnchor="middle" style={{ fill: on ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: on ? 700 : 500 }}>{MINOR_KEYS[n]}m</text>
                </g>
              );
            })}
            <text x={C} y={C - 2} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700 }}>{key} = {sig.count === 0 ? t.none : `${sig.count} ${sig.kind === 'sharp' ? '♯' : '♭'}`}</text>
            <text x={C} y={C + 16} textAnchor="middle" className="s">{t.clockwise}</text>
          </svg>
        </div>
        <div className="gx-pane gx-grow">
          <div className="viz-now">
            <strong>{t.head(key, MINOR_KEYS[i])}</strong>
            <span style={{ display: 'block' }}>
              {sig.count === 0 ? t.noSig : t.sig(sig.count, sig.accidentals.join(' '))}
            </span>
            <span style={{ display: 'block' }}>{t.scale} <b>{scale.map(nameOf).join(' ')}</b></span>
          </div>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr>{triads.map((t, d) => <th key={d} style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>{roman(d, t.quality)}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{triads.map((t, d) => <td key={d} style={{ padding: '6px', textAlign: 'center', fontWeight: 700, background: [0, 3, 4].includes(d) ? 'var(--accent-soft)' : undefined, borderRadius: 8 }}>{chordName(t.root, t.quality)}</td>)}</tr>
            </tbody>
          </table>
          <span className="gx-detail">
            {t.near(MAJOR_KEYS[near[0]], MAJOR_KEYS[near[1]], key)}
          </span>
        </div>
      </div>
    </figure>
  );
}
