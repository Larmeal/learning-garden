import { useState } from 'react';
import Fretboard from '../../music/Fretboard';
import { Pills, rootOptions } from '../../music/Controls';
import { chord } from '../../music/audio';
import { CAGED_SHAPES, cagedAt, midiOfShape, mod12, nameOf, parseNote, pcOf, pitchAt, type Mark } from '../../../lib/music';

// One major chord, five shapes. Pick a root and the five open chords C A G E D are slid along the neck until each one
// makes that chord. Together they tile the neck from the nut to the twelfth fret.

type Lang = 'th' | 'en';
type Shape = keyof typeof CAGED_SHAPES;
const ORDER: Shape[] = ['C', 'A', 'G', 'E', 'D'];
const TONE = (pc: number, root: number) => ({ 0: 'R', 4: '3', 7: '5' })[mod12(pc - root) as 0 | 4 | 7] ?? '';

const TEXT: Record<Lang, {
  title: string;
  chordLabel: string;
  shapeLabel: string;
  all: string;
  shape: (s: string) => string;
  fbLabel: (root: string) => string;
  head: (name: string) => string;
  one: (s: string, frets: string, shift: number) => string;
  listen: string;
  caption: string;
}> = {
  th: {
    title: 'ห้ารูปของคอร์ดเมเจอร์ตัวเดียว (CAGED)',
    chordLabel: 'คอร์ด',
    shapeLabel: 'รูป',
    all: 'ทั้งห้า',
    shape: (s) => `รูป ${s}`,
    fbLabel: (root) => `คอร์ด ${root} ในรูป CAGED`,
    head: (name) => `คอร์ด ${name} เมเจอร์ (R = root, 3 = ตัว 3, 5 = ตัว 5)`,
    one: (s, frets, shift) => `รูป ${s}: ${frets} (ยก ${shift} เฟร็ตจากรูปเปิด)`,
    listen: 'ฟังรูปนี้',
    caption: 'เมื่อไล่ไปตามคอกีตาร์ ลำดับของรูปจะเป็น C → A → G → E → D แล้ววนกลับมาที่ C เสมอ (ชื่อ CAGED มาจากตรงนี้เอง) ส่วนว่าจะเริ่มที่รูปไหนก็ขึ้นอยู่กับคอร์ดที่เราเลือก ลองเลือกคอร์ดอื่นดู แล้วเราจะเห็นว่าลำดับนี้ไม่เปลี่ยน',
  },
  en: {
    title: 'Five shapes of one major chord (CAGED)',
    chordLabel: 'Chord',
    shapeLabel: 'Shape',
    all: 'All five',
    shape: (s) => `Shape ${s}`,
    fbLabel: (root) => `Chord ${root} in CAGED shapes`,
    head: (name) => `${name} major chord (R = root, 3 = the 3rd, 5 = the 5th)`,
    one: (s, frets, shift) => `Shape ${s}: ${frets} (moved up ${shift} frets from the open shape)`,
    listen: 'Listen to this shape',
    caption: 'Along the neck the order is always C → A → G → E → D, then back to C (this is where the name CAGED comes from). Which shape comes first depends on the chord you pick. Try different chords and see that the order does not change.',
  },
};

export default function CagedLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [root, setRoot] = useState('C');
  const [shape, setShape] = useState<Shape | 'all'>('all');
  const rootPc = pcOf(parseNote(root));

  const placed = ORDER.map((s) => ({ s, ...cagedAt(s, rootPc) }));
  const marks: Mark[] = [];
  const seen = new Set<string>();
  for (const p of placed) {
    if (shape !== 'all' && shape !== p.s) continue;
    p.frets.forEach((f, string) => {
      if (f < 0 || f > 15) return;
      const key = `${string}-${f}`;
      if (seen.has(key)) return;
      seen.add(key);
      const pc = mod12(pitchAt(string, f));
      const role = TONE(pc, rootPc);
      marks.push({ string, fret: f, label: role, kind: role === 'R' ? 'root' : 'tone' });
    });
  }
  const one = shape === 'all' ? null : placed.find((p) => p.s === shape)!;

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <Pills label={T.chordLabel} value={root} onChange={setRoot} options={rootOptions} />
      <Pills<Shape | 'all'> label={T.shapeLabel} value={shape} onChange={setShape} options={[{ value: 'all', text: T.all }, ...ORDER.map((s) => ({ value: s, text: T.shape(s) }))]} />
      <div className="viz-box">
        <Fretboard marks={marks} label={T.fbLabel(root)} lang={lang} />
      </div>
      <div className="viz-now">
        <strong>{T.head(nameOf(parseNote(root)))}</strong>
        <span>
          {one
            ? T.one(one.s, one.frets.map((f) => (f < 0 ? 'x' : f)).join(' '), one.shift)
            : placed.map((p) => `${p.s}: ${p.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`).join(' · ')}
        </span>
        {one && (
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => chord(midiOfShape(one.frets), { spread: 0.03 })}>{T.listen}</button>
        )}
      </div>
      <p className="viz-caption">{T.caption}</p>
    </figure>
  );
}
