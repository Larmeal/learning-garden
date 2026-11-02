import { useState } from 'react';
import { MAJOR_KEYS, MINOR_KEYS, SCALES, build, diatonicChord, chordName, nameOf, parseNote, roman, signatureOf } from '../../../lib/music';

// The circle of fifths. Moving clockwise goes up a fifth and adds a sharp (or drops a flat); counter-clockwise goes up a
// fourth and adds a flat. The outer ring is the major keys, the inner ring is their relative minors.

const R_OUT = 138;
const R_IN = 96;
const C = 170;

const pt = (i: number, r: number) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

export default function CircleOfFifths() {
  const [i, setI] = useState(0);
  const key = MAJOR_KEYS[i];
  const sig = signatureOf(key);
  const scale = build(parseNote(key), SCALES.major.pattern);
  const triads = scale.map((_, d) => diatonicChord(scale, d, 3));
  const near = [(i + 11) % 12, (i + 1) % 12];

  return (
    <figure className="viz">
      <div className="viz-title">วงกลมคู่ห้า: กดคีย์เพื่อดูเครื่องหมายและคอร์ด</div>
      <div className="gx-split" style={{ alignItems: 'center' }}>
        <div className="gx-pane" style={{ flex: '0 1 340px' }}>
          <svg viewBox="0 0 340 340" role="img" aria-label="วงกลมคู่ห้า" style={{ width: '100%', maxWidth: 340, height: 'auto' }}>
            <circle cx={C} cy={C} r={R_OUT + 26} fill="var(--surface-2)" />
            <circle cx={C} cy={C} r={R_IN - 24} fill="var(--surface)" />
            {MAJOR_KEYS.map((k, n) => {
              const o = pt(n, R_OUT);
              const m = pt(n, R_IN);
              const on = n === i;
              const side = near.includes(n);
              return (
                <g key={k} onClick={() => setI(n)} style={{ cursor: 'pointer' }} tabIndex={0} role="button" aria-label={`คีย์ ${k} เมเจอร์`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setI(n)}>
                  <circle cx={o.x} cy={o.y} r="21" fill={on ? 'var(--accent)' : side ? 'var(--accent-soft)' : 'var(--surface)'} stroke={on || side ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth="2" />
                  <text x={o.x} y={o.y + 5} textAnchor="middle" style={{ fill: on ? 'var(--on-accent)' : 'var(--fg)', fontSize: 15, fontWeight: 700 }}>{k}</text>
                  <text x={m.x} y={m.y + 4} textAnchor="middle" style={{ fill: on ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: on ? 700 : 500 }}>{MINOR_KEYS[n]}m</text>
                </g>
              );
            })}
            <text x={C} y={C - 2} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700 }}>{key} = {sig.count === 0 ? 'ไม่มี # ♭' : `${sig.count} ${sig.kind === 'sharp' ? '♯' : '♭'}`}</text>
            <text x={C} y={C + 16} textAnchor="middle" className="s">ตามเข็ม = ขึ้นหนึ่งคู่ห้า</text>
          </svg>
        </div>
        <div className="gx-pane gx-grow">
          <div className="viz-now">
            <strong>{key} เมเจอร์ · relative minor คือ {MINOR_KEYS[i]}m</strong>
            <span style={{ display: 'block' }}>
              {sig.count === 0 ? 'ไม่มีเครื่องหมายแปลงเสียงเลย (โน้ตขาวทั้งหมด)' : `เครื่องหมายประจำคีย์ ${sig.count} ตัว: ${sig.accidentals.join(' ')}`}
            </span>
            <span style={{ display: 'block' }}>สเกล: <b>{scale.map(nameOf).join(' ')}</b></span>
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
            คีย์ข้างเคียง {MAJOR_KEYS[near[0]]} และ {MAJOR_KEYS[near[1]]} ใช้โน้ตร่วมกับ {key} ถึง 6 จาก 7 ตัว นั่นคือคอร์ด IV และ V (พื้นสี) ที่ใช้ในเพลงเกือบทุกเพลง
          </span>
        </div>
      </div>
    </figure>
  );
}
