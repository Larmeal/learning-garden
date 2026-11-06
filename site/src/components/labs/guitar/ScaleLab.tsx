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

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string;
  keyLabel: string;
  scaleLabel: string;
  labelsLabel: string;
  byName: string;
  byDegree: string;
  play: string;
  prev: string;
  next: string;
  whole: string;
  posTag: (pos: number, total: number, lo: number, hi: number, start: string) => string;
  wholeTag: string;
  bluesNote: string;
  fbLabel: (root: string, scale: string) => string;
  notesOf: string;
  caption: string;
}> = {
  th: {
    title: 'สเกลบนคอกีต้าร์',
    keyLabel: 'คีย์',
    scaleLabel: 'สเกล',
    labelsLabel: 'ป้าย',
    byName: 'ชื่อโน้ต',
    byDegree: 'ตัวเลขขั้น',
    play: 'ฟังสเกลขึ้นหนึ่งอ็อกเทฟ',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    whole: 'ทั้งคอ',
    posTag: (pos, total, lo, hi, start) => `ตำแหน่ง ${pos} จาก ${total} · เฟร็ต ${lo} ถึง ${hi} · เริ่มที่ ${start} สาย 6`,
    wholeTag: 'แสดงทั้งคอ',
    bluesNote: 'สเกลบลูส์มี 6 โน้ต จึงดูทั้งคอได้อย่างเดียว ลองเล่นบนกรอบ minor pentatonic ของคีย์เดียวกันแล้วเติมโน้ต ♭5',
    fbLabel: (root, scale) => `${root} ${scale} บนคอกีต้าร์`,
    notesOf: 'โน้ตของสเกล:',
    caption: 'วงสีเข้มคือโน้ตหลัก (root) · ตำแหน่งที่แสดงอยู่ต่ำกว่าเฟร็ต 12 เสมอ ถ้าอยากได้อ็อกเทฟสูงให้เลื่อนไปอีก 12 เฟร็ต',
  },
  en: {
    title: 'Scales on the guitar neck',
    keyLabel: 'Key',
    scaleLabel: 'Scale',
    labelsLabel: 'Labels',
    byName: 'Note names',
    byDegree: 'Degree numbers',
    play: 'Hear the scale up one octave',
    prev: 'Previous',
    next: 'Next',
    whole: 'Whole neck',
    posTag: (pos, total, lo, hi, start) => `Position ${pos} of ${total} · frets ${lo} to ${hi} · starts on ${start} on string 6`,
    wholeTag: 'Showing the whole neck',
    bluesNote: 'The blues scale has 6 notes, so it can only be shown on the whole neck. Play inside the minor pentatonic box of the same key and add the ♭5 note.',
    fbLabel: (root, scale) => `${root} ${scale} on the guitar neck`,
    notesOf: 'Notes of the scale:',
    caption: 'The dark circle is the root note · the positions shown are always below fret 12. For the higher octave, move up another 12 frets.',
  },
};

export default function ScaleLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
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
      <div className="viz-title">{T.title}</div>
      <Pills label={T.keyLabel} value={root} onChange={(r) => { setRoot(r); setPos(0); }} options={rootOptions} />
      <Pills<ScaleKey> label={T.scaleLabel} value={scaleKey} onChange={choose} options={CHOICES.map((k) => ({ value: k, text: SHORT[k] }))} />
      <div className="viz-controls">
        <Pills<'name' | 'degree'> label={T.labelsLabel} value={labels} onChange={setLabels} options={[{ value: 'name', text: T.byName }, { value: 'degree', text: T.byDegree }]} />
        <button type="button" className="btn sm" onClick={play}>{T.play}</button>
      </div>
      {positions.length > 0 ? (
        <div className="viz-controls">
          <button type="button" className="btn sm" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>{T.prev}</button>
          <button type="button" className="btn sm" disabled={pos === positions.length} onClick={() => setPos((p) => p + 1)}>{T.next}</button>
          <button type="button" className="btn sm" disabled={pos === 0} onClick={() => setPos(0)}>{T.whole}</button>
          <span className="gx-tag">
            {chosen ? T.posTag(pos, positions.length, chosen.lo, chosen.hi, chosen.startNote) : T.wholeTag}
          </span>
        </div>
      ) : (
        <span className="gx-detail">{T.bluesNote}</span>
      )}
      <div className="viz-box">
        <Fretboard marks={marks} label={T.fbLabel(root, SHORT[scaleKey])} lang={lang} />
      </div>
      <p className="viz-caption">
        {T.notesOf} <b>{notes.map(nameOf).join(' ')}</b> · {T.caption}
      </p>
    </figure>
  );
}
