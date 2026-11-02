import { useState } from 'react';
import Keyboard, { type KeyMark } from '../../music/Keyboard';
import { Pills, rootOptions } from '../../music/Controls';
import { pluck } from '../../music/audio';
import { SCALES, build, degreeLabels, mod12, nameOf, parseNote, pcOf } from '../../../lib/music';

// Pick a root and a scale. The keyboard lights the scale from the root upward, the card prints the spelled notes,
// the gaps between them (W = whole step, H = half step) and how each note differs from the major scale.

interface Props {
  scales?: string[];
  start?: string;
  startRoot?: string;
  caption?: string;
}

const STEP: Record<number, string> = { 1: 'H', 2: 'W', 3: 'W+H' };

export default function ScaleExplorer({ scales = ['major', 'minor', 'harmonicMinor', 'melodicMinor'], start, startRoot = 'C', caption }: Props) {
  const [root, setRoot] = useState(startRoot);
  const [key, setKey] = useState(start ?? scales[0]);
  const spec = SCALES[key];
  const r = parseNote(root);
  const notes = build(r, spec.pattern);
  const degrees = degreeLabels(spec.pattern);

  // Walk upward from the first C at or above middle C, one octave of the scale plus the octave note.
  const base = 60 + mod12(pcOf(r) - 60);
  const semis = [...spec.pattern.map(([, s]) => s), 12];
  const marks: KeyMark[] = semis.map((s, i) => ({ midi: base + s, label: nameOf(notes[i % notes.length]), kind: i % notes.length === 0 ? 'root' : 'tone' }));
  const steps = semis.slice(1).map((s, i) => STEP[s - semis[i]] ?? `${s - semis[i]}`);

  const play = () => semis.forEach((s, i) => pluck(base + s, i * 0.28, 0.9));

  return (
    <figure className="viz">
      <div className="viz-title">สร้างสเกลจากโน้ตตั้งต้น</div>
      <Pills label="โน้ตตั้งต้น" value={root} onChange={setRoot} options={rootOptions} />
      <Pills label="สเกล" value={key} onChange={setKey} options={scales.map((k) => ({ value: k, text: SCALES[k].label }))} />
      <div className="viz-box">
        <Keyboard marks={marks} octaves={2} from={60} label={`${root} ${spec.label}`} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{nameOf(r)} {spec.label}</strong>
        <span style={{ display: 'block' }}>โน้ต: <b>{notes.map(nameOf).join(' ')}</b></span>
        <span style={{ display: 'block' }}>ขั้น: <b>{degrees.join(' ')}</b></span>
        <span style={{ display: 'block' }}>ระยะห่าง: <b>{steps.join(' ')}</b> (W เต็มเสียง, H ครึ่งเสียง)</span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={play}>ฟังสเกลขึ้นหนึ่งอ็อกเทฟ</button>
        </div>
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
