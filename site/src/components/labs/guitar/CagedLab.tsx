import { useState } from 'react';
import Fretboard from '../../music/Fretboard';
import { Pills, rootOptions } from '../../music/Controls';
import { chord } from '../../music/audio';
import { CAGED_SHAPES, cagedAt, midiOfShape, mod12, nameOf, parseNote, pcOf, pitchAt, type Mark } from '../../../lib/music';

// One major chord, five shapes. Pick a root and the five open chords C A G E D are slid along the neck until each one
// makes that chord. Together they tile the neck from the nut to the twelfth fret.

type Shape = keyof typeof CAGED_SHAPES;
const ORDER: Shape[] = ['C', 'A', 'G', 'E', 'D'];
const TONE = (pc: number, root: number) => ({ 0: 'R', 4: '3', 7: '5' })[mod12(pc - root) as 0 | 4 | 7] ?? '';

export default function CagedLab() {
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
      <div className="viz-title">ห้ารูปของคอร์ดเมเจอร์ตัวเดียว (CAGED)</div>
      <Pills label="คอร์ด" value={root} onChange={setRoot} options={rootOptions} />
      <Pills<Shape | 'all'> label="รูป" value={shape} onChange={setShape} options={[{ value: 'all', text: 'ทั้งห้า' }, ...ORDER.map((s) => ({ value: s, text: `รูป ${s}` }))]} />
      <div className="viz-box">
        <Fretboard marks={marks} label={`คอร์ด ${root} ในรูป CAGED`} />
      </div>
      <div className="viz-now">
        <strong>คอร์ด {nameOf(parseNote(root))} เมเจอร์ (R = root, 3 = ตัว 3, 5 = ตัว 5)</strong>
        <span>
          {one
            ? `รูป ${one.s}: ${one.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')} (ยก ${one.shift} เฟร็ตจากรูปเปิด)`
            : placed.map((p) => `${p.s}: ${p.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`).join(' · ')}
        </span>
        {one && (
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => chord(midiOfShape(one.frets), { spread: 0.03 })}>ฟังรูปนี้</button>
        )}
      </div>
      <p className="viz-caption">ลำดับตามคอเป็น C → A → G → E → D แล้ววนกลับเสมอ (เป็นที่มาของชื่อ CAGED) จะเริ่มที่รูปไหนขึ้นกับคอร์ดที่เลือก ลองเลือกคอร์ดต่างกันแล้วดูว่าลำดับนี้ไม่เปลี่ยน</p>
    </figure>
  );
}
