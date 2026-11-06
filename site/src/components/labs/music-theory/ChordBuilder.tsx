import { useState } from 'react';
import Keyboard, { type KeyMark } from '../../music/Keyboard';
import { Pills, rootOptions } from '../../music/Controls';
import { chord } from '../../music/audio';
import { CHORDS, build, chordName, nameOf, parseNote, pcOf, degreeLabels, mod12 } from '../../../lib/music';

// Choose a root and a quality. The chord is spelled by letter, shown with its formula (1 3 5 ♭7) and lit on a keyboard.

const KEYS = ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'add9'] as const;
type Q = (typeof KEYS)[number];

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string; kind: string; kbLabel: (name: string) => string; formula: string; notes: string;
  distance: string; together: string; arp: string;
}> = {
  th: {
    title: 'สร้างคอร์ดจากสูตร',
    kind: 'ชนิด',
    kbLabel: (name) => `คอร์ด ${name}`,
    formula: 'สูตร:',
    notes: 'โน้ต:',
    distance: 'ระยะห่างจาก root (เสียงครึ่ง):',
    together: 'ฟังพร้อมกัน',
    arp: 'ฟังทีละตัว (อาร์เปจโจ)',
  },
  en: {
    title: 'Build a chord from its formula',
    kind: 'Type',
    kbLabel: (name) => `Chord ${name}`,
    formula: 'Formula:',
    notes: 'Notes:',
    distance: 'Distance from the root (semitones):',
    together: 'Play together',
    arp: 'Play one by one (arpeggio)',
  },
};

export default function ChordBuilder({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
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
      <div className="viz-title">{t.title}</div>
      <Pills label="root" value={root} onChange={setRoot} options={rootOptions} />
      <Pills<Q> label={t.kind} value={q} onChange={setQ} options={KEYS.map((k) => ({ value: k, text: CHORDS[k].suffix || 'major' }))} />
      <div className="viz-box">
        <Keyboard marks={marks} octaves={3} from={60} label={t.kbLabel(chordName(r, q))} lang={lang} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{chordName(r, q)} · {spec.label}</strong>
        <span style={{ display: 'block' }}>{t.formula} <b>{degrees.join(' ')}</b> · {t.notes} <b>{notes.map(nameOf).join(' ')}</b></span>
        <span style={{ display: 'block' }}>
          {t.distance} {spec.pattern.map(([, s]) => s).join(' ')}
        </span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => chord(midis, { dur: 1.8 })}>{t.together}</button>
          <button type="button" className="btn sm" onClick={() => chord(midis, { spread: 0.32, dur: 1.8 })}>{t.arp}</button>
        </div>
      </div>
    </figure>
  );
}
