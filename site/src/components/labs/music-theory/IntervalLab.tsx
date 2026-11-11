import { useState } from 'react';
import Keyboard, { type KeyMark } from '../../music/Keyboard';
import { Pills, rootOptions } from '../../music/Controls';
import { tone } from '../../music/audio';
import { INTERVALS, above, nameOf, parseNote, pcOf } from '../../../lib/music';

// Pick a lower note and an interval. The keyboard shows both notes, the card names the interval and the note on top
// (spelled by letter, so a tritone above C is shown as F♯ and G♭, the two spellings of the same key).

type Lang = 'th' | 'en';

// A tune whose first two notes make the interval going up. Some anchors are weaker and are marked as such.
const ANCHOR: Record<Lang, Record<string, string>> = {
  th: {
    m2: 'เพลงประกอบหนัง Jaws (สองโน้ตแรก)',
    M2: 'Frère Jacques (โด เร)',
    m3: 'Greensleeves (โน้ตสองตัวแรก)',
    M3: 'When the Saints Go Marching In',
    P4: 'Here Comes the Bride',
    TT: 'ธีมของ The Simpsons (ช่วง "The Simp-sons")',
    P5: 'Twinkle Twinkle Little Star',
    m6: 'ธีม Love Story (Where Do I Begin)',
    M6: 'My Bonnie Lies over the Ocean',
    m7: 'Somewhere จาก West Side Story (ถ้านึกออก)',
    M7: 'ไม่มีเพลงที่ชัดเจน ให้จำเสียงว่า "เกือบถึงอ็อกเทฟแต่ขาดครึ่งเสียง"',
    P8: 'Somewhere Over the Rainbow',
  },
  en: {
    m2: 'Jaws movie theme (first two notes)',
    M2: 'Frère Jacques (do re)',
    m3: 'Greensleeves (first two notes)',
    M3: 'When the Saints Go Marching In',
    P4: 'Here Comes the Bride',
    TT: 'The Simpsons theme (the part "The Simp-sons")',
    P5: 'Twinkle Twinkle Little Star',
    m6: 'Love Story theme (Where Do I Begin)',
    M6: 'My Bonnie Lies over the Ocean',
    m7: 'Somewhere from West Side Story (if you can recall it)',
    M7: 'No clear song. Remember the sound as "almost an octave, but a half step short"',
    P8: 'Somewhere Over the Rainbow',
  },
};

const FEEL: Record<Lang, Record<string, string>> = {
  th: {
    P1: 'โน้ตเดียวกัน',
    m2: 'ชิดและตึง เหมือนโน้ตสองตัวชนกัน',
    M2: 'ก้าวเดินธรรมดา เป็นขั้นของสเกล',
    m3: 'เศร้า มืด เป็นแก่นของคอร์ดไมเนอร์',
    M3: 'สว่าง มั่นคง เป็นแก่นของคอร์ดเมเจอร์',
    P4: 'เปิดโล่ง รอให้ไปต่อ',
    TT: 'ไม่นิ่ง อยากแก้ไปหาที่ใดที่หนึ่ง',
    P5: 'แข็งแรง ว่างและเสถียร เป็นฐานของพาวเวอร์คอร์ด',
    m6: 'หวานปนเศร้า',
    M6: 'อบอุ่น สดใส',
    m7: 'ค้างคา อยากไปต่อ เป็นเสียงของคอร์ด Dominant',
    M7: 'ตึงมาก ใกล้ถึงบ้านแต่ยังไม่ถึง',
    P8: 'โน้ตเดียวกันแต่สูงขึ้น',
  },
  en: {
    P1: 'The same note',
    m2: 'Close and tense, two notes that clash',
    M2: 'An ordinary step, one step of the scale',
    m3: 'Sad and dark, the core of a minor chord',
    M3: 'Bright and stable, the core of a major chord',
    P4: 'Open, waiting to go on',
    TT: 'Unsettled, wants to resolve somewhere',
    P5: 'Strong, empty and stable, the base of a power chord',
    m6: 'Bittersweet',
    M6: 'Warm and bright',
    m7: 'Hanging, wants to go on, the sound of a dominant chord',
    M7: 'Very tense, almost home but not quite',
    P8: 'The same note, but higher',
  },
};

const TEXT: Record<Lang, {
  title: string; low: string; interval: string; kbLabel: (short: string, root: string) => string;
  summary: (name: string, short: string, semis: number, low: string, top: string) => string;
  or: string; anchor: string; melodic: string; harmonic: string;
}> = {
  th: {
    title: 'ช่วงเสียง: ฟังและดูบนคีย์บอร์ด',
    low: 'โน้ตล่าง',
    interval: 'ช่วงเสียง',
    kbLabel: (short, root) => `ช่วงเสียง ${short} เหนือ ${root}`,
    summary: (name, short, semis, low, top) => `${name} (${short}) · ${semis} เสียงครึ่ง · ${low} ไป ${top}`,
    or: ' หรือ ',
    anchor: 'เพลงที่ใช้จำ (ไต่ขึ้น):',
    melodic: 'ฟังทีละตัว',
    harmonic: 'ฟังพร้อมกัน',
  },
  en: {
    title: 'Intervals: listen and see them on the keyboard',
    low: 'Lower note',
    interval: 'Interval',
    kbLabel: (short, root) => `Interval ${short} above ${root}`,
    summary: (name, short, semis, low, top) => `${name} (${short}) · ${semis} semitones · ${low} to ${top}`,
    or: ' or ',
    anchor: 'A song to remember it by (going up):',
    melodic: 'Play one by one',
    harmonic: 'Play together',
  },
};

export default function IntervalLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [root, setRoot] = useState('C');
  const [semis, setSemis] = useState(4);
  const iv = INTERVALS.find((i) => i.semis === semis)!;

  const lower = parseNote(root);
  const lowMidi = 60 + pcOf(lower);
  const highMidi = lowMidi + semis;
  const top = above(lower, iv);
  const alt = iv.semis === 6 ? above(lower, { ...iv, degree: 4 }) : null; // the other spelling of a tritone
  const marks: KeyMark[] = [{ midi: lowMidi, label: nameOf(lower), kind: 'root' }, { midi: highMidi, label: nameOf(top), kind: 'target' }];

  const play = (mode: 'melodic' | 'harmonic') => {
    if (mode === 'melodic') {
      tone(lowMidi, 0, 0.7);
      tone(highMidi, 0.75, 0.9);
    } else {
      tone(lowMidi, 0, 1.4);
      tone(highMidi, 0, 1.4);
    }
  };

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <Pills label={t.low} value={root} onChange={setRoot} options={rootOptions} />
      <Pills<number> label={t.interval} value={semis} onChange={setSemis} options={INTERVALS.filter((i) => i.semis > 0).map((i) => ({ value: i.semis, text: i.short }))} />
      <div className="viz-box">
        <Keyboard marks={marks} octaves={2} label={t.kbLabel(iv.short, root)} lang={lang} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>
          {t.summary(iv.name, iv.short, iv.semis, nameOf(lower), nameOf(top))}
          {alt ? `${t.or}${nameOf(alt)}` : ''}
        </strong>
        <span style={{ display: 'block' }}>{FEEL[lang][iv.short]}</span>
        <span style={{ display: 'block' }}>{t.anchor} {ANCHOR[lang][iv.short]}</span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => play('melodic')}>{t.melodic}</button>
          <button type="button" className="btn sm" onClick={() => play('harmonic')}>{t.harmonic}</button>
        </div>
      </div>
    </figure>
  );
}
