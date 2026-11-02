import { useMemo, useState } from 'react';
import Fretboard from '../../music/Fretboard';
import { Pills, rootOptions } from '../../music/Controls';
import { pluck } from '../../music/audio';
import { SCALES, build, degreeLabels, marksFor, nameOf, parseNote, pcOf, scalePositions, mod12, type Mark } from '../../../lib/music';

// Pick a key and a scale, see every note on the neck, then walk through the positions one at a time.

const CHOICES = ['minorPent', 'majorPent', 'blues', 'major', 'minor', 'dorian', 'mixolydian'] as const;
type ScaleKey = (typeof CHOICES)[number];
const SHORT: Record<ScaleKey, string> = {
  minorPent: 'Minor pentatonic',
  majorPent: 'Major pentatonic',
  blues: 'Blues',
  major: 'Major',
  minor: 'Natural minor',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
};

export default function ScaleLab() {
  const [root, setRoot] = useState('A');
  const [scaleKey, setScaleKey] = useState<ScaleKey>('minorPent');
  const [labels, setLabels] = useState<'name' | 'degree'>('name');
  const [pos, setPos] = useState(0); // 0 = whole neck, n = position n

  const scale = SCALES[scaleKey];
  const notes = useMemo(() => build(parseNote(root), scale.pattern), [root, scale]);
  const degrees = useMemo(() => degreeLabels(scale.pattern), [scale]);
  const perString = notes.length === 5 ? 2 : notes.length === 7 ? 3 : 0;
  const positions = useMemo(() => (perString ? scalePositions(notes, perString).filter((p) => p.lo < 12) : []), [notes, perString]);
  const chosen = pos > 0 ? positions[pos - 1] : undefined;

  const marks: Mark[] = chosen
    ? chosen.marks.map((m) => {
        const idx = notes.findIndex((n) => nameOf(n) === m.label);
        return { ...m, label: labels === 'degree' ? degrees[idx] : m.label };
      })
    : marksFor(notes, { labels, degrees });

  const choose = (k: ScaleKey) => {
    setScaleKey(k);
    setPos(0);
  };

  const play = () => {
    const base = 48 + pcOf(parseNote(root));
    const pcs = notes.map(pcOf);
    const midis = [base];
    let p = base;
    while (midis.length <= notes.length) {
      p += 1;
      if (pcs.includes(mod12(p))) midis.push(p);
    }
    midis.forEach((m, i) => pluck(m, i * 0.3, 0.9));
  };

  return (
    <figure className="viz">
      <div className="viz-title">สเกลบนคอกีต้าร์</div>
      <Pills label="คีย์" value={root} onChange={(r) => { setRoot(r); setPos(0); }} options={rootOptions} />
      <Pills<ScaleKey> label="สเกล" value={scaleKey} onChange={choose} options={CHOICES.map((k) => ({ value: k, text: SHORT[k] }))} />
      <div className="viz-controls">
        <Pills<'name' | 'degree'> label="ป้าย" value={labels} onChange={setLabels} options={[{ value: 'name', text: 'ชื่อโน้ต' }, { value: 'degree', text: 'ตัวเลขขั้น' }]} />
        <button type="button" className="btn sm" onClick={play}>ฟังสเกลขึ้นหนึ่งอ็อกเทฟ</button>
      </div>
      {positions.length > 0 ? (
        <div className="viz-controls">
          <button type="button" className="btn sm" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>ก่อนหน้า</button>
          <button type="button" className="btn sm" disabled={pos === positions.length} onClick={() => setPos((p) => p + 1)}>ถัดไป</button>
          <button type="button" className="btn sm" disabled={pos === 0} onClick={() => setPos(0)}>ทั้งคอ</button>
          <span className="gx-tag">
            {chosen ? `ตำแหน่ง ${pos} จาก ${positions.length} · เฟร็ต ${chosen.lo} ถึง ${chosen.hi} · เริ่มที่ ${chosen.startNote} สาย 6` : 'แสดงทั้งคอ'}
          </span>
        </div>
      ) : (
        <span className="gx-detail">สเกลบลูส์มี 6 โน้ต จึงดูทั้งคอได้อย่างเดียว ลองเล่นบนกรอบ minor pentatonic ของคีย์เดียวกันแล้วเติมโน้ต ♭5</span>
      )}
      <div className="viz-box">
        <Fretboard marks={marks} label={`${root} ${SHORT[scaleKey]} บนคอกีต้าร์`} />
      </div>
      <p className="viz-caption">
        โน้ตของสเกล: <b>{notes.map(nameOf).join(' ')}</b> · วงสีเข้มคือโน้ตหลัก (root) · ตำแหน่งที่แสดงอยู่ต่ำกว่าเฟร็ต 12 เสมอ ถ้าอยากได้อ็อกเทฟสูงให้เลื่อนไปอีก 12 เฟร็ต
      </p>
    </figure>
  );
}
