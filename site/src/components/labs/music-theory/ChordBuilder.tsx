import { useState } from 'react';
import Keyboard, { type KeyMark } from '../../music/Keyboard';
import { Pills, rootOptions } from '../../music/Controls';
import { chord } from '../../music/audio';
import { CHORDS, build, chordName, nameOf, parseNote, pcOf, degreeLabels, mod12 } from '../../../lib/music';

// Choose a root and a quality. The chord is spelled by letter, shown with its formula (1 3 5 ♭7) and lit on a keyboard.

const KEYS = ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'add9'] as const;
type Q = (typeof KEYS)[number];

export default function ChordBuilder() {
  const [root, setRoot] = useState('C');
  const [q, setQ] = useState<Q>('major');
  const spec = CHORDS[q];
  const r = parseNote(root);
  const notes = build(r, spec.pattern);
  const degrees = degreeLabels(spec.pattern);

  // Lay the notes out upward from the first C at or above middle C, each one the nearest pitch above the one before.
  const midis: number[] = [];
  let prev = 60 + mod12(pcOf(r) - 60);
  notes.forEach((n, i) => {
    const m = i === 0 ? prev : prev + 1 + mod12(pcOf(n) - prev - 1);
    midis.push(m);
    prev = m;
  });
  const marks: KeyMark[] = midis.map((m, i) => ({ midi: m, label: nameOf(notes[i]), kind: i === 0 ? 'root' : 'tone' }));

  return (
    <figure className="viz">
      <div className="viz-title">สร้างคอร์ดจากสูตร</div>
      <Pills label="root" value={root} onChange={setRoot} options={rootOptions} />
      <Pills<Q> label="ชนิด" value={q} onChange={setQ} options={KEYS.map((k) => ({ value: k, text: CHORDS[k].suffix || 'major' }))} />
      <div className="viz-box">
        <Keyboard marks={marks} octaves={3} from={60} label={`คอร์ด ${chordName(r, q)}`} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{chordName(r, q)} · {spec.label}</strong>
        <span style={{ display: 'block' }}>สูตร: <b>{degrees.join(' ')}</b> · โน้ต: <b>{notes.map(nameOf).join(' ')}</b></span>
        <span style={{ display: 'block' }}>
          ระยะห่างจาก root (เสียงครึ่ง): {spec.pattern.map(([, s]) => s).join(' ')}
        </span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => chord(midis, { dur: 1.8 })}>ฟังพร้อมกัน</button>
          <button type="button" className="btn sm" onClick={() => chord(midis, { spread: 0.32, dur: 1.8 })}>ฟังทีละตัว (อาร์เปจโจ)</button>
        </div>
      </div>
    </figure>
  );
}
