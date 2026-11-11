import { useEffect, useMemo, useRef, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { audio } from '../../music/audio';
import { midiToHz, noteName } from '../../../lib/voice';

// A warm-up that plays the guide notes while you sing. Pick an exercise, your voice part and a tempo; the player repeats the pattern a
// half step higher each time (and then back down) and stops before the top of your comfortable range (Davids and LaTour, chapter 9,
// Table 9.1). The exercises come from chapters 2, 3, 4, 5, 8, 10 and 16; the guide tone is a plain synthesized tone, not a voice.

interface Ev {
  /** semitones from the starting note; `to` makes a slide */
  at: number;
  to?: number;
  beats: number;
  syl: string;
  rest?: boolean;
}
interface Exercise {
  key: string;
  name: string;
  group: string;
  goal: string;
  how: string;
  sovt?: boolean;
  step: number;
  events: Ev[];
  source: string;
}

const seq = (offsets: number[], beats: number, syls: string[]): Ev[] => offsets.map((o, i) => ({ at: o, beats, syl: syls[i % syls.length] }));

const EX: Exercise[] = [
  {
    key: 'straw', name: 'Straw: เลื่อนขึ้นลงช่วง Major 3rd', group: 'SOVT', sovt: true, step: 1,
    goal: 'ช่วยให้เส้นเสียงสั่นได้ง่ายขึ้น และเตรียมตัวก่อนผ่านช่วงเปลี่ยน Register',
    how: 'ให้เราร้องผ่านหลอดที่มีเส้นผ่านศูนย์กลาง 2.5 ถึง 5 mm โดยถือหลอดไว้ด้วยมือ เพื่อไม่ให้ริมฝีปากเกร็ง จากนั้นเลื่อนเสียงให้ต่อเนื่องโดยไม่แยกเป็นขั้น ถ้าไม่มีหลอดก็ใช้ [v] แทนได้ แต่ต้องระวังไม่ให้ลมรั่วออกทางจมูก',
    events: [{ at: 0, to: 4, beats: 2, syl: 'หลอด' }, { at: 4, to: 0, beats: 2, syl: 'หลอด' }, { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 3 หัวข้อ Semi-occluded vocal tract (SOVT) exercises หน้า 54 และบทที่ 16 หน้า 283',
  },
  {
    key: 'siren', name: 'Siren / Ghost: เลื่อนช่วง Octave', group: 'SOVT', sovt: true, step: 2,
    goal: 'ให้เสียงผ่านได้ทุก Register โดยที่เราไม่ต้องคิดถึงโน้ตแต่ละตัว',
    how: 'ใช้ Lip Trill (พรูริมฝีปาก) หรือหลอดก็ได้ เริ่มจาก Register ล่าง แล้วเลื่อนขึ้นเบา ๆ ก่อนจะเลื่อนลงมา จากนั้นทำซ้ำโดยเริ่มให้สูงขึ้นทีละเสียงเต็ม ถ้า Lip Trill ไม่สั่น ลองดันแก้มเบา ๆ ดูนะ',
    events: [{ at: 0, to: 12, beats: 3, syl: 'brrr' }, { at: 12, to: 0, beats: 3, syl: 'brrr' }, { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 8 หัวข้อ Register exercises หน้า 173 และบทที่ 3 หัวข้อ Lip trill SOVT exercise หน้า 60',
  },
  {
    key: 'ng-ah', name: 'ng แล้วเปิดเป็น ah: ห้าโน้ต', group: 'Resonance', step: 1,
    goal: 'ฝึกควบคุมเพดานอ่อน ให้ยกขึ้นตอนที่เปลี่ยนจาก ng ไปเป็นสระ',
    how: 'ร้อง "ng" ในสี่โน้ตแรกขณะที่เสียงขึ้น แล้วเปิดเป็น [ɑ] ที่โน้ตบนสุดและตอนลง ให้สังเกตว่าเสียงเลิกเป็นนาสิกแล้ว ถ้าลองบีบจมูกแล้วเสียงยังเหมือนเดิม แปลว่าเรายกเพดานอ่อนได้แล้ว',
    events: [...seq([0, 2, 4, 5], 1, ['ng']), { at: 7, beats: 1, syl: 'ah' }, ...seq([5, 4, 2, 0], 1, ['ah']), { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 16 (Sample sequence two) หน้า 286 และบทที่ 4 แบบฝึก Hang-ah หน้า 89',
  },
  {
    key: 'vowel-fifth', name: 'ห้าโน้ตขึ้นลงบนสระ Cardinal', group: 'Vowels', step: 1,
    goal: 'รักษาสระให้คงที่ในขณะที่โน้ตเปลี่ยนไป และรักษาแรงดันลมให้เท่าเดิมตลอดทั้งเส้น',
    how: 'ร้อง 1-2-3-4-5-4-3-2-1 ค่อนข้างเร็วบนสระเดียว แล้วสลับสระ (อี เอ อา โอ อู) ในแต่ละรอบ โดยพยายามรักษาท่าลิ้นและกรามให้นิ่ง และให้ปลายลิ้นแตะโคนฟันล่างไว้',
    events: [...seq([0, 2, 4, 5, 7, 5, 4, 2, 0], 0.5, ['i', 'i']), { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 16 (Sample sequence one) หน้า 286 และบทที่ 5 หัวข้อ Vowel exercises หน้า 119',
  },
  {
    key: 'desc-ia', name: 'ลงห้าโน้ต [i] ไปจบที่ [a]', group: 'Vowels', step: -1,
    goal: 'เชื่อมความสว่างของ [i] เข้ากับความลึกของ [a] โดยที่ตำแหน่งเสียงไม่เปลี่ยน',
    how: 'ร้อง [i] ในสี่โน้ตแรก แล้วค่อย ๆ เลื่อนเป็น [a] ที่โน้ตสุดท้าย โดยลดกรามด้านหลังลงทีละน้อย เริ่มราว C4 ถึง C5 แล้วลงทีละครึ่งเสียง',
    events: [{ at: 7, beats: 1, syl: 'i' }, { at: 5, beats: 1, syl: 'i' }, { at: 4, beats: 1, syl: 'i' }, { at: 2, beats: 1, syl: 'i' }, { at: 0, beats: 2, syl: 'a' }, { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 16 (Sample sequence one) หน้า 286',
  },
  {
    key: 'arp-o', name: 'Arpeggio Legato บน [o]', group: 'Registers', step: 1,
    goal: 'เชื่อมโน้ตให้ต่อเนื่องกัน และเตรียมตัวผ่านช่วงเปลี่ยน',
    how: 'ร้อง 1-3-5-8-5-3-1 ให้ลื่น โดยลองนึกภาพว่าเรากำลังขึ้นไปบนยอดชิงช้าสวรรค์ ซึ่งที่ยอดไม่ต้องออกแรงเพิ่ม และเมื่อเข้าช่วง Passaggio ให้ปรับสระตามสไตล์',
    events: [...seq([0, 4, 7, 12, 7, 4, 0], 1, ['o']), { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 8 หัวข้อ Extended arpeggios หน้า 173 และบทที่ 16 หน้า 286',
  },
  {
    key: 'mamamia', name: 'Mamamia', group: 'Articulation', step: 1,
    goal: 'ฝึกพยัญชนะให้เร็วและเบา โดยที่สระไม่เพี้ยนไป',
    how: 'ร้อง ma-ma-mi-a สามชุด (do re mi do / re mi fa re / mi fa sol mi do) ให้เร็วและเบา โดยให้ปลายลิ้นกลับมาที่โคนฟันล่างทุกครั้ง แล้วลองเปลี่ยนพยัญชนะดู',
    events: [...seq([0, 2, 4, 0], 0.5, ['ma', 'ma', 'mi', 'a']), ...seq([2, 4, 5, 2], 0.5, ['ma', 'ma', 'mi', 'a']), ...seq([4, 5, 7, 4], 0.5, ['ma', 'ma', 'mi', 'a']), { at: 0, beats: 1, syl: 'ma' }, { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 16 (Sample sequence one) หน้า 286',
  },
  {
    key: 'pivot', name: 'Pivot Note: ขึ้นลงรอบโน้ตกลาง', group: 'Intonation', step: 0,
    goal: 'ฝึกให้ระยะระหว่างโน้ตแม่นยำ (Horizontal Intonation)',
    how: 'ร้อง "di" ที่โน้ตกลาง แล้วขึ้นครึ่งเสียงและกลับมา จากนั้นลงครึ่งเสียงและกลับมา หลังจากนั้นทำซ้ำด้วยเสียงเต็ม โดยใช้ PitchMirror ช่วยดูว่าแต่ละโน้ตตรงหรือไม่',
    events: [...seq([0, 1, 0, -1, 0], 1, ['di']), { at: 0, beats: 0.5, syl: '', rest: true }, ...seq([0, 2, 0, -2, 0], 1, ['di']), { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 10 หัวข้อ Exercises to improve intonation หน้า 196',
  },
  {
    key: 'iu', name: 'สลับ [i] กับ [u] บนโน้ตเดียว', group: 'Resonance', step: 1,
    goal: 'รักษา Resonance ให้สม่ำเสมอ ตั้งแต่สระที่สว่างที่สุดไปจนถึงสระที่มืดที่สุด',
    how: 'ร้องโน้ตเดียวโดยสลับระหว่าง [i] ที่ยิ้มกว้าง กับ [u] ที่จู๋ปาก และให้เสียงเต็มทั้งสองสระ (ท่านี้เกินจริงนะ ใช้ฝึกเท่านั้น ไม่ใช้ตอนร้องเพลง)',
    events: [...seq([0, 0, 0, 0, 0, 0], 1, ['i', 'u']), { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Exercises for enhancing resonance หน้า 89',
  },
  {
    key: 'swell', name: 'Messa di voce: ดังขึ้นแล้วเบาลง', group: 'Dynamics', step: 1,
    goal: 'ควบคุมแรงดันลมและความแน่นของการปิดให้ค่อย ๆ เปลี่ยนไป',
    how: 'ร้องโน้ตเดียวแปดจังหวะ โดยค่อย ๆ ดังขึ้นในสี่จังหวะแรก แล้วเบาลงในสี่จังหวะหลัง พยายามรักษา Vowel และโน้ตให้นิ่ง แล้วลองเปลี่ยนความกว้างของ Vibrato ดู',
    events: [{ at: 0, beats: 8, syl: 'ah' }, { at: 0, beats: 1, syl: '', rest: true }],
    source: 'Davids และ LaTour บทที่ 16 (Sample sequence two) หน้า 286',
  },
];


const EX_EN: Record<string, { name: string; goal: string; how: string; source: string; syl?: string }> = {
  straw: {
    name: 'Straw: slide up and down a major 3rd',
    goal: 'Helps the vocal folds vibrate more easily and prepares you to cross the register transition.',
    how: 'Sing through a straw with an inner diameter of 2.5 to 5 mm. Hold the straw in your hand so that the lips do not tense. Slide the sound continuously without breaking it into steps. If you have no straw, use [v] instead. Take care that no air leaks out of the nose.',
    source: 'Davids and LaTour, chapter 3, section Semi-occluded vocal tract (SOVT) exercises, page 54, and chapter 16, page 283',
    syl: 'straw',
  },
  siren: {
    name: 'Siren / ghost: slide an octave',
    goal: 'Pass through every register without thinking about each note.',
    how: 'Use a lip trill (blowing the lips) or a straw. Start in the lower register, slide up lightly and come down. Repeat, starting a whole tone higher each time. If the lip trill does not vibrate, try pushing the cheeks gently.',
    source: 'Davids and LaTour, chapter 8, section Register exercises, page 173, and chapter 3, section Lip trill SOVT exercise, page 60',
  },
  'ng-ah': {
    name: 'ng, then open to ah: five notes',
    goal: 'Practice controlling the soft palate so that it lifts when you change from ng to the vowel.',
    how: 'Sing "ng" on the first four notes going up, then open to [ɑ] on the top note and on the way down. Notice that the sound stops being nasal. If the sound is the same when you pinch your nose, the soft palate has lifted.',
    source: 'Davids and LaTour, chapter 16 (Sample sequence two), page 286, and chapter 4, the Hang-ah exercise, page 89',
  },
  'vowel-fifth': {
    name: 'Five notes up and down on the cardinal vowels',
    goal: 'Keep the vowel steady while the note changes, and keep the same air pressure through the whole line.',
    how: 'Sing 1-2-3-4-5-4-3-2-1 fairly quickly on one vowel, switching vowels on each round (ee, eh, ah, oh, oo). Keep the tongue and jaw posture still, with the tip of the tongue at the base of the lower teeth.',
    source: 'Davids and LaTour, chapter 16 (Sample sequence one), page 286, and chapter 5, section Vowel exercises, page 119',
  },
  'desc-ia': {
    name: 'Five notes down from [i] to end on [a]',
    goal: 'Connect the brightness of [i] with the depth of [a] without changing the placement of the sound.',
    how: 'Sing [i] on the first four notes and then slowly change to [a] on the last note, lowering the back of the jaw little by little. Begin at about C4 to C5, and then go down by a semitone each time.',
    source: 'Davids and LaTour, chapter 16 (Sample sequence one), page 286',
  },
  'arp-o': {
    name: 'Legato arpeggio on [o]',
    goal: 'Connect the notes smoothly and prepare to cross the transition.',
    how: 'Sing 1-3-5-8-5-3-1 smoothly. Picture going up to the top of a Ferris wheel, where you need no extra effort at the top. Adjust the vowel when you enter the passaggio, depending on the style.',
    source: 'Davids and LaTour, chapter 8, section Extended arpeggios, page 173, and chapter 16, page 286',
  },
  mamamia: {
    name: 'Mamamia',
    goal: 'Practice making consonants quick and light without letting the vowel drift.',
    how: 'Sing ma-ma-mi-a in three groups (do re mi do / re mi fa re / mi fa sol mi do), quickly and lightly. The tip of the tongue returns to the base of the lower teeth every time. Try changing the consonant.',
    source: 'Davids and LaTour, chapter 16 (Sample sequence one), page 286',
  },
  pivot: {
    name: 'Pivot note: up and down around the middle note',
    goal: 'Practice the distance between notes accurately (horizontal intonation).',
    how: 'Sing "di" on the middle note, then go up a semitone and back, down a semitone and back, and then do it with a whole tone. Use the pitch mirror to see whether each note is on pitch.',
    source: 'Davids and LaTour, chapter 10, section Exercises to improve intonation, page 196',
  },
  iu: {
    name: 'Alternate [i] and [u] on one note',
    goal: 'Keep the resonance even between the brightest and the darkest vowel.',
    how: 'Sing one note, alternating [i] with a wide smile and [u] with rounded lips, and keep the sound full in both vowels (this posture is exaggerated and is for practice only, not for real singing).',
    source: 'Davids and LaTour, chapter 4, section Exercises for enhancing resonance, page 89',
  },
  swell: {
    name: 'Messa di voce: louder, then softer',
    goal: 'Control the air pressure and the firmness of closure so that they change gradually.',
    how: 'Sing one note for eight beats, getting louder over four beats and then softer over four beats. Keep the vowel and the note steady. Try changing the extent of the vibrato.',
    source: 'Davids and LaTour, chapter 16 (Sample sequence two), page 286',
  },
};

const ROUTINE_EN = [
  'Stretch the neck and shoulders and balance your standing posture (no voice needed)',
  'Breathe in through the nose and out through the mouth, checking that both are quiet',
  'SOVT: straw or [v], sliding a major 3rd',
  'Work on the vowels in pairs: [i] to [e], [e] to [a], [a] to [o], [o] to [u]',
  'Five notes up and down on the cardinal vowels',
  'Five notes down from [i] to [a]',
  'Legato arpeggio on [o]',
  'Mamamia',
  'Sing softly and let the voice relax for about two minutes (cool-down)',
];

const GROUP_EN: Record<string, string> = { SOVT: 'SOVT', Resonance: 'Resonance', Vowels: 'Vowels', Registers: 'Registers', Articulation: 'Articulation', Intonation: 'Intonation', Dynamics: 'Dynamics' };

const PARTS: { key: string; text: string; start: number; top: number }[] = [
  { key: 'S', text: 'Soprano', start: 60, top: 79 },
  { key: 'A', text: 'Alto', start: 55, top: 72 },
  { key: 'T', text: 'Tenor', start: 48, top: 66 },
  { key: 'B', text: 'Bass', start: 43, top: 62 },
];

const ROUTINE: { min: number; text: string; ex?: string }[] = [
  { min: 1, text: 'ยืดคอและไหล่ ปรับท่ายืนให้สมดุล (ไม่ต้องใช้เสียง)' },
  { min: 1, text: 'หายใจเข้าทางจมูก ออกทางปาก ตรวจว่าทั้งสองช่วงเงียบ' },
  { min: 2, text: 'SOVT: หลอดหรือ [v] เลื่อนช่วง Major 3rd', ex: 'straw' },
  { min: 2, text: 'ทำงานกับสระเป็นคู่ [i] ไป [e], [e] ไป [a], [a] ไป [o], [o] ไป [u]', ex: 'iu' },
  { min: 2, text: 'ห้าโน้ตขึ้นลงบนสระ Cardinal', ex: 'vowel-fifth' },
  { min: 2, text: 'ลงห้าโน้ตจาก [i] ไป [a]', ex: 'desc-ia' },
  { min: 2, text: 'Arpeggio Legato บน [o]', ex: 'arp-o' },
  { min: 2, text: 'Mamamia', ex: 'mamamia' },
  { min: 2, text: 'ร้องเบา ๆ เพื่อผ่อนเสียงลง ราวสองนาที (Cool-down)' },
];

interface Sched {
  t0: number;
  t1: number;
  from: number;
  to: number;
  syl: string;
  rest: boolean;
  rep: number;
}

export default function WarmupPlayer({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [exKey, setExKey] = useState('straw');
  const [partKey, setPartKey] = useState('T');
  const [bpm, setBpm] = useState(80);
  const [reps, setReps] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState<Sched | null>(null);
  const ctxStart = useRef(0);
  const nodes = useRef<{ stop: () => void }[]>([]);
  const raf = useRef(0);

  const exBase = EX.find((e) => e.key === exKey)!;
  const ex = lang === 'en' ? { ...exBase, ...EX_EN[exKey] } : exBase;
  const sylOf = (s: string) => (lang === 'en' && s === 'หลอด' ? 'straw' : s);
  const part = PARTS.find((p) => p.key === partKey)!;
  const spb = 60 / bpm;

  const { sched, usedReps, capped } = useMemo(() => {
    const maxAt = Math.max(...ex.events.map((e) => Math.max(e.at, e.to ?? e.at)));
    // a descending ladder starts higher and goes down; the others start from the start note of the voice part
    const startNote = ex.step < 0 ? part.start + 7 : part.start;
    const step = ex.step;
    let n = reps;
    if (step > 0) n = Math.min(n, Math.floor((part.top - maxAt - startNote) / step) + 1);
    if (step < 0) n = Math.min(n, 8);
    if (step === 0) n = Math.min(n, 2);
    n = Math.max(1, n);
    const list: Sched[] = [];
    let t = 0;
    const order: number[] = [];
    for (let i = 0; i < n; i++) order.push(i);
    if (step > 0 && n > 2) for (let i = n - 2; i >= 0; i--) order.push(i); // up and back down
    order.forEach((k, rep) => {
      const tr = startNote + k * step;
      for (const e of ex.events) {
        const dur = e.beats * spb;
        list.push({ t0: t, t1: t + dur, from: tr + e.at, to: tr + (e.to ?? e.at), syl: ex.key === 'vowel-fifth' && e.syl === 'i' ? ['i', 'e', 'ɑ', 'o', 'u'][k % 5] : e.syl, rest: !!e.rest, rep });
        t += dur;
      }
    });
    return { sched: list, usedReps: order.length, capped: step > 0 && Math.floor((part.top - maxAt - startNote) / step) + 1 < reps };
  }, [ex, part, reps, spb]);

  const total = sched.length ? sched[sched.length - 1].t1 : 0;

  const stop = () => {
    nodes.current.forEach((n) => n.stop());
    nodes.current = [];
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setCur(null);
  };
  useEffect(() => () => stop(), []);
  useEffect(() => {
    stop();
  }, [exKey, partKey, bpm, reps]);

  const play = () => {
    const c = audio();
    if (!c) return;
    stop();
    const t0 = c.currentTime + 0.15;
    ctxStart.current = t0;
    const out = c.createGain();
    out.gain.value = 0.22;
    out.connect(c.destination);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.connect(out);
    for (const s of sched) {
      if (s.rest) continue;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      const a = t0 + s.t0;
      const b = t0 + s.t1;
      o.frequency.setValueAtTime(midiToHz(s.from), a);
      if (s.to !== s.from) o.frequency.linearRampToValueAtTime(midiToHz(s.to), b - 0.02);
      const peak = ex.key === 'swell' ? 0.8 : 1;
      g.gain.setValueAtTime(0.0001, a);
      g.gain.exponentialRampToValueAtTime(peak, a + 0.03);
      g.gain.setValueAtTime(peak, Math.max(a + 0.03, b - 0.06));
      g.gain.exponentialRampToValueAtTime(0.0001, b - 0.005);
      o.connect(g);
      g.connect(lp);
      o.start(a);
      o.stop(b + 0.02);
    }
    nodes.current = [{ stop: () => { try { out.gain.setTargetAtTime(0, c.currentTime, 0.02); setTimeout(() => out.disconnect(), 150); } catch { /* done */ } } }];
    setPlaying(true);
    const loop = () => {
      const t = c.currentTime - t0;
      if (t > total + 0.1) {
        setPlaying(false);
        setCur(null);
        return;
      }
      setCur(sched.find((s) => t >= s.t0 && t < s.t1) ?? null);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  // piano roll of the first repetition
  const first = sched.filter((s) => s.rep === 0);
  const lo = Math.min(...first.map((s) => Math.min(s.from, s.to)));
  const hi = Math.max(...first.map((s) => Math.max(s.from, s.to)));
  const dur0 = first.length ? first[first.length - 1].t1 : 1;
  const W = 520;
  const H = 130;
  const rx = (t: number) => 20 + (t / dur0) * (W - 40);
  const ry = (m: number) => 14 + (1 - (m - (lo - 1)) / (hi - lo + 2)) * (H - 28);
  const t = playing && cur ? cur : null;
  const inFirst = t && t.rep === 0 ? t : null;
  const playT = inFirst ? inFirst.t0 : null;

  const groups = [...new Set(EX.map((e) => e.group))];

  return (
    <figure className="viz">
      <div className="viz-title">{L('Warm-up ที่เล่นโน้ตนำให้', 'A warm-up that plays the guide notes')}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {groups.map((g) => (
          <Pills<string> key={g} label={lang === 'en' ? GROUP_EN[g] : g} value={exKey} onChange={setExKey} options={EX.filter((e) => e.group === g).map((e) => ({ value: e.key, text: lang === 'en' ? EX_EN[e.key].name : e.name }))} />
        ))}
        <Pills<string> label={L('ส่วนร้อง', 'Voice part')} value={partKey} onChange={setPartKey} options={PARTS.map((p) => ({ value: p.key, text: p.text }))} />
        <Slider label={L('ความเร็ว', 'Speed')} value={bpm} min={50} max={140} step={5} unit=" bpm" onChange={setBpm} />
        <Slider label={L('จำนวนรอบขึ้น', 'Number of rounds up')} value={reps} min={1} max={10} onChange={setReps} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{ex.name}{ex.sovt ? ' (SOVT)' : ''}</strong>
        <span style={{ display: 'block' }}><b style={{ color: 'var(--fg)' }}>{L('เพื่ออะไร', 'What it is for')}</b> {ex.goal}</span>
        <span style={{ display: 'block', marginTop: 4 }}><b style={{ color: 'var(--fg)' }}>{L('ทำอย่างไร', 'How to do it')}</b> {ex.how}</span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 13 }}>{ex.source}</span>
      </div>
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('แผนภาพโน้ตของรอบแรกของแบบฝึก', 'A diagram of the notes of the first round of the exercise')} style={{ width: '100%', minWidth: 0 }}>
          {first.filter((s) => !s.rest).map((s, i) => (
            <g key={i}>
              {s.from === s.to ? (
                <rect x={rx(s.t0) + 1} y={ry(s.from) - 6} width={Math.max(3, rx(s.t1) - rx(s.t0) - 2)} height="12" rx="6" fill={playT === s.t0 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 40%, var(--surface))'} />
              ) : (
                <line x1={rx(s.t0) + 3} x2={rx(s.t1) - 3} y1={ry(s.from)} y2={ry(s.to)} stroke={playT === s.t0 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, var(--surface))'} strokeWidth="9" strokeLinecap="round" />
              )}
              {s.syl && <text className="s" x={(rx(s.t0) + rx(s.t1)) / 2} y={ry(Math.min(s.from, s.to)) + 20} textAnchor="middle">{sylOf(s.syl)}</text>}
            </g>
          ))}
          <text className="s" x="20" y="10">{L('โน้ตเริ่มต้น', 'Starting note')} {noteName(first[0]?.from ?? part.start)} {L('(รอบแรกเท่านั้น)', '(first round only)')}</text>
        </svg>
      </div>
      <div className="viz-controls">
        <button type="button" className="btn sm primary" onClick={playing ? stop : play}>{playing ? L('หยุด', 'Stop') : L('เล่นโน้ตนำ', 'Play the guide notes')}</button>
        <span className="gx-detail">
          {L(`${usedReps} รอบ รวมประมาณ ${Math.round(total)} วินาที`, `${usedReps} rounds, about ${Math.round(total)} seconds in all`)}{capped ? L(` (จำกัดไว้ไม่เกินโน้ตสบายบนของ ${part.text} คือ ${noteName(part.top)})`, ` (limited to the top comfortable note of ${part.text}, which is ${noteName(part.top)})`) : ''}
          {cur && !cur.rest ? L(` | ตอนนี้ ${noteName(cur.from)}${cur.syl ? ` "${cur.syl}"` : ''} รอบที่ ${cur.rep + 1}`, ` | Now ${noteName(cur.from)}${cur.syl ? ` "${sylOf(cur.syl)}"` : ''} round ${cur.rep + 1}`) : ''}
        </span>
      </div>
      <div className="viz-now">
        <strong>{L('ลำดับ Warm-up ราว 12 ถึง 15 นาที (Sample sequence one)', 'Warm-up sequence of about 12 to 15 minutes (Sample sequence one)')}</strong>
        <ol style={{ margin: '6px 0 0', paddingLeft: 20, color: 'var(--muted)', fontSize: 15 }}>
          {ROUTINE.map((r, i) => (
            <li key={i}>
              {r.ex ? <button type="button" onClick={() => setExKey(r.ex!)} style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', color: 'var(--fg)' }}>{lang === 'en' ? ROUTINE_EN[i] : r.text}</button> : lang === 'en' ? ROUTINE_EN[i] : r.text} ({r.min} {L('นาที', r.min === 1 ? 'minute' : 'minutes')})
            </li>
          ))}
        </ol>
      </div>
      <p className="viz-caption">{L('โน้ตนำเป็นเสียงสังเคราะห์ธรรมดา ให้ร้องตามที่ระดับสบายโดยไม่ฝืน ถ้าเสียงเหนื่อยหรือเจ็บ ก็ให้หยุด ส่วนลำดับ Warm-up นี้ย่อมาจากตัวอย่างในหนังสือ และไม่ได้เป็นโปรแกรมที่ผ่านการทดสอบกับผู้ใช้นะ', 'The guide notes are plain synthesized sound. Sing along at a comfortable level without forcing. If your voice gets tired or hurts, stop. The warm-up sequence is shortened from an example in the book and is not a program that was tested with users.')}</p>
    </figure>
  );
}
