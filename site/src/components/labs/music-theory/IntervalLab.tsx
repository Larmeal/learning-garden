import { useState } from 'react';
import Keyboard, { type KeyMark } from '../../music/Keyboard';
import { Pills, rootOptions } from '../../music/Controls';
import { tone } from '../../music/audio';
import { INTERVALS, above, nameOf, parseNote, pcOf } from '../../../lib/music';

// Pick a lower note and an interval. The keyboard shows both notes, the card names the interval and the note on top
// (spelled by letter, so a tritone above C is shown as F♯ and G♭, the two spellings of the same key).

// A tune whose first two notes make the interval going up. The ones marked "ถ้านึกออก" are the weaker anchors.
const ANCHOR: Record<string, string> = {
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
  M7: 'ไม่มีเพลงที่ชัดเจน จำเสียงว่า "เกือบถึงอ็อกเทฟแต่ขาดครึ่งเสียง"',
  P8: 'Somewhere Over the Rainbow',
};

const FEEL: Record<string, string> = {
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
  m7: 'ค้างคา อยากไปต่อ เป็นเสียงของคอร์ด dominant',
  M7: 'ตึงมาก ใกล้ถึงบ้านแต่ยังไม่ถึง',
  P8: 'โน้ตเดียวกันแต่สูงขึ้น',
};

export default function IntervalLab() {
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
      <div className="viz-title">ช่วงเสียง: ฟังและดูบนคีย์บอร์ด</div>
      <Pills label="โน้ตล่าง" value={root} onChange={setRoot} options={rootOptions} />
      <Pills<number> label="ช่วงเสียง" value={semis} onChange={setSemis} options={INTERVALS.filter((i) => i.semis > 0).map((i) => ({ value: i.semis, text: i.short }))} />
      <div className="viz-box">
        <Keyboard marks={marks} octaves={2} label={`ช่วงเสียง ${iv.short} เหนือ ${root}`} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>
          {iv.name} ({iv.short}) · {iv.semis} เสียงครึ่ง · {nameOf(lower)} ไป {nameOf(top)}
          {alt ? ` หรือ ${nameOf(alt)}` : ''}
        </strong>
        <span style={{ display: 'block' }}>{FEEL[iv.short]}</span>
        <span style={{ display: 'block' }}>เพลงที่ใช้จำ (ไต่ขึ้น): {ANCHOR[iv.short]}</span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => play('melodic')}>ฟังทีละตัว</button>
          <button type="button" className="btn sm" onClick={() => play('harmonic')}>ฟังพร้อมกัน</button>
        </div>
      </div>
    </figure>
  );
}
